/**
 * Control structures to help with readability.
 */
import {
  o
} from "./observable"

import { Display } from "./elt"

import type { Renderable } from "./types"

import {
  node_add_child,
  node_clear,
  node_do_remove,
  node_observe,
  node_on_inserted,
  node_on_removed,
} from "./dom"


/**
 * @category verbs, toc
 *
 * Display content depending on the value of a `condition`, which can be an observable.
 *
 * If `condition` is not an observable, then the call to `If` is resolved immediately without using
 * an intermediary observable.
 *
 * If `condition` is readonly, then the observables given to `display` and `display_otherwise` are
 * Readonly as well.
 *
 * For convenience, the truth value is given typed as a `o.Observable<NonNullable<...>>` in `display`,
 * since there is no way `null` or `undefined` could make their way here.
 *
 * @code ../examples/if.tsx
 *
 * @code ../examples/if2.tsx
 */
export function If<T extends o.RO<any>>(
  condition: T,
  display: (arg: If.NonNullableRO<T>) => Renderable,
  display_otherwise?: (a: T) => Renderable,
): HTMLElement {
  const eltif = document.createElement("e-if")
  node_observe(
    eltif,
    o.tf<T, Renderable>(condition, (cond, old, v) => {
      if (old !== o.NoValue && !!cond === !!old && v !== o.NoValue) return v as Renderable
      eltif.setAttribute("condition", cond ? "true" : "false")
      if (cond) {
        return display(condition as If.NonNullableRO<T>)
      } else if (display_otherwise) {
        return display_otherwise(condition)
      } else {
        return null
      }
    }),
    renderable => {
      node_clear(eltif)
      node_add_child(eltif, renderable)
    },
    undefined,
    true
  )
  return eltif
}

export namespace If {

  /**
   * Get the type of a potentially `Observable` type where `null` and `undefined` are exluded, keeping
   * the `Readonly` status if the provided [[o.Observable]] type was `Readonly`.
   *
   * @code ../examples/if.nonnullablero.tsx
   */
  export type NonNullableRO<T> =
    T extends o.Observable<infer U> ? o.Observable<NonNullable<U>> :
    T extends o.ReadonlyObservable<infer U> ? o.ReadonlyObservable<NonNullable<U>>
    : NonNullable<T>

}


/**
 * @category verbs, toc
 *
 * Repeats the `render` function for each element in `ob`, optionally separating each rendering
 * with the result of the `separator` function.
 *
 * If `ob` is an observable, `Repeat` will update the generated nodes to match the changes.
 * If it is a `o.ReadonlyObservable`, then the `render` callback will be provided a read only observable.
 *
 * `ob` is not converted to an observable if it was not one, in which case the results are executed
 * right away and only once.
 *
 * @code ../examples/repeat.tsx
 */
export function Repeat<T extends o.RO<any[]>>(obs: T, render: (arg: Repeat.RoItem<T>, idx: o.RO<number>) => Renderable): HTMLElement
export function Repeat<T extends o.RO<any[]>>(obs: T, options: Repeat.Options<Repeat.Item<T>>, render: (arg: Repeat.RoItem<T>, idx: o.RO<number>) => Renderable): HTMLElement
export function Repeat<T extends o.RO<any[]>>(
  ob: T,
  render_or_options: Repeat.Options<Repeat.Item<T>> | ((arg: Repeat.RoItem<T>, idx: o.RO<number>) => Renderable),
  real_render?: (arg: Repeat.RoItem<T>, idx: o.RO<number>) => Renderable
): HTMLElement {
  const options = typeof render_or_options === "function" ? {} : render_or_options
  const render = typeof render_or_options === "function" ? render_or_options : real_render!

  return new Repeat.Repeater(o(ob) as any, render as any, options).render()
}

export namespace Repeat {

  export const sym_repeat_pos = Symbol("repeat-pos")

