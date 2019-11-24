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
  export function array_transform<T>(fn: o.RO<(array: T[]) => number[]>): o.RO<o.Converter<T[], T[]>> {
    var indices: number[]
    return o.tf(fn,
      fn => (list: T[]) => {
        return [] as T[]
      },

    )
  }

  /**
   * Filter an array.
   *
   * @param condition The condition the item has to pass to be kept
   * @param stable If false, the array is refiltered for any change in the condition or array.
   *    If true, only refilter if the condition changes, but keep the indices even if the array changes.
   */
  export function array_filter<T>(condition: o.RO<(item: T) => any>, stable: o.RO<boolean> = false): o.RO<o.Converter<T[], T[]>> {

  }

  export function sort<T>(sortfn: o.RO<(a: T, b: T) => 1 | 0 | -1>): o.RO<o.Converter<T[], T[]>> {

  }

  export function sort_by<T>(...sorters: o.RO<(a: T) => any>[]): o.RO<o.Converter<T[], T[]>> {

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