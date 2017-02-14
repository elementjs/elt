
import {
  o,
  MaybeObservable
} from 'domic-observable'

import {
  Instantiator,
  BasicAttributes,
  ControllerCallback,
} from './types'


const nodeControllerMap = new WeakMap<Node, Controller[]>()


export class Controller {

  node: Node
  mounted = false
  onmount: ControllerCallback[] = this.onmount ? this.onmount.slice() : []
  onunmount: ControllerCallback[] = this.onunmount ? this.onunmount.slice() : []
  onrender: ControllerCallback[] = this.onrender ? this.onrender.slice() : []

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
    this.node = node
    nodeControllerMap.get(node).push(this)
  }

  observe<A, B, C, D, E, F, G, H, I>(a: MaybeObservable<A>, b: MaybeObservable<B>, c: MaybeObservable<C>, d: MaybeObservable<D>, e: MaybeObservable<E>, f: MaybeObservable<F>, g: MaybeObservable<G>, h: MaybeObservable<H>, i: MaybeObservable<I>, cbk: (a: A, b: B, c: C, d: D, e: E, f: F, g: G, h: H, i: I) => any): this;
  observe<A, B, C, D, E, F, G, H>(a: MaybeObservable<A>, b: MaybeObservable<B>, c: MaybeObservable<C>, d: MaybeObservable<D>, e: MaybeObservable<E>, f: MaybeObservable<F>, g: MaybeObservable<G>, h: MaybeObservable<H>, cbk: (a: A, b: B, c: C, d: D, e: E, f: F, g: G, h: H) => any): this;
  observe<A, B, C, D, E, F, G>(a: MaybeObservable<A>, b: MaybeObservable<B>, c: MaybeObservable<C>, d: MaybeObservable<D>, e: MaybeObservable<E>, f: MaybeObservable<F>, g: MaybeObservable<G>, cbk: (a: A, b: B, c: C, d: D, e: E, f: F, g: G) => any): this;
  observe<A, B, C, D, E, F>(a: MaybeObservable<A>, b: MaybeObservable<B>, c: MaybeObservable<C>, d: MaybeObservable<D>, e: MaybeObservable<E>, f: MaybeObservable<F>, cbk: (a: A, b: B, c: C, d: D, e: E, f: F) => any): this;
  observe<A, B, C, D, E>(a: MaybeObservable<A>, b: MaybeObservable<B>, c: MaybeObservable<C>, d: MaybeObservable<D>, e: MaybeObservable<E>, cbk: (a: A, b: B, c: C, d: D, e: E) => any): this;
  observe<A, B, C, D>(a: MaybeObservable<A>, b: MaybeObservable<B>, c: MaybeObservable<C>, d: MaybeObservable<D>, cbk: (a: A, b: B, c: C, d: D) => any): this;
  observe<A, B, C>(a: MaybeObservable<A>, b: MaybeObservable<B>, c: MaybeObservable<C>, cbk: (a: A, b: B, c: C) => any): this;
  observe<A, B>(a: MaybeObservable<A>, b: MaybeObservable<B>, cbk: (a: A, b: B) => any): this;
  observe<A>(a: MaybeObservable<A>, cbk: (a: A, prop: string, prev: A) => any): this;

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

  static get(n: Node): DefaultController {

    let d = super.get.call(this, n) as DefaultController
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

  constructor(attrs: BasicAttributes) {
    super()
    this.attrs = attrs
  }

  render(children: DocumentFragment): Node {
    return null
  }

}

export class HTMLComponent extends Component {

  node: HTMLElement

}
