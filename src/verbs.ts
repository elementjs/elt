/**
 * Control structures to help with readability.
 */
import {
  o
} from "./observable"

import {
  node_append,
  node_do_disconnect,
  node_observe,
  node_on_connected,
  node_on_disconnected,
  node_remove,
} from "./dom"

import { Inserter, Renderable } from "./types"
import { sym_insert } from "./symbols"


/**
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
 * ```tsx
 * [[include:../examples/if.tsx]]
 * ```
 *
 * ```tsx
 * [[include:../examples/if2.tsx]]
 * ```
 * @group Verbs
 */
export function If<T extends o.RO<any>, N extends Node>(
  condition: T,
  display?: (arg: If.NonNullableRO<T>) => Renderable<N>,
  display_otherwise?: () => Renderable<N>,
) {
  return new If.IfDisplayer(condition, display, display_otherwise)
}

export namespace If {

  /**
   * Get the type of a potentially `Observable` type where `null` and `undefined` are exluded, keeping
   * the `Readonly` status if the provided {@link o.Observable} type was `Readonly`.
   *
   * ```tsx
   * [[include:../examples/if.nonnullablero.tsx]]
   * ```
   */
  export type NonNullableRO<T> =
    T extends o.Observable<infer U> ? o.Observable<NonNullable<U>> :
    T extends o.ReadonlyObservable<infer U> ? o.ReadonlyObservable<NonNullable<U>>
    : NonNullable<T>

  export class IfDisplayer<T, N extends Node> implements Inserter<N> {

    last?: IfDisplayer<any, N>

    constructor(
      public condition: o.RO<T>,
      public _display?: (arg: If.NonNullableRO<T>) => Renderable<N>,
      public _display_otherwise?: () => Renderable<N>,
    ) {

    }

    [sym_insert](parent: N, refchild: Node | null) {

      const renderable = o.tf<T, Renderable<N>>(this.condition, (cond, old, v) => {
        if (old !== o.NoValue && !!cond === !!old && v !== o.NoValue) return v as Renderable<N>
        if (cond && this._display) {
          return this._display(this.condition as If.NonNullableRO<T>)
        } else if (this._display_otherwise) {
          return this._display_otherwise()
        } else {
          return null
        }
      })

      if (o.is_observable(renderable)) {
        renderable[o.sym_display_node] = "e-if"
      }

      node_append(parent as N, renderable, refchild)
    }

    Then(display: (arg: If.NonNullableRO<T>) => Renderable<N>) {
      this._display = display
      return this
    }

    ElseIf<T2 extends o.RO<any>>(
      condition: T2,
      display?: (arg: If.NonNullableRO<T2>) => Renderable<N>,
    ) {
      const last = this.last ?? this
      const other = last._display_otherwise
      const add = new IfDisplayer<T2, N>(condition, display, other)
      this._display_otherwise = () => add
      this.last = add
      return this
    }

    Else(otherwise: () => Renderable<N>) {
      const last = this.last ?? this
      last._display_otherwise = otherwise
      return this
    }
  }
}


/**
 * Perform a Switch statement on an observable.
 *
 * ```tsx
 * [[include:../examples/switch.tsx]]
 * ```
 *
 * `Switch()` can work with typeguards to narrow a type in the observable passed to the then callback,
 * but only with defined functions. It is however not as powerful as typescript's type guards in ifs
 * and will not recognize `typeof` or `instanceof` calls.
 *
 * ```tsx
 * [[include:../examples/switch2.tsx]]
 * ```
 *
 * @group Verbs
 */
export function Switch<T, N extends Node = HTMLElement>(obs: o.Observable<T>): Switch.Switcher<T, N>
export function Switch<T, N extends Node = HTMLElement>(obs: o.ReadonlyObservable<T>): Switch.ReadonlySwitcher<T, N>
export function Switch(obs: any): any {
  return new (Switch.Switcher as any)(obs)
}


export namespace Switch {
  /**
   * @internal
   */
  export class Switcher<T, N extends Node> implements Inserter<N> {

