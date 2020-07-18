/**
 * Control structures to help with readability.
 */
import {
  o
} from './observable'

import {
  Mixin,
} from './mixins'

import { e, Renderable, Displayer, Display } from './elt'

import {
  insert_before_and_init,
  node_remove_after,
} from './dom'


/**
 * @category dom, toc
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
  display_otherwise?: (a: T) => Renderable
): Node {
  // ts bug on condition.
  if (typeof display === 'function' && !((condition as any) instanceof o.Observable)) {
    return condition ?
      e.renderable_to_node(display(condition as any), true)
      : e.renderable_to_node(display_otherwise ?
          (display_otherwise(null!))
          : document.createComment('false'), true)
  }

  return e(document.createComment('If'),
    node => new If.ConditionalDisplayer<any>(node, display, condition, display_otherwise)
  )
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


  /**
   * Implementation of the `DisplayIf()` verb.
   * @internal
   */
  export class ConditionalDisplayer<T extends o.ReadonlyObservable<any>> extends Displayer {

    constructor(
      node: Comment,
      protected display: (arg: If.NonNullableRO<T>) => Renderable,
      protected condition: T,
      protected display_otherwise?: (arg: T) => Renderable
    ) {
      super(node, condition.tf((cond, old, v) => {
        if (old !== o.NoValue && !!cond === !!old && v !== o.NoValue) return v as Renderable
        if (cond) {
          return display(condition as NonNullableRO<T>)
        } else if (display_otherwise) {
          return display_otherwise(condition)
        } else {
          return null
        }
      }))
    }

  }

}


