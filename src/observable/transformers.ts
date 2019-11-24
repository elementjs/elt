import { o } from './observable'

export namespace tf {

  export function equals<T, TT extends T>(other: o.RO<TT>) {
    return o.tf(other, oth => (current: T) => current === oth)
  }

  export function differs<T, TT extends T>(other: o.RO<TT>) {
    return o.tf(other, oth => (current: T) => current !== oth)
  }

  export const is_truthy = (val: any) => !!val

  export const is_falsy = (val: any) => !val

  export const is_value = (val: any) => val != null

  export const is_not_value = (val: any) => val == null

  /**
   *
   * @param fn
   */
  export function array_transform<T>(fn: o.RO<number[] | ((array: T[]) => number[])>): o.RO<o.Converter<T[], T[]>> {
    var indices: number[]
    return o.tf(fn,
      fn => {
        return {
          get(list: T[]) {
            if (Array.isArray(fn))
              indices = fn
            else
              indices = fn(list)
            return indices.map(i => list[i])
          },
          set(newval, _, current) {
            var res = current.slice()
            for (var i = 0; i < indices.length; i++) {
              res[indices[i]] = newval[i]
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
   */
  export function array_filter<T>(condition: o.RO<(item: T, idx: number, lst: T[]) => any>, stable: o.RO<boolean> = false): o.RO<o.Converter<T[], T[]>> {
    return array_transform(o.tf(condition, cond => (lst: T[]) => {
      var res: number[] = []
      for (var i = 0, l = lst.length; i < l; i++) {
        if (cond(lst[i], i, lst))
          res.push(i)
      }
      return res
    }))
  }

  /**
   *
   * @param sortfn
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
   *
   * @param sorters
   */
  export function sort_by<T>(sorters: o.RO<((a: T) => any)[]>): o.RO<o.Converter<T[], T[]>> {
    return sort(o.tf(sorters,
      sorters => {
        return (a: T, b: T): 1 | 0 | -1 => {
          for (var i = 0, l = sorters.length; i < l; i++) {
            var _a = sorters[i](a)
            var _b = sorters[i](b)
            if (_a < _b) return -1
            if (_a > _b) return 1
          }
          return 0
        }
      }
    ))
  }

  /**
   *
   * @param values The values that should be in the set.
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