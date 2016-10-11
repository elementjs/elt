
import {
  Instantiator,
  ArrayOrSingle,
  Children,
  BasicAttributes
} from './types'


/**
 *
 */
export function ctrl(ctrls: Instantiator<Controller>[]) {
  return function (node: Node): void {
    for (var c of ctrls) {
      var instance = new c
      node._domic_ctrl.push(instance)
      instance.setNode(node)
    }
  }
}


export class Controller {

  node: Node
  mounted: boolean

  onMount(): void {
    // observe
  }

  onUnmount(): void {
    // stop observing
  }

  setNode(node: Node) {
    this.node = node
  }

  /**
   * Recursively find the asked for controller.
   */
  getController<C extends Controller>(kls: Instantiator<C>): C {
    let iter = this.node

    while (iter._domic_ctrl) {
      for (var c of iter._domic_ctrl) {
        if (c instanceof kls)
          return c as C
      }
      iter = iter.parentNode
    }

    return null
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