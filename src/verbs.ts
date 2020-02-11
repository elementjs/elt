/**
 * Control structures to help with readability.
 */
import {
  o
} from './observable'

import {
  Mixin,
} from './mixins'

import { e, renderable_to_node } from './elt'

import {
  insert_before_and_init,
  node_remove_after,
  sym_mount_status,
  node_add_mixin,
  node_init,
} from './dom'


/**
 * Get a node that can be inserted into the DOM from an insertable `i`. The returned value can be
 * a single `Node` or a `DocumentFragment` if the insertable was an array.
 *
 *
 * @param i The insertable
 *
 * @category helper
 */
export function get_dom_insertable(i: e.JSX.Insertable<Node>) {

  if (i instanceof Node)
    return i

  if (i instanceof Array) {
    const res = document.createDocumentFragment()
    for (var n of i) {
      res.appendChild(get_dom_insertable(n))
    }
    return res
  }

  if (i instanceof o.Observable) {
    return Display(i)
  }

  if (i != null) {
    return document.createTextNode(i.toString())
  }

  return document.createComment('' + i)
}


/**
 * @category verb
 */
export class Verb extends Mixin<Comment> {

  render() {
    const node = document.createComment(`  ${this.constructor.name} `)
    node_add_mixin(node, this)
    return node
  }

}

/**
 * A subclass of `#Verb` made to store nodes between two comments.
 *
 * Can be used as a base to build verbs more easily.
 * @api
 * @category verb
 */
var cmt_count = 0
export class CommentContainer extends Verb {

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

  constructor(public _obs: o.RO<e.JSX.Insertable<Node>>) {
    super()
  }

  init(node: Comment) {
    super.init(node)
    this.observe(this._obs, value => this.setContents(get_dom_insertable(value)))
  }

}


/**
 * Write and update the string value of an observable value into
 * a Text node.
 * @category verb
 * @api
 */
export function Display(obs: o.RO<e.JSX.Insertable<Node>>): Node {
  if (!(obs instanceof o.Observable)) {
    return get_dom_insertable(obs as e.JSX.Insertable<Node>)
  }

  return new Displayer(obs).render()
}


/**
 * @category verb
 * @api
 *
 * Display content depending on the value of a `condition`, which can be `#o.Observable`
 */
export function If<T extends o.RO<any>>(
  condition: T,
  display: If.DisplayFn<If.NonNullableObs<T>>,
  display_otherwise?: If.DisplayFn<T>
): Node {
  // ts bug on condition.
  if (typeof display === 'function' && !((condition as any) instanceof o.Observable)) {
    return condition ?
      get_dom_insertable(display(condition as any))
      : get_dom_insertable(display_otherwise ?
          (display_otherwise(null!))
          : document.createComment('false'))
  }

  return new If.ConditionalDisplayer<any>(display, condition, display_otherwise).render()
}

export namespace If {

  export type DisplayFn<T> = (a: T) => e.JSX.Insertable<Node>

  export type NonNullableObs<T> = T extends o.Observable<infer U> ? o.Observable<NonNullable<U>> :
    T extends o.ReadonlyObservable<infer U> ? o.ReadonlyObservable<NonNullable<U>>
    : NonNullable<T>


  /**
   * Implementation of the `DisplayIf()` verb.
   */
  export class ConditionalDisplayer<T extends o.ReadonlyObservable<any>> extends Displayer {

