import { _node_append, node_append } from "./dom"
import { sym_elt_init, sym_fragment_source } from "./symbols"

import type { Attrs, ElementMap, EmptyAttributes, Renderable } from "./types"

////////////////////////////////////////////////////////

/**
 * Marker passed as the second argument to two-parameter components (`fn.length > 1`).
 * JSX children are inserted at the **`RefChild` insertion point** in the returned tree,
 * or at the root when no insertion point is declared.
 *
 * Pick **one** placement mode per component — they are **mutually exclusive**:
 *
 * - **Bare `ref` in the tree** — fixed insertion point, always present:
 *   `(attrs, ref) => <div><span>here: {ref}</span></div>`
 * - **`IfChildren(fn)`** — scaffold exists only when JSX children were passed; pass `ref` inside `fn`'s container:
 *   `(attrs, ref) => <div><span>Always present content</span>{ref.IfChildren(ref => <div class="body">{ref} - only when children given</div>)}</div>`
 *
 * Do not combine bare `{ref}` and `IfChildren()` in the same component.
 *
 * @see tests/refchild.pw.ts
 */
export class RefChild extends Comment {
  private with_content: ((refchild: RefChild) => Renderable<Node>) | null = null
  private content_ref: Comment = document.createComment(`with-content`)

  constructor() {
    // labelled with its nesting depth ; must not touch the counter, which indexes the reuse pool below
    super(`ref${refchild_counter}`)
  }

  get isUsed() {
    return this.parentNode != null || this.content_ref.parentNode != null
  }

  /** Scaffold from `fn` exists only when the component received children; pass `ref` into that container. Mutually exclusive with bare `{ref}` in the tree. */
  IfChildren(fn: (refchild: RefChild) => Renderable<Node>) {
    this.with_content = fn
    this.content_ref = document.createComment(`${this.textContent}-content`)
    return this.content_ref
  }

  override before(...nodes: (Node | string)[]) {
    const ref = this.content_ref
    if (this.with_content != null && ref.parentNode != null) {
      node_append(ref.parentNode, this.with_content(this), ref)
      ref.remove()
      this.with_content = null
    }
    return super.before(...nodes)
  }

  override remove() {
    this.with_content = null
    return super.remove()
  }
}

// Just to avoid Comment allocations
let refchild_counter = 0
/** One RefChild per nesting depth of component calls, reused across calls (grows as deep as the deepest nesting). */
const refchildren: RefChild[] = []

export type NodeTypeFromCreator<T extends string> =
  // If it is a string of a known HTML element, return it
  T extends keyof HTMLElementTagNameMap
    ? HTMLElementTagNameMap[T]
    : // If it is a string of known SVG element, return it
      T extends keyof SVGElementTagNameMap
      ? SVGElementTagNameMap[T]
      : // Otherwise, it will be a plain HTMLElement
        HTMLElement
export type AttrsFor<T extends string> = T extends keyof ElementMap ? ElementMap[T] : Attrs<HTMLElement>

/**
 * Create Nodes with a twist.
 *
 * This function is the base of element ; it creates Nodes and glues together
 * Controllers, decorators, classes and style.
 * @category dom, toc
 */
