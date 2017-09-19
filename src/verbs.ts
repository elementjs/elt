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
  BaseController,
} from './controller'

import {
  EmptyAttributes,
} from './types'


/**
 * Extend this class when writing a verb.
 *
 * This is a very short class declaration which only purpose
 * is to help create shorter verb functions.
 */
export class Verb extends BaseController {

  node: Comment

  static create<V extends Verb, A, B, C, D>(this: new (a: A, b: B, c: C, d: D) => V, a: A, b: B, c: C, d: D): Node
  static create<V extends Verb, A, B, C>(this: new (a: A, b: B, c: C) => V, a: A, b: B, c: C): Node
  static create<V extends Verb, A, B>(this: new (a: A, b: B) => V, a: A, b: B): Node
  static create<V extends Verb, A>(this: new (a: A) => V, a: A): Node
  static create<V extends Verb>(this: new (...a: any[]) => V, ...args: any[]): Node {
    return (new this(...args)).node
  }

  constructor(name: string) {
    super()
    this.node = document.createComment(`  ${name}  `)
    this.bindToNode(this.node)
  }

}



/**
 * Base Component for components not using DOM Elements.
 *
 * Rendered as a several Comment nodes, it keeps its children
 * between a starting and an ending Comment (called `begin` and
 * `end` internally) which are kept immediately *after* `this.node`
 */
export class VirtualHolder extends Verb {

  /**
   * The Comment after which all children will be appended.
   */
  begin = document.createComment(` (( `)

  /**
   * The Comment before which all children will be inserted
   */
  end = document.createComment(` )) `)

  /**
   * An internal variable used to hold the next node that will be appended,
   * as since we wait for an Animation Frame to execute, updateChildren
   * can be thus called multiple times before actually adding anything into
   * the DOM
   */
  // protected next_node: Node|null

  /**
   * A DocumentFragment in which manually removed children are stored
   * for later remounting if needed.
   */
  protected saved_children: DocumentFragment|null = null

  onmount(node: Node, parent: Node) {
    // we force the type to Node as in theory when @onmount is called
    // the parent is guaranteed to be defined
    let next = node.nextSibling

    if (this.saved_children) {
      parent.insertBefore(this.saved_children, next)
      this.saved_children = null
    } else if (!this.begin.parentNode) {
      parent.insertBefore(this.begin, next)
      parent.insertBefore(this.end, next)
    }

  }

  onunmount(node: Node) {
    // If we have a parentNode in an unmount() method, it means
    // that we were not unmounted directly.
    // If there is no parentNode, `this.node` was specifically
    // removed from the DOM and since we keep our children
    // after `this.node`, we need to remove them as well.
    let fragment = document.createDocumentFragment()

    let iter: Node|null = this.begin
    let next: Node|null = null

    if (!iter.nextSibling) {
      fragment.appendChild(this.begin)
      fragment.appendChild(this.end)
    } else {
      while (iter) {
        next = iter.nextSibling
        fragment.appendChild(iter)
        if (iter === this.end) break
        iter = next
      }
    }

    this.saved_children = fragment
  }

  updateChildren(node: Node|null) {
    let iter = this.begin.nextSibling
    let end = this.end
    let next: Node|null = null

    if (!iter || !iter.parentNode) return

    const parent = iter.parentNode!

    while (iter && iter !== end) {
      next = iter.nextSibling
      parent.removeChild(iter)
      iter = next
    }

    if (node)
      parent.insertBefore(node, end)
  }

}


export class Writer extends VirtualHolder {

  txt: Node | null
  backup: WeakMap<DocumentFragment, Node[]> | null = null

  constructor(obs: Observable<null|undefined|string|number|Node>) {
    super('writer')

    this.observe(obs, value => {
      var txt = this.txt

      if (value instanceof Array) {
        value = getDocumentFragment(value)
      } else if (!(value instanceof Node)) {
        var val = value != null ? value.toString() : ''
        if (txt) {
          txt.nodeValue = val
          return
        } else {
          value = this.txt = document.createTextNode(val)
        }
      } else {
        if (value instanceof DocumentFragment) {
          if (this.backup === null)
            this.backup = new WeakMap<DocumentFragment, Node[]>()

          var previous = this.backup.get(value)
          if (!previous) {
            this.backup.set(value, getNodes(value))
          } else {
            value = getDocumentFragment(previous)
          }
        }

        this.txt = null
      }

      this.updateChildren(value as Node)
    })
  }

}


