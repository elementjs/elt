import { o } from "elt"
import type { Factory } from "./schema"

/**
 * The edited value, as the editor handles it: a value of any type. The editor builds values the caller's
 * type knows nothing about (a new key, a changed type), so a write goes back to the caller's observable
 * only once the schema has accepted the value; reads are the caller's value as it is. While `readonly`
 * holds, a write leaves the caller's observable as it is.
 *
 * `readonly` set to `true` for good is the only case where the model may be a plain value or a
 * `ReadonlyObservable` (the types of `ObjectEditor` see to it): every write is dropped.
 */
export function untyped_root<T>(model: o.RO<T>, schema: Factory<unknown>, readonly: true): o.Observable<unknown>
export function untyped_root<T>(
  o_model: o.Observable<T>,
  schema: Factory<unknown>,
  readonly?: o.RO<boolean>,
): o.Observable<unknown>
export function untyped_root<T>(
  model: o.RO<T>,
  schema: Factory<unknown>,
  readonly: o.RO<boolean> = false,
): o.Observable<unknown> {
  // Tested on the value, not on the model: an `o.expression` is an `Observable` at runtime, read-only or not.
  if (readonly === true)
    return o.expression<unknown>(
      (get) => get(model),
      () => {},
    )
  const o_writable = model as o.Observable<T>
  return o_writable.tf<unknown>({
    transform: (value) => value,
    revert: (value) => {
      // The model's own value: setting it again changes nothing.
      if (o.get(readonly)) return o_writable.get()
      if (!schema.canHandle(value)) throw new Error("object editor: the schema does not accept this value")
      // The schema accepted it, which is all the editor can know about the caller's type.
      return value as T
    },
  })
}
