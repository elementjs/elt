/*
Safe-child observables and INVALID_MOUNT (Layer 1b). Every derived child the
editor mounts should read through these helpers so deleted slots, wrong parent
kinds, and stale Map/Set rows surface INVALID_MOUNT instead of throwing.
*/

import { o } from "elt"

/** Slot no longer exists on the parent — distinct from o.NoValue. */
export const INVALID_MOUNT: unique symbol = Symbol("object-editor:invalid-mount")

export function is_valid_mount(value: unknown): value is Exclude<unknown, typeof INVALID_MOUNT> {
  return value !== INVALID_MOUNT
}

/** Object property child — invalid when the key is gone or the parent is not a plain object. */
export function safe_object_child(o_parent: o.Observable<unknown>, key: string): o.Observable<unknown> {
  return o.expression(
    (get) => {
      const parent = get(o_parent)
      if (typeof parent !== "object" || parent === null || Array.isArray(parent)) return INVALID_MOUNT
      if (!Object.hasOwn(parent as object, key)) return INVALID_MOUNT
      return (parent as Record<string, unknown>)[key]
    },
    (value, set) => {
      if (value === INVALID_MOUNT) return
      const parent = o_parent.get()
      if (typeof parent !== "object" || parent === null || Array.isArray(parent)) return
      if (!Object.hasOwn(parent as object, key)) return
      set(o_parent, { ...(parent as Record<string, unknown>), [key]: value })
    },
  )
}

/** Array element at a fixed index — invalid when the index falls off the array. */
export function safe_array_index(o_arr: o.Observable<unknown>, index: number): o.Observable<unknown> {
  return o.expression(
    (get) => {
      const arr = get(o_arr)
      if (!Array.isArray(arr) || index < 0 || index >= arr.length) return INVALID_MOUNT
      return arr[index]
    },
    (value, set) => {
      if (value === INVALID_MOUNT) return
      const arr = o_arr.get()
      if (!Array.isArray(arr) || index < 0 || index >= arr.length) return
      const next = arr.slice()
      next[index] = value
      set(o_arr, next)
    },
  )
}

/** Map entry value for a row keyed by its Map key at mount time. */
export function safe_map_value(o_map: o.Observable<unknown>, entry_key: unknown): o.Observable<unknown> {
  return o.expression(
    (get) => {
      const m = get(o_map)
      if (!(m instanceof Map)) return INVALID_MOUNT
      if (!m.has(entry_key)) return INVALID_MOUNT
      return m.get(entry_key)
    },
    (value, set) => {
      if (value === INVALID_MOUNT) return
      const m = o_map.get()
      if (!(m instanceof Map) || !m.has(entry_key)) return
      const next = new Map(m)
      next.set(entry_key, value)
      set(o_map, next)
    },
  )
}

/** Map entry key — renames the entry when the key value changes. */
export function safe_map_key(o_map: o.Observable<unknown>, entry_key: unknown): o.Observable<unknown> {
  return o.expression(
    (get) => {
      const m = get(o_map)
      if (!(m instanceof Map)) return INVALID_MOUNT
      if (!m.has(entry_key)) return INVALID_MOUNT
      return entry_key
    },
    (next_key, set) => {
      if (next_key === INVALID_MOUNT) return
      const m = o_map.get()
      if (!(m instanceof Map) || !m.has(entry_key)) return
      if (m.has(next_key) && next_key !== entry_key) return
      const val = m.get(entry_key)
      const next = new Map(m)
      next.delete(entry_key)
      next.set(next_key, val)
      set(o_map, next)
    },
  )
}

/** Set member row — identity is the member value present when the row was mounted. */
export function safe_set_member(o_set: o.Observable<unknown>, member: unknown): o.Observable<unknown> {
  return o.expression(
    (get) => {
      const s = get(o_set)
      if (!(s instanceof Set)) return INVALID_MOUNT
      if (!s.has(member)) return INVALID_MOUNT
      return member
    },
    (value, set) => {
      if (value === INVALID_MOUNT) return
      const s = o_set.get()
      if (!(s instanceof Set) || !s.has(member)) return
      const next = new Set(s)
      next.delete(member)
      next.add(value)
      set(o_set, next)
    },
  )
}

/** Table cell — row object must exist; missing column key reads as undefined, not INVALID_MOUNT. */
export function safe_table_cell(
  o_arr: o.Observable<unknown>,
  row_index: number,
  col_key: string,
): o.Observable<unknown> {
  return o.expression(
    (get) => {
      const arr = get(o_arr)
      if (!Array.isArray(arr) || row_index < 0 || row_index >= arr.length) return INVALID_MOUNT
      const row = arr[row_index]
      if (typeof row !== "object" || row === null || Array.isArray(row)) return INVALID_MOUNT
      if (!Object.hasOwn(row as object, col_key)) return undefined
      return (row as Record<string, unknown>)[col_key]
    },
    (value, set) => {
      if (value === INVALID_MOUNT) return
      const arr = o_arr.get()
      if (!Array.isArray(arr) || row_index < 0 || row_index >= arr.length) return
      const row = arr[row_index]
      if (typeof row !== "object" || row === null || Array.isArray(row)) return
      set(o_arr, [
        ...arr.slice(0, row_index),
        { ...(row as Record<string, unknown>), [col_key]: value },
        ...arr.slice(row_index + 1),
      ])
    },
  )
}
