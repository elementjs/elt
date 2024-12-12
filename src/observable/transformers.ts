import { o } from "./observable"


/**
 * Transforms to a boolean observable that switches to `true` when
 * the original `observable` has the same value than `other`.
 *
 * `other` may be itself an observable.
 *
 * ```tsx
 * [[include:../../examples/tf.equals.tsx]]
 * ```
 * @group Transformer
 */
export function tf_equals<T, TT extends T = T, TT2 extends T = T>(other: o.RO<TT>): o.RO<o.ReadonlyConverter<T, boolean>>
export function tf_equals<T, TT extends T = T, TT2 extends T = T>(other: o.RO<TT>, prev: o.RO<TT2>): o.RO<o.Converter<T, boolean>>
export function tf_equals<T, TT extends T = T, TT2 extends T = T>(other: o.RO<TT>, prev?: o.RO<TT2>): o.RO<o.Converter<T, boolean>> {

  if (arguments.length === 1) {
    return o.tf(other, oth => ({
      transform(cur: T) { return cur === oth }
    })) as unknown as o.RO<o.Converter<T, boolean>>
  }

  return o.join(other as TT, prev as o.Observable<TT2>)
    .tf(([oth, pr]) => ({
      transform(current: T) {
        return current === oth
      },
      revert(boo: boolean) {
        return boo ? oth as T : pr as T
      }
    }))

}

/**
 * Does the opposite of {@link tf.equals}
 * @group Transformer
 */
export function tf_differs<T, TT extends T>(other: o.RO<TT>) {
  return o.tf(other, oth => (current: T) => current !== oth)
}

export interface IndexConverter<T> extends o.Converter<T[], T[]> {
  indices: number[]
}

/**
 * Transform an observable of array into another array based on either
 * an array of numbers (which are indices) or a function that takes the
 * array and returns indices.
 *
 * The indices/index function can be itself an observable.
 *
 * The resulting observable can have set() called on it.
 *
 * This is the basis of {@link tf.filter} and {@link tf.array_sort}
 * @group Transformer
 */
export function tf_array_transform<T>(fn: o.RO<number[] | ((array: T[]) => number[])>): o.RO<IndexConverter<T>> {
  return o.tf(fn,
    fn => {
      const res: IndexConverter<T> = {
        indices: [] as number[],
        transform(list: T[]) {
          if (Array.isArray(fn))
            this.indices = fn
          else
            this.indices = fn(list)
          return this.indices.map(i => list[i])
        },
        revert(newval, _, current) {
          const res = current.slice()
          for (let i = 0, idx = this.indices; i < idx.length; i++) {
            res[idx[i]] = newval[i]
          }
          return res
        }
      }
      return res
    })
}

/**
 * Filter an array.
 *
 * @param condition The condition the item has to pass to be kept
 * @param stable If false, the array is refiltered for any change in the condition or array.
 *    If true, only refilter if the condition changes, but keep the indices even if the array changes.
 * @group Transformer
 */
export function tf_array_filter<T>(condition: o.RO<(item: T, idx: number, lst: T[]) => any>, stable: o.RO<boolean> = false): o.RO<IndexConverter<T>> {
  return o.combine(
    [condition, stable] as const,
    ([cond, stable]) => {
      const res: IndexConverter<T> = {
        indices: [] as number[],
        transform(lst: T[], old_val: T[] | o.NoValue) {
          let indices: number[] = stable && old_val !== o.NoValue ? this.indices : []

          // If the filter is stable, then start adding values at the end if the array changed length
          const start = stable && old_val !== o.NoValue ? old_val.length : 0

          // this will only run if the old length is smaller than the new length.
          let i = 0, l = 0
          for (i = start, l = lst.length; i < l; i++) {
            if (cond(lst[i], i, lst))
              indices.push(i)
          }

          // if the array lost elements, then we have to remove those indices that are no longer relevant.
          // fortunately, this.indices is sorted and we just have to go back from the beginning.
          if (start > lst.length) {
            // eslint-disable-next-line no-empty
            for (i = indices.length - 1; indices[i] >= lst.length && i >= 0; i--) { }
            indices = i < 0 ? [] : indices.slice(0, i + 1)
          }

          this.indices = indices
          return indices.map(i => lst[i]) as T[]
        },
        revert(newval, _, current) {
          const res = current.slice()
          for (let i = 0, idx = this.indices; i < idx.length; i++) {
            res[idx[i]] = newval[i]
          }
          return res
        }
      }
      return res
    })
}

/**
 * Transforms an array by sorting it. The sort function must return 0 in case of equality.
 * @param sortfn
 * @group Transformer
 */
export function tf_array_sort<T>(sortfn: o.RO<(a: T, b: T) => 1 | 0 | -1>): o.RO<o.Converter<T[], T[]>> {
  return tf_array_transform(o.tf(sortfn, sortfn => (lst: T[]) => {
    const res: number[] = new Array(lst.length)
    for (let i = 0, l = lst.length; i < l; i++)
      res[i] = i
    res.sort((a, b) => sortfn(lst[a], lst[b]))
    return res
  }))
}

/**
 * Sort an array by extractors, given in order of importance.
 * To sort in descending order, make a tuple with 'desc' as the second argument.
 *
 * ```tsx
 * [[include:../../examples/tf.array_sort_by.tsx]]
 * ```
 * @group Transformer
 */
export function tf_array_sort_by<T>(sorters: o.RO<([(a: T) => any, "desc" | "asc"] | ((a: T) => any))[]>): o.RO<o.Converter<T[], T[]>> {
  return tf_array_sort(o.tf(sorters,
    _sorters => {
      const sorters: ((a: T) => any)[] = []
      const mult = [] as (1 | -1)[]
      for (let i = 0, l = _sorters.length; i < l; i++) {
        const srt = _sorters[i]

        if (Array.isArray(srt)) {
          mult.push(srt[1] === "desc" ? -1 : 1)
          sorters.push(srt[0])
        } else {
          mult.push(1)
          sorters.push(srt)
        }
      }

      return (a: T, b: T): 1 | 0 | -1 => {
        for (let i = 0, l = sorters.length; i < l; i++) {
          const _a = sorters[i](a)
          const _b = sorters[i](b)
          if (_a < _b) return -1 * mult[i] as 1 | -1
          if (_a > _b) return 1 * mult[i] as 1 | -1
        }
        return 0
      }
    }
  ))
}

/**
 * Group by an extractor function.
 * @group Transformer
 */
export function tf_array_group_by<T, R>(extractor: o.RO<(a: T) => R>): o.RO<o.Converter<T[], [R, T[]][]> & {indices: number[][], length: number}> {
  return o.tf(extractor, extractor => {
    return {
      length: 0 as number,
      indices: [] as number[][],
      transform(lst: T[]) {
        this.length = lst.length
        const m = new Map<R, number[]>()
        for (let i = 0, l = lst.length; i < l; i++) {
          const item = lst[i]
          const ex = extractor(item)
          const ls = m.get(ex) ?? m.set(ex, []).get(ex)!
          ls.push(i)
        }

        const res = [] as [R, T[]][]
        const indices = [] as number[][]
        for (const entry of m.entries()) {
          const ind = entry[1]
          const newl = new Array(ind.length) as T[]
          indices.push(ind)
          for (let i = 0, l = ind.length; i < l; i++) {
            newl[i] = lst[ind[i]]
          }
          res.push([entry[0], newl])
        }
        return res
      },
      revert(nval) {
        const res = new Array(this.length) as T[]
        const ind = this.indices
        for (let i = 0, li = ind.length; i < li; i++) {
          const line = ind[i]
          for (let j = 0, lj = line.length; j < lj; j++) {
            const nval_line = nval[i][1]
            res[line[j]] = nval_line[j]
          }
        }
        return res
      }
    }
  })
}

/**
 * Object entries, as returned by Object.keys() and returned as an array of [key, value][]
 * @group Transformer
 */
export function tf_entries<T extends object>(): o.Converter<T, [keyof T, T[keyof T]][]> {
  return {
    transform(item: T) {
      const res = [] as [keyof T, T[keyof T]][]
      const keys = Object.keys(item) as (keyof T)[]
      for (let i = 0, l = keys.length; i < l; i++) {
        const k = keys[i] as keyof T
        res.push([k, item[k]])
      }
      return res
    },
    revert(nval) {
      const nres = {} as T
      for (let i = 0, l = nval.length; i < l; i++) {
        const entry = nval[i]
        nres[entry[0]] = entry[1]
      }
      return nres
    }
  }
}

/**
 * Object entries, as returned by Object.keys() and returned as an array of [key, value][]
 * @group Transformer
 */
export function tf_map_entries<K, V>(): o.Converter<Map<K, V>, [K, V][]> {
  return {
    transform(item: Map<K, V>) {
      return [...item.entries()]
    },
    revert(nval) {
      const nres = new Map<K, V>()
      for (let i = 0, l = nval.length; i < l; i++) {
        const entry = nval[i]
        nres.set(entry[0], entry[1])
      }
      return nres
    }
  }
}

/**
 * Make a boolean observable out of the presence of given values in the array that is to be observed. If the observable is writable, then setting the tranformed to true will put all the `values` that were not in the array into it.
 * @group Transformer
 */
export function tf_array_has<T>(...values: o.RO<T>[]): o.RO<o.Converter<T[], boolean>> {
  return o.combine(values, values => ({
    transform(arr) {
      for (let i = 0; i < values.length; i++) {
        const item = values[i]
        if (!arr.includes(item)) {
          return false
        }
      }
      return true
    },
    revert(bool, _, cur) {
      if (bool) {
        let add: T[] = []
        for (let i = 0; i < values.length; i++) {
          const item = values[i]
          if (!cur.includes(item) && !add.includes(item)) {
            add.push(item)
          }
        }

        return add.length ? [...cur, ...add] : cur
      }
      return cur.filter(x => !values.includes(x))
    }
  }))
}

/**
 * Make a boolean observable from the presence of given values in a `Set`. If the observable can be written to, then setting the transformed to `true` will put all the values to the `Set`, and setting it to `false` will remove all of them.
 * @group Transformer
 */
export function tf_set_has<T>(...values: o.RO<T>[]): o.RO<o.Converter<Set<T>, boolean>> {
  return o.combine(values, (values) => {
    return {
      transform(set) {
        for (let i = 0; i < values.length; i++) {
          const item = values[i]
          if (!set.has(item))
            return false
        }
        return true
      },
      revert(newv, _, set) {
        const res = new Set(set)
        for (let i = 0; i < values.length; i++) {
          const item = values[i]
          if (newv) res.add(item)
          else res.delete(item)
        }
        return res
      }
    } as o.Converter<Set<T>, boolean>

  })
}

/**
 * Make a boolean observable from the presence of given [key, value] pairs in a `Map`.
 * If the observable can be written to, then setting the transformed to `true` will
 * set all the pairs into the `Map`, and setting it to `false` will remove all of them.
 *
 * @group Transformer
 */
export function tf_map_has<K, V>(...values: o.RO<[K, V]>[]): o.RO<o.Converter<Map<K, V>, boolean>> {
  return o.combine(values, (values) => {
    return {
      transform(map) {
        for (let i = 0; i < values.length; i++) {
          const [key, value] = values[i]
          if (map.get(key) !== value)
            return false
        }
        return true
      },
      revert(newv, _, map) {
        const res = new Map(map)
        for (let i = 0; i < values.length; i++) {
          const item = values[i]
          if (newv) res.set(item[0], item[1])
          else if (res.get(item[0]) === item[1]) res.delete(item[0])
        }
        return res
      }
    } as o.Converter<Map<K, V>, boolean>

  })
}


export type KeysOfType<T, V> = keyof { [ P in keyof T as T[P] extends V ? P : never ] : P }


/**
 *
 * @param extractor
 * @returns
 * @group Transformer
 */
