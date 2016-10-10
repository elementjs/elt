
import {
  Instantiator,
  ArrayOrSingle,
  Children,
  BasicAttributes
} from './types'


export class DomicControllerEvent<T extends Controller> extends CustomEvent {
  detail: {
    answer: T
    query: Instantiator<T>
  }

  constructor(query: Instantiator<T>) {
    super('domic:controller-query', {
      detail: {
        query,
        answer: null
      },
      bubbles: true,
      cancelable: true
    })
  }
}


export class Controller {

  node: Node

  setNode(node: Node) {
    this.node = node
  }

  /**
   * Send a message event into our DOM to get the corresponding controller.
   */
  getController<C extends Controller>(kls: Instantiator<C>): C {
    let e = new DomicControllerEvent(kls)
    this.node.dispatchEvent(e)
    return e.detail.answer
  }

  /**
   * Answer a controller query, filling the answer.
   */
  protected onGetController(ev: DomicControllerEvent<any>): void {
    if (this instanceof ev.detail.query) {
      ev.detail.answer = this
      ev.stopPropagation()
      ev.preventDefault()
    }
  }

}


/**
 * attrs is not set in the constructor, but will be in render()
 */
export class Component extends Controller {

  attrs: BasicAttributes

  render(children: Children): Node {
    return null
  }

}