
import {
  o,
  O
} from './observable'

import {
  Instantiator,
  ArrayOrSingle,
  BasicAttributes,
  Child,
  ControllerCallback,
} from './types'


const nodeControllerMap = new WeakMap<Node, Controller[]>()


/**
 *
 */
export function onmount(target: any, key: string) {
  target.onmount = target.onmount || (target.constructor.prototype.onmount||[]).concat([])
  target.onmount.push(target[key])
}


export function onunmount(target: any, key: string) {
  target.onunmount = target.onunmount || (target.constructor.prototype.onmount||[]).concat([])
  target.onunmount.push(target[key])
}


export function onrender(target: any, key: string) {
  target.onrender = target.onrender || (target.constructor.prototype.onmount||[]).concat([])
  target.onrender.push(target[key])
}


export class Controller {

  onmount: ControllerCallback[]
  onunmount: ControllerCallback[]
  onrender: ControllerCallback[]

  /**
   * Recursively find a controller starting at a node and making its
   * way up.
   */
  static get<C extends Controller>(this: Instantiator<C>, node: Node): C {
    let iter = node
    let controllers = nodeControllerMap.get(iter)

    while (controllers) {
      for (var c of controllers) {
        if (c instanceof this)
          return c as C
      }
      iter = iter.parentNode
      controllers = nodeControllerMap.get(iter)
    }

    return null
  }

  /**
   * Get all the controllers for a given node.
   *
   * @returns undefined if the node was not associated with a controller array
   */
  static all(node: Node): Controller[] {
    return nodeControllerMap.get(node)
  }

  /**
   * Get all the controllers for a Node. If there was no controller array,
   * setup a new one.
   */
  static init(node: Node): Controller[] {
    let res = nodeControllerMap.get(node)
    if (!res) {
      res = []
      nodeControllerMap.set(node, res)
    }
    return res
  }

  /**
   * Associate a Controller to a Node.
   */
  bindToNode(node: Node): void {
    nodeControllerMap.get(node).push(this)
  }

  constructor() {

    let proto = this.constructor.prototype
    this.onmount = proto.onmount ? proto.onmount.concat([]) : []
    this.onunmount = proto.onunmount ? proto.onunmount.concat([]) : []
    this.onrender = proto.onrender ? proto.onrender.concat([]) : []

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

    this.onmount.push(function () {
      unload = (o.observe as any)(...args)
    })

    this.onunmount.push(function () {
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
    var controllers = nodeControllerMap.get(node)

    for (var c of ctrls) {
      if (c instanceof Controller) {
        instance = c
      } else {
        instance = new c
      }
      controllers.push(instance)
    }
  }
}



/**
 * attrs is not set in the constructor, but will be in render()
 */
export class Component extends Controller {

  attrs: BasicAttributes

  render(children: DocumentFragment): Node {
    return null
  }

}