/**
 * Control structures to help with readability.
 */
import {
  o
} from './observable'

import {
  Mixin,
} from './mixins'

import {
  EmptyAttributes,
  Insertable
} from './types'

import {
  remove_and_unmount,
  mount,
} from './mounting'


/**
 * Get a node that can be inserted into the DOM from an insertable.
 * @param i The insertable
 * @hidden
 */
export function getDOMInsertable(i: Insertable) {

  if (i instanceof Node)
    return i

  if (i instanceof Array) {
    const res = document.createDocumentFragment()
    for (var n of i) {
      res.appendChild(getDOMInsertable(n))
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
 * Get a node from an insertable, or a Fragment verb if the insertable
 * returned a DocumentFragment.
 *
 * This function is a helper for Display / Repeat ; its goal is to get a
 * single node from anything that may be inserted (which can be a lot of different things)
 * @hidden
 */
export function getSingleNode(i: Insertable) {
  const result = getDOMInsertable(i)
  if (result instanceof DocumentFragment) {
    new FragmentHolder(result).render()
  }
  return result
}


/**
 * Create a Comment node and bind the mixin to it.
 * @param m The mixin that will be added to the verb
 */
// export function instanciate_verb(m: Mixin<Comment>): Node {
//   const node = document.createComment(`  ${m.constructor.name} `)
//   m.addToNode(node)
//   return node
// }


/**
 * Remove nodes between other nodes, unmounting them.
 * @category helper
 */
export function remove_nodes_between(start: Node, end: Node) {
  // this is done in reverse order
  var iter = end.previousSibling as Node | null

  if (!iter) return

  while (iter && iter !== start) {
    remove_and_unmount(iter!)
    iter = end.previousSibling
  }

}

export class Verb extends Mixin<Comment> {

  render() {
    const node = document.createComment(`  ${this.constructor.name} `)
    this.addToNode(node)
    return node
  }

}

/**
 * A Mixin that stores nodes between two comments.
 * Its end is its this.node
 *
 * Can be used as a base to build verbs more easily.
 */
export class CommentContainer extends Verb {

  start = document.createComment('--start--')

  init(node: Node, parent: Node) {
    parent.insertBefore(this.start, node)
  }

  /**
   * Remove all nodes between this.start and this.node
   */
  clear() {
    remove_nodes_between(this.start, this.node)
  }

  setContents(node: Node) {
    this.clear()
    var end = this.node

    // Insert the new node before the end
    var parent = this.node.parentNode!
    parent.insertBefore(node, end)

    var child = this.start.nextSibling
    while (child && child !== end) {
      mount(child)
      child = child.nextSibling
    }
  }

  removed(node: Node, parent: Node) {
    this.clear()
    parent.removeChild(this.start)
  }
}



/**
 * Displays and actualises the content of an Observable containing
 * Node, string or number into the DOM.
 * @hidden
 */
export class Displayer extends CommentContainer {

  constructor(public _obs: o.RO<Insertable>) {
    super()
  }

  init(node: Node, parent: Node) {
    super.init(node, parent)
    this.observe(this._obs, value => this.setContents(getDOMInsertable(value)))
  }

}


/**
 * Write and update the string value of an observable value into
 * a Text node.
 * @category verb
 */
export function Display(obs: o.RO<Insertable>): Node {
  if (!(obs instanceof o.Observable)) {
    return getDOMInsertable(obs as Insertable)
  }

  return new Displayer(obs).render()
}


/** @hidden */
export type Displayable<T> = (a: T) => Insertable

/** @hidden */
export type NonNullableObs<T> = T extends o.Observable<infer U> ? o.Observable<NonNullable<U>> :
  T extends o.ReadonlyObservable<infer U> ? o.ReadonlyObservable<NonNullable<U>>
  : NonNullable<T>


/**
 * Implementation of the `DisplayIf()` verb.
 * @hidden
 */
export class ConditionalDisplayer<T extends o.ReadonlyObservable<any>> extends Displayer {

  constructor(
    protected display: Displayable<NonNullableObs<T>>,
    protected condition: T,
    protected display_otherwise?: Displayable<T>
  ) {
    super(condition.tf((cond, old, v) => {
      if (old !== o.NOVALUE && !!cond === !!old && v !== o.NOVALUE) return v as Insertable
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


/**
 * @category verb
 */
export function If<T extends o.RO<any>>(
  condition: T,
  display: Displayable<NonNullableObs<T>>,
  display_otherwise?: Displayable<T>
): Node {
  // ts bug on condition.
  if (typeof display === 'function' && !((condition as any) instanceof o.Observable)) {
    return condition ?
      getDOMInsertable(display(condition as any))
      : getDOMInsertable(display_otherwise ?
          (display_otherwise(null!))
          : document.createComment('false'))
  }

  return new ConditionalDisplayer<any>(display, condition, display_otherwise).render()
}


/**
 * should I document that ?
 * @hidden
 */
export type RoItem<T extends o.RO<any>> = T extends o.Observable<(infer U)[]> ? o.Observable<U>
  : T extends o.ReadonlyObservable<(infer U)[]> ? o.ReadonlyObservable<U>
  : T extends (infer U)[] ? U
  : T;

export type RenderFn<T> = (e: o.Observable<T>, oi: number) => Insertable
export type ReadonlyRenderFn<T> = (e: o.ReadonlyObservable<T>, oi: number) => Insertable

/** @hidden */
export type SeparatorFn = (oi: number) => Insertable


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
    public renderfn: RenderFn<T>,
    public separator?: SeparatorFn
  ) {
    super()

    this.obs = o(ob)
  }

  /**
   * FIXME: WHAT SHOULD WE DO WHEN THE NODE IS REMOVED AND THEN
   * ADDED AGAIN ???
   */
  init(node: Comment) {
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
  next(): Node | null {
    if (this.next_index >= this.lst.length)
      return null

    // here, we *KNOW* it represents a defined value.
    var ob = this.obs.p(this.next_index) as o.Observable<T>

    this.child_obs.push(ob)

    var res = getSingleNode(this.renderfn(ob, this.next_index))

    if (this.separator && this.next_index > 0) {
      const sep = getSingleNode(this.separator(this.next_index))
      res = E(Fragment, {}, sep, res)
    }

    this.positions.push(res)
    this.next_index++
    return res
  }

  appendChildren(count: number) {
    var next: Node | null
    const parent = this.node.parentNode!
    if (!parent) return

    var fr = document.createDocumentFragment()

    while (count-- > 0) {
      next = this.next()
      if (!next) break
      fr.appendChild(next)
      mount(next)
    }

    parent.insertBefore(fr, this.node)
  }

  removeChildren(count: number) {
    // Détruire jusqu'à la position concernée...
    this.next_index = this.next_index - count

    var co = this.child_obs
    var po = this.positions
    var l = co.length

    // Remove the excess nodes
    for (var i = this.next_index; i < l; i++) {
      const node = po[i]
      remove_and_unmount(node)
    }

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
    renderfn: RenderFn<T>,
    public scroll_buffer_size: number = 10,
    public threshold_height: number = 500,
    public separator?: SeparatorFn,
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

  init(node: Comment) {
    requestAnimationFrame(() => {
      // Find parent with the overflow-y
      if (!this.live) return

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
 * @verb
 *
 * Repeats a render function for each element of an array.
 *
 * @param ob The array to observe
 * @param render The render function that will be called for
 * @returns a Comment node with the Repeater controller bound
 *  on it.
 * @category verb
 */
export function Repeat<T extends o.RO<any[]>>(
  ob: T,
  render: (arg: RoItem<T>, idx: number) => Insertable,
  separator?: SeparatorFn
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
    return getSingleNode(final)
  }
  return new Repeater(ob, render as any, separator).render()
}

/**
 *
 * @param ob
 * @param render
 * @param separator
 * @param scroll_buffer_size
 * @category verb
 */
export function RepeatScroll<T>(ob: T[], render: ReadonlyRenderFn<T>, separator?: SeparatorFn, scroll_buffer_size?: number): Node;
export function RepeatScroll<T>(ob: o.Observable<T[]>, render: RenderFn<T> , separator?: SeparatorFn, scroll_buffer_size?: number): Node;
export function RepeatScroll<T>(ob: o.ReadonlyObservable<T[]>, render: ReadonlyRenderFn<T>, separator?: SeparatorFn, scroll_buffer_size?: number): Node;
export function RepeatScroll<T>(
  ob: any,
  render: any,
  separator?: SeparatorFn,
  scroll_buffer_size = 10
): Node {
  return new ScrollRepeater(ob, render, scroll_buffer_size, 500, separator).render()
}


/**
 *  A comment node that holds a document fragment.
 * @hidden
 */
export class FragmentHolder extends CommentContainer {

  constructor(public fragment: DocumentFragment) {
    super()
  }

  init(node: Comment, parent: Node) {
    super.init(node, parent)
    this.setContents(this.fragment)
  }

}


/**
 *  Fragment wraps everything into a DocumentFragment.
 *  Beware that because of typescript's imprecisions with the JSX namespace,
 *  we had to tell this function that it returns an HTMLElement while this
 *  completely false !
 * @category verb
 */
export function Fragment(attrs: EmptyAttributes, children: DocumentFragment): Element {
  // This is a trick ! It is not actually an element !
  // return children as any
  return new FragmentHolder(children).render() as unknown as Element
}


/**
 * Used by the `Switch()` verb.
 * @hidden
 */
export class Switcher<T> extends o.VirtualObservable<[T], Insertable> {

  cases: [(T | ((t: T) => any)), (t: o.Observable<T>) => Insertable][] = []
  passthrough: () => Insertable = () => null
  prev_case: any = null
  prev: Insertable | o.NoValue

  constructor(public obs: o.Observable<T>) {
    super([obs])
  }

  getter([nval] : [T]): Insertable {
    const cases = this.cases
    for (var c of cases) {
      const val = c[0]
      if (val === nval || (typeof val === 'function' && (val as Function)(nval))) {
        if (this.prev_case === val) {
          return this.prev as Insertable
        }
        this.prev_case = val
        const fn = c[1]
        return (this.prev = fn(this.obs))
      }
    }
    if (this.prev_case === this.passthrough)
      return this.prev as Insertable
    this.prev_case = this.passthrough
    return (this.prev = this.passthrough ? this.passthrough() : null)
  }

  Case(value: T | ((t: T) => any), fn: (v: o.Observable<T>) => Insertable): this {
    this.cases.push([value, fn])
    return this
  }

  Else(fn: () => Insertable) {
    this.passthrough = fn
    return this
  }

}


export interface ReadonlySwitcher<T> extends o.ReadonlyObservable<Insertable> {
  Case(value: T | ((t: T) => boolean), fn: (v: o.ReadonlyObservable<T>) => Insertable): this
  Else(fn: () => Insertable): this
}


/**
 * Perform a Switch statement
 * @param obs The observable switched on
 * @category verb
 */
export function Switch<T>(obs: o.Observable<T>): Switcher<T>
export function Switch<T>(obs: o.ReadonlyObservable<T>): ReadonlySwitcher<T>
export function Switch<T>(obs: o.ReadonlyObservable<T>): ReadonlySwitcher<T> {
  return new (Switcher as any)(obs)
}
