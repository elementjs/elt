
import {
  o,
  Observable,
  MaybeObservable,
  ObserverOptions,
  Observer,
  ObserverFunction
} from 'domic-observable'

import {
  Attrs,
} from './types'


/**
 * This symbol is added as a property of the DOM nodes to store
 * an array of mixins.
 *
 * The more "correct" way of achieving this would have been to create
 * a WeakSet, but since the performance is not terrific (especially
 * when the number of elements gets high), the symbol solution was retained.
 */
const mxsym = Symbol('domic-mixins')


/**
 * Get an array of all the mixins associated with that node.
 * @param node The node that holds the mixins
 */
export function getMixins(node: Node): Mixin[] | undefined
export function getMixins(node: any, no_create?: boolean): Mixin[] | undefined {
  return node[mxsym]
}


/**
 * Add a mixin to the array of mixins associated with that node.
 * @param node The node the mixin will be added to
 * @param mixin The mixin to add
 */
export function addMixin(node: Node, mixin: Mixin): void
export function addMixin(node: any, mixin: Mixin) {
  var mx: Mixin[] = node[mxsym]
  if (!mx) {
    mx = node[mxsym] = []
  }
  mx.push(mixin)
}


/**
 * Remove a Mixin from the array of mixins associated with this Node.
 * @param node The node the mixin will be removed from
 * @param mixin The mixin object we want to remove
 */
export function removeMixin(node: Node, mixin: Mixin): void
export function removeMixin(node: any, mixin: Mixin): void {
  var mx: Mixin[] = node[mxsym]
  if (!mx) return
  var res: Mixin[] = []
  for (var m of mx) if (mixin !== m) res.push(m)
  node[mxsym] = res
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
 */
export class Mixin<N extends Node = Node> {

  /** true when the associated Node is inside the DOM */
  readonly mounted: boolean = false

  /** An array of observers tied to the Node for observing. Populated by `observe()` calls. */
  protected observers: Observer<any, any>[] = []

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
  static get<M extends Mixin>(this: new (...a: any[]) => M, node: Node | EventTarget, recursive = true): M | null {
    let iter: Node | null = node as Node // yeah yeah, I know, it's an EventTarget as well but hey.

    while (iter) {
      var mixins = getMixins(iter)

      if (mixins) {
        for (var m of mixins)
          if (m instanceof this)
            return m as M
      }

      if (!recursive)
        break

      iter = iter.parentNode
    }

    return null
  }

  /**
   * Add the mixin to the node and call its init() method.
   * @param node The node that will receive this mixin.
   */
  addToNode(node: N) {
    addMixin(node, this)
    this.init(node)
  }

  /**
   * Remove the mixin from this node. Observers created with `observe()` will
   * stop observing, but `removed()` will not be called.
   * @param node
   */
  removeFromNode(node: N) {
    if (this.mounted) {
      for (var ob of this.observers) ob.stopObserving()
    }
    removeMixin(node, this)
  }

  /**
   * Observe an observable whenever it is mounted. Stop observing when
   * unmounted. Reobserve when mounted again.
   *
   * @param cbk The observer instance or the function called when observing
   * @param options options for the observer creation
   * @returns The Observer instance
   */
  observe<T, U = void>(a: MaybeObservable<T>, cbk: Observer<T, U> | ObserverFunction<T, U>, options?: ObserverOptions): Observer<T, U> {
    const ob = a instanceof Observable ? a : o(a)
    const observer = typeof cbk === 'function' ?  ob.createObserver(cbk, options) : cbk
    this.observers.push(observer)

    if (this.mounted) {
      observer.startObserving()
    }
    return observer
  }

  /**
   * This method is called by the mounting process whenever the associated node
   * was inserted into the DOM. Avoid overloading this method if you want to react
   * to this event ; use `inserted()` instead.
   *
   * @param node The associated node
   * @param parent The parent of the associated node
   */
  mount(node: N, parent: Node) {
    // We cheat the readonly here.
    (this.mounted as any) = true

    this.inserted(node, parent)

    for (var obs of this.observers) {
      obs.startObserving()
    }
  }

  /**
   * This method is called by the mounting process whenever the associated node
   * was removed from the DOM. Overload `removed()` if you want to react to this event.
   * @param node The associated node
   * @param parent Its former parent
   * @param next Its former nextSibling
   * @param prev Its former prevSibling
   */
  unmount(node: N, parent: Node, next: Node | null, prev: Node | null) {
    (this.mounted as any) = false

    for (var o of this.observers) {
      o.stopObserving()
    }

    this.removed(node, parent, next, prev)
  }

  /**
   * Stub method. Overload it if you want to run code right after the creation of the
   * associated node by the d() function (or more generally whenever this mixin is added
   * to a node.)
   * @param node The associated node.
   */
  init(node: N): void { }

  /**
   * Stub method. Overload it if you want to run code right after the Node was added to the DOM.
   * @param node The associated node
   * @param parent Its new parent
   */
  inserted(node: N, parent: Node): void { }

  /**
   * Stub method. Overload it if you want to run code right after the associated node was
   * removed from the DOM.
   * @param node The associated node
   * @param parent Its former parent
   * @param next Its former nextSibling
   * @param prev Its former prevSibling
   */
  removed(node: N, parent: Node, next: Node | null, prev: Node | null): void { }

}


/**
 * The Component is the core class of your TSX components.
 *
 * It is just a Mixin that has a `render()` method and that defines the `attrs`
 * property which will restrict what attributes the component can be created with.
 * All attributes must extend the base `Attrs` class.
 */
export abstract class Component<N extends Element = Element> extends Mixin<N> {
  attrs: Attrs
  abstract render(children: DocumentFragment): N
}
