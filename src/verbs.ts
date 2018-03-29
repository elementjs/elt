/**
 * Control structures to help with readability.
 */
import {
  o,
  O,
  Observable,
  ReadonlyObservable,
  RO
} from './observable'

import {
  Mixin,
} from './mixins'

import {
  EmptyAttributes,
  Renderable
} from './types'

import {
  bound
} from './decorators'

import {
  remove_and_unmount,
  mount,
  insert_before_and_mount
} from './mounting'


/**
 * Extend this class when writing a verb.
 *
 * This is a very short class declaration whose only purpose
 * is to help create shorter verb functions.
 */
export class Verb extends Mixin<Comment> {

  node: Comment

  /**
   * Create a Verb, bind it to its rendered node, and return it.
   */
  static create<V extends Verb, A, B, C, D, E>(this: new (a: A, b: B, c: C, d: D, e: E) => V, a: A, b: B, c: C, d: D, e: E): Node
  static create<V extends Verb, A, B, C, D>(this: new (a: A, b: B, c: C, d: D) => V, a: A, b: B, c: C, d: D): Node
  static create<V extends Verb, A, B, C>(this: new (a: A, b: B, c: C) => V, a: A, b: B, c: C): Node
  static create<V extends Verb, A, B>(this: new (a: A, b: B) => V, a: A, b: B): Node
  static create<V extends Verb, A>(this: new (a: A) => V, a: A): Node
  static create<V extends Verb>(this: new (...a: any[]) => V, ...args: any[]): Node {
    var mixin = (new this(...args))
    mixin.addToNode(mixin.node)
    return mixin.node
  }

  constructor() {
    super()
    this.node = document.createComment(`  ${this.constructor.name}  `)
  }

}


/**
 * Displays and actualises the content of an Observable containing
 * Node, string or number into the DOM.
 */
export class Displayer extends Verb {

  next_node: Node | null = null

  constructor(public _obs: ReadonlyObservable<Renderable>) {
    super()
  }

  init() {
    this.observe(this._obs, value => {
      if (!(value instanceof Node)) {
        var val = value != null ? value.toString() : ''

        var next = this.next_node
        if (next && next instanceof Text) {
          next.nodeValue = val
          return
        } else {
          value = document.createTextNode(val)
        }
      }

      var parent = this.node.parentNode!
      var next = this.next_node
      if (next) {
        remove_and_unmount(next)
      }
      this.next_node = value
      insert_before_and_mount(parent, value, this.node)
    })
  }

  inserted(node: Comment, parent: Node) {
    if (this.next_node) {
      insert_before_and_mount(parent, this.next_node, this.node)
    }
  }

  removed(node: Comment, parent: Node) {
    if (this.next_node) {
      // can this err ?
      remove_and_unmount(this.next_node)
    }
  }

}


/**
 * Write and update the string value of an observable value into
 * a Text node.
 */
export function Display(obs: ReadonlyObservable<Renderable>): Node {
  return Displayer.create(obs)
}



export type DisplayCreator<T> = (a: Observable<T>) => Renderable
export type Displayable<T> = Renderable | DisplayCreator<T>
export type ReadonlyDisplayable<T> = Renderable | ((a: ReadonlyObservable<T>) => Renderable)

export class ConditionalDisplayer<T> extends Displayer {

  rendered_display: Renderable
  rendered_otherwise: Renderable

  constructor(
    protected display: Displayable<T>,
    protected condition: O<T>,
    protected display_otherwise?: Displayable<T>
  ) {
    super(o(condition).tf(cond => {
      if (cond) {
        if (!this.rendered_display)
          this.rendered_display = typeof display === 'function' ? display(o(condition)) : display
        return this.rendered_display
      } else {
        if (!this.rendered_otherwise)
          this.rendered_otherwise = typeof display_otherwise === 'function' ? display_otherwise(o(condition)) : display_otherwise
        return this.rendered_otherwise
      }
    }))
  }

}


/**
 *
 */
export function DisplayIf<T>(
  condition: Observable<T | undefined | null>,
  display: Displayable<T>, display_otherwise?: Displayable<T>
): Node
export function DisplayIf<T>(
  condition: Observable<T | undefined>,
  display: Displayable<T>, display_otherwise?: Displayable<T>
): Node
export function DisplayIf<T>(
  condition: Observable<T | null>,
  display: Displayable<T>, display_otherwise?: Displayable<T>
): Node
export function DisplayIf<T>(
  condition: Observable<T>,
  display: Displayable<T>, display_otherwise?: Displayable<T>
): Node
export function DisplayIf<T>(
  condition: ReadonlyObservable<T | undefined | null>,
  display: Displayable<T>, display_otherwise?: Displayable<T>
): Node
export function DisplayIf<T>(
  condition: ReadonlyObservable<T | undefined>,
  display: ReadonlyDisplayable<T>, display_otherwise?: ReadonlyDisplayable<T>
): Node
export function DisplayIf<T>(
  condition: ReadonlyObservable<T | null>,
  display: ReadonlyDisplayable<T>, display_otherwise?: ReadonlyDisplayable<T>
): Node
export function DisplayIf<T>(
  condition: ReadonlyObservable<T>,
  display: ReadonlyDisplayable<T>, display_otherwise?: ReadonlyDisplayable<T>
): Node
export function DisplayIf<T>(
  condition: null | undefined | O<T | null | undefined>,
  display: Displayable<any>,
  display_otherwise?: Displayable<T>
): Node {
  return ConditionalDisplayer.create(display, condition as O<T>, display_otherwise)
}