  export type ERitem = HTMLElement & { [sym_repeat_pos]: o.Observable<number> }
  /**
   * A helper type that transforms a type that could be an array, an [[o.Observable]] or a [[o.ReadonlyObservable]]
   * of an array to the base type of the same type.
   *
   * This type is used to help with [[Repeat]]'s prototype definition.
   *
   * @code ../examples/repeat.roitem.tsx
   */
  export type RoItem<T extends o.RO<any[]>> = T extends o.Observable<(infer U)[]> ? o.Observable<U>
  : T extends o.ReadonlyObservable<(infer U)[]> ? o.ReadonlyObservable<U>
  : T extends (infer U)[] ? U
  : T;

  export type Item<T extends o.RO<any[]>> = T extends o.ReadonlyObservable<(infer U)[]> ? U : T

  export interface Options<T> {
    /**
     * The separator to insert between all rendering of repeated elements
     */
    separator?: (n: o.RO<number>) => Renderable
    key?: (elt: T) => any
  }

  /**
   * Repeats content.
   * @internal
   */
  export class Repeater<T> {

    protected next_index: number = 0
    protected lst: T[] = []
    protected node!: HTMLElement

    constructor(
      public obs: o.Observable<T[]>,
      public renderfn: (ob: o.Observable<T>, n: o.RO<number>) => Renderable,
      public options: Repeat.Options<T> = {}
    ) { }

    render() {
      this.node = document.createElement("e-repeat")
      node_observe(this.node, this.obs, lst => {
        this.lst = lst || []
        const diff = lst.length - this.next_index

        if (diff > 0)
          this.appendChildren(diff)

        if (diff < 0)
          this.removeChildren(-diff)
      }, undefined, true)

      return this.node
    }

    /**
     * Generate the next element to append to the list.
     */
    next(fr: DocumentFragment): boolean {
      if (this.next_index >= this.lst.length)
        return false

      const prop_obs = o(this.next_index)
      const ob = this.obs.p(prop_obs)
      const node = document.createElement("e-ritem") as ERitem

      const _sep = this.options.separator
      if (_sep && this.next_index > 0) {
        node_add_child(node, _sep(prop_obs))
      }

      node_add_child(node, this.renderfn(ob, prop_obs))
      node[sym_repeat_pos] = prop_obs
      fr.appendChild(node)

      this.next_index++
      return true
    }

    appendChildren(count: number) {
      const parent = this.node.parentNode!
      if (!parent) return

      const fr = document.createDocumentFragment()

      while (count-- > 0) {
        if (!this.next(fr)) break
      }

      node_add_child(this.node, fr)
    }

    removeChildren(count: number) {
      let iter = this.node.lastChild
      if (iter == null || this.next_index === 0 || count === 0) return
      // Détruire jusqu'à la position concernée...
      this.next_index = this.next_index - count

      while (true) {
        const next = iter.previousSibling as ERitem | null
        count--
        if (count === -1) { break }
        this.node.removeChild(iter)
        node_do_remove(iter)
        iter = next
        if (iter == null) { break }
      }
    }
  }
}


/**
 * Similarly to `Repeat`, `RepeatScroll` repeats the `render` function for each element in `ob`,
 * optionally separated by the results of `separator`, until the elements overflow past the
 * bottom border of the current parent marked `overflow-y: auto`.
 *
 * As the user scrolls, new items are being added. Old items are *not* discarded and stay above.
 *
 * It will generate `scroll_buffer_size` elements at a time (or 10 if not specified), waiting for
 * the next repaint with `requestAnimationFrame()` between chunks.
 *
 * Unlike `Repeat`, `RepeatScroll` turns `ob` into an `Observable` internally even if it wasn't one.
 *
 * > **Note** : while functional, RepeatScroll is not perfect. A "VirtualScroll" behaviour is in the
 * > roadmap to only maintain the right amount of elements on screen.
 *
 * @code ../examples/repeatscroll.tsx
 *
 * @category verbs, toc
 */
