
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
    _domic_controllers: Controller[] | undefined
  }
}


export class Controller {

  node: Node
  mounted = false
  onmount: ControllerCallback[] = this.onmount ? this.onmount.slice() : []
  onunmount: ControllerCallback[] = this.onunmount ? this.onunmount.slice() : []
  onrender: ControllerCallback[] = this.onrender ? this.onrender.slice() : []

  static getIfExists<C extends Controller>(this: Instantiator<C>, node: Node): C|null {
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
  static get<C extends Controller>(this: Instantiator<C>, node: Node): C {
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
  static all(node: Node): Controller[]|undefined {
    return node._domic_controllers
  }

  /**
   * Get all the controllers for a Node. If there was no controller array,
   * setup a new one.
   */
  static init(node: Node): Controller[] {
    if (!node._domic_controllers)
      node._domic_controllers = []
    return node._domic_controllers
  }

  /**
   * Associate a Controller to a Node.
   */
  bindToNode(node: Node): void {
    this.node = node
    Controller.init(node).push(this)
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
export function ctrl(...ctrls: (Instantiator<Controller>|Controller)[]) {
  return function (node: Node): void {
    var instance: Controller|null = null

    for (var c of ctrls) {
      if (c instanceof Controller) {
        instance = c
      } else {
        instance = new c
      }
      Controller.init(node).push(instance)
    }
  }
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

  abstract render(children: DocumentFragment): Node

}

export abstract class HTMLComponent extends Component {

  node: HTMLElement

}
