import type { o } from "elt"
import type { Factory } from "./schema"

/**
 * The edited value, as the editor handles it: a value of any type. The editor builds values the caller's
 * type knows nothing about (a new key, a changed type), so a write goes back to the caller's observable
 * only once the schema has accepted the value; reads are the caller's value as it is.
 */
export function untyped_root<T>(o_model: o.Observable<T>, schema: Factory<unknown>): o.Observable<unknown> {
  return o_model.tf<unknown>({
    transform: (value) => value,
    revert: (value) => {
      if (!schema.canHandle(value)) throw new Error("object editor: the schema does not accept this value")
      // The schema accepted it, which is all the editor can know about the caller's type.
      return value as T
    },
  })
}