    constructor(
      protected display: If.DisplayFn<If.NonNullableObs<T>>,
      protected condition: T,
      protected display_otherwise?: If.DisplayFn<T>
    ) {
      super(condition.tf((cond, old, v) => {
        if (old !== o.NOVALUE && !!cond === !!old && v !== o.NOVALUE) return v as e.JSX.Insertable<Node>
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
export class Repeater<T> extends Verb {

  // protected proxy = o([] as T[])
  protected obs: o.Observable<T[]>
  protected positions: Node[] = []
  protected next_index: number = 0
  protected lst: T[] = []

  protected child_obs: o.Observable<T>[] = []

  constructor(
    ob: o.Observable<T[]>,
    public renderfn: Repeat.RenderFn<T>,
    public separator?: Repeat.SeparatorFn
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
      fr.appendChild(get_dom_insertable(this.separator(this.next_index)))
    }

    var node = get_dom_insertable(this.renderfn(ob, this.next_index))
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
    renderfn: Repeat.RenderFn<T>,
    public scroll_buffer_size: number = 10,
    public threshold_height: number = 500,
    public separator?: Repeat.SeparatorFn,
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
      // Find parent with the overflow-y
      if (this.node[sym_mount_status] !== 'inserted') return

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
 * @category verb
 * @api
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
export function Repeat<T extends o.RO<any[]>>(
  ob: T,
  render: (arg: Repeat.RoItem<T>, idx: number) => e.JSX.Insertable<Node>,
  separator?: Repeat.SeparatorFn
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
    return get_dom_insertable(final)
  }
  return new Repeater(ob, render as any, separator).render()
}

export namespace Repeat {

  export type RoItem<T extends o.RO<any>> = T extends o.Observable<(infer U)[]> ? o.Observable<U>
  : T extends o.ReadonlyObservable<(infer U)[]> ? o.ReadonlyObservable<U>
  : T extends (infer U)[] ? U
  : T;

  export type RenderFn<T> = (e: o.Observable<T>, oi: number) => e.JSX.Insertable<Node>
  export type ReadonlyRenderFn<T> = (e: o.ReadonlyObservable<T>, oi: number) => e.JSX.Insertable<Node>

  export type SeparatorFn = (oi: number) => e.JSX.Insertable<Node>

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
 * @category verb
 * @api
 */
export function RepeatScroll<T>(ob: T[], render: Repeat.ReadonlyRenderFn<T>, separator?: Repeat.SeparatorFn, scroll_buffer_size?: number): Node;
export function RepeatScroll<T>(ob: o.Observable<T[]>, render: Repeat.RenderFn<T> , separator?: Repeat.SeparatorFn, scroll_buffer_size?: number): Node;
export function RepeatScroll<T>(ob: o.ReadonlyObservable<T[]>, render: Repeat.ReadonlyRenderFn<T>, separator?: Repeat.SeparatorFn, scroll_buffer_size?: number): Node;
export function RepeatScroll<T>(
  ob: any,
  render: any,
  separator?: Repeat.SeparatorFn,
  scroll_buffer_size = 10
): Node {
  return new ScrollRepeater(ob, render, scroll_buffer_size, 500, separator).render()
}


// /**
//  *  A comment node that holds a document fragment.
//  */
// export class FragmentHolder extends CommentContainer {

//   constructor(public fragment: DocumentFragment) {
//     super()
//   }

//   init(node: Comment) {
//     super.init(node)
//     this.setContents(this.fragment)
//   }

// }


/**
 * Fragment is responsible for its children. If the `Fragment` is removed and unmounted,
 * it then removes and unmounts its children.
 *
 * Beware that because of typescript's imprecisions with the JSX namespace,
 * we had to tell this function that it returns an Element, which is false.
 *
 * `<Fragment class='something'></Fragment>` will most likely crash, even though the type system
 * will allow it.
 *
 * @category verb
 */
export function Fragment(attrs: e.JSX.EmptyAttributes<DocumentFragment>, children: e.JSX.Renderable[]): DocumentFragment {
  // This is a trick ! It is not actually an element !
  const fr = document.createDocumentFragment()
  for (var i = 0, l = children.length; i < l; i++) {
    const c = renderable_to_node(children[i])
    if (c) {
      fr.appendChild(c)
      node_init(c)
    }
  }
  return fr
}


/**
 * Perform a Switch statement
 * @param obs The observable switched on
 * @category verb
 * @api
 */
export function Switch<T>(obs: o.Observable<T>): Switch.Switcher<T>
export function Switch<T>(obs: o.ReadonlyObservable<T>): Switch.ReadonlySwitcher<T>
export function Switch<T>(obs: o.ReadonlyObservable<T>): Switch.ReadonlySwitcher<T> {
  return new (Switch.Switcher as any)(obs)
}


export namespace Switch {
  /**
   * Used by the `Switch()` verb.
   */
  export class Switcher<T> extends o.VirtualObservable<[T], e.JSX.Insertable<Node>> {

    cases: [(T | ((t: T) => any)), (t: o.Observable<T>) => e.JSX.Insertable<Node>][] = []
    passthrough: () => e.JSX.Insertable<Node> = () => null
    prev_case: any = null
    prev: e.JSX.Insertable<Node> | o.NoValue

    constructor(public obs: o.Observable<T>) {
      super([obs])
    }

    getter([nval] : [T]): e.JSX.Insertable<Node> {
      const cases = this.cases
      for (var c of cases) {
        const val = c[0]
        if (val === nval || (typeof val === 'function' && (val as Function)(nval))) {
          if (this.prev_case === val) {
            return this.prev as e.JSX.Insertable<Node>
          }
          this.prev_case = val
          const fn = c[1]
          return (this.prev = fn(this.obs))
        }
      }
      if (this.prev_case === this.passthrough)
        return this.prev as e.JSX.Insertable<Node>
      this.prev_case = this.passthrough
      return (this.prev = this.passthrough ? this.passthrough() : null)
    }

    Case(value: T | ((t: T) => any), fn: (v: o.Observable<T>) => e.JSX.Insertable<Node>): this {
      this.cases.push([value, fn])
      return this
    }

    Else(fn: () => e.JSX.Insertable<Node>) {
      this.passthrough = fn
      return this
    }

  }


  export interface ReadonlySwitcher<T> extends o.ReadonlyObservable<e.JSX.Insertable<Node>> {
    Case(value: T | ((t: T) => boolean), fn: (v: o.ReadonlyObservable<T>) => e.JSX.Insertable<Node>): this
    Else(fn: () => e.JSX.Insertable<Node>): this
  }

}