/**
 * Write and update the string value of an observable value into
 * a Text node.
 */
export function Write(obs: Observable<null|undefined|string|number|Node>): Node {
  var wr = new Writer(obs)
  return wr.node
}


/**
 * Get a node array from a given node. If it is a document fragment, get
 * all its children.
 *
 * @param node The source node
 */
function getNodes(node: Node | null): Node[] {
  if (node === null) return []

  if (node instanceof DocumentFragment) {
    var iter = node.firstChild
    var result: Node[] = []
    while (iter != null) {
      result.push(iter)
      iter = iter.nextSibling
    }
    return result
  }

  return [node]
}


export type DisplayCreator<T> = (a: Observable<T>) => (Node|null)
export type Displayable<T> = Node | DisplayCreator<T>

export class Displayer<T> extends VirtualHolder {

  rendered_display: Node[] | null = null
  rendered_otherwise: Node[] | null = null

  constructor(
    display: Displayable<T>,
    condition: MaybeObservable<T>,
    display_otherwise?: Displayable<T>
  ) {
    super('displayer')

    var o_cond = o(condition)

    this.observe(o_cond, condition => {
      if (!condition) {

        if (display_otherwise) {
          if (this.rendered_otherwise === null)
            this.rendered_otherwise = getNodes(
              typeof display_otherwise === 'function' ?
                display_otherwise(o_cond) :
                display_otherwise
            )
          this.updateChildren(getDocumentFragment(this.rendered_otherwise))
        } else {
          this.updateChildren(null)
        }

      } else {
        if (this.rendered_display === null) {
          this.rendered_display = getNodes(typeof display === 'function' ?
            display(o_cond) : display
          )
        }

        this.updateChildren(getDocumentFragment(this.rendered_display))
      }

    })
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
  var disp = new Displayer(display, condition as MaybeObservable<T>, display_otherwise)
  return disp.node
}


export type RenderFn<T> = (e: Observable<T>, oi: number) => Node | null
export type RenderFnProxy<T> = (e: ObservableProxy<T>, oi: number) => Node | null


/**
 *
 */
export class Repeater<T> extends VirtualHolder {

  protected obs: Observable<T[]>
  protected positions: Node[] = []
  protected next_index: number = 0
  protected lst: T[] = []

  protected child_obs: Observable<T>[] = []

  constructor(
    ob: MaybeObservable<T[]>,
    public renderfn: RenderFn<T>
  ) {
    super('repeater')

    this.obs = o(ob)

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
  next(): DocumentFragment | null {
    if (this.next_index >= this.lst.length)
      return null

    const comment = document.createComment('repeat-' + this.next_index)
    this.positions.push(comment)

    var fr = document.createDocumentFragment()
    fr.appendChild(comment)

    var ob = this.obs.p(this.next_index)
    this.child_obs.push(ob)

    var res = this.renderfn(ob, this.next_index)
    if (res) fr.appendChild(res)

    this.next_index++
    return fr
  }

  appendChildren(count: number) {
    var next: DocumentFragment | null
    var parent = this.node.parentNode!

    var fr = document.createDocumentFragment()

    while ((next = this.next()) && count-- > 0) {
      fr.appendChild(next)
    }

    parent.insertBefore(fr, this.end)
  }

  removeChildren(count: number) {
    // Détruire jusqu'à la position concernée...
    this.next_index = this.next_index - count

    var parent = this.node.parentNode!
    var end = this.end
    var next: Node | null
    var iter: Node|null = this.positions[this.next_index]

    this.child_obs = this.child_obs.slice(0, this.next_index)
    this.positions = this.positions.slice(0, this.next_index)

    // From the position that we're going to remove to the end, remove
    // all children.
    while (iter && iter !== end) {
      next = iter.nextSibling
      parent.removeChild(iter)
      iter = next
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
    this.onscroll = this.onscroll.bind(this)
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

  onscroll() {
    if (!this.parent) return
    this.appendChildren(0)
  }

  onmount(node: Element) {
    super.onmount.apply(this, arguments)

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

  onunmount() {
    super.onunmount.apply(this, arguments)

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
 *  Fragment wraps everything into a DocumentFragment.
 *  Beware that because of typescript's imprecisions with the JSX namespace,
 *  we had to tell this function that it returns an HTMLElement while this
 *  completely false !
 */
export function Fragment(attrs: EmptyAttributes, children: DocumentFragment): Element {
  return (children as any) as Element
}