export function RepeatScroll<T extends o.RO<any[]>>(ob: T, render: (arg: Repeat.RoItem<T>, idx: o.RO<number>) => Renderable): Node
export function RepeatScroll<T extends o.RO<any[]>>(ob: T, options: RepeatScroll.Options<Repeat.Item<T>>, render: (arg: Repeat.RoItem<T>, idx: o.RO<number>) => Renderable): Node
export function RepeatScroll<T extends o.RO<any[]>>(
  ob: T,
  opts_or_render: ((arg: Repeat.RoItem<T>, idx: o.RO<number>) => Renderable) | RepeatScroll.Options<Repeat.Item<T>>,
  real_render?: ((arg: Repeat.RoItem<T>, idx: o.RO<number>) => Renderable)
): Node {
  // we cheat the typesystem, which is not great, but we "know what we're doing".
  if (typeof opts_or_render === "function") {
    return new RepeatScroll.ScrollRepeater<any>(o(ob as any) as o.Observable<any>, opts_or_render as any, {}).render()
  }

  return new RepeatScroll.ScrollRepeater<any>(o(ob as any) as o.Observable<any>, real_render as any, opts_or_render).render()
}

export namespace RepeatScroll {

  /**
   * Options to [[RepeatScroll]]
   */
  export interface Options<T> extends Repeat.Options<T> {
    /**
     * The number of elements to generate at the same time between `requestAnimationFrame` calls.
     */
    scroll_buffer_size?: number
    /**
     * The number of pixels before the end of the container at which RepeatScroll should start
     * generating new elements as the user scrolls.
     */
    threshold_height?: number
  }

  /**
   * Repeats content and append it to the DOM until a certain threshold
   * is meant. Use it with `scrollable()` on the parent..
   * @internal
   */
  export class ScrollRepeater<T> extends Repeat.Repeater<T> {

    protected parent: HTMLElement|null = null

    constructor(
      ob: o.Observable<T[]>,
      renderfn: (e: o.Observable<T>, oi: o.RO<number>) => Renderable,
      public options: RepeatScroll.Options<T>
    ) {
      super(ob, renderfn, options)
    }

    scroll_buffer_size = this.options.scroll_buffer_size ?? 10
    threshold_height = this.options.threshold_height ?? 500
    // Have to type this manually since dts-bundler chokes on Renderable
    separator?: (n: number) => Renderable = this.options.separator

    /**
     * Append `count` children if the parent was not scrollable (just like Repeater),
     * or append elements until we've added past the bottom of the container.
     */
    appendChildren() {
      // Instead of appending all the count, break it down to bufsize packets.
      const bufsize = this.scroll_buffer_size

      const append = () => {
        const p = this.parent
        while (!p || this.next_index < this.lst.length && p.scrollHeight - (p.clientHeight + p.scrollTop) < this.threshold_height) {
          super.appendChildren(bufsize)
        }
      }

      requestAnimationFrame(append)
    }

    inserted() {
      // do not process this if the node is not inserted.
      if (!this.node.isConnected) return

      // Find parent with the overflow-y
      let iter = this.node.parentElement
      while (iter) {
        const style = getComputedStyle(iter) as any
        if (style.overflowY === "auto" || style.msOverflowY === "auto" || style.msOverflowY === "scrollbar") {
          this.parent = iter
          break
        }
        iter = iter.parentElement
      }

      if (!this.parent) {
        console.warn("Scroll repeat needs a parent with overflow-y: auto")
        this.appendChildren()
        return
      }

      this.parent.addEventListener("scroll", this.onscroll)
    }

    onscroll = o.throttle(() => {
      if (!this.parent) return
      this.appendChildren()
    }, 100)

    removed() {
      // remove Scrolling
      if (!this.parent) return

      this.parent.removeEventListener("scroll", this.onscroll)
      this.parent = null
    }

    render() {
      const node = super.render()
      node_on_inserted(node, () => this.inserted())
      node_on_removed(node, () => this.removed())
      return node
    }

  }


}


/**
 * Perform a Switch statement on an observable.
 *
 * @code ../examples/switch.tsx
 *
 * `Switch()` can work with typeguards to narrow a type in the observable passed to the then callback,
 * but only with defined functions. It is however not as powerful as typescript's type guards in ifs
 * and will not recognize `typeof` or `instanceof` calls.
 *
 * @code ../examples/switch2.tsx
 *
 * @category verbs, toc
 */