    cases: [(T | ((t: T) => any)), (t: o.Observable<T>) => Renderable<N>][] = []
    passthrough: () => Renderable<N> = () => null
    prev_case: any = null
    prev: Renderable<N> = ""

    constructor(public value: o.Observable<T>) { }

    [sym_insert](parent: N, refchild: Node | null) {
      const current_displayfn = o.tf(this.value, value => {
        const cases = this.cases

        for (const c of cases) {
          const [cond, fn] = c

          if ((typeof cond === "function") && (cond as any)(value)
            || cond === value
          ) {
            return fn
          }
        }

        return this.passthrough

      })

      // We use two potential renderables because we do not want the function to be called everytime
      // this.value sees a change.
      const renderable = o.tf(current_displayfn, fn => {
        return fn?.(this.value)
      })

      if (o.is_observable(renderable)) {
        renderable[o.sym_display_node] = "e-switch"
      }

      node_append(parent, renderable, refchild)
    }

    // @ts-ignore
    Case<S extends T>(value: (t: T) => t is S, fn: (v: o.Observable<S>) => Renderable<N>): Switcher<Exclude<T, S>, N>
    Case(value: T, fn: (v: o.Observable<T>) => Renderable<N>): this
    Case(predicate: (t: T) => any, fn: (v: o.Observable<T>) => Renderable<N>): this
    Case(value: T | ((t: T) => any), fn: (v: o.Observable<T>) => Renderable<N>): this {
      this.cases.push([value, fn])
      return this as any
    }

    Else(fn: () => Renderable<N>) {
      this.passthrough = fn
      return this
    }

  }


  /**
   * @internal
   */
  export interface ReadonlySwitcher<T, N extends Node> extends o.ReadonlyObservable<Renderable<N>> {
    /** See {@link Switch.Switcher#Case} */
    Case<S extends T>(value: (t: T) => t is S, fn: (v: o.ReadonlyObservable<S>) => Renderable<N>): ReadonlySwitcher<Exclude<T, S>, N>
    Case(value: T, fn: (v: o.ReadonlyObservable<T>) => Renderable<N>): this
    Case(predicate: (t: T) => any, fn: (v: o.ReadonlyObservable<T>) => Renderable<N>): this
    /** See {@link Switch.Switcher#Else} */

  }

}


/**
 * Repeats the `render` function for each element in `ob`, optionally separating each rendering
 * with the result of the `separator` function.
 *
 * If `ob` is an observable, `Repeat` will update the generated nodes to match the changes.
 * If it is a `o.ReadonlyObservable`, then the `render` callback will be provided a read only observable.
 *
 * `ob` is not converted to an observable if it was not one, in which case the results are executed
 * right away and only once.
 *
 * ```tsx
 * [[include:../examples/repeat.tsx]]
 * ```
 *
 * @group Verbs
 */
export function Repeat<T extends o.RO<any[]>>(obs: T, render?: Repeat.RenderItemFn<T>): Repeat.Repeater<T> {
  return new Repeat.Repeater(o(obs) as any, render as any) as any as Repeat.Repeater<T>
}

export namespace Repeat {

  const sym_obs = Symbol("ritem-obs")

  interface RepeatItemElement extends HTMLElement {
    [sym_obs]: o.CombinedObservable<any, any>
  }

  /**
   * A helper type that transforms a type that could be an array, an {@link o.Observable} or a {@link o.ReadonlyObservable}
   * of an array to the base type of the same type.
   *
   * This type is used to help with {@link Repeat}'s prototype definition.
   *
   * ```tsx
   * [[include:../examples/repeat.roitem.tsx]]
   * ```
   */
  export type RoItem<T extends o.RO<any[]>> = T extends o.Observable<(infer U)[]> ? o.Observable<U>
  : T extends o.ReadonlyObservable<(infer U)[]> ? o.ReadonlyObservable<U>
  : T extends (infer U)[] ? U
  : T;

