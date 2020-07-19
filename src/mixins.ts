
import { sym_mixins } from './dom'
import type { EmptyAttributes, Attrs, Renderable } from './elt'


export type ArgTypes<T> = T extends (...args: infer U) => any ? U : never
export type ResType<T> = T extends (...args: any[]) => infer U ? U : never


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
export class Mixin {

  /**
   * Get a Mixin by its class on the given node or its parents.
   *
   * You do not need to overload this static method.
   *
   * @param node The node at which we'll start looking for the mixin
   * @param recursive Set to false if you do not want the mixin to be searched on the
   *   node parent's if it was not found.
   */
  static get<N extends Node, M extends Mixin>(this: new (...a: any[]) => M, node: Node | EventTarget, recursive = true): M | null {
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

  static emit<M extends Mixin, K extends keyof M>(this: { new (...a: any[]): M, get(node: Node): M }, node: Node, method: K, ...args: ArgTypes<M[K]>): ResType<M[K]> {
    const inst = this.get(node)
    if (inst) {
      return (inst[method] as any)(...args)
    }
    throw new Error(`Mixin '${this.name}' was not found on this node or any parent`)
  }

  static broadcast<M extends Mixin, K extends keyof M>(this: { new (...a: any[]): M, get(node: Node): M }, node: Node, method: K, ...args: ArgTypes<M[K]>): ResType<M[K]>[] {
    var res = [] as ResType<M[K]>[]
    for (var iter = node.firstChild; iter; iter = iter.nextSibling) {
      var mx = iter[sym_mixins]
      if (!mx) continue
      for (var l = mx.length, i = 0; i < l; i++) {
        if (mx[i] instanceof this) {
          res.push((mx[i] as any)[method](...args))
        }
      }
    }
    return res
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
export abstract class Component<N extends Node, A extends EmptyAttributes<N> = Attrs<N>> extends Mixin {
  /**
   *
   */
  node!: N
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
  abstract render(children: Renderable[]): N

  /** @internal */
  renderAndAttach(children: Renderable[]): N {
    const res = this.render(children)
    this.node = res
    node_add_mixin(res, this)
    return res
  }
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
}
