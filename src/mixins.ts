
import {
  o
} from './observable'

import { EmptyAttributes, Attrs, AttrsNodeType, Renderable } from './elt'
import { sym_mixins, Listener } from './dom'


export interface Mixin<N extends Node> {
  /**
   * Stub method. Overload it if you want to run code right after the creation of the
   * associated node by the e() function (or more generally whenever this mixin is added
   * to a node.)
   */
  init?(node: N, parent: Node): void

  /**
   * Stub method. Overload it to run code whenever the node is inserted into the
   * live DOM.
   */
  inserted?(node: N, parent: Node): void

  /**
   * Stub method. Overload it to run code whenever the node is the direct target
   * of a DOM removal (and not a child in the sub tree of a node that was removed)
   */
  removed?(node: N, parent: Node): void
}

/**
 * A `Mixin` is an object that is tied to a DOM Node and its lifecycle. This class
 * is the base class all Mixins should derive from.
 *
 * Mixins can "comunicate" with each other by asking other mixins present on a given
 * node.
 *
 * Extending a Mixin allows the developper to be notified whenever the node
 * is first created by the `d()` function, when it gets inserted into the DOM
 * by overloading the `inserted()` method or when it gets removed from the DOM
 * by overloading the `removed()` method.
 *
 * Additionally, it provides the `observe()` method that ties the observing of an
 * Observable to the Node's presence in the DOM : if the `Node` is inserted, then
 * the observers start listening to their observable. If it gets removed, they stop.
 * Limiting the observing this way ensures that we avoid creating circular references
 * and thus memory leaks.
 *
 * If you intend to store a reference to the associated Node in your Mixin when called
 * with `init()` or `inserted()`, please make sure that you set it to `null` in the
 * `removed()` call.
 * @category dom, toc
 */
export abstract class Mixin<N extends Node = Node> extends o.ObserverHolder {

  node: N = null!

  /**
   * Get a Mixin by its class on the given node or its parents.
   *
   * You do not need to overload this static method.
   *
   * ```typescript
   * class MyMixin extends Mixin {  }
   *
   * // At some point, we add this mixin to a node.
   *
   * var mx = MyMixin.get(node) // This gets the instance that was added to the node, if it exists.
   * ```
   *
   * @param node The node at which we'll start looking for the mixin
   * @param recursive Set to false if you do not want the mixin to be searched on the
   *   node parent's if it was not found.
   */
  static get<N extends Node, M extends Mixin<N>>(this: new (...a: any[]) => M, node: Node | EventTarget, recursive = true): M | null {
    let iter: Node | null = node as Node // yeah yeah, I know, it's an EventTarget as well but hey.

    while (iter) {
      var mixin_iter = iter[sym_mixins]

      while (mixin_iter) {
        if (mixin_iter instanceof this)
          return mixin_iter as M
      }

      if (!recursive)
        break

      iter = iter.parentNode
    }

    return null
  }

  /**
   * To be used with decorators
   */
  static onThisNode<N extends Node, M extends Mixin<N>>(cbk: (m: M) => void) {
    return (node: N) => {

    }
  }

  /**
   * Remove the mixin from this node. Observers created with `observe()` will
   * stop observing, but `removed()` will not be called.
   * @param node
   */
  removeFromNode() {
    node_remove_mixin(this.node, this);
    (this.node as any) = null; // we force the node to null to help with garbage collection.
  }

  listen<K extends (keyof DocumentEventMap)[]>(name: K, listener: Listener<DocumentEventMap[K[number]], N>, useCapture?: boolean): void
  listen<K extends keyof DocumentEventMap>(name: K, listener: Listener<DocumentEventMap[K], N>, useCapture?: boolean): void
  listen(name: string | string[], listener: Listener<Event, N>, useCapture?: boolean): void
  listen(name: string | string[], listener: Listener<Event, any>, useCapture?: boolean) {
    if (typeof name === 'string')
      this.node.addEventListener(name, (ev) => listener(ev), useCapture)
    else
      for (var n of name) {
        this.node.addEventListener(n, (ev) => listener(ev), useCapture)
      }
  }

}


/**
 * The Component is the core class of your TSX components.
 *
 * It is just a Mixin that has a `render()` method and that defines the `attrs`
 * property which will restrict what attributes the component can be created with.
 * All attributes must extend the base `Attrs` class.
 * @category dom, toc
 */
export abstract class Component<A extends EmptyAttributes<any> = Attrs<HTMLElement>> extends Mixin<AttrsNodeType<A>> {
  // attrs: Attrs
  constructor(public attrs: A) { super() }
  abstract render(children: Renderable[]): AttrsNodeType<A>
}


/**
 * Associate a `mixin` to a `node`.
 *
 * All it does is add it to the chained list of mixins accessible on `node[sym_mixins]` and
 * set `mixin.node` to the corresponding node.
 *
 * In general, to add a mixin to a node, prefer adding it to its children.
 *
 * ```tsx
 * var my_mixin = new Mixin()
 *
 * // these are equivalent
 * <div>{my_mixin}</div>
 * var d = <div/>; node_add_mixin(d, mixin);
 * ```
 */
export function node_add_mixin(node: Node, mixin: Mixin): void {
  (node[sym_mixins] = node[sym_mixins] ?? []).push(mixin)
  mixin.node = node
}


/**
 * Remove a Mixin from the array of mixins associated with this Node.
 * @param node The node the mixin will be removed from
 * @param mixin The mixin object we want to remove
 */
export function node_remove_mixin(node: Node, mixin: Mixin): void {
  var mx = node[sym_mixins]

  if (!mx) return
  var idx = mx.indexOf(mixin)
  if (idx) mx.splice(idx, 1)
  if (idx > -1) {
    mixin.stopObservers()
  }
}
