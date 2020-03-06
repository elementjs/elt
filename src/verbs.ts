/**
 * Control structures to help with readability.
 */
import {
  o
} from './observable'

import {
  Mixin,
} from './mixins'

import { e, Insertable, Renderable } from './elt'

import {
  insert_before_and_init,
  node_remove_after,
} from './dom'


/**
 * Get a node that can be inserted into the DOM from an insertable `i`. The returned value can be
 * a single `Node` or a `DocumentFragment` if the insertable was an array.
 *
 * Note that this function will ignore Decorators, Mixins and other non-renderable elements.
 *
 * @param i The insertable
 *
 * @category dom, toc
 */
export function get_node_from_insertable(i: Insertable<Node>) {

  if (i instanceof Node)
    return i

  if (i instanceof Array) {
    const res = document.createDocumentFragment()
    for (var n of i) {
      res.appendChild(get_node_from_insertable(n))
    }
    return res
  }

  if (i instanceof o.Observable) {
    return $Display(i)
  }

  if (i != null) {
    return document.createTextNode(i.toString())
  }

  return document.createComment('' + i)
}


/**
 * A subclass of `#Verb` made to store nodes between two comments.
 *
 * Can be used as a base to build verbs more easily.
 * @category verb, toc
 */
var cmt_count = 0
export class CommentContainer extends Mixin<Comment> {

  end = document.createComment(`-- ${this.constructor.name} ${cmt_count ++} --`)

  init(node: Comment) {
    node.parentNode!.insertBefore(this.end, node.nextSibling)
  }

  /**
   * Remove all nodes between this.start and this.node
   */
  clear() {
    if (this.end.previousSibling !== this.node)
      node_remove_after(this.node, this.end.previousSibling!)
  }

  setContents(cts: Node) {
    this.clear()

    // Insert the new comment before the end
    insert_before_and_init(this.node.parentNode!, cts, this.end)
  }
}



/**
 * Displays and actualises the content of an Observable containing
 * Node, string or number into the DOM.
 */
export class Displayer extends CommentContainer {

  constructor(public _obs: o.RO<Insertable<Node>>) {
    super()
  }

  init(node: Comment) {
    super.init(node)
    this.observe(this._obs, value => this.setContents(get_node_from_insertable(value)))
  }

}


/**
 * Write and update the string value of an observable value into
 * a Text node.
 *
 * This verb is used whenever an observable is passed as a child to a node.
 *
 * ```tsx
 * import { o, $Display, $Fragment as $ } from 'elt'
 *
 * const o_text = o('text')
 * document.body.appendChild(<$>
 *   {o_text} is the same as {$Display(o_text)}
 * </$>)
 * ```
 *
 * @category verb, toc
 */
export function $Display(obs: o.RO<Insertable<Node>>): Node {
  if (!(obs instanceof o.Observable)) {
    return get_node_from_insertable(obs as Insertable<Node>)
  }

  return e(document.createComment('$Display'), new Displayer(obs))
}


/**
 * @category verb, toc
 *
 * Display content depending on the value of a `condition`, which can be an observable.
 *
 * If `condition` is not an observable, then the call to `$If` is resolved immediately without using
 * an intermediary observable.
 *
 * If `condition` is readonly, then the observables given to `display` and `display_otherwise` are
 * Readonly as well.
 *
 * For convenience, the truth value is given typed as a `o.Observable<NonNullable<...>>` in `display`,
 * since there is no way `null` or `undefined` could make their way here.
 *
 * ```tsx
 * // o_obj is nullable.
 * const o_obj = o({a: 'hello'} as {a: string} | null)
 *
 * $If(o_obj,
 *   // o_truthy here is o.Observable<{a: string}>
 *   // which is why we can safely use .p('a') without typescript complaining
 *   o_truthy => <>{o_truthy.p('a')}
 * )
 * ```
 */
export function $If<T extends o.RO<any>>(
  condition: T,
  display: (arg: $If.NonNullableRO<T>) => Renderable,
  display_otherwise?: (a: T) => Renderable
): Node {
  // ts bug on condition.
  if (typeof display === 'function' && !((condition as any) instanceof o.Observable)) {
    return condition ?
      get_node_from_insertable(display(condition as any))
      : get_node_from_insertable(display_otherwise ?
          (display_otherwise(null!))
          : document.createComment('false'))
  }

  return e(document.createComment('$If'),
    new $If.ConditionalDisplayer<any>(display, condition, display_otherwise)
  )
}

export namespace $If {

