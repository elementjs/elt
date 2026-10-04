import { $click, Deferred } from "elt"

/**
 * What a popup or a dialog resolves with when the user dismisses it (click outside, `Escape`) rather
 * than the content resolving it with a value. Also available as `popup.closed`.
 */
export const sym_closed = Symbol("closed")

/**
 * What `popup` and `show_dialog` return and hand to their content: a {@link Deferred} (resolve or
 * reject it from outside; only the first call counts) with a click decorator that resolves it.
 */
export class Future<T> extends Deferred<T> {
  /** A decorator: a click on the element resolves the future with `fn(ev)`. */
  $clickResolve<N extends HTMLElement | SVGElement>(fn: (ev: MouseEvent & { currentTarget: N }) => T): (e: N) => void {
    return $click<N>((ev) => this.resolve(fn(ev)))
  }
}
