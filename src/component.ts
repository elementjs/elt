
import { node_add_data } from "./dom"
import type { EmptyAttributes, Attrs, Renderable, AttrsNodeType } from "./elt"


/**
 * The Component is the core class of your TSX components.
 *
 * It is just a Mixin that has a `render()` method and that defines the `attrs`
 * property which will restrict what attributes the component can be created with.
 *
 * All attributes **must** extend the base `Attrs` class.
 * @category dom, toc
 */
export abstract class Component<A extends EmptyAttributes<any> = Attrs<HTMLElement>> {
  /**
   *
   */
  node!: AttrsNodeType<A>
  /**
   * The attributes passed to the component
   */
  attrs: A

  /** @internal */
  constructor(attrs: A) {
    this.attrs = attrs
  }

  /**
   * The render function that has to be defined by Components
   */
  abstract render(children: Renderable[]): AttrsNodeType<A>

  /** @internal */
  renderAndAttach(children: Renderable[]): AttrsNodeType<A> {
    const res = this.render(children)
    this.node = res
    node_add_data(res, this)
    return res
  }
}