  /**
   * Get the type of a potentially `Observable` type where `null` and `undefined` are exluded, keeping
   * the `Readonly` status if the provided `Observable` type was `Readonly`.
   *
   * ```tsx
   * NonNullableObs<o.Observable<string | null>> // -> o.Observable<string>
   * NonNullableObs<o.RO<number | undefined | null> // -> o.ReadonlyObservable<number> | number
   * NonNullableObs<string> // -> string
   * ```
   */
  export type NonNullableRO<T> = T extends o.Observable<infer U> ? o.Observable<NonNullable<U>> :
    T extends o.ReadonlyObservable<infer U> ? o.ReadonlyObservable<NonNullable<U>>
    : NonNullable<T>


  /**
   * Implementation of the `DisplayIf()` verb.
   * @category internal
   */
  export class ConditionalDisplayer<T extends o.ReadonlyObservable<any>> extends Displayer {

    constructor(
      protected display: (arg: $If.NonNullableRO<T>) => Renderable,
      protected condition: T,
      protected display_otherwise?: (arg: T) => Renderable
    ) {
      super(condition.tf((cond, old, v) => {
        if (old !== o.NOVALUE && !!cond === !!old && v !== o.NOVALUE) return v as Insertable<Node>
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
 * @category verb, toc
 *
 * Repeats the `render` function for each element in `ob`, optionally separating each rendering
 * with the result of the `separator` function.
 *
 * If `ob` is an observable, `$Repeat` will update the generated nodes to match the changes.
 * If it is a `o.ReadonlyObservable`, then the `render` callback will be provided a read only observable.
 *
 * `ob` is not converted to an observable if it was not one, in which case the results are executed
 * right away and only once.
 *
 * ```tsx
 * const o_mylist = o(['hello', 'world'])
 *
 * <div>
 *   {Repeat(
 *      o_mylist,
 *      o_item => <Button click={event => o_item.mutate(value => value + '!')}/>,
 *      () => <div class='separator'/> // this div will be inserted between each button.
 *   )}
 * </div>
 * ```
 */
export function $Repeat<T extends o.RO<any[]>>(
  ob: T,
  render: (arg: $Repeat.RoItem<T>, idx: number) => Insertable<Node>,
  separator?: $Repeat.SeparatorFn
): Node {
  if (!(ob instanceof o.Observable)) {
    const arr = ob as any[]
    const final = new Array(separator ? arr.length * 2 - 1 : arr.length) as Node[]
    var i = 0
    var j = 0
    for (var elt of arr) {
      arr[i++] = render(elt, j++)
      if (separator)
        arr[i++] = separator(j - 1)
    }
    return get_node_from_insertable(final)
  }

  return e(
    document.createComment('$Repeat'),
    new $Repeat.Repeater(ob, render as any, separator)
  )
}

export namespace $Repeat {

  export type RoItem<T extends o.RO<any>> = T extends o.Observable<(infer U)[]> ? o.Observable<U>
  : T extends o.ReadonlyObservable<(infer U)[]> ? o.ReadonlyObservable<U>
  : T extends (infer U)[] ? U
  : T;

  /** @category internal */
  export type RenderFn<T> = (e: o.Observable<T>, oi: number) => Insertable<Node>

  export type SeparatorFn = (oi: number) => Insertable<Node>

  /**
   *  Repeats content.
   * @category internal
   */
  export class Repeater<T> extends Mixin<Comment> {

    // protected proxy = o([] as T[])
    protected obs: o.Observable<T[]>
    protected positions: Node[] = []
    protected next_index: number = 0
    protected lst: T[] = []

    protected child_obs: o.Observable<T>[] = []

    constructor(
      ob: o.Observable<T[]>,
      public renderfn: $Repeat.RenderFn<T>,
      public separator?: $Repeat.SeparatorFn
    ) {
      super()

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
        fr.appendChild(get_node_from_insertable(this.separator(this.next_index)))
      }

      var node = get_node_from_insertable(this.renderfn(ob, this.next_index))
      this.positions.push(node instanceof DocumentFragment ? node.lastChild! : node)
      fr.appendChild(node)

      this.next_index++
      return true
    }

    appendChildren(count: number) {
      const parent = this.node.parentNode!
      if (!parent) return

      var fr = document.createDocumentFragment()

      while (count-- > 0) {
        if (!this.next(fr)) break
      }

      insert_before_and_init(parent, fr, this.node)
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
 * Similarly to `$Repeat`, `$RepeatScroll` repeats the `render` function for each element in `ob`,
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
 * @category verb, toc
 */
export function $RepeatScroll<T extends o.RO<any[]>>(
  ob: T,
  render: (arg: $Repeat.RoItem<T>, idx: number) => Insertable<Node>,
  options: Partial<$RepeatScroll.Options> = {}
): Node {
  // we cheat the typesystem, which is not great, but we know what we're doing.
  return e(
    document.createComment('$RepeatScroll'),
    new $RepeatScroll.ScrollRepeater<any>(o(ob as any) as o.Observable<any>, render as any, options)
  )
}

export namespace $RepeatScroll {

  export type Options = {
    separator?: $Repeat.SeparatorFn
    scroll_buffer_size?: number
    threshold_height?: number
  }

  /**
   * Repeats content and append it to the DOM until a certain threshold
   * is meant. Use it with `scrollable()` on the parent..
   * @category internal
   */
  export class ScrollRepeater<T> extends $Repeat.Repeater<T> {

    protected parent: HTMLElement|null = null

    constructor(
      ob: o.Observable<T[]>,
      renderfn: (e: o.Observable<T>, oi: number) => Insertable<Node>,
      public options: $RepeatScroll.Options
    ) {
      super(ob, renderfn)
    }

    scroll_buffer_size = this.options.scroll_buffer_size ?? 10
    threshold_height = this.options.threshold_height ?? 500
    separator = this.options.separator

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
 * ```tsx
 * const o_value = o('hello')
 * <div>
 *   {$Switch(o_value)
 *    .$Case('world', o_v => <span>It is {o_v}</span>)
 *    .$Case(v => v === 'one' || v === 'two', () => <>Test with a function</>)
 *    .$Case('something else', () => <span>We got another one</span>)
 *    .$Else(() => <>Something else entirely</>)
 *   }
 * </div>
 * ```
 *
 * `$Switch()` can work with typeguards to narrow a type in the observable passed to the then callback,
 * but only with defined functions. It is however not as powerful as typescript's type guards in ifs
 * and will not recognize `typeof` or `instanceof` calls.
 *
 * ```tsx
 * const is_number = (v: any): v is number => typeof v === 'number'
 * const o_obs = o('hello' as string | number) // Observable<string | number>
 *
 * $Switch(o_obs)
 *   .$Case(is_number, o_num => o_num) // o_num is Observable<number>
 *   .$Case('hey', o_obs => )
 *   .$Else(() => null)
 * ```
 *
 * @category verb, toc
 */
export function $Switch<T>(obs: o.Observable<T>): $Switch.Switcher<T>
export function $Switch<T>(obs: o.ReadonlyObservable<T>): $Switch.ReadonlySwitcher<T>
export function $Switch<T>(obs: any): any {
  return new ($Switch.Switcher as any)(obs)
}


export namespace $Switch {
  /**
   * Used by the `Switch()` verb.
   * @category internal
   */
  export class Switcher<T> extends o.VirtualObservable<[T], Renderable> {

    cases: [(T | ((t: T) => any)), (t: o.Observable<T>) => Renderable][] = []
    passthrough: () => Renderable = () => null
    prev_case: any = null
    prev: Renderable | o.NoValue

    constructor(public obs: o.Observable<T>) {
      super([obs])
    }

    getter([nval] : [T]): Renderable {
      const cases = this.cases
      for (var c of cases) {
        const val = c[0]
        if (val === nval || (typeof val === 'function' && (val as Function)(nval))) {
          if (this.prev_case === val) {
            return this.prev as Renderable
          }
          this.prev_case = val
          const fn = c[1]
          return (this.prev = fn(this.obs))
        }
      }
      if (this.prev_case === this.passthrough)
        return this.prev as Renderable
      this.prev_case = this.passthrough
      return (this.prev = this.passthrough ? this.passthrough() : null)
    }

    $Case<S extends T>(value: (t: T) => t is S, fn: (v: o.Observable<S>) => Renderable): this
    $Case<S extends T>(value: S, fn: (v: o.Observable<S>) => Renderable): this
    $Case(predicate: (t: T) => any, fn: (v: o.Observable<T>) => Renderable): this
    $Case(value: T | ((t: T) => any), fn: (v: o.Observable<T>) => Renderable): this {
      this.cases.push([value, fn])
      return this
    }

    $Else(fn: () => Renderable) {
      this.passthrough = fn
      return this
    }

  }


  export interface ReadonlySwitcher<T> extends o.ReadonlyObservable<Renderable> {
    $Case<S extends T>(value: (t: T) => t is S, fn: (v: o.ReadonlyObservable<S>) => Renderable): this
    $Case<S extends T>(value: S, fn: (v: o.ReadonlyObservable<S>) => Renderable): this
    $Case(predicate: (t: T) => any, fn: (v: o.ReadonlyObservable<T>) => Renderable): this
    $Else(fn: (v: o.ReadonlyObservable<T>) => Renderable): this
  }

}
