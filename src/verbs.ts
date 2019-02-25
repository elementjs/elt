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
  Renderable,
  Insertable
} from './types'

import {
  bound
} from './decorators'

import {
  remove_and_unmount,
  mount,
  add
} from './mounting'


export function getNode(i: Insertable) {

  if (i instanceof Node)
    return i

  if (i instanceof Array) {
    const res = document.createDocumentFragment()
    for (var n of i) {
      res.appendChild(getNode(n))
    }
    return res
  }

  if (i instanceof o.Observable) {
    return Display(i)
  }

  if (i != null) {
    return document.createTextNode(i.toString())
  }

  return document.createComment('empty')
}


/**
 * Get a node from an insertable, or a Fragment verb if the insertable
 * returned a DocumentFragment.
 *
 * This function is a helper for Display.
 */
export function getNodeOrFragment(i: Insertable) {
  const result = getNode(i)
  if (result instanceof DocumentFragment) {
    return instanciate_verb(new FragmentHolder(result))
  }
  return result
}


export function instanciate_verb(m: Mixin<Comment>): Node {
  const node = document.createComment(`  ${m.constructor.name} `)
  m.addToNode(node)
  return node
}


/**
 * Displays and actualises the content of an Observable containing
 * Node, string or number into the DOM.
 */
export class Displayer extends Mixin<Comment> {

  current_node: Node | null = null
  observer!: o.ReadonlyObserver<Insertable>

  constructor(public _obs: o.ReadonlyObservable<Insertable>) {
    super()
  }

  init() {
    this.observer = this.observers.observe(this._obs, value => this.update(value))
  }

  update(value: Insertable) {
    const typ = typeof value
    const current = this.current_node

    // Special case for when we're updating text with text.
    if (typ === 'string' || typ === 'number') {
      if (current && current instanceof Text) {
        current.nodeValue = (value == null ? '' : value).toString()
        return
      }
    }

    var parent = this.node.parentNode!
    if (current) {
      remove_and_unmount(current)
    }

    const new_node = getNodeOrFragment(value)
    this.current_node = new_node
    parent.insertBefore(new_node, this.node)
    add(new_node)
    if (this.mounted)
      mount(new_node, parent)
  }

  added() {
    this.observer.call(this._obs.get())
  }

  inserted(_: Comment, parent: Node) {
    if (this.current_node) {
      this.node.parentNode!.insertBefore(this.current_node, this.node)
      add(this.current_node)
      mount(this.current_node, parent)
    }
  }

  removed(node: Comment, parent: Node) {
    if (this.current_node) {
      remove_and_unmount(this.current_node)
    }
  }

}


/**
 * Write and update the string value of an observable value into
 * a Text node.
 */
export function Display(obs: o.RO<Renderable>): Node {
  if (!(obs instanceof o.Observable)) {
    return getNode(obs)
  }
  return instanciate_verb(new Displayer(obs))
}



export type DisplayCreator<T> = (a: o.Observable<T>) => Insertable
export type Displayable<T> = Insertable | DisplayCreator<T>
export type ReadonlyDisplayable<T> = Insertable | ((a: o.ReadonlyObservable<T>) => Insertable)

export class ConditionalDisplayer<T> extends Displayer {

  rendered_display: Renderable
  rendered_otherwise: Renderable

  constructor(
    protected display: Displayable<NonNullable<T>>,
    protected condition: o.O<T>,
    protected display_otherwise?: Displayable<T>
  ) {
    super(o(condition).tf(cond => {
      if (cond) {
        if (!this.rendered_display)
          // Here we have to help the inferer as it can't guess that cond and condition
          // are linked and as such display(o(condition)) is actually handling a NonNullable.
          this.rendered_display = getNode(typeof display === 'function' ? display(o(condition as NonNullable<T>)) : display)
        return this.rendered_display
      } else {
        if (!this.rendered_otherwise)
          this.rendered_otherwise = getNode(typeof display_otherwise === 'function' ? display_otherwise(o(condition)) : display_otherwise)
        return this.rendered_otherwise
      }
    }))
  }

}


/**
 *
 */
export function DisplayIf<T>(
  condition: o.Observable<T | undefined | null>,
  display: Displayable<NonNullable<T>>, display_otherwise?: Displayable<T>
): Node
export function DisplayIf<T>(
  condition: o.ReadonlyObservable<T | undefined | null>,
  display: Displayable<NonNullable<T>>, display_otherwise?: Displayable<T>
): Node
export function DisplayIf<T>(
  condition: null | undefined | o.O<T | null | undefined>,
  display: Displayable<NonNullable<T>>,
  display_otherwise?: Displayable<T>
): Node {
  if ((typeof display === 'function' && display.length === 0 || typeof display !== 'function') && !(condition instanceof o.Observable)) {
    return condition ?
      getNode(typeof display === 'function' ? display(null!) : display)
      : getNode(display_otherwise ?
          (typeof display_otherwise === 'function' ? display_otherwise(null!) : display_otherwise)
          : document.createComment('false'))
  }
  return instanciate_verb(new ConditionalDisplayer(display, condition as o.O<T>, display_otherwise))
}


