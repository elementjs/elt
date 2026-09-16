/** Shared list/set/map structural edit helpers (Layer 3). */

export function resolve_item_default(spec: unknown | (() => unknown) | undefined): unknown {
  if (typeof spec === "function") return (spec as () => unknown)()
  if (spec !== undefined) return spec
  return null
}

export function allows_insert(opts: { allow_insert?: boolean }): boolean {
  return opts.allow_insert !== false
}

export function allows_delete(opts: { allow_delete?: boolean }): boolean {
  return opts.allow_delete !== false
}

export function insert_array_at(o_arr: import("elt").o.Observable<unknown>, index: number, value: unknown) {
  const arr = o_arr.get()
  if (!Array.isArray(arr)) return
  const next = arr.slice()
  next.splice(index, 0, value)
  o_arr.set(next)
}

export function remove_array_at(o_arr: import("elt").o.Observable<unknown>, index: number) {
  const arr = o_arr.get()
  if (!Array.isArray(arr) || index < 0 || index >= arr.length) return
  const next = arr.slice()
  next.splice(index, 1)
  o_arr.set(next)
}

export function append_set_member(o_set: import("elt").o.Observable<unknown>, value: unknown): boolean {
  const s = o_set.get()
  if (!(s instanceof Set)) return false
  if (s.has(value)) return false
  o_set.set(new Set([...s, value]))
  return true
}

export function remove_set_member(o_set: import("elt").o.Observable<unknown>, member: unknown) {
  const s = o_set.get()
  if (!(s instanceof Set) || !s.has(member)) return
  const next = new Set(s)
  next.delete(member)
  o_set.set(next)
}

export function insert_map_entry(
  o_map: import("elt").o.Observable<unknown>,
  key: unknown,
  value: unknown,
): boolean {
  const m = o_map.get()
  if (!(m instanceof Map)) return false
  if (m.has(key)) return false
  const next = new Map(m)
  next.set(key, value)
  o_map.set(next)
  return true
}

export function remove_map_entry(o_map: import("elt").o.Observable<unknown>, key: unknown) {
  const m = o_map.get()
  if (!(m instanceof Map) || !m.has(key)) return
  const next = new Map(m)
  next.delete(key)
  o_map.set(next)
}

/** Table column keys — manual list wins, else first-row keys (Layer 3 Table). */
export function table_column_keys(
  arr: unknown[],
  manual?: readonly string[],
): string[] {
  if (manual?.length) return [...manual]
  const first = arr[0]
  if (typeof first === "object" && first !== null && !Array.isArray(first)) {
    return Object.keys(first as object)
  }
  return []
}

/** True when any row owns a key outside the visible column set (Layer 3 warning). */
export function table_has_extra_keys(arr: unknown[], columns: string[]): boolean {
  if (columns.length === 0) return false
  const col_set = new Set(columns)
  return arr.some((row) => {
    if (typeof row !== "object" || row === null || Array.isArray(row)) return false
    return Object.keys(row as object).some((k) => !col_set.has(k))
  })
}
