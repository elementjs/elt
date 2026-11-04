import { o } from "./observable"
import { create, rawReturn } from "mutative"

declare module "./observable" {
  namespace o {
    interface IObservable<Get, Set> {
      // The draft is a copy of the current value, so it has the read type `Get`; what the mutator returns (or
      // the edited draft) is written, so it has the write type `Set`.
      mutate(mutator: (value: Get) => void | Set | o.NoValue): void
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
  // `create` returns what `mutator` returns, if anything: `o.NoValue` cancels the write. A returned value is wrapped
  // with `rawReturn`, which tells mutative it is meant: it warns about any returned object that holds no draft.
  const new_value = create(this._value, (draft) => {
    const returned = mutator(draft)
    // only an object needs it, and `rawReturn` warns about any other value (`o.NoValue`, a primitive)
    return typeof returned === "object" && returned !== null ? rawReturn(returned) : returned
  })
  if (new_value !== o.NoValue) {
    this.set(new_value)
  }
}