  export type RenderItemFn<T extends o.RO<any[]>> = (arg : Repeat.RoItem<T>, idx: o.RO<number>) => Renderable<HTMLElement>

  /**
   * Repeats content.
   * @internal
   */
  export class Repeater<O extends o.RO<any[]>> {

    protected next_index: number = 0
    protected on_empty: (() => Renderable<Node>) | null = null
    protected prefix: ((oo_length: o.ReadonlyObservable<number>) => Renderable<Node>) | null = null
    protected suffix: ((oo_length: o.ReadonlyObservable<number>) => Renderable<Node>) | null = null
    protected separator: ((n: o.RO<number>) => Renderable<HTMLElement>) | null = null
    protected _suffix: Node | null = null
    protected empty_drawn = false
    protected lst: O[] = []
    protected node!: HTMLElement
    protected oo_length = o(0)
    protected obs: o.Observable<any[]>

    constructor(
      obs: O,
      public renderfn: (ob: RoItem<O>, n: o.RO<number>) => Renderable<HTMLElement>,
      // public options: Repeat.Options<T> = {}
    ) {
      this.obs = o(obs) as o.Observable<any[]>
    }

    /**
     * Append the repeater
     */
    [sym_insert](parent: Node, refchild: Node | null) {
      if (this.renderfn == null) {
        throw new Error("Repeater needs a Render function")
      }

      this.node = document.createElement("e-repeat")

      node_observe(this.node, this.obs, lst => {
        this.lst = lst ?? []
        this.node.setAttribute("length", lst.length.toString())
        const diff = lst.length - this.next_index

        if (diff > 0) {
          if (this.empty_drawn) {
            while (this.node.firstChild) {
              node_remove(this.node.firstChild)
            }
            this.empty_drawn = false
          }
          this.appendChildren(diff)
        }

        if (diff < 0)
          this.removeChildren(-diff)

        if (this.lst.length === 0 && this.on_empty && !this.empty_drawn) {
          this.empty_drawn = true
          node_append(this.node, this.on_empty())
        }
        this.oo_length.set(lst.length)
      }, { immediate: true })

      node_append(parent, this.node, refchild)
    }

    RenderEach(fn: (ob: RoItem<O>, n: o.RO<number>) => Renderable<HTMLElement>) {
      this.renderfn = fn
      return this
    }

    /** Render `fn` right before the first element if the observed array  was not empty */
    PrefixBy(fn: (oo_length: o.ReadonlyObservable<number>) => Renderable<Node>) {
      this.prefix = fn
      return this
    }

    /** Render `fn` right after the last element if the observed array was not empty */
    SuffixBy(fn: (oo_length: o.ReadonlyObservable<number>) => Renderable<Node>) {
      this.suffix = fn
      return this
    }

    SeparateWith(fn: (n: o.RO<number>) => Renderable<HTMLElement>) {
      this.separator = fn
      return this
    }

    /** Display this renderable if the observed array is empty */
    DisplayWhenEmpty(fn: () => Renderable<Node>) {
      this.on_empty = fn
      return this
    }

    /**
     * Generate the next element to append to the list.
     */
    protected next(fr: DocumentFragment): boolean {
      if (this.next_index >= this.lst.length)
        return false

      if (this.next_index === 0 && this.prefix) {
        const pref = document.createElement("e-ritem")
        pref.setAttribute("prefix", "")
        node_append(pref, this.prefix(this.oo_length))
        node_append(fr, pref)
      }

      const prop_obs = o(this.next_index)
      const ob = this.obs.p(prop_obs) as o.CombinedObservable<any, any>
      const node = document.createElement("e-ritem") as RepeatItemElement
      node[sym_obs] = ob

      node.setAttribute("index", this.next_index.toString())

      const _sep = this.separator
      if (_sep && this.next_index > 0) {
        node_append(node, _sep(prop_obs))
      }

      node_append(node, this.renderfn(ob as RoItem<O>, prop_obs))
      fr.appendChild(node)

      this.next_index++
      return true
    }

