/**
 * Control structures to help with readability.
 */
import {
  o,
  O,
  Observable,
  PropObservable
} from './observable'

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
 * Put the result of an observable into the DOM.
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
      node.nodeValue = value ? value.toString() : ''
    })

    return node
  }

}


export function Write(obs: Observable<HasToString>): Node {
  return d(Writer, {obs})
}


export type DisplayCreator<T> = (a: T) => Node

export class DisplayComponent<T> extends VirtualHolder {
  name = 'if'

  attrs: {
    condition?: O<T>
    display: O<DisplayCreator<T>>
  }

  render(): Node {

    this.observe(
      this.attrs.condition,
      this.attrs.display,
      (condition, display) => {

      if (typeof condition === 'undefined' || !condition)
        return this.updateChildren(null)

      this.updateChildren(display(condition))
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
export function DisplayIf<T>(condition: O<T>, display: O<DisplayCreator<T>>): Node {
  return d(DisplayComponent, {condition, display})
}


export function DisplayUnless<T>(condition: O<any>, display: O<DisplayCreator<T>>) {
  return d(DisplayComponent, {condition: o(condition).isFalsy(), display})
}



export type RepeatNode = {node: Node, index: Observable<number>}

export class RepeatComponent<T> extends VirtualHolder {

  attrs: {
    ob: O<T[]>,
    render: (e: PropObservable<T[], T>, oi?: Observable<number>) => Node
  }

  obs: Observable<T[]>
  map: WeakMap<T, RepeatNode> = new WeakMap<T, RepeatNode>()
  last_id: number

  redrawList(lst: T[]) {

    let obs = this.obs
    let last_drawn = -1
    let fn = this.attrs.render
    let res = document.createDocumentFragment()
    let map = this.map
    var n: Node
    var id: Observable<number>

    for (var i = 0; i < lst.length; i++) {
      // var prev = map.get(lst[i])

      // if (typeof lst[i] === 'object') {
      //   var prev = map.get(lst[i])
      //   if (prev) {
      //     prev.index.set(i)
      //     res.appendChild(prev.node)
      //     continue
      //   }
      // }

      id = o(i)
      n = fn(obs.p(i) as PropObservable<T[], T>, o(i))
      res.appendChild(n)
      // if (typeof lst[i] === 'object') map.set(lst[i], {node: n, index: id})
    }

    this.updateChildren(res)

    // if (this.last_id) cancelAnimationFrame(this.last_id)

    // this.last_id = requestAnimationFrame(() => {

    //   while (last_drawn < lst.length - 1) {
    //     last_drawn += 1

    //   }

    // })

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
export function Repeat<T>(ob: O<T[]>, render: (e: PropObservable<T[], T>, oi?: Observable<number>) => Node): Node {
  return d(RepeatComponent, {ob, render})
}


/**
 *
 */
export function Fragment(attrs: BasicAttributes, children: DocumentFragment): Node {
  return children
}