export function Switch<T>(obs: o.Observable<T>): Switch.Switcher<T>
export function Switch<T>(obs: o.ReadonlyObservable<T>): Switch.ReadonlySwitcher<T>
export function Switch(obs: any): any {
  return new (Switch.Switcher as any)(obs)
}


export namespace Switch {
  /**
   * @internal
   */
  export class Switcher<T> extends o.CombinedObservable<[T], Renderable> {

    cases: [(T | ((t: T) => any)), (t: o.Observable<T>) => Renderable][] = []
    passthrough: () => Renderable = () => null
    prev_case: any = null
    prev: Renderable = ""

    constructor(public obs: o.Observable<T>) {
      super([obs])
    }

    getter([nval] : [T]): Renderable {
      const cases = this.cases
      for (const c of cases) {
        const val = c[0]
        if (val === nval || (typeof val === "function" && (val as any)(nval))) {
          if (this.prev_case === val) {
            return this.prev
          }
          this.prev_case = val
          const fn = c[1]
          return (this.prev = fn(this.obs))
        }
      }
      if (this.prev_case === this.passthrough)
        return this.prev
      this.prev_case = this.passthrough
      return (this.prev = this.passthrough ? this.passthrough() : null)
    }

    // @ts-ignore
    Case<S extends T>(value: (t: T) => t is S, fn: (v: o.Observable<S>) => Renderable): Switcher<Exclude<T, S>>
    Case(value: T, fn: (v: o.Observable<T>) => Renderable): this
    Case(predicate: (t: T) => any, fn: (v: o.Observable<T>) => Renderable): this
    Case(value: T | ((t: T) => any), fn: (v: o.Observable<T>) => Renderable): this {
      this.cases.push([value, fn])
      return this as any
    }

    Else(fn: () => Renderable) {
      this.passthrough = fn
      return this
    }

  }


  /**
   * @internal
   */
  export interface ReadonlySwitcher<T> extends o.ReadonlyObservable<Renderable> {
    /** See [[Switch.Switcher#Case]] */
    Case<S extends T>(value: (t: T) => t is S, fn: (v: o.ReadonlyObservable<S>) => Renderable): ReadonlySwitcher<Exclude<T, S>>
    Case(value: T, fn: (v: o.ReadonlyObservable<T>) => Renderable): this
    Case(predicate: (t: T) => any, fn: (v: o.ReadonlyObservable<T>) => Renderable): this
    /** See [[Switch.Switcher#Else]] */
    Else(fn: (v: o.ReadonlyObservable<T>) => Renderable): this
  }

}


/**
 * Display the result of `fn` if the promise is waiting for its result, or if the promise currently
 * contained in the provided observable is loading.
 *
 * To display something based on the result of the promise, use [[IfResolved]]
 *
 * @category toc, verbs
 */
export function IfResolving(pro: o.RO<Promise<any>>, fn: () => Renderable) {
  return If(o.wrapPromise(pro).tf(v => v.resolving), fn)
}


/**
 * Display the result of `resolved` if the promise has resolved and provide its result in `o_value`.
 * If the promise has errored, then the `rejected` arm is executed with `o_error` filled with the
 * error.
 *
 * To display something based on the loading state of the promise, use [[IfResolving]]
 *
 * @category toc, verbs
 */
export function IfResolved<T>(op: o.RO<Promise<T>>,
  resolved: (o_value: o.ReadonlyObservable<T>) => Renderable,
  rejected?: (o_error: o.ReadonlyObservable<any>) => Renderable)
{
  const op_wrapped = o.wrapPromise(op)
  const o_value = o(undefined as any)
  const o_error = o(undefined)
  return Display(op_wrapped.tf((wr, _, prev) => {
    if (wr.resolved === "value") {
      o_value.set(wr.value)
      if (prev !== o.NoValue && _ !== o.NoValue && (_.resolved ==="value"))
        return prev
      return resolved(o_value)
    } else if (rejected && (wr.resolved === "error")) {
      o_error.set(wr.error)
      if (prev !== o.NoValue && _ !== o.NoValue && (_.resolved === "error"))
        return prev
      return rejected(o_error)
    }
    return undefined
  }))
}
