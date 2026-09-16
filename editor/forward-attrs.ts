import { node_observe_attribute, o, type Renderable } from "elt"

/**
 * Apply schema-facing attrs onto a mounted control. Skips factory-only option
 * keys (see ADR 0001). Supports plain values and observables (`o.RO`).
 */
export function $forward_attrs(attrs: Record<string, unknown>, skip: ReadonlySet<string>): Renderable {
  return (node) => {
    const el = node as Element
    for (const [name, value] of Object.entries(attrs)) {
      if (skip.has(name) || value === undefined) continue
      if (o.is_observable(value)) {
        node_observe_attribute(el, name, value as o.RO<string | boolean | null | undefined | number>)
        continue
      }
      if (value === true) {
        el.setAttribute(name, "")
        continue
      }
      if (value === false || value == null) {
        el.removeAttribute(name)
        continue
      }
      if (typeof value === "object") continue
      // Prefer IDL properties where they exist (min/max/step on inputs, etc.).
      if (name in el) {
        try {
          ;(el as unknown as Record<string, unknown>)[name] = value
          continue
        } catch {
          /* fall through to setAttribute */
        }
      }
      el.setAttribute(name, String(value))
    }
  }
}

export function skip_keys(...keys: string[]): ReadonlySet<string> {
  return new Set(keys)
}
