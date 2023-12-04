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
} from "./dom"

import { Renderable } from "./types"


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
export function If<T extends o.RO<any>>(
  condition: T,
  display: (arg: If.NonNullableRO<T>) => Renderable,
  display_otherwise?: (a: T) => Renderable,
) {

  // return res

  const resfn = function () {
    const res = o.tf<T, Renderable>(condition, (cond, old, v) => {
      if (old !== o.NoValue && !!cond === !!old && v !== o.NoValue) return v as Renderable
      if (cond) {
        return display(condition as If.NonNullableRO<T>)
      } else if (display_otherwise) {
        return display_otherwise(condition)
      } else {
        return null
      }
    })
    if (o.isReadonlyObservable(res)) res[o.sym_display_node] = "e-if"
    return res
  }

  resfn.Else = function (otherwise: (a: T) => Renderable) {
    display_otherwise = otherwise
  }

  return resfn
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
export function Repeat<T extends o.RO<any[]>>(obs: T, render: Repeat.RenderItemFn<T>): HTMLElement
export function Repeat<T extends o.RO<any[]>>(obs: T, options: Repeat.Options<Repeat.Item<T>>, render: Repeat.RenderItemFn<T>): HTMLElement
export function Repeat<T extends o.RO<any[]>>(
  ob: T,
  render_or_options: Repeat.Options<Repeat.Item<T>> | (Repeat.RenderItemFn<T>),
  real_render?: Repeat.RenderItemFn<T>
): HTMLElement {
  const options = typeof render_or_options === "function" ? {} : render_or_options
  const render = typeof render_or_options === "function" ? render_or_options : real_render!

  return new Repeat.Repeater(o(ob) as any, render as any, options).render()
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

  export type Item<T extends o.RO<any[]>> = T extends o.ReadonlyObservable<(infer U)[]> ? U : T

  export type RenderItemFn<T extends o.RO<any[]>> = (arg : Repeat.RoItem<T>, idx: o.RO<number>) => Renderable<HTMLElement>

  export interface Options<T> {
    /**
     * The separator to insert between all rendering of repeated elements
     */
    separator?: (n: o.RO<number>) => Renderable<HTMLElement>
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
      public renderfn: (ob: o.Observable<T>, n: o.RO<number>) => Renderable<HTMLElement>,
      public options: Repeat.Options<T> = {}
    ) { }

    render() {
      this.node = document.createElement("e-repeat")
      node_observe(this.node, this.obs, lst => {
        this.lst = lst ?? []
        this.node.setAttribute("length", lst.length.toString())
        const diff = lst.length - this.next_index

        if (diff > 0)
          this.appendChildren(diff)

        if (diff < 0)
          this.removeChildren(-diff)
      }, { immediate: true })

      return this.node
    }

    /**
     * Generate the next element to append to the list.
     */
    next(fr: DocumentFragment): boolean {
      if (this.next_index >= this.lst.length)
        return false

      const prop_obs = o(this.next_index)
      const ob = this.obs.p(prop_obs) as o.CombinedObservable<any, any>
      const node = document.createElement("e-ritem") as RepeatItemElement
      node[sym_obs] = ob
      node.setAttribute("index", this.next_index.toString())

      const _sep = this.options.separator
      if (_sep && this.next_index > 0) {
        node_append(node, _sep(prop_obs))
      }

      node_append(node, this.renderfn(ob, prop_obs))
      fr.appendChild(node)

      this.next_index++
      return true
    }

    appendChildren(count: number) {
      const fr = document.createDocumentFragment()

      while (count-- > 0) {
        if (!this.next(fr)) break
      }

      node_append(this.node, fr)
    }

    removeChildren(count: number) {
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
export function RepeatScroll<T extends o.RO<any[]>>(ob: T, render: Repeat.RenderItemFn<T>): Node
export function RepeatScroll<T extends o.RO<any[]>>(ob: T, options: RepeatScroll.Options<Repeat.Item<T>>, render: Repeat.RenderItemFn<T>): Node
export function RepeatScroll<T extends o.RO<any[]>>(
  ob: T,
  opts_or_render: (Repeat.RenderItemFn<T>) | RepeatScroll.Options<Repeat.Item<T>>,
  real_render?: (Repeat.RenderItemFn<T>)
): Node {
  // we cheat the typesystem, which is not great, but we "know what we're doing".
  if (typeof opts_or_render === "function") {
    return new RepeatScroll.ScrollRepeater<any>(o(ob as any) as o.Observable<any>, opts_or_render as any, {}).render()
  }

  return new RepeatScroll.ScrollRepeater<any>(o(ob as any) as o.Observable<any>, real_render as any, opts_or_render).render()
}

export namespace RepeatScroll {

  /**
   * Options to {@link RepeatScroll}
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
    instersector = document.createElement("span")
    intersecting = false

    constructor(
      ob: o.Observable<T[]>,
      renderfn: (e: o.Observable<T>, oi: o.RO<number>) => Renderable<HTMLElement>,
      public options: RepeatScroll.Options<T>
    ) {
      super(ob, renderfn, options)
    }

    scroll_buffer_size = this.options.scroll_buffer_size ?? 10
    threshold = this.options.threshold_height ?? 500

    inter: IntersectionObserver | null = null

    // Have to type this manually since dts-bundler chokes on Renderable
    separator?: (n: number) => Renderable<HTMLElement> = this.options.separator

    /**
     * Append `count` children if the parent was not scrollable (just like Repeater),
     * or append elements until we've added past the bottom of the container.
     */
    appendChildren() {
      // Instead of appending all the count, break it down to bufsize packets.
      super.appendChildren(this.scroll_buffer_size)
      requestAnimationFrame(() => {
        if (this.intersecting) {
          this.appendChildren()
        }
      })
    }

    connected() {
      // do not process this if the node is not inserted.
      if (!this.node.isConnected) return

      this.inter = new IntersectionObserver(entries => {
        for (let e of entries) {
          if (e.isIntersecting) {
            this.appendChildren()
          }
          this.intersecting = e.isIntersecting
        }
      }, { rootMargin: `${this.threshold}px`, })
      this.inter.observe(this.instersector)
    }

    disconnected() {
      // remove Scrolling
      this.inter?.disconnect()
      this.inter = null

      if (!this.parent) return
      this.parent = null
    }

    render() {
      const node = super.render()
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
export function Switch<T>(obs: o.Observable<T>): Switch.Switcher<T>
export function Switch<T>(obs: o.ReadonlyObservable<T>): Switch.ReadonlySwitcher<T>
export function Switch(obs: any): any {
  const res = new (Switch.Switcher as any)(obs)
  res[o.sym_display_node] = "e-switch"
  return res
}


export namespace Switch {
  /**
   * @internal
   */
  export class Switcher<T> extends o.CombinedObservable<[T], Renderable<ParentNode>> {

    cases: [(T | ((t: T) => any)), (t: o.Observable<T>) => Renderable<ParentNode>][] = []
    passthrough: () => Renderable<ParentNode> = () => null
    prev_case: any = null
    prev: Renderable<ParentNode> = ""

    constructor(public obs: o.Observable<T>) {
      super([obs])
    }

    getter([nval] : [T]): Renderable<ParentNode> {
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
    Case<S extends T>(value: (t: T) => t is S, fn: (v: o.Observable<S>) => Renderable<ParentNode>): Switcher<Exclude<T, S>>
    Case(value: T, fn: (v: o.Observable<T>) => Renderable<ParentNode>): this
    Case(predicate: (t: T) => any, fn: (v: o.Observable<T>) => Renderable<ParentNode>): this
    Case(value: T | ((t: T) => any), fn: (v: o.Observable<T>) => Renderable<ParentNode>): this {
      this.cases.push([value, fn])
      return this as any
    }

    Else(fn: () => Renderable<ParentNode>) {
      this.passthrough = fn
      return this
    }

  }


  /**
   * @internal
   */
  export interface ReadonlySwitcher<T> extends o.ReadonlyObservable<Renderable<ParentNode>> {
    /** See {@link Switch.Switcher#Case} */
    Case<S extends T>(value: (t: T) => t is S, fn: (v: o.ReadonlyObservable<S>) => Renderable<ParentNode>): ReadonlySwitcher<Exclude<T, S>>
    Case(value: T, fn: (v: o.ReadonlyObservable<T>) => Renderable<ParentNode>): this
    Case(predicate: (t: T) => any, fn: (v: o.ReadonlyObservable<T>) => Renderable<ParentNode>): this
    /** See {@link Switch.Switcher#Else} */

  }

}

/**
 * Display the result of `fn` if the promise is waiting for its result, or if the promise currently
 * contained in the provided observable is loading.
 *
 * To display something based on the result of the promise, use {@link IfResolved}
 *
 * @group Verbs
 */
export function IfResolving(pro: o.RO<Promise<any>>, fn: () => Renderable<ParentNode>) {
  return If(o.wrap_promise(pro).tf(v => v.resolving), fn)
}


/**
 * Display the result of `resolved` if the promise has resolved and provide its result in `o_value`.
 * If the promise has errored, then the `rejected` arm is executed with `o_error` filled with the
 * error.
 *
 * To display something based on the loading state of the promise, use {@link IfResolving}
 *
 * @group Verbs
 */
export function IfResolved<T>(op: o.Observable<Promise<T>>,
  resolved: (o_value: o.Observable<T>) => Renderable<ParentNode>,
  rejected?: (o_error: o.Observable<any>) => Renderable<ParentNode>): o.ReadonlyObservable<Renderable>
export function IfResolved<T>(op: o.RO<Promise<T>>,
  resolved: (o_value: o.ReadonlyObservable<T>) => Renderable<ParentNode>,
  rejected?: (o_error: o.ReadonlyObservable<any>) => Renderable<ParentNode>): o.ReadonlyObservable<Renderable>
export function IfResolved<T>(op: o.Observable<Promise<T>> | o.RO<Promise<T>>,
  resolved: (o_value: o.Observable<T>) => Renderable<ParentNode>,
  rejected?: (o_error: o.Observable<any>) => Renderable<ParentNode>)
{
  const op_wrapped = o.wrap_promise(op)
  const o_value = o(undefined as any)
  const o_error = o(undefined)
  return op_wrapped.tf((wr, _, prev) => {
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
  })
}