    protected appendChildren(count: number) {
      if (count <= 0) return

      const fr = document.createDocumentFragment()

      while (count-- > 0) {
        if (!this.next(fr)) break
      }


      node_append(this.node, fr, this._suffix)

      if (this.suffix && this._suffix == null) {
        const suf = document.createElement("e-ritem")
        suf.setAttribute("suffix", "")
        this._suffix = suf
        node_append(suf, this.suffix(this.oo_length))
        node_append(this.node, suf)
      }

    }

    protected removeChildren(count: number) {
      let iter = this.node.lastChild as RepeatItemElement | null
      if (iter == null || this.next_index === 0 || count === 0) return
      // Détruire jusqu'à la position concernée...
      this.next_index = this.next_index - count

      while (true) {
        const next = iter.previousSibling as RepeatItemElement | null
        count--
        if (count === -1) { break }
        node_do_disconnect(iter)
        iter[sym_obs]?.disconnect()
        this.node.removeChild(iter)
        iter = next
        if (iter == null) { break }
      }

      if (this.next_index === 0 && this._suffix) {
        node_remove(this._suffix)
        this._suffix = null
      }
    }
  }
}


/**
 * Similarly to `Repeat`, `RepeatScroll` repeats the `render` function for each element in `ob`,
 * optionally separated by the results of `separator`, until the elements overflow past the
 * bottom border of the current parent marked `overflow-y: auto`.
 *
 * It will generate `scroll_buffer_size` elements at a time (or 10 if not specified), waiting for
 * the next repaint with `requestAnimationFrame()` between chunks.
 *
 * Unlike `Repeat`, `RepeatScroll` turns `ob` into an `Observable` internally even if it wasn't one.
 *
 * > **Note** : while functional, RepeatScroll is not perfect. A "VirtualScroll" behaviour is in the
 * > roadmap to only maintain the right amount of elements on screen.
 *
 * ```tsx
 * [[include:../examples/repeatscroll.tsx]]
 * ```
 *
 * @group Verbs
 */
export function RepeatScroll<T extends o.RO<any[]>>(ob: T, render?: Repeat.RenderItemFn<T>): RepeatScroll.ScrollRepeater<T> {
  // we cheat the typesystem, which is not great, but we "know what we're doing".
  return new RepeatScroll.ScrollRepeater(o(ob) as any, render as any)
}

export namespace RepeatScroll {

  /**
   * Repeats content and append it to the DOM until a certain threshold
   * is meant. Use it with `scrollable()` on the parent..
   * @internal
   */
  export class ScrollRepeater<O extends o.RO<any[]>> extends Repeat.Repeater<O> {

    protected parent: HTMLElement|null = null
    instersector = document.createElement("span")
    intersecting = false
    scroll_buffer_size = 10
    threshold = 500
    on_end_reached: null | (() => any) = null

    inter: IntersectionObserver | null = null

    onEndReached(fn: (() => any)) {
      this.on_end_reached = fn
      return this
    }

    setScrollBufferSize(n: number) {
      this.scroll_buffer_size = n
      return this
    }

    setThreshold(n: number) {
      this.threshold = n
      return this
    }

    /**
     * Append `count` children if the parent was not scrollable (just like Repeater),
     * or append elements until we've added past the bottom of the container.
     */
    appendChildren() {
      // Instead of appending all the count, break it down to bufsize packets.
      if (this.next_index >= this.lst.length || !this.intersecting) {
        return
      }

      super.appendChildren(this.scroll_buffer_size)

      if (this.next_index >= this.lst.length - 1) {
        this.on_end_reached?.()
      } else if (this.intersecting) {
        requestAnimationFrame(() => {
          if (this.intersecting) {
            this.appendChildren()
            // if (this.next_index)
          }
        })
      }
    }

    connected() {
      // do not process this if the node is not inserted.
      if (!this.node.isConnected) return

      this.inter = new IntersectionObserver(entries => {
        for (let e of entries) {
          this.intersecting = e.isIntersecting
          if (e.isIntersecting) {
            this.appendChildren()
          }
        }
      }, { rootMargin: `${this.threshold}px`, root: this.node.parentElement })
      this.inter.observe(this.instersector)
    }