export type RenderFn<T> = (e: Observable<T>, oi: number) => Renderable
export type ReadonlyRenderFn<T> = (e: ReadonlyObservable<T>, oi: number) => Renderable
export type SeparatorFn = (oi: number) => Renderable


/**
 *  Repeats content.
 */
export class Repeater<T> extends Verb {

  protected obs: Observable<T[]>
  protected positions: Node[] = []
  protected next_index: number = 0
  protected lst: T[] = []

  protected child_obs: Observable<T>[] = []

  constructor(
    ob: O<T[]>,
    public renderfn: RenderFn<T>,
    public separator?: SeparatorFn
  ) {
    super()

    this.obs = o(ob)
  }

  init() {
    this.observe(this.obs, (lst, old_value) => {
      this.lst = lst || []
      const diff = lst.length - this.next_index

      if (diff > 0)
        this.appendChildren(diff)
      else
        this.removeChildren(-diff)
    })
  }

  /**
   * Generate the next element to append to the list.
   */
  next(): Node | null {
    if (this.next_index >= this.lst.length)
      return null

    var ob = this.obs.p(this.next_index)
    this.child_obs.push(ob)

    var res = this.renderfn(ob, this.next_index)
    if (!(res instanceof Node)) res = document.createTextNode(res ? '' + res : '')

    if (this.separator && this.next_index > 0) {
      const sep = this.separator(this.next_index)
      res = E(Fragment, {}, sep, res)
    }

    this.positions.push(res)
    this.next_index++
    return res
  }

  appendChildren(count: number) {
    var next: Node | null
    var parent = this.node.parentNode!

    var fr = document.createDocumentFragment()
    var to_mount = []

    while (count-- > 0) {
      next = this.next()
      if (!next) break
      to_mount.push(next)
      fr.appendChild(next)
    }

    parent.insertBefore(fr, this.node)
    for (var n of to_mount) mount(n, parent)

  }

  removeChildren(count: number) {
    // Détruire jusqu'à la position concernée...
    this.next_index = this.next_index - count

    var co = this.child_obs
    var po = this.positions
    var l = co.length

    // Remove the excess nodes
    for (var i = this.next_index; i < l; i++) {
      co[i].stopObservers()
      remove_and_unmount(po[i])
    }

    this.child_obs = this.child_obs.slice(0, this.next_index)
    this.positions = this.positions.slice(0, this.next_index)
  }

  inserted(node: Comment, parent: Node) {
    for (var n of this.positions) {
      insert_before_and_mount(parent, n, node)
    }
  }

  removed() {
    for (var n of this.positions) {
      remove_and_unmount(n)
    }

  }

}


/**
 * Repeats content and append it to the DOM until a certain threshold
 * is meant. Use it with `scrollable()` on the parent..
 */
export class ScrollRepeater<T> extends Repeater<T> {

  protected parent: HTMLElement|null = null

  constructor(
    ob: O<T[]>,
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

  @bound
  onscroll() {
    if (!this.parent) return
    this.appendChildren(0)
  }

  inserted() {
    super.inserted.apply(this, arguments)

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
      return
    }

    this.parent.addEventListener('scroll', this.onscroll)
  }

  removed() {
    super.removed.apply(this, arguments)

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
 */
export function Repeat<T>(ob: T[], render: RenderFn<T>, separator?: SeparatorFn): Node;
export function Repeat<T>(ob: Observable<T[]>, render: RenderFn<T>, separator?: SeparatorFn): Node
export function Repeat<T>(ob: ReadonlyObservable<T[]>, render: ReadonlyRenderFn<T>, separator?: SeparatorFn): Node
export function Repeat<T>(ob: RO<T[]>, render: RenderFn<T>, separator?: SeparatorFn): Node
export function Repeat(
  ob: any,
  render: any,
  separator?: SeparatorFn
): Node {
  return Repeater.create(ob, render, separator)
}


export function RepeatScroll<T>(ob: T[], render: RenderFn<T>, separator?: SeparatorFn, scroll_buffer_size?: number): Node;
export function RepeatScroll<T>(ob: Observable<T[]>, render: RenderFn<T> , separator?: SeparatorFn, scroll_buffer_size?: number): Node;
export function RepeatScroll<T>(ob: ReadonlyObservable<T[]>, render: ReadonlyRenderFn<T>, separator?: SeparatorFn, scroll_buffer_size?: number): Node;
export function RepeatScroll<T>(
  ob: any,
  render: any,
  separator?: SeparatorFn,
  scroll_buffer_size = 10
): Node {
  return ScrollRepeater.create(ob, render, scroll_buffer_size, 500, separator)
}


/**
 *  A comment node that holds a document fragment.
 */
export class FragmentHolder extends Verb {

  child_nodes: Node[]

  constructor(public fragment: DocumentFragment) {
    super()
    var iter: Node | null = fragment.firstChild
    var nodes: Node[] = []
    while (iter) {
      nodes.push(iter)
      iter = iter.nextSibling
    }
    this.child_nodes = nodes
  }

  inserted(node: Comment, parent: Node) {
    parent.insertBefore(this.fragment, node.nextSibling)
    for (var c of this.child_nodes) {
      mount(c, parent)
    }
  }

  removed(n: Node, p: Node, pre: Node, next: Node) {
    for (var c of this.child_nodes) {
      remove_and_unmount(c)
      this.fragment.appendChild(c)
    }
  }

}


/**
 *  Fragment wraps everything into a DocumentFragment.
 *  Beware that because of typescript's imprecisions with the JSX namespace,
 *  we had to tell this function that it returns an HTMLElement while this
 *  completely false !
 */
export function Fragment(attrs: EmptyAttributes, children: DocumentFragment): Element {
  // This is a trick !
  return FragmentHolder.create(children) as Element
}
