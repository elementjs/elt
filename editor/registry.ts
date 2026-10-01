/*
Constructor → factory registry (Layer 5 resolution step 3). Used when drill-in
or re-resolve has no explicit factory from the dispatching widget.
*/

import type { Factory } from "./schema"

/** Any class, abstract or not (`Object`, `Map`, a user class…). */
type Constructor = abstract new (...args: never[]) => unknown

const by_constructor = new Map<Constructor, Factory<unknown>>()

/** Register a default factory for values whose `constructor` matches. */
export function register_constructor(ctor: Constructor, factory: Factory<unknown>) {
  by_constructor.set(ctor, factory)
}

/** Pick a factory from the value's runtime constructor, else `fallback`. */
export function resolve_factory_from_value(value: unknown, fallback: Factory<unknown>): Factory<unknown> {
  if (value === null || value === undefined) return fallback
  if (typeof value !== "object") return fallback
  const ctor = (value as object).constructor
  if (ctor == null) return fallback
  return by_constructor.get(ctor as Constructor) ?? fallback
}