    disconnected() {
      // remove Scrolling
      this.inter?.disconnect()
      this.inter = null

      if (!this.parent) return
      this.parent = null
    }

    [sym_insert](parent: Node, refchild: Node | null) {
      super[sym_insert](parent, refchild)
      const node = this.node
      node_on_connected(node, () => this.connected())
      node_on_disconnected(node, () => this.disconnected())

      const shadow = node.attachShadow({ mode: "open" })
      const st = this.instersector.style
      st.width = "0px"
      st.height = "0px"
      shadow.appendChild(document.createElement("slot"))
      shadow.appendChild(this.instersector)

      return node
    }

  }


}


/**
 * Display UI elements according to the resolution status of the Promise living in `o_promise`.
 */
export function DisplayPromise<T>(o_promise: o.Observable<Promise<T>>): DisplayPromise.PromiseDisplayer<T>
export function DisplayPromise<T>(o_promise: o.ReadonlyObservable<Promise<T>>): DisplayPromise.ReadonlyPromiseDisplayer<T>
export function DisplayPromise<T>(o_promise: o.ReadonlyObservable<Promise<T>>) {
  return new DisplayPromise.PromiseDisplayer(o_promise as o.Observable<Promise<T>>)
}

export namespace DisplayPromise {

  export class PromiseDisplayer<T> implements Inserter<Node>, ReadonlyPromiseDisplayer<T> {

    _resolved: null | ((o_result: o.Observable<T>, oo_waiting: o.ReadonlyObservable<boolean>) => Renderable<HTMLElement> ) = null

    _rejected: null | ((o_error: o.Observable<any>, oo_waiting: o.ReadonlyObservable<boolean>) => Renderable<HTMLElement>) = null

    _waiting: null | (() => Renderable<HTMLElement>) = null

    constructor(public o_promise: o.Observable<Promise<T>>) { }

    [sym_insert](parent: Node, refchild: Node | null) {
      const wrapped = o.wrap_promise(this.o_promise)

      const pre_render = wrapped.tf(wr => {
        if (wr.resolved === "value") {
          return this._resolved
        } else if (wr.resolved === "error") {
          return this._rejected
        }
        return this._waiting
      })

      const render = pre_render.tf(rd => {
        const o_cheat = wrapped as o.Observable<any>
        if (rd === this._resolved) {
          return rd?.(o_cheat.p("value"), o_cheat.p("resolving"))
        } else if (rd === this._rejected) {
          return rd?.(o_cheat.p("error"), o_cheat.p("resolving"))
        }
        // Last case is necessarily waiting
        return (rd as any)?.()
      })

      render[o.sym_display_node] = "e-unpromise"

      node_append(parent, render, refchild)
    }

    WhileWaiting(fn: () => Renderable<HTMLElement>) {
      this._waiting = fn
      return this
    }

    WhenResolved(
      fn: (o_result: o.Observable<T>, oo_waiting: o.ReadonlyObservable<boolean>) => Renderable<HTMLElement>
    ) {
      this._resolved = fn
      return this
    }

    UponRejection(
      fn: (o_error: o.Observable<any>, oo_waiting: o.ReadonlyObservable<boolean>) => Renderable<HTMLElement>
    ) {
      this._rejected = fn
      return this
    }
  }

  export interface ReadonlyPromiseDisplayer<T> {
    WhileWaiting(fn: () => Renderable<HTMLElement>): this
    WhenResolved(
      fn: (o_result: o.ReadonlyObservable<T>, oo_waiting: o.ReadonlyObservable<boolean>) => Renderable<HTMLElement>
    ): this
    UponRejection(fn: (o_error: o.ReadonlyObservable<any>, oo_waiting: o.ReadonlyObservable<boolean>) => Renderable<HTMLElement>): this
  }

}