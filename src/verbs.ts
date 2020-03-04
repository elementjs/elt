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

  removed(node: Node, parent: Node) {
    this.clear()
    parent.removeChild(this.end)
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
 * Display content depending on the value of a `condition`, which can be `#o.Observable`
 */
export function $If<T extends o.RO<any>>(
  condition: T,
  display: $If.DisplayFn<$If.NonNullableObs<T>>,
  display_otherwise?: $If.DisplayFn<T>
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

  export type DisplayFn<T> = (a: T) => Renderable

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
  export type NonNullableObs<T> = T extends o.Observable<infer U> ? o.Observable<NonNullable<U>> :
    T extends o.ReadonlyObservable<infer U> ? o.ReadonlyObservable<NonNullable<U>>
    : NonNullable<T>


  /**
   * Implementation of the `DisplayIf()` verb.
   * @internal
   */
  export class ConditionalDisplayer<T extends o.ReadonlyObservable<any>> extends Displayer {

    constructor(
      protected display: $If.DisplayFn<$If.NonNullableObs<T>>,
      protected condition: T,
      protected display_otherwise?: $If.DisplayFn<T>
    ) {
      super(condition.tf((cond, old, v) => {
        if (old !== o.NOVALUE && !!cond === !!old && v !== o.NOVALUE) return v as Insertable<Node>
        if (cond) {
          return display(condition as NonNullableObs<T>)
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
 *  Repeats content.
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

  removed() {
    this.removeChildren(this.positions.length)
  }

}


/**
 * Repeats content and append it to the DOM until a certain threshold
 * is meant. Use it with `scrollable()` on the parent..
 */
export class ScrollRepeater<T> extends Repeater<T> {

  protected parent: HTMLElement|null = null

  constructor(
    ob: o.Observable<T[]>,
    renderfn: (e: o.Observable<T>, oi: number) => Insertable<Node>,
    public scroll_buffer_size: number = 10,
    public threshold_height: number = 500,
    public separator?: $Repeat.SeparatorFn,
  ) {
    super(ob, renderfn)
  }

  /**
   * Append `count` children if the parent was not scrollable (just like Repeater),
   * or append elements until we've added past the bottom of the container.
   */
  appendChildren(count: number) {
    if (!this.parent)
      // if we have no scrollable parent, just act like a regular repeater.
      return super.appendChildren(count)

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

  init() {
    requestAnimationFrame(() => {
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
        this.appendChildren(0)
        return
      }

      this.parent.addEventListener('scroll', this.onscroll)

      this.observe(this.obs, lst => {
        this.lst = lst || []
        const diff = lst.length - this.next_index

        if (diff < 0)
          this.removeChildren(-diff)

        if (diff > 0)
          this.appendChildren(0)
      })

    })

  }

  onscroll = () => {
    if (!this.parent) return
    this.appendChildren(0)
  }

  removed() {
    super.removed()

    // remove Scrolling
    if (!this.parent) return

    this.parent.removeEventListener('scroll', this.onscroll)
    this.parent = null
  }

}


/**
 * @category verb, toc
 *
 * Repeats the `render` function for each element in `ob`, optionally separating each rendering
 * with the result of the `separator` function.
 *
 * If `ob` is an observable, `Repeat` will update the generated nodes to match the changes.
 * If it is a `ReadonlyObservable`, then the `render` callback will be provided a read only observable.
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
    new Repeater(ob, render as any, separator)
  )
}

export namespace $Repeat {

  export type RoItem<T extends o.RO<any>> = T extends o.Observable<(infer U)[]> ? o.Observable<U>
  : T extends o.ReadonlyObservable<(infer U)[]> ? o.ReadonlyObservable<U>
  : T extends (infer U)[] ? U
  : T;

  export type RenderFn<T> = (e: o.Observable<T>, oi: number) => Insertable<Node>
  export type ReadonlyRenderFn<T> = (e: o.ReadonlyObservable<T>, oi: number) => Insertable<Node>

  export type SeparatorFn = (oi: number) => Insertable<Node>

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
 * @category verb, toc
 */
export function $RepeatScroll<T extends o.RO<any[]>>(
  ob: T,
  render: (arg: $Repeat.RoItem<T>, idx: number) => Insertable<Node>,
  separator?: $Repeat.SeparatorFn,
  scroll_buffer_size = 10
): Node {
  // we cheat the typesystem, which is not great, but we know what we're doing.
  return e(
    document.createComment('$RepeatScroll'),
    new ScrollRepeater(o(ob as any) as o.Observable<any>, render as any, scroll_buffer_size, 500, separator)
  )
}


/**
 * Perform a Switch statement
 * @param obs The observable switched on
 * @category verb, toc
 */
export function $Switch<T>(obs: o.Observable<T>): $Switch.Switcher<T>
export function $Switch<T>(obs: o.ReadonlyObservable<T>): $Switch.ReadonlySwitcher<T>
export function $Switch<T>(obs: o.ReadonlyObservable<T>): $Switch.ReadonlySwitcher<T> {
  return new ($Switch.Switcher as any)(obs)
}


export namespace $Switch {
  /**
   * Used by the `Switch()` verb.
   */
  export class Switcher<T> extends o.VirtualObservable<[T], Insertable<Node>> {

    cases: [(T | ((t: T) => any)), (t: o.Observable<T>) => Insertable<Node>][] = []
    passthrough: () => Insertable<Node> = () => null
    prev_case: any = null
    prev: Insertable<Node> | o.NoValue

    constructor(public obs: o.Observable<T>) {
      super([obs])
    }

    getter([nval] : [T]): Insertable<Node> {
      const cases = this.cases
      for (var c of cases) {
        const val = c[0]
        if (val === nval || (typeof val === 'function' && (val as Function)(nval))) {
          if (this.prev_case === val) {
            return this.prev as Insertable<Node>
          }
          this.prev_case = val
          const fn = c[1]
          return (this.prev = fn(this.obs))
        }
      }
      if (this.prev_case === this.passthrough)
        return this.prev as Insertable<Node>
      this.prev_case = this.passthrough
      return (this.prev = this.passthrough ? this.passthrough() : null)
    }

    Case(value: T | ((t: T) => any), fn: (v: o.Observable<T>) => Insertable<Node>): this {
      this.cases.push([value, fn])
      return this
    }

    Else(fn: () => Insertable<Node>) {
      this.passthrough = fn
      return this
    }

  }


  export interface ReadonlySwitcher<T> extends o.ReadonlyObservable<Insertable<Node>> {
    Case(value: T | ((t: T) => boolean), fn: (v: o.ReadonlyObservable<T>) => Insertable<Node>): this
    Else(fn: () => Insertable<Node>): this
  }

}