/**
 * Control structures to help with readability.
 */
import {
  O,
  Observable
} from './observable'

import {
  d,
  getChildren
} from './domic'

import {
  Component
} from './controller'

import {
  BasicAttributes,
  Child
} from './types'


export class VirtualHolder extends Component {

  prev_node: Comment
  next_children: Child[]
  waiting: boolean

  render(children: Child[]): Node {
    this.prev_node = document.createComment(`!`)

    this.mountfns.push(() => {
      this.node.parentNode.insertBefore(this.prev_node, this.node)
    })

    this.unmountfns.push(() => {
      this.prev_node.remove()
    })

    return document.createComment('virt')
  }

  updateChildren(children: Child[]) {
    this.next_children = children

    if (this.waiting) return

    this.waiting = true

    requestAnimationFrame(() => {
      let iter = this.prev_node.nextSibling
      let end = this.node
      let next: Node = null
      while (iter !== end) {
        next = iter.nextSibling
        iter.parentNode.removeChild(iter)
        iter = next
      }

      let fragment = getChildren(children)
      end.parentNode.insertBefore(fragment, end)
      this.waiting = false
    })

  }

}


export interface ObserverAttributes {
  obs: Observable<Child>
}

export class Observer extends VirtualHolder {

  attrs: ObserverAttributes

  render(children: Child[]): Node {

    this.observe(this.attrs.obs, value => {
      this.updateChildren([value])
    })

    return super.render(children)
  }

}


/**
 * Put the result of an observable into the DOM.
 */
export function Observe(obs: Observable<Child>): Node {
  return d(Observer as any, {obs} as BasicAttributes)
}


export function If() {

}

export function Repeat() {

}
