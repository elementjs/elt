import { o } from "./observable"
import { create } from "mutative"

declare module "./observable" {
  namespace o {
    interface Observable<A> {
      /**
       * Mutate the value of the observable using a mutative function.
       */
      mutate(mutator: (value: A) => void): void
    }
  }
}

/**
 *
 */
o.Observable.prototype.mutate = function <A>(mutator: (value: A) => any) {
  const new_value = create(this._value, mutator)
  if (new_value !== o.NoValue) {
    this.set(new_value)
  }
}
