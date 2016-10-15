/**
 * Control structures to help with readability.
 */
import {
  O,
  Observable
} from 'stalkr'

import {
  d
} from './domic'

import {
  Component
} from './controller'

import {
  BasicAttributes,
  Child
} from './types'


export interface ObserverAttributes {
  obs: Observable<Child>
}

export class Observer extends Component {

  attrs: ObserverAttributes
  next_node: Comment

  render(children: Child[]): Node {
    this.observe(this.attrs.obs, value => {
      console.log('the value')
      console.log(value)
    })

    this.next_node = document.createComment('!observable')
    return document.createComment('observable')
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
