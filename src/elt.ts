
import {
  node_append,
} from "./dom"

import {
  Attrs,
  ElementMap,
  EmptyAttributes,
  Renderable,
} from "./types"

import { sym_exposed, } from "./symbols"
import { EltCustomElement } from "./custom-elements"

////////////////////////////////////////////////////////


export function setup_base_styles(doc = document) {
  const style = doc.createElement("style")
  style.append(`e-obs,e-if,e-switch,e-repeat,e-repeat-scroll,e-virtual-scroll,e-ritem,e-iter,e-app,e-app-view,e-lang{ display: contents }`)
  doc.head.appendChild(style)
}
requestAnimationFrame(() => setup_base_styles())


export type NodeTypeFromCreator<T extends string> =
  // If it is a string of a known HTML element, return it
  T extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[T]
  // If it is a string of known SVG element, return it
  : T extends keyof SVGElementTagNameMap ? SVGElementTagNameMap[T]
  // Otherwise, it will be a plain HTMLElement
  : HTMLElement
export type AttrsFor<T extends string> =
  T extends keyof ElementMap ? ElementMap[T] : Attrs<HTMLElement>

/**
 * Create Nodes with a twist.
 *
 * This function is the base of element ; it creates Nodes and glues together
 * Controllers, decorators, classes and style.
 * @category dom, toc
 */
export function e<T extends (a: A) => N, A extends Attrs<any>, N extends Node>(elt: T, attrs: A, ...children: (A | Renderable<N>)[]): N
export function e<T extends Node>(elt: T, ...children: (Attrs<T> | Renderable<T>)[]): T
export function e<T extends string>(elt: T, ...children: (Renderable<NodeTypeFromCreator<T>> | AttrsFor<T>)[]): NodeTypeFromCreator<T>
// eslint-disable-next-line @typescript-eslint/ban-types
export function e<N extends Node>(elt: string | Node | Function, ...children: (Renderable<N> | Attrs<N>)[]): N {
  let node: N // just to prevent the warnings later

  let is_basic_node = true

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
    }
  } else if (typeof elt === "function") {
    // elt is just a creator function
    node = elt(children[0] ?? {})
    is_basic_node = false
  } else {
    node = elt as N
  }

  const l = children.length
  if (l > 0)
    node_append(node, children[0], null, is_basic_node)
  for (let i = 1; i < l; i++) {
    node_append(node, children[i])
  }

  if (node[sym_exposed] !== undefined) {
    // We can safely init a custom element now that its properties have been potentially replaced by provided observables in its Attrs.
    (node as unknown as EltCustomElement).init()
  }

  return node
}

/**
 * Creates a document fragment.
 *
 * The JSX namespace points `JSX.Fragment` to this function.
 *
 * > **Note**: Its signature says it expects `Insertable`, but since a document fragment itself never
 * > ends up being added to `Node`, no observable will ever run on it, no life cycle callback will
 * > ever be called on it.
 *
 * ```tsx
 * [[include:../examples/fragment.tsx]]
 * ```
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
    export interface ElementClassFn<N extends Node> {
      (attrs: EmptyAttributes<N>): N
    }

    /** @internal */
    export type ElementClass = ElementClassFn<any>

    // This is the line that tells JSX what attributes the basic elements like "div" or "article" have
    export type IntrinsicElements = ElementMap & {[name: string]: Attrs<HTMLElement>}
  }

  /**
   * An alias to conform to typescript's JSX
   * @internal
   */
  export const createElement = e

  /** @internal */
  export const Fragment: (at: EmptyAttributes<DocumentFragment>) => DocumentFragment = $
}

declare let global: any
if (typeof global !== "undefined" && typeof (global.E) === "undefined") {
  (global as any).E = e
}

if ("undefined" !== typeof window && typeof (window as any).E === "undefined") {
  (window as any).E = e
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
