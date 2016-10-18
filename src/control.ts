/**
 * Control structures to help with readability.
 */
import {
  o,
  O,
  Observable
} from './observable'

import {
  d,
  getDocumentFragment
} from './domic'

import {
  Component,
  NodeControllerMap,
} from './controller'

import {
  BasicAttributes,
  Child,
  NodeCreatorFn
} from './types'


export class VirtualHolder extends Component {

  name = 'virtual'
  begin: Comment
  end: Comment
  next_node: Node

  // Note : this should only be done when this node is a
  // direct target for removal instead of being unmounted
  saved_children: DocumentFragment
  waiting: boolean

  render(): Node {
    this.begin = document.createComment(` (( `)
    this.end = document.createComment(` ))`)

    this.onmount.push(() => {
      let parent = this.node.parentNode
      let next = this.node.nextSibling

      if (this.saved_children) {

        parent.insertBefore(this.saved_children, next)
        this.saved_children = null

      } else if (!this.begin.parentNode) {
        parent.insertBefore(this.begin, next)
        parent.insertBefore(this.end, next)
      }

    })

    this.onunmount.push(() => {
      if (!this.node.parentNode) {
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
    })

    return document.createComment(` ${this.name}: `)
  }

  updateChildren(node: Node) {
    this.next_node = node

    if (this.waiting) return

    this.waiting = true

    requestAnimationFrame(() => {
      let iter = this.begin.nextSibling
      let end = this.end
      let next: Node = null

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
  obs: Observable<NodeCreatorFn>
}

export class Observer extends VirtualHolder {

  name = 'observer'
  attrs: ObserverAttributes

  render(): Node {

    this.observe(this.attrs.obs, fn => {
      this.updateChildren(fn())
    })

    return super.render()
  }

}


/**
 * Put the result of an observable into the DOM.
 */
export function Observe(obs: Observable<NodeCreatorFn>): Node {
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
      node.nodeValue = value.toString()
    })

    return node
  }

}


export function Write(obs: Observable<HasToString>): Node {
  return d(Writer, {obs})
}


export class DisplayComponent extends VirtualHolder {
  name = 'if'

  attrs: {
    condition?: O<any>
    display: O<NodeCreatorFn>
  }

  render(): Node {

    this.observe(
      this.attrs.condition || true,
      this.attrs.display,
      (condition, display) => {

      if (!condition)
        return this.updateChildren(null)

      this.updateChildren(display())
    })
    return super.render()
  }

}


export function Display(display: O<NodeCreatorFn>): Node {
  return d(DisplayComponent, {display})
}


/**
 *
 */
export function DisplayIf(condition: O<any>, display: O<NodeCreatorFn>): Node {
  return d(DisplayComponent, {condition, display})
}


export function DisplayUnless(condition: O<any>, display: O<NodeCreatorFn>) {
  return d(DisplayComponent, {condition: o(condition).isFalsy(), display})
}


/**
 *
 */
export function Repeat() {

}


/**
 *
 */
export function Fragment(attrs: BasicAttributes, children: DocumentFragment): Node {
  return children
}