export function e<T extends (a: any, refchild: RefChild) => Node>(
  elt: T,
  attrs: Parameters<T>[0],
  ...children: (Renderable<ReturnType<typeof elt>> | Attrs<HTMLElement>)[]
): ReturnType<typeof elt>
export function e<T extends Node>(elt: T, ...children: (Attrs<T> | Renderable<T>)[]): T
export function e<T extends string>(
  elt: T,
  ...children: (Renderable<NodeTypeFromCreator<T>> | AttrsFor<T>)[]
): NodeTypeFromCreator<T>
export function e<N extends Node>(
  elt: string | Node | ((...args: any[]) => any),
  ...children: (Renderable<N> | Attrs<N> | any)[]
): N {
  let node: N // just to prevent the warnings later

  let is_basic_node = true
  let refchild: RefChild | null = null

  // create a simple DOM node
  if (typeof elt === "string") {
    switch (elt) {
      case "svg":
      case "circle":
      case "clipPath":
      case "defs":
      case "desc":
      case "ellipse":
      case "feBlend":
      case "feColorMatrix":
      case "feComponentTransfer":
      case "feComposite":
      case "feConvolveMatrix":
      case "feDiffuseLighting":
      case "feDisplacementMap":
      case "feDistantLight":
      case "feFlood":
      case "feFuncA":
      case "feFuncB":
      case "feFuncG":
      case "feFuncR":
      case "feGaussianBlur":
      case "feImage":
      case "feMerge":
      case "feMergeNode":
      case "feMorphology":
      case "feOffset":
      case "fePointLight":
      case "feSpecularLighting":
      case "feSpotLight":
      case "feTile":
      case "feTurbulence":
      case "filter":
      case "foreignObject":
      case "g":
      case "image":
      case "line":
      case "linearGradient":
      case "marker":
      case "mask":
      case "metadata":
      case "path":
      case "pattern":
      case "polygon":
      case "polyline":
      case "radialGradient":
      case "rect":
      case "stop":
      case "switch":
      case "symbol":
      case "text":
      case "textPath":
      case "tspan":
      case "use":
      case "view":
        node = document.createElementNS("http://www.w3.org/2000/svg", elt) as unknown as N
        break
      default:
        node = document.createElement(elt) as unknown as N
        node[sym_elt_init]?.()
    }
  } else if (typeof elt === "function") {
    // elt is just a creator function
    if (elt.length > 1) {
      // the creator takes a RefChild : reuse the pooled one for this nesting depth, creating it on first use
      refchild = refchildren[refchild_counter]
      if (refchild == null) {
        refchild = new RefChild()
        refchildren[refchild_counter] = refchild
      }
      refchild_counter++
      node = elt(children[0] ?? {}, refchild)
    } else {
      node = elt(children[0] ?? {})
    }

    // if refchild was given but not inserted, set it back to null
    if (refchild != null) {
      if (!refchild.isUsed) {
        refchild_counter--
        refchild = null
      }
    }
    is_basic_node = false
    // `<>`: keeps what it is built from, to be rebuilt when inserted again (see `_node_append`)
    if (elt === Fragment) (node as unknown as DocumentFragment)[sym_fragment_source] = children
  } else {
    node = elt as N
  }

  for (let i = 0, l = children.length; i < l; i++) {
    _node_append(node, children[i], refchild, is_basic_node, false)
  }

  if (refchild != null) {
    refchild_counter--
    refchild.remove()
  }

  return node
}

/**
 * Creates a document fragment.
 *
 * The JSX namespace points `JSX.Fragment` to this function.
 *
 * Inserting a fragment moves its nodes out of it, so it is empty afterwards. A `<>…</>` keeps the
 * children it was built from: inserted again once empty, it is rebuilt from them, into itself as at its
 * creation. Its elements are moved back (the same nodes, with their state), its verbs and observables
 * are inserted again and show their current value, and its decorators run again on the fragment. A
 * fragment created otherwise (`Fragment()`, `document.createDocumentFragment()`) can be inserted once:
 * inserting it again once empty only logs a warning.
 *
 * A fragment itself is never attached to the document, so lifecycle decorators placed directly in it
 * (`$observe`, `$connected`, `$disconnected`) are not tied to anything:
 *
 * ```tsx
 * <>{$observe(o_x, x => { ... })}<span>{o_x}</span></>
 * ```
 *
 * Prefer a real element when you need `$connected` / `$observe` lifecycle.
 *
 * @category dom, toc
 */
export const Fragment = document.createDocumentFragment.bind(document)

const $ = Fragment

export namespace e {
  /**
   * Extend the JSX namespace to be able to use .tsx code.
   */
  export namespace JSX {
    /** @internal */
    export type Element = Node

    /** @internal */
    export interface ElementChildrenAttribute {
      $$children: any
    }

    /**
     * The signature function components should conform to.
     * @internal
     */
    export type ElementClassFn<N extends Node> = (attrs: EmptyAttributes<N>, refchild: RefChild) => N

    /** @internal */
    export type ElementClass = ElementClassFn<any>

    // This is the line that tells JSX what attributes the basic elements like "div" or "article" have
    export type IntrinsicElements = ElementMap & {
      [name: string]: Attrs<HTMLElement>
    }
  }

  /**
   * An alias to conform to typescript's JSX
   * @internal
   */
  export const createElement = e

  /** @internal */
  export const Fragment: (at: EmptyAttributes<DocumentFragment>) => DocumentFragment = $
}

// `E` as a global, for the JSX factory (`jsxFactory: "E"`): `globalThis` is `window` in a page and
// `global` under node / bun.
if (typeof (globalThis as any).E === "undefined") {
  ;(globalThis as any).E = e
}

declare global {
  const E: typeof e

  namespace E.JSX {
    export type Element = Node
    export type ElementChildrenAttribute = e.JSX.ElementChildrenAttribute
    export type ElementClassFn<N extends Node> = e.JSX.ElementClassFn<N>
    export type ElementClass = e.JSX.ElementClass
    export type IntrinsicElements = e.JSX.IntrinsicElements
  }
}
