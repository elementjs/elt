/**
 * Control structures to help with readability.
 */
import {
  o,
  O,
  Observable,
  PropObservable
} from 'domic-observable'

import {
  d,
  getDocumentFragment
} from './domic'

import {
  onmount,
  onunmount,
} from './decorators'

import {
  Component,
} from './controller'

import {
  BasicAttributes,
  Child,
  NodeCreatorFn
} from './types'


/**
 * Base Component for components not using DOM Elements.
 *
 * Rendered as a several Comment nodes, it keeps its children
 * between a starting and an ending Comment (called `begin` and
 * `end` internally) which are kept immediately *after* `this.node`
 */
export class VirtualHolder extends Component {

  /**
   * A string used to keep track in the DOM of who we are.
   */
  name = 'virtual'

  /**
   * The Comment after which all children will be appended.
   */
  begin: Comment

  /**
   * The Comment before which all children will be inserted
   */
  end: Comment

  /**
   * An internal variable used to hold the next node that will be appended,
   * as since we wait for an Animation Frame to execute, updateChildren
   * can be thus called multiple times before actually adding anything into
   * the DOM
   */
  protected next_node: Node

  /**
   * A DocumentFragment in which manually removed children are stored
   * for later remounting if needed.
   */
  protected saved_children: DocumentFragment

  /**
   * True if updateChildren() was called but the new children
   * are still waiting for the AnimationFrame
   */
  protected waiting: boolean

  render(children?: DocumentFragment): Node {
    this.begin = document.createComment(` (( `)
    this.end = document.createComment(` ))`)

    if (children) {
      children.insertBefore(this.begin, children.firstChild)
      children.appendChild(this.end)
      this.saved_children = children
    }

    return document.createComment(` ${this.name}: `)
  }

  @onmount
  createOrAppendChildren(node: Node) {
    let parent = node.parentNode
    let next = node.nextSibling

    if (this.saved_children) {

      parent.insertBefore(this.saved_children, next)
      this.saved_children = null

    } else if (!this.begin.parentNode) {
      parent.insertBefore(this.begin, next)
      parent.insertBefore(this.end, next)
    }
  }

  @onunmount
  unmountChildrenIfNeeded(node: Node) {

    // If we have a parentNode in an unmount() method, it means
    // that we were not unmounted directly.
    // If there is no parentNode, `this.node` was specifically
    // removed from the DOM and since we keep our children
    // after `this.node`, we need to remove them as well.
    if (!node.parentNode) {
      let fragment = document.createDocumentFragment()

      let iter: Node = this.begin
      let next: Node = null

      while (iter) {
        next = iter.nextSibling
        fragment.appendChild(iter)
        if (iter === this.end) break
        iter = next
      }

      this.saved_children = fragment
    }

  }

  updateChildren(node: Node) {
    this.next_node = node

    if (this.waiting) return

    this.waiting = true

    requestAnimationFrame(() => {
      let iter = this.begin.nextSibling
      let end = this.end
      let next: Node = null

      if (!iter) {
        // If we're here, we're most likely not mounted, so we will
        // put the next node into saved_children instead.
        this.saved_children = this.next_node as DocumentFragment
        this.next_node = null
        this.waiting = false
        return
      }

      while (iter !== end) {
        next = iter.nextSibling
        iter.parentNode.removeChild(iter)
        iter = next
      }

      if (this.next_node)
        end.parentNode.insertBefore(this.next_node, end)
      this.next_node = null
      this.waiting = false
    })

  }

}


export interface ObserverAttributes {
  obs: Observable<Node>
}

export class Observer extends VirtualHolder {

  name = 'observer'
  attrs: ObserverAttributes

  render(): Node {

    this.observe(this.attrs.obs, node => {
      this.updateChildren(node)
    })

    return super.render()
  }

}


/**
 * Put the value of an observable into the DOM.
 * Be careful with DocumentFragments ; they can only be inserted once.
 */
export function Observe(obs: Observable<Node>): Node {
  return d(Observer, {obs})
}


export interface HasToString {
  toString(): string
}


export class Writer extends Component {

  attrs: {
    obs: Observable<HasToString>
  }

  render() {
    let node = document.createTextNode('')

    this.observe(this.attrs.obs, value => {
      node.nodeValue = value != null ? value.toString() : ''
    })

    return node
  }

}


/**
 * Write and update the string value of an observable value into
 * a Text node.
 */
export function Write(obs: Observable<HasToString>): Node {
  return d(Writer, {obs})
}


export type DisplayCreator<T> = (a: T) => Node

export class Displayer<T> extends VirtualHolder {
  name = 'if'

  attrs: {
    condition?: O<T>
    display: O<DisplayCreator<T>>
    display_otherwise?: O<DisplayCreator<T>>
  }

  render(): Node {

    this.observe(
      this.attrs.condition,
      this.attrs.display,
      this.attrs.display_otherwise,
      (condition, display, otherwise) => {

      if (typeof condition === 'undefined' || !condition) {
        if (otherwise)
          return this.updateChildren(otherwise(condition))
        return this.updateChildren(null)
      }

      this.updateChildren(display(condition))
    })
    return super.render()
  }

}


export function Display(display: O<NodeCreatorFn>): Node {
  return d(Displayer, {display})
}


/**
 *
 */
export function DisplayIf<T>(condition: O<T>, display: O<DisplayCreator<T>>, display_otherwise?: O<DisplayCreator<T>>): Node {
  return d(Displayer, {condition, display, display_otherwise})
}


export function DisplayUnless<T>(condition: O<any>, display: O<DisplayCreator<T>>, display_otherwise?: O<DisplayCreator<T>>) {
  return d(Displayer, {condition: o(condition).isFalsy(), display, display_otherwise})
}



export type RepeatNode = {node: Node, index: Observable<number>}

export class Repeater<T> extends VirtualHolder {

  attrs: {
    ob: O<T[]>,
    render: (e: PropObservable<T[], T>, oi?: Observable<number>) => Node
  }

  obs: Observable<T[]>
  map: WeakMap<T, RepeatNode> = new WeakMap<T, RepeatNode>()

  redrawList(lst: T[]) {

    let obs = this.obs
    let fn = this.attrs.render
    let res = document.createDocumentFragment()
    let map = this.map
    var n: Node
    var id: Observable<number>

    for (var i = 0; i < lst.length; i++) {
      id = o(i)
      n = fn(obs.p(i) as PropObservable<T[], T>, o(i))
      res.appendChild(n)
    }

    this.updateChildren(res)

  }

  render(): Node {
    this.obs = o(this.attrs.ob)

    this.observe(this.attrs.ob, (lst, prop) => {
      if (!prop)
        this.redrawList(lst)
    })

    return super.render()
  }

}

/**
 *
 */
export function Repeat<T>(ob: T[], render: (e: PropObservable<T[], T>, oi?: Observable<number>) => Node): Node
export function Repeat<T>(ob: Observable<T[]>, render: (e: PropObservable<T[], T>, oi?: Observable<number>) => Node): Node
export function Repeat<T>(ob: O<T[]>, render: (e: PropObservable<T[], T>, oi?: Observable<number>) => Node): Node {
  return d(Repeater, {ob, render})
}


/**
 *
 */
export function Fragment(attrs: BasicAttributes, children: DocumentFragment): Node {
  return children
}
