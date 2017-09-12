
import {
  o,
  Observable,
  make_observer,
  MaybeObservable,
  ObserverOptions,
  Observer,
  ObserverFunction
} from 'domic-observable'

import {
  Instantiator,
  BasicAttributes,
} from './types'


declare global {
  interface Node {
    _domic_controllers: BaseController[] | undefined
  }
}


export class BaseController {

  static getIfExists<C extends BaseController>(this: Instantiator<C>, node: Node): C|null {
    let iter: Node|null = node

    while (iter) {
      for (var c of iter._domic_controllers||[]) {
        if (c instanceof this)
          return c as C
      }
      iter = iter.parentNode
    }

    return null
  }

  /**
   * Recursively find a controller starting at a node and making its
   * way up.
   */
  static get<C extends BaseController>(this: Instantiator<C>, node: Node): C {
    var res = (this as any).getIfExists(node)
    if (!res)
      throw new Error(`Controller ${this.name} was not found on this node`)
    return res
  }

  /**
   * Get all the controllers for a given node.
   *
   * @returns undefined if the node was not associated with a controller array
   */
  static all(node: Node): BaseController[]|undefined {
    return node._domic_controllers
  }

  /**
   * Get all the controllers for a Node. If there was no controller array,
   * setup a new one.
   */
  static init(node: Node): BaseController[] {
    if (!node._domic_controllers)
      node._domic_controllers = []
    return node._domic_controllers
  }

  node: Node
  mounted = false
  protected observers: Observer<any, any>[] = []

  onmount(node: Element) {
    this.mounted = true
    for (var o of this.observers) {
      o.startObserving()
    }
  }

  onunmount(node: Element, parent: Node, next: Node, prev: Node) {
    this.mounted = false
    for (var o of this.observers) {
      o.stopObserving()
    }
  }

  onrender(node: Element) {

  }

  getController<C extends BaseController>(cls: Instantiator<C>): C {
    if (this.node == null)
      throw new Error('cannot get controllers on unmounted nodes')
    return (cls as any).get(this.node)
  }

  getControllerIfExists<C extends BaseController>(cls: Instantiator<C>): C|null {
    if (this.node == null)
      throw new Error('cannot get controllers on unmounted nodes')
    return (cls as any).getIfExists(this.node)
  }

  /**
   * Associate a Controller to a Node.
   */
  bindToNode(node: Node): void {
    this.node = node
    BaseController.init(node).push(this)
  }

  /**
   * Observe an observer whenever it is mounted. Stop observing when
   * unmounted. Reobserve when mounted again.
   */
  observe<T>(a: MaybeObservable<T>, cbk: Observer<T, any> | ObserverFunction<T, any>, options?: ObserverOptions): this {

    const observable = a instanceof Observable ? a : o(a)
    const observer = typeof cbk === 'function' ?  make_observer(observable, cbk, options) : cbk
    this.observers.push(observer)

    if (this.mounted)
      observer.call(o.get(observable))

    return this
  }

}


/**
 * Useless controller just used to register observables used by class or style
 */
export class DefaultController extends BaseController {

  onmount_callbacks: ((node: Element) => any)[]
  onunmount_callbacks: ((node: Element) => any)[]
  onrender_callbacks: ((node: Element) => any)[]

  static get<C extends BaseController>(this: Instantiator<C>, n: Node): C {

    let d = super.getIfExists.call(this, n) as DefaultController
    if (!d) {
      d = new DefaultController()
      d.bindToNode(n)
    }

    return d as any
  }

  onmount(node: Element) {
    super.onmount.apply(this, arguments)
    for (var m of this.onmount_callbacks) {
      m.apply(this, arguments)
    }
  }

  onunmount(node: Element) {
    super.onunmount.apply(this, arguments)
    for (var m of this.onunmount_callbacks) {
      m.apply(this, arguments)
    }
  }

  onrender(node: Element) {
    super.onrender(node)
    for (var m of this.onrender_callbacks) { m.apply(this, arguments) }
  }

}



/**
 *
 */
export function ctrl(...ctrls: (Instantiator<BaseController>|BaseController)[]) {
  return function (node: Node): void {
    var instance: BaseController|null = null

    for (var c of ctrls) {
      if (c instanceof BaseController) {
        instance = c
      } else {
        instance = new c
      }
      instance.bindToNode(node)
      BaseController.init(node).push(instance)
    }
  }
}


export class Controller extends BaseController {
  node: HTMLElement
}


/**
 * attrs is not set in the constructor, but will be in render()
 */
export abstract class Component extends Controller {

  attrs: BasicAttributes

  constructor(attrs: BasicAttributes) {
    super()
    this.attrs = attrs
  }

  abstract render(children: DocumentFragment): Element

}


export abstract class SVGComponent extends BaseController {
  node: SVGElement
  attrs: BasicAttributes

  constructor(attrs: BasicAttributes) {
    super()
    this.attrs = attrs
  }

  abstract render(children: DocumentFragment): Element
}