/**
 * @category dom, toc
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
export function Repeat<T extends o.RO<any[]>>(
  ob: T,
  render: (arg: Repeat.RoItem<T>, idx: number) => Renderable,
  separator?: (n: number) => Renderable
): Node {
  if (!(ob instanceof o.Observable)) {
    const arr = ob as any[]

    var df = document.createDocumentFragment()
    for (var i = 0, l = arr.length; i < l; i++) {
      df.appendChild(e.renderable_to_node(render(arr[i], i), true))
      if (i > 1 && separator) {
        df.appendChild(e.renderable_to_node(separator(i - 1), true))
      }
    }
    return df
  }

  return e(
    document.createComment('Repeat'),
    node => new Repeat.Repeater(node, ob, render as any, separator)
  )
}

export namespace Repeat {

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

  /**
   *  Repeats content.
   * @internal
   */
  export class Repeater<T> extends Mixin<Comment> {

    // protected proxy = o([] as T[])
    protected obs: o.Observable<T[]>
    protected positions: Node[] = []
    protected next_index: number = 0
    protected lst: T[] = []

    protected child_obs: o.Observable<T>[] = []

    constructor(
      node: Comment,
      ob: o.Observable<T[]>,
      public renderfn: (ob: o.Observable<T>, n: number) => Renderable,
      public separator?: (n: number) => Renderable
    ) {
      super(node)

      this.obs = o(ob)
    }

    init() {
      this.observe(this.obs, lst => {
        this.lst = lst || []
        const diff = lst.length - this.next_index

        if (diff < 0)
          this.removeChildren(-diff)

        if (diff > 0)
          this.appendChildren(diff)
      })
    }

    /**
     * Generate the next element to append to the list.
     */
    next(fr: DocumentFragment): boolean {
      if (this.next_index >= this.lst.length)
        return false

      // here, we *KNOW* it represents a defined value.
      var ob = this.obs.p(this.next_index) as o.Observable<T>

      this.child_obs.push(ob)

      if (this.separator && this.next_index > 0) {
        var sep = e.renderable_to_node(this.separator(this.next_index))
        if (sep) fr.appendChild(sep)
      }

      var node = e.renderable_to_node(this.renderfn(ob, this.next_index), true)
      this.positions.push(node instanceof DocumentFragment ? node.lastChild! : node)
      fr.appendChild(node)

      this.next_index++
      return true
    }

    appendChildren(count: number) {
      const parent = this.node.parentNode!
      if (!parent) return
      const insert_point = this.positions.length === 0 ? this.node.nextSibling : this.positions[this.positions.length - 1]?.nextSibling

      var fr = document.createDocumentFragment()

      while (count-- > 0) {
        if (!this.next(fr)) break
      }

      insert_before_and_init(parent, fr, insert_point)
    }

    removeChildren(count: number) {
      if (this.next_index === 0 || count === 0) return
      // Détruire jusqu'à la position concernée...
      this.next_index = this.next_index - count

      node_remove_after(this.positions[this.next_index - 1] ?? this.node, this.positions[this.positions.length - 1])

      this.child_obs = this.child_obs.slice(0, this.next_index)
      this.positions = this.positions.slice(0, this.next_index)
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
 * @category dom, toc
 */
export function RepeatScroll<T extends o.RO<any[]>>(
  ob: T,
  render: (arg: Repeat.RoItem<T>, idx: number) => Renderable,
  options: Partial<RepeatScroll.Options> = {}
): Node {
  // we cheat the typesystem, which is not great, but we know what we're doing.
  return e(
    document.createComment('RepeatScroll'),
    node => new RepeatScroll.ScrollRepeater<any>(node, o(ob as any) as o.Observable<any>, render as any, options)
  )
}

export namespace RepeatScroll {

  /**
   * Options to [[RepeatScroll]]
   */
  export interface Options {
    /**
     * The separator to insert between all rendering of repeated elements
     */
    separator?: (n: number) => Renderable
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
      node: Comment,
      ob: o.Observable<T[]>,
      renderfn: (e: o.Observable<T>, oi: number) => Renderable,
      public options: RepeatScroll.Options
    ) {
      super(node, ob, renderfn)
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
      if (!this.parent)
        // if we have no scrollable parent (yet, if just inited), then just append items
        return super.appendChildren(this.scroll_buffer_size)

      // Instead of appending all the count, break it down to bufsize packets.
      const bufsize = this.scroll_buffer_size
      const p = this.parent

      const append = () => {
        if (this.next_index < this.lst.length && p.scrollHeight - (p.clientHeight + p.scrollTop) < this.threshold_height) {
          super.appendChildren(bufsize)
          requestAnimationFrame(append)
        }
      }

      // We do not try appending immediately ; some observables may modify current
      // items height right after this function ends, which can lead to a situation
      // where we had few elements that were very high and went past the threshold
      // that would get very small suddenly, but since they didn't get the chance
      // to do that, append stops because it is past the threshold right now and
      // thus leaves a lot of blank space.
      requestAnimationFrame(append)
    }

    inserted() {
      // do not process this if the node is not inserted.
      if (!this.node.isConnected) return

      // Find parent with the overflow-y
      var iter = this.node.parentElement
      while (iter) {
        var style = getComputedStyle(iter) as any
        if (style.overflowY === 'auto' || style.msOverflowY === 'auto' || style.msOverflowY === 'scrollbar') {
          this.parent = iter
          break
        }
        iter = iter.parentElement
      }

      if (!this.parent) {
        console.warn(`Scroll repeat needs a parent with overflow-y: auto`)
        this.appendChildren()
        return
      }

      this.parent.addEventListener('scroll', this.onscroll)

      this.observe(this.obs, lst => {
        this.lst = lst || []
        const diff = lst.length - this.next_index

        if (diff < 0)
          this.removeChildren(-diff)

        if (diff > 0)
          this.appendChildren()
      })
    }

    onscroll = () => {
      if (!this.parent) return
      this.appendChildren()
    }

    removed() {
      // remove Scrolling
      if (!this.parent) return

      this.parent.removeEventListener('scroll', this.onscroll)
      this.parent = null
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
 * @category dom, toc
 */
export function Switch<T>(obs: o.Observable<T>): Switch.Switcher<T>
export function Switch<T>(obs: o.ReadonlyObservable<T>): Switch.ReadonlySwitcher<T>
export function Switch<T>(obs: any): any {
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
    prev: Renderable = ''

    constructor(public obs: o.Observable<T>) {
      super([obs])
    }

    getter([nval] : [T]): Renderable {
      const cases = this.cases
      for (var c of cases) {
        const val = c[0]
        if (val === nval || (typeof val === 'function' && (val as Function)(nval))) {
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
 * @category toc, verb
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
 * @category toc, verb
 */
export function IfResolved<T>(op: o.RO<Promise<T>>,
  resolved: (o_value: o.ReadonlyObservable<T>) => Renderable,
  rejected?: (o_error: o.ReadonlyObservable<any>) => Renderable)
{
  const op_wrapped = o.wrapPromise(op)
  const o_value = o(undefined as any)
  const o_error = o(undefined)
  return Display(op_wrapped.tf((wr, _, prev) => {
    if (wr.resolved === 'value') {
      o_value.set(wr.value)
      if (prev !== o.NoValue && _ !== o.NoValue && (_.resolved ==='value'))
        return prev
      return resolved(o_value)
    } else if (rejected && (wr.resolved === 'error')) {
      o_error.set(wr.error)
      if (prev !== o.NoValue && _ !== o.NoValue && (_.resolved === 'error'))
        return prev
      return rejected(o_error)
    }
    return undefined
  }))
}