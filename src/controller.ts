
import {
  o,
  O
} from 'stalkr'

import {
  Instantiator,
  ArrayOrSingle,
  Children,
  BasicAttributes
} from './types'


export const NodeControllerMap = new WeakMap<Node, Controller[]>()


export class Controller {

  node: Node
  mounted: boolean
  mountfns: (() => void)[]
  unmountfns: (() => void)[]

  setNode(node: Node) {
    this.node = node
  }

  observe<A, B, C, D, E, F>(a: O<A>, b: O<B>, c: O<C>, d: O<D>, e: O<E>, f: O<F>, cbk: (a: A, b: B, c: C, d: D, e: E, f: F) => any): this;
  observe<A, B, C, D, E>(a: O<A>, b: O<B>, c: O<C>, d: O<D>, e: O<E>, cbk: (a: A, b: B, c: C, d: D, e: E) => any): this;
  observe<A, B, C, D>(a: O<A>, b: O<B>, c: O<C>, d: O<D>, cbk: (a: A, b: B, c: C, d: D) => any): this;
  observe<A, B, C>(a: O<A>, b: O<B>, c: O<C>, cbk: (a: A, b: B, c: C) => any): this;
  observe<A, B>(a: O<A>, b: O<B>, cbk: (a: A, b: B) => any): this;
  observe<A>(a: O<A>, cbk: (a: A, prop: string) => any): this;

  /**
   * Observe an observer whenever it is mounted. Stop observing when
   * unmounted. Reobserve when mounted again.
   */
  observe(...args: any[]): this {
    let unload: any

    this.mountfns.push(function () {
      unload = (o.observe as any)(...args)
    })

    this.unmountfns.push(function () {
      unload()
      unload = null
    })

    return this
  }

  /**
   * Observe an observer but only when it changes, do not call the callback
   * right away like observe. (?)
   */
  observeChanges(): this {
    return this
  }

  /**
   * Recursively find the asked for controller.
   */
  getController<C extends Controller>(kls: Instantiator<C>): C {
    let iter = this.node
    let controllers = NodeControllerMap.get(iter)

    while (controllers) {
      for (var c of controllers) {
        if (c instanceof kls)
          return c as C
      }
      iter = iter.parentNode
      controllers = NodeControllerMap.get(iter)
    }

    return null
  }

}


/**
 * Useless controller just used to register observables used by class or style
 */
export class DefaultController extends Controller {

}



/**
 *
 */
export function ctrl(ctrls: (Instantiator<Controller>|Controller)[]) {
  return function (node: Node): void {
    var instance: Controller = null
    var controllers = NodeControllerMap.get(node)

    for (var c of ctrls) {
      if (c instanceof Controller) {
        instance = c
      } else {
        instance = new c
      }
      instance.setNode(node)
      controllers.push(instance)
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