export function tf_array_to_object<T, Key extends string | number | symbol, Extractor extends o.RO<(v: T) => Key>>(extractor: Extractor): o.RO<o.Converter<T[], {[name in Key]: T}>> {
  return o.tf(extractor, extractor => {
    return {
      transform(orig) {
        const res = {} as any
        for (let i = 0, l = orig.length; i < l; i++) {
          const val = orig[i]
          const ex = extractor(val)
          res[ex] = val
        }
        return res
      },
      revert(nval) {
        return [...Object.values(nval)] as T[]
      }
    }
  })
}


/**
 *
 * @param extractor
 * @returns
 * @group Transformer
 */
export function tf_group_by_to_object<T>(extractor: o.RO<keyof T | ((v: T) => string)>): o.RO<o.Converter<T[], {[key: string]: T[]}>> {
  return o.tf(extractor, extractor => {
    const _extractor = typeof extractor === "string" ? (v: T): string => v[extractor as keyof T] as string : extractor as (v: T) => string
    return {
      indices: {} as {[name: string]: number[]},
      transform(orig) {
        const obj: {[username: string]: T[]} = {}
        const indices = this.indices = {} as {[name: string]: number[]}
        for (let i = 0, l = orig.length; i < l; i++) {
          const val = orig[i]
          const ex = _extractor(val)
          obj[ex] ??= []
          indices[ex] ??= []
          obj[ex].push(val)
          indices[ex].push(i)
        }
        return obj
      },
      revert(nval, _, orig) {
        const newarr = orig.slice()
        const keys = Object.getOwnPropertyNames(nval) as (keyof typeof nval)[]
        const indices = this.indices
        for (const k of keys) {
          const _newobjs = nval[k]
          const _indices = indices[k]
          for (let i = 0, l = _newobjs.length; i < l; i++) {
            const orig_idx = _indices?.[i]
            if (orig_idx != null) {
              // If it corresponds to an old index, it is put back the original array
              newarr[orig_idx] = _newobjs[i]
            } else {
              // If the object had no index, it still gets pushed to the original object
              newarr.push(_newobjs[i])
            }
          }
        }
        return newarr
      }
    }
  })
}

/**
 *
 * @param extractor
 * @returns
 * @group Transformer
 */
export function tf_array_to_map<T, V>(extractor: o.RO<(v: T) => V>): o.RO<o.Converter<T[], Map<V, T>>> {
  return o.tf(extractor, extractor => {
    return {
      transform(orig) {
        const mp = new Map<V, T>()
        for (let i = 0, l = orig.length; i < l; i++) {
          const val = orig[i]
          const ex = extractor(val)
          mp.set(ex, val)
        }
        return mp
      },
      revert(nval) {
        return [...nval.values()]
      }
    }
  })
}


/**
 *
 * @param extractor
 * @returns
 * @group Transformer
 */
export function tf_group_by_to_map<T, V>(extractor: o.RO<(v: T) => V>): o.RO<o.Converter<T[], Map<V, T[]>>> {
  return o.tf(extractor, extractor => {
    return {
      indices: {} as Map<V, number[]>,
      transform(orig) {
        const mp = new Map<V, T[]>()
        const indices = this.indices = new Map<V, number[]>()
        for (let i = 0, l = orig.length; i < l; i++) {
          const val = orig[i]
          const ex = extractor(val)
          const _mp_arr = mp.get(ex) ?? []
          if (!mp.has(ex)) mp.set(ex, _mp_arr)
          const _indices_arr = indices.get(ex) ?? []
          if (!indices.has(ex)) indices.set(ex, _indices_arr)
          _mp_arr.push(val)
          _indices_arr.push(i)
        }
        return mp
      },
      revert(nval, _, orig) {
        const newarr = orig.slice()
        const indices = this.indices
        for (const [key, _newobjs] of nval.entries()) {
          const _indices = indices.get(key)
          for (let i = 0, l = _newobjs.length; i < l; i++) {
            const orig_idx = _indices?.[i]
            if (orig_idx != null) {
              // If it corresponds to an old index, it is put back the original array
              newarr[orig_idx] = _newobjs[i]
            } else {
              // If the object had no index, it still gets pushed to the original object
              newarr.push(_newobjs[i])
            }
          }
        }
        return newarr
      }
    }
  })
}
