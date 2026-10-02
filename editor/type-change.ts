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

/**
 * The type changes offered for `value`, rendered by `current`: one per target kind other than the
 * value's own — a conversion when the target can convert the value, else a reset to the target's
 * default ("number (reset)"). `targets` is what the value's slot accepts (`slot_type_targets` in
 * schema.tsx); by default the unknown-mode catalog. `options.conversions` narrows it further.
 */
export function type_change_actions(
  current: Factory<unknown>,
  value: unknown,
  options: CommonNodeOptions,
  targets: Factory<unknown>[] = catalog(),
): TypeChangeAction[] {
  const seen = new Set<string>()
  const conversions = options.conversions
  const actions: TypeChangeAction[] = []
  for (const target of targets) {
    if (target.kind === current.kind && current.canHandle(value)) continue
    if (seen.has(target.kind)) continue
    seen.add(target.kind)
    if (conversions?.length && !conversions.includes(target.kind)) continue
    actions.push(
      target.canConvert(value)
        ? { target, mode: "convert", label: target.kind }
        : { target, mode: "default", label: `${target.kind} (reset)` },
    )
  }
  return actions
}

/** The unknown-mode catalog: the type-change targets of a value no schema constrains. */
export function unknown_type_targets(): Factory<unknown>[] {
  return catalog()
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
