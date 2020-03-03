import { o } from './observable'

export namespace tf {

  /**
   * @category observable, toc
   */
  export function equals<T, TT extends T>(other: o.RO<TT>) {
    return o.tf(other, oth => (current: T) => current === oth)
  }

  /**
   * @category observable, toc
   */
  export function differs<T, TT extends T>(other: o.RO<TT>) {
    return o.tf(other, oth => (current: T) => current !== oth)
  }

  /**
   * @category observable, toc
   */
  export function is_truthy(val: any) { return !!val }

  /**
   * @category observable, toc
   */
  export function is_falsy(val: any) { return !val }

  /**
   * @category observable, toc
   */
  export function is_value(val: any) { return val != null }

  /**
   * @category observable, toc
   */
  export function is_not_value(val: any) { return val == null }

  /**
   * @category observable, toc
   */
  export function array_transform<T>(fn: o.RO<number[] | ((array: T[]) => number[])>): o.RO<o.Converter<T[], T[]> & {indices: number[]}> {
    return o.tf(fn,
      fn => {
        return {
          indices: [] as number[],
          get(list: T[]) {
            if (Array.isArray(fn))
              this.indices = fn
            else
              this.indices = fn(list)
            return this.indices.map(i => list[i])
          },
          set(newval, _, current) {
            var res = current.slice()
            for (var i = 0, idx = this.indices; i < idx.length; i++) {
              res[idx[i]] = newval[i]
            }
            return res
          }
        }
      })
  }

  /**
   * Filter an array.
   *
   * @param condition The condition the item has to pass to be kept
   * @param stable If false, the array is refiltered for any change in the condition or array.
   *    If true, only refilter if the condition changes, but keep the indices even if the array changes.
   * @category observable, toc
   */
  export function array_filter<T>(condition: o.RO<(item: T, idx: number, lst: T[]) => any>, stable: o.RO<boolean> = false): o.RO<o.Converter<T[], T[]> & {indices: number[]}> {
    return o.virtual(
      o.tuple(condition, stable),
      ([cond, stable]) => {
        return {
          indices: [] as number[],
          get(lst: T[], old_val: T[] | o.NoValue) {
            var indices: number[] = stable && o.isValue(old_val) ? this.indices : []

            // If the filter is stable, then start adding values at the end if the array changed length
            var start = stable && o.isValue(old_val) ? old_val.length : 0

            // this will only run if the old length is smaller than the new length.
            for (var i = start, l = lst.length; i < l; i++) {
              if (cond(lst[i], i, lst))
                indices.push(i)
            }

            // if the array lost elements, then we have to remove those indices that are no longer relevant.
            // fortunately, this.indices is sorted and we just have to go back from the beginning.
            if (start > lst.length) {
              for (i = indices.length - 1; indices[i] >= lst.length && i >= 0; i--) { }
              indices = i < 0 ? [] : indices.slice(0, i + 1)
            }

            this.indices = indices
            return indices.map(i => lst[i]) as T[]
          },
          set(newval, _, current) {
            var res = current.slice()
            for (var i = 0, idx = this.indices; i < idx.length; i++) {
              res[idx[i]] = newval[i]
            }
            return res
          }
        }
    })
  }

  /**
   * Transforms an array by sorting it. The sort function must return 0 in case of equality.
   * @param sortfn
   * @category observable, toc
   */
  export function sort<T>(sortfn: o.RO<(a: T, b: T) => 1 | 0 | -1>): o.RO<o.Converter<T[], T[]>> {
    return array_transform(o.tf(sortfn, sortfn => (lst: T[]) => {
      var res: number[] = new Array(lst.length)
      for (var i = 0, l = lst.length; i < l; i++)
        res[i] = i
      res.sort((a, b) => sortfn(lst[a], lst[b]))
      return res
    }))
  }

