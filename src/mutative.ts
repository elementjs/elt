import { o } from "./observable"
import { create } from "mutative"

declare module "./observable" {
  namespace o {
    interface IObservable<Get, Set> {
      mutate(mutator: (value: Set) => void | Set | o.NoValue): void
    }
    interface Observable<A> {
      /**
       * Mutate the value of the observable using a mutative function: `mutator` edits a draft, or returns a
       * value that replaces the whole value. If it returns `o.NoValue`, nothing is written.
       */
      mutate(mutator: (value: A) => void | A | o.NoValue): void
    }
  }
}

o.Observable.prototype.mutate = function <A>(mutator: (value: A) => any) {
  // `create` returns what `mutator` returns, if anything: `o.NoValue` cancels the write
  const new_value = create(this._value, mutator)
  if (new_value !== o.NoValue) {
    this.set(new_value)
  }
}
