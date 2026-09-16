import type { o } from "elt"
import type { CommonNodeOptions, Factory } from "./schema"

/** Filled once from `schema.tsx` after `anything` exists — avoids a load-time cycle. */
let unknown_catalog: (() => Factory<unknown>[]) | null = null

export function register_unknown_type_change_catalog(fn: () => Factory<unknown>[]) {
  unknown_catalog = fn
}

function catalog(): Factory<unknown>[] {
  return unknown_catalog?.() ?? []
}

function involves_composite(kind: string): boolean {
  return kind === "object" || kind === "array" || kind === "set" || kind === "map"
}

/** Structural type changes that can drop data — confirm before writing (Layer 1). */
export function type_change_needs_confirm(current: Factory<unknown>, target: Factory<unknown>): boolean {
  return involves_composite(current.kind) || involves_composite(target.kind)
}

export interface TypeChangeAction {
  target: Factory<unknown>
  mode: "convert" | "default"
  label: string
}

export function type_change_actions(
  current: Factory<unknown>,
  value: unknown,
  options: CommonNodeOptions,
  extra: Factory<unknown>[] = [],
): TypeChangeAction[] {
  const seen = new Set<string>()
  const candidates: Factory<unknown>[] = []
  for (const f of [...catalog(), ...extra]) {
    if (f.kind === current.kind && current.canHandle(value)) continue
    if (seen.has(f.kind)) continue
    seen.add(f.kind)
    candidates.push(f)
  }

  let allowed = candidates
  if (options.conversions?.length) {
    allowed = allowed.filter((f) => options.conversions!.includes(f.kind))
  }

  const actions: TypeChangeAction[] = []
  for (const target of allowed) {
    if (target.canConvert(value)) {
      actions.push({ target, mode: "convert", label: `Convert to ${target.kind}` })
    }
    actions.push({ target, mode: "default", label: `Reset to ${target.kind} default` })
  }
  return actions
}

export function apply_type_change(
  o_value: o.Observable<unknown>,
  current: Factory<unknown>,
  action: TypeChangeAction,
): boolean {
  const value = o_value.get()
  if (action.mode === "convert" && !action.target.canConvert(value)) return false

  if (type_change_needs_confirm(current, action.target)) {
    const ok = globalThis.confirm?.(
      `Change type to ${action.target.kind}? Structure that the target cannot represent may be lost.`,
    )
    if (!ok) return false
  }

  const next = action.mode === "convert" ? action.target.convert(value) : action.target.defaultValue()
  o_value.set(next)
  return true
}