  /**
   * Sort an array by extractors, given in order of importance.
   * @param sorters
   * @category observable, toc
   */
  export function sort_by<T>(sorters: o.RO<([(a: T) => any, 'desc' | 'asc'] | ((a: T) => any))[]>): o.RO<o.Converter<T[], T[]>> {
    return sort(o.tf(sorters,
      _sorters => {
        var sorters: ((a: T) => any)[] = []
        var mult = [] as (1 | -1)[]
        for (var i = 0, l = _sorters.length; i < l; i++) {
          var srt = _sorters[i]

          if (Array.isArray(srt)) {
            mult.push(srt[1] === 'desc' ? -1 : 1)
            sorters.push(srt[0])
          } else {
            mult.push(1)
            sorters.push(srt)
          }
        }

        return (a: T, b: T): 1 | 0 | -1 => {
          for (var i = 0, l = sorters.length; i < l; i++) {
            var _a = sorters[i](a)
            var _b = sorters[i](b)
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
   * @category observable, toc
   */
  export function group_by<T, R>(extractor: o.RO<(a: T) => R>): o.RO<o.Converter<T[], [R, T[]][]> & {indices: number[][], length: number}> {
    return o.tf(extractor, extractor => {
      return {
        length: 0 as number,
        indices: [] as number[][],
        get(lst: T[]) {
          this.length = lst.length
          var m = new Map<R, number[]>()
          for (var i = 0, l = lst.length; i < l; i++) {
            var item = lst[i]
            var ex = extractor(item)
            var ls = m.get(ex) ?? m.set(ex, []).get(ex)!
            ls.push(i)
          }

          var res = [] as [R, T[]][]
          var indices = [] as number[][]
          for (var entry of m.entries()) {
            var ind = entry[1]
            var newl = new Array(ind.length) as T[]
            indices.push(ind)
            for (var i = 0, l = ind.length; i < l; i++) {
              newl[i] = lst[ind[i]]
            }
            res.push([entry[0], newl])
          }
          return res
        },
        set(nval) {
          var res = new Array(this.length) as T[]
          var ind = this.indices
          for (var i = 0, li = ind.length; i < li; i++) {
            var line = ind[i]
            for (var j = 0, lj = line.length; j < lj; j++) {
              var nval_line = nval[i][1]
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
   * @category observable, toc
   */
  export function entries<T extends object, K extends keyof T>(): o.Converter<T, [K, T[K]][]> {
    return {
      get(item: T) {
        var res = [] as [K, T[K]][]
        var keys = Object.keys(item) as K[]
        for (var i = 0, l = keys.length; i < l; i++) {
          var k = keys[i] as K
          res.push([k, item[k]])
        }
        return res
      },
      set(nval) {
        var nres = {} as T
        for (var i = 0, l = nval.length; i < l; i++) {
          var entry = nval[i]
          nres[entry[0]] = entry[1]
        }
        return nres
      }
    }
  }

  /**
   * Object entries, as returned by Object.keys() and returned as an array of [key, value][]
   * @category observable, toc
   */
  export function map_entries<K, V>(): o.Converter<Map<K, V>, [K, V][]> {
    return {
      get(item: Map<K, V>) {
        return [...item.entries()]
      },
      set(nval) {
        var nres = new Map<K, V>()
        for (var i = 0, l = nval.length; i < l; i++) {
          var entry = nval[i]
          nres.set(entry[0], entry[1])
        }
        return nres
      }
    }
  }

  /**
   *
   * @param values The values that should be in the set.
   * @category observable, toc
   */
  export function set_has<T>(...values: o.RO<T>[]): o.RO<o.Converter<Set<T>, boolean>> {
    return o.virtual(values, (values) => {
      return {
        get(set) {
          for (var i = 0; i < values.length; i++) {
            var item = values[i]
            if (!set.has(item))
              return false
          }
          return true
        },
        set(newv, _, set) {
          const res = new Set(set)
          for (var i = 0; i < values.length; i++) {
            var item = values[i]
            if (newv) res.add(item)
            else res.delete(item)
          }
          return res
        }
      } as o.Converter<Set<T>, boolean>

    })
  }
}