export const If = DisplayIf


export type RenderFn<T> = (e: o.Observable<T>, oi: number) => Insertable
export type ReadonlyRenderFn<T> = (e: o.ReadonlyObservable<T>, oi: number) => Insertable
export type SeparatorFn = (oi: number) => Insertable


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
  private end = document.createComment('repeat end')

  constructor(
    ob: o.O<T[]>,
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
  added(node: Comment, immediate = true) {
    // Add the end_repeat after this node
    node.parentNode!.insertBefore(this.end, node.nextSibling)

    this.observers.observe(this.obs, lst => {
      this.lst = lst || []
      const diff = lst.length - this.next_index

      if (diff < 0)
        this.removeChildren(-diff)

      if (diff > 0)
        this.appendChildren(diff)

    }, immediate)
  }

  /**
   * Generate the next element to append to the list.
   */
  next(): Node | null {
    if (this.next_index >= this.lst.length)
      return null

    var ob = this.obs.p(this.next_index)

    this.child_obs.push(ob)

    var res = getNodeOrFragment(this.renderfn(ob, this.next_index))

    if (this.separator && this.next_index > 0) {
      const sep = getNodeOrFragment(this.separator(this.next_index))
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

    add(fr)
    parent.insertBefore(fr, this.end)
    if (this.mounted) {
      for (var n of to_mount) {
        mount(n, parent)
      }
    }

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

  inserted() {
    if (this.positions.length === 0) {
      this.node.parentNode!.insertBefore(this.end, this.node.nextSibling)
      // This happens when the Repeat was removed from the DOM
      // and inserted again. In this case, the observer is not triggered since
      // the value of the list didn't change, so we need to insert the elements.
      this.appendChildren(this.lst.length)
    } else {
      // We timeout this to prevent finishing mounting elements before having our own
      // observable started, to avoid them registering BEFORE us
      // setTimeout(() => {
      //   var parent = this.node.parentNode!
      //   for (var p of this.positions)
      //     mount(p, parent)
      // })
    }
  }

  removed() {
    if (this.end.parentNode)
      this.end.parentNode.removeChild(this.end)

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
    ob: o.O<T[]>,
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

  // This is to prevent the nodes to be added directly since the repeat scroll absolutely
  // needs to know the height of its container to display its first element.
  // This could be changed in favor of displaying a first chunk of elements and only then
  // check for height.
  added(node: Comment) {
    super.added(node, false)
  }

  inserted() {

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
    } // else if (this.positions.length === 0) {
    //   this.appendChildren(0)
    // } else if (this.positions.length > 0) {
    //   var parent = this.node.parentNode!
    //   for (var p of this.positions) {
    //     mount(p, parent)
    //   }
    // }

    this.parent.addEventListener('scroll', this.onscroll)
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
 */
export function Repeat<T>(ob: T[], render: ReadonlyRenderFn<T>, separator?: SeparatorFn): Node;
export function Repeat<T>(ob: o.Observable<T[]>, render: RenderFn<T>, separator?: SeparatorFn): Node
export function Repeat<T>(ob: o.ReadonlyObservable<T[]>, render: ReadonlyRenderFn<T>, separator?: SeparatorFn): Node
export function Repeat(
  ob: any,
  render: any,
  separator?: SeparatorFn
): Node {
  return instanciate_verb(new Repeater(ob, render, separator))
}


export function RepeatScroll<T>(ob: T[], render: ReadonlyRenderFn<T>, separator?: SeparatorFn, scroll_buffer_size?: number): Node;
export function RepeatScroll<T>(ob: o.Observable<T[]>, render: RenderFn<T> , separator?: SeparatorFn, scroll_buffer_size?: number): Node;
export function RepeatScroll<T>(ob: o.ReadonlyObservable<T[]>, render: ReadonlyRenderFn<T>, separator?: SeparatorFn, scroll_buffer_size?: number): Node;
export function RepeatScroll<T>(
  ob: any,
  render: any,
  separator?: SeparatorFn,
  scroll_buffer_size = 10
): Node {
  return instanciate_verb(new ScrollRepeater(ob, render, scroll_buffer_size, 500, separator))
}


/**
 *  A comment node that holds a document fragment.
 */
export class FragmentHolder extends Mixin<Comment> {

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

  added(node: Comment) {
    node.parentNode!.insertBefore(this.fragment, node.nextSibling)
    for (var c of this.child_nodes) {
      add(c)
      if (this.mounted)
        mount(c)
    }
  }

  inserted(node: Comment, parent: Node) {
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
  // This is a trick ! It is not actually an element !
  return instanciate_verb(new FragmentHolder(children)) as Element
}
