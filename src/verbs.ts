/**
 * Control structures to help with readability.
 */
import {
  o,
  MaybeObservable,
  Observable,
  ObservableProxy
} from 'domic-observable'

import {
  getDocumentFragment
} from './domic'

import {
  Mixin,
} from './mixins'

import {
  EmptyAttributes,
} from './types'

import {
  bound
} from './decorators'


/**
 * Extend this class when writing a verb.
 *
 * This is a very short class declaration which only purpose
 * is to help create shorter verb functions.
 */
export class Verb extends Mixin<Comment> {

  node: Comment

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
 * Writer displays a node or a string next to itself.
 */
export class Displayer extends Verb {

  next_node: Node | null
  backup: WeakMap<DocumentFragment, Node[]> | null = null

  constructor(public _obs: Observable<null|undefined|string|number|Node>) {
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
      if (this.next_node) {
        parent.removeChild(this.next_node)
      }
      this.next_node = value
      parent.insertBefore(value, this.node)
    })
  }

  inserted(node: Comment, parent: Node) {
    if (this.next_node) {
      parent.insertBefore(this.next_node, this.node)
    }
  }

  removed(node: Comment, parent: Node) {
    if (this.next_node) {
      // can this err ?
      parent.removeChild(this.next_node)
    }
  }

}


/**
 * Write and update the string value of an observable value into
 * a Text node.
 */
export function Display(obs: Observable<null|undefined|string|number|Node>): Node {
  return Displayer.create(obs)
}



export type DisplayCreator<T> = (a: Observable<T>) => Node
export type Displayable<T> = Node | DisplayCreator<T>

export class ConditionalDisplayer<T> extends Displayer {

  rendered_display: Node | undefined
  rendered_otherwise: Node | undefined

  constructor(
    protected display: Displayable<T>,
    protected condition: MaybeObservable<T>,
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
  condition: MaybeObservable<T>,
  display: Displayable<T>,
  display_otherwise?: Displayable<T>
): Node {
  return ConditionalDisplayer.create(display, condition as MaybeObservable<T>, display_otherwise)
}


export type RenderFn<T> = (e: Observable<T>, oi: number) => Node
export type RenderFnProxy<T> = (e: ObservableProxy<T>, oi: number) => Node


/**
 *
 */
export class Repeater<T> extends Verb {

  protected obs: Observable<T[]>
  protected positions: Node[] = []
  protected next_index: number = 0
  protected lst: T[] = []

  protected child_obs: Observable<T>[] = []

  constructor(
    ob: MaybeObservable<T[]>,
    public renderfn: RenderFn<T>
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
    this.positions.push(res)

    this.next_index++
    return res
  }

  appendChildren(count: number) {
    var next: Node | null
    var parent = this.node.parentNode!

    var fr = document.createDocumentFragment()

    while (count-- > 0) {
      next = this.next()
      if (!next) break
      fr.appendChild(next)
    }

    parent.insertBefore(fr, this.node)
  }

  removeChildren(count: number) {
    // Détruire jusqu'à la position concernée...
    this.next_index = this.next_index - count

    var parent = this.node.parentNode!

    var co = this.child_obs
    var po = this.positions
    var l = co.length

    // Remove the excess nodes
    for (var i = this.next_index; i < l; i++) {
      // We preemptively stop the observers to avoid them triggering with
      // the new values (which are often undefined), since anyway their corresponding
      // nodes will be removed immediately.
      co[i].stopObservers()
      parent.removeChild(po[i])
    }

    this.child_obs = this.child_obs.slice(0, this.next_index)
    this.positions = this.positions.slice(0, this.next_index)
  }

  inserted(node: Comment, parent: Node) {
    for (var n of this.positions) {
      parent.insertBefore(n, node)
    }
  }

  removed() {
    for (var n of this.positions) {
      if (n.parentNode) n.parentNode.removeChild(n)
    }

  }

}


export class ScrollRepeater<T> extends Repeater<T> {

  protected parent: HTMLElement|null = null

  constructor(
    ob: MaybeObservable<T[]>,
    renderfn: RenderFn<T>,
    public scroll_buffer_size: number = 10,
    public threshold_height: number = 500
  ) {
    super(ob, renderfn)
  }

  appendChildren(count: number) {
    if (!this.parent)
      // if we have no scrollable parent, just act like a regular repeater.
      return super.appendChildren(count)

    // Instead of appending all the count, break it down to bufsize packets.
    const bufsize = this.scroll_buffer_size
    const p = this.parent

    while (this.next_index < this.lst.length - 1 && p.scrollHeight - (p.clientHeight + p.scrollTop) < this.threshold_height) {
      super.appendChildren(bufsize)
    }
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
export function Repeat<T>(ob: T[], render: RenderFn<T>): Node;
export function Repeat<T>(ob: ObservableProxy<T[]>, render: RenderFnProxy<T>): Node
export function Repeat<T>(ob: Observable<T[]>, render: RenderFn<T>): Node
export function Repeat<T>(
  ob: MaybeObservable<T[]>,
  render: RenderFn<T>
): Node {
  return Repeater.create(ob, render)
}


export function RepeatScroll<T>(ob: T[], render: RenderFn<T>, scroll_buffer_size?: number): Node;
export function RepeatScroll<T>(ob: ObservableProxy<T[]>, render: RenderFnProxy<T>, scroll_buffer_size?: number): Node;
export function RepeatScroll<T>(ob: Observable<T[]>, render: RenderFn<T>, scroll_buffer_size?: number): Node;
export function RepeatScroll<T>(
  ob: MaybeObservable<T[]>,
  render: RenderFn<T>,
  scroll_buffer_size = 10
): Node {
  return ScrollRepeater.create(ob, render, scroll_buffer_size)
}


/**
 *
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

  inserted(node: Comment) {
    node.parentNode!.insertBefore(this.fragment, node.nextSibling)
  }

  removed() {
    for (var c of this.child_nodes) {
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
