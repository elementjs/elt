
import {
  o,
  MaybeObservable,
  ObserveOptions,
  Observer,
  UnregisterFn
} from 'domic-observable'

import {
  Instantiator,
  BasicAttributes,
  ControllerCallback,
} from './types'


declare global {
  interface Node {
    _domic_controllers: BaseController[] | undefined
  }
}


export class BaseController {

  node: Node
  mounted = false
  onmount: ControllerCallback[] = this.onmount ? this.onmount.slice() : []
  onunmount: ControllerCallback[] = this.onunmount ? this.onunmount.slice() : []
  onrender: ControllerCallback[] = this.onrender ? this.onrender.slice() : []

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

  getController<C extends BaseController>(cls: Instantiator<C>): C {
    if (this.node == null)
      throw new Error('cannot get controllers on unmounted nodes')
    return (cls as any).get(this.node)
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
  observe<T>(a: MaybeObservable<T>, cbk: Observer<T>, options?: ObserveOptions): this
  observe<T>(a: MaybeObservable<T>|null, cbk: Observer<T|null>, options?: ObserveOptions): this
  observe<T>(a: MaybeObservable<T>|undefined, cbk: Observer<T|undefined>, options?: ObserveOptions): this
  observe<T>(a: MaybeObservable<T>, cbk: Observer<T>, options?: ObserveOptions): this {
    var unload: UnregisterFn|null
    const obs = o(a)
    this.onmount.push(function () {
      if (!unload) unload = obs.addObserver(cbk, options)
    })

    this.onunmount.push(function () {
      if (unload) unload()
      unload = null
    })

    // Add the observer right now if it turns out we're already mounted.
    if (this.mounted) unload = obs.addObserver(cbk, options)

    return this
  }

}


/**
 * Useless controller just used to register observables used by class or style
 */
export class DefaultController extends BaseController {

  static get(n: Node): DefaultController {

    let d = super.getIfExists.call(this, n) as DefaultController
    if (!d) {
      d = new DefaultController()
      d.bindToNode(n)
    }

    return d
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

  abstract render(children: DocumentFragment): HTMLElement

}
