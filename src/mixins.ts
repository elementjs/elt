
import {
  o
} from './observable'

import { EmptyAttributes, Attrs, AttrsNodeType, Renderable } from './elt'
import { sym_mixins, Listener } from './dom'


/**
 * A `Mixin` is an object that is tied to a DOM Node and its lifecycle. This class
 * is the base class all Mixins should derive from.
 *
 * Aside from allowing code to be nicely boxed in classes, Mixins can "communicate" by
 * looking for other mixins on the same node, children or parents.
 *
 * When defining a Mixin that could be set on a root type (eg: `HTMLElement`), ensure that
 * it is always defined as an extension of this type
 *
 * @code ../examples/mixin.tsx
 *
 * @category dom, toc
 */
export class Mixin<N extends Node = Node> extends o.ObserverHolder {

  /**
   * The node this mixin is associated to.
   *
   * Since assigning a mixin to a `Node` is done by **first** creating the mixin and
   * putting it in its children when using [[e]], the fact that node is not typed as `N | null`
   * is cheating ; `this.node` **is** null in the `constructor` of the Mixin.
   *
   * The only reason it is not `N | null` is because it is not `null` for very long.
   *
   * `this.node` is only defined for certain during [[Mixin#init]] ; do not try to use it before
   * then.
   */
  node: N = null!

  /**
   * Get a Mixin by its class on the given node or its parents.
   *
   * You do not need to overload this static method.
   *
   * @param node The node at which we'll start looking for the mixin
   * @param recursive Set to false if you do not want the mixin to be searched on the
   *   node parent's if it was not found.
   */
  static get<N extends Node, M extends Mixin<N>>(this: new (...a: any[]) => M, node: Node | EventTarget, recursive = true): M | null {
    let iter: Node | null = node as Node // yeah yeah, I know, it's an EventTarget as well but hey.

    while (iter) {
      var mixins = iter[sym_mixins]
      if (mixins) {
        for (var i = 0, l = mixins.length; i < l; i++) {
          var m = mixins[i]
          if (m instanceof this) return m
        }
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
  static onThisNode<N extends Node, M extends Mixin<N>>(this: { new (...a: any[]): M, get(n: Node): M | null }, cbk: (m: M) => void) {
    return (node: N) => {
      const mx = this.get(node)
      if (mx) cbk(mx)
    }
  }

  /**
   * Stub method meant to be overloaded in a child class. Called during [[$init]]
   */
  init(node: N, parent: Node): void { }

  /**
   * Stub method meant to be overloaded in a child class. Called during [[$inserted]]
   */
  inserted(node: N, parent: Node): void { }

  /**
   * Stub method meant to be overloaded in a child class. Called during [[$removed]]
   */
  removed(node: N, parent: Node): void { }

  /**
   * Remove the mixin from this node. Observers created with `this.observe()` will
   * stop observing. The `this.removed` method **will not** be called.
   */
  removeFromNode() {
    node_remove_mixin(this.node, this);
    (this.node as any) = null; // we force the node to null to help with garbage collection.
  }

  /**
   * Helper method to listen an event on the current node. `currentTarget` is typed as the current node type.
   *
   * @code ../examples/mixin.on.tsx
   */
  on<K extends (keyof DocumentEventMap)[]>(name: K, listener: Listener<DocumentEventMap[K[number]], N>, useCapture?: boolean): void
  on<K extends keyof DocumentEventMap>(name: K, listener: Listener<DocumentEventMap[K], N>, useCapture?: boolean): void
  on(name: string | string[], listener: Listener<Event, N>, useCapture?: boolean): void
  on(name: string | string[], listener: Listener<Event, any>, useCapture?: boolean) {
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
 *
 * All attributes **must** extend the base `Attrs` class.
 * @category dom, toc
 */
export abstract class Component<A extends EmptyAttributes<any> = Attrs<HTMLElement>> extends Mixin<AttrsNodeType<A>> {
  /**
   * The attributes passed to the component
   */
  attrs: A

  /** @internal */
  constructor(attrs: A) {
    super()
    this.attrs = attrs
  }

  /**
   * The render function that has to be defined by Components
   */
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
 * @code ../examples/node_add_mixin.tsx
 */
export function node_add_mixin(node: Node, mixin: Mixin): void {
  (node[sym_mixins] = node[sym_mixins] ?? []).push(mixin)
  mixin.node = node
}


/**
 * Remove a Mixin from the array of mixins associated with this Node.
 *
 * Stops the observers if they were running.
 *
 * Does **NOT** call its `removed()` handlers.
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
