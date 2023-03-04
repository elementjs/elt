import { o } from "./observable"

import {
  node_observe,
  node_append,
  node_clear
} from "./dom"

import {
  Attrs,
  ElementMap,
  EmptyAttributes,
  Insertable,
  Renderable,
} from "./types"

////////////////////////////////////////////////////////


const SVG_NS = "http://www.w3.org/2000/svg"
const SVG = new Set(["svg", "circle", "clipPath", "defs", "desc", "ellipse", "feBlend", "feColorMatrix", "feComponentTransfer", "feComposite", "feConvolveMatrix", "feDiffuseLighting", "feDisplacementMap", "feDistantLight", "feFlood", "feFuncA", "feFuncB", "feFuncG", "feFuncR", "feGaussianBlur", "feImage", "feMerge", "feMergeNode", "feMorphology", "feOffset", "fePointLight", "feSpecularLighting", "feSpotLight", "feTile", "feTurbulence", "filter", "foreignObject", "g", "image", "line", "linearGradient", "marker", "mask", "metadata", "path", "pattern", "polygon", "polyline", "radialGradient", "rect", "stop", "switch", "symbol", "text", "textPath", "tspan", "use", "view",])


export function setup_base_styles(doc = document) {
  const style = doc.createElement("style")
  style.append(`e-display,e-if,e-switch,e-repeat,e-repeat-scroll,e-ritem,e-iter,e-app,e-app-view{ display: contents }`)
  doc.head.appendChild(style)
}
requestAnimationFrame(() => setup_base_styles())


/**
 * Write and update the string value of an observable value into
 * a Text node.
 *
 * This verb is used whenever an observable is passed as a child to a node.
 *
 * @code ../examples/display.tsx
 *
 * @category verbs, toc
 */
export function Display(obs: o.RO<Renderable>, element = "e-display"): HTMLElement {
  const d = document.createElement(element)
  node_observe(d, obs, renderable => {
    node_clear(d)
    node_append(d, renderable)
  }, undefined, true)
  return d
}


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
export function e<T extends (a: A) => N, A extends Attrs<any>, N extends Node>(elt: T, ...children: (A | Insertable<N>)[]): N
export function e<T extends Node>(elt: T, ...children: Insertable<T>[]): T
export function e<T extends string>(elt: T, ...children: (Insertable<NodeTypeFromCreator<T>> | AttrsFor<T>)[]): NodeTypeFromCreator<T>
// eslint-disable-next-line @typescript-eslint/ban-types
export function e<N extends Node>(elt: string | Node | Function, ...children: (Insertable<N> | Attrs<N>)[]): N {
  if (!elt) throw new Error("e() needs at least a string, a function or a Component")

  let node: N // just to prevent the warnings later

  let is_basic_node = true

  // create a simple DOM node
  if (typeof elt === "string") {
    node = (SVG.has(elt) ? document.createElementNS(SVG_NS, elt) : document.createElement(elt)) as unknown as N
    is_basic_node = true
  } else if (elt instanceof Node) {
    node = elt as N
  } else {
    // elt is just a creator function
    node = elt(children[0] ?? {})
    is_basic_node = false
  }

  for (let i = 0, l = children.length; i < l; i++) {
    node_append(node, children[i], null, is_basic_node)
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
 * @code ../examples/fragment.tsx
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
    export type IntrinsicElements = ElementMap
  }

  /**
   * A wrapper maker for basic elements, used to generate all of the $A, $DIV, ...
   * @internal
   */
  function _<K extends keyof ElementMap & keyof HTMLElementTagNameMap>(elt: K): (...args: (Insertable<HTMLElementTagNameMap[K]> | ElementMap[K])[]) => HTMLElementTagNameMap[K]
  function _(elt: string): (...args: (Insertable<HTMLElement> | Attrs<HTMLElement>)[]) => HTMLElement
  function _<K extends keyof HTMLElementTagNameMap & keyof ElementMap>(elt: K): (...args: (Insertable<HTMLElementTagNameMap[K]> | ElementMap[K])[]) => HTMLElementTagNameMap[K] {
    return e.bind(null, elt) as any
  }

  /** @internal */
  export const A = _("a")
  /** @internal */
  export const ABBR = _("abbr")
  /** @internal */
  export const ADDRESS = _("address")
  /** @internal */
  export const AREA = _("area")
  /** @internal */
  export const ARTICLE = _("article")
  /** @internal */
  export const ASIDE = _("aside")
  /** @internal */
  export const AUDIO = _("audio")
  /** @internal */
  export const B = _("b")
  /** @internal */
  export const BASE = _("base")
  /** @internal */
  export const BDI = _("bdi")
  /** @internal */
  export const BDO = _("bdo")
  /** @internal */
  export const BIG = _("big")
  /** @internal */
  export const BLOCKQUOTE = _("blockquote")
  /** @internal */
  export const BODY = _("body")
  /** @internal */
  export const BR = _("br")
  /** @internal */
  export const BUTTON = _("button")
  /** @internal */
  export const CANVAS = _("canvas")
  /** @internal */
  export const CAPTION = _("caption")
  /** @internal */
  export const CITE = _("cite")
  /** @internal */
  export const CODE = _("code")
  /** @internal */
  export const COL = _("col")
  /** @internal */
  export const COLGROUP = _("colgroup")
  /** @internal */
  export const DATA = _("data")
  /** @internal */
  export const DATALIST = _("datalist")
  /** @internal */
  export const DD = _("dd")
  /** @internal */
  export const DEL = _("del")
  /** @internal */
  export const DETAILS = _("details")
  /** @internal */
  export const DFN = _("dfn")
  /** @internal */
  export const DIALOG = _("dialog")
  /** @internal */
  export const DIV = _("div")
  /** @internal */
  export const DL = _("dl")
  /** @internal */
  export const DT = _("dt")
  /** @internal */
  export const EM = _("em")
  /** @internal */
  export const EMBED = _("embed")
  /** @internal */
  export const FIELDSET = _("fieldset")
  /** @internal */
  export const FIGCAPTION = _("figcaption")
  /** @internal */
  export const FIGURE = _("figure")
  /** @internal */
  export const FOOTER = _("footer")
  /** @internal */
  export const FORM = _("form")
  /** @internal */
  export const H1 = _("h1")
  /** @internal */
  export const H2 = _("h2")
  /** @internal */
  export const H3 = _("h3")
  /** @internal */
  export const H4 = _("h4")
  /** @internal */
  export const H5 = _("h5")
  /** @internal */
  export const H6 = _("h6")
  /** @internal */
  export const HEAD = _("head")
  /** @internal */
  export const HEADER = _("header")
  /** @internal */
  export const HR = _("hr")
  /** @internal */
  export const HTML = _("html")
  /** @internal */
  export const I = _("i")
  /** @internal */
  export const IFRAME = _("iframe")
  /** @internal */
  export const IMG = _("img")
  /** @internal */
  export const INPUT = _("input")
  /** @internal */
  export const INS = _("ins")
  /** @internal */
  export const KBD = _("kbd")
  /** @internal */
  export const KEYGEN = _("keygen")
  /** @internal */
  export const LABEL = _("label")
  /** @internal */
  export const LEGEND = _("legend")
  /** @internal */
  export const LI = _("li")
  /** @internal */
  export const LINK = _("link")
  /** @internal */
  export const MAIN = _("main")
  /** @internal */
  export const MAP = _("map")
  /** @internal */
  export const MARK = _("mark")
  /** @internal */
  export const MENU = _("menu")
  /** @internal */
  export const MENUITEM = _("menuitem")
  /** @internal */
  export const META = _("meta")
  /** @internal */
  export const METER = _("meter")
  /** @internal */
  export const NAV = _("nav")
  /** @internal */
  export const NOSCRIPT = _("noscript")
  /** @internal */
  export const OBJECT = _("object")
  /** @internal */
  export const OL = _("ol")
  /** @internal */
  export const OPTGROUP = _("optgroup")
  /** @internal */
  export const OPTION = _("option")
  /** @internal */
  export const OUTPUT = _("output")
  /** @internal */
  export const P = _("p")
  /** @internal */
  export const PARAM = _("param")
  /** @internal */
  export const PICTURE = _("picture")
  /** @internal */
  export const PRE = _("pre")
  /** @internal */
  export const PROGRESS = _("progress")
  /** @internal */
  export const Q = _("q")
  /** @internal */
  export const RP = _("rp")
  /** @internal */
  export const RT = _("rt")
  /** @internal */
  export const RUBY = _("ruby")
  /** @internal */
  export const S = _("s")
  /** @internal */
  export const SAMP = _("samp")
  /** @internal */
  export const SCRIPT = _("script")
  /** @internal */
  export const SECTION = _("section")
  /** @internal */
  export const SELECT = _("select")
  /** @internal */
  export const SMALL = _("small")
  /** @internal */
  export const SOURCE = _("source")
  /** @internal */
  export const SPAN = _("span")
  /** @internal */
  export const STRONG = _("strong")
  /** @internal */
  export const STYLE = _("style")
  /** @internal */
  export const SUB = _("sub")
  /** @internal */
  export const SUMMARY = _("summary")
  /** @internal */
  export const SUP = _("sup")
  /** @internal */
  export const TABLE = _("table")
  /** @internal */
  export const TBODY = _("tbody")
  /** @internal */
  export const TD = _("td")
  /** @internal */
  export const TEXTAREA = _("textarea")
  /** @internal */
  export const TFOOT = _("tfoot")
  /** @internal */
  export const TH = _("th")
  /** @internal */
  export const THEAD = _("thead")
  /** @internal */
  export const TIME = _("time")
  /** @internal */
  export const TITLE = _("title")
  /** @internal */
  export const TR = _("tr")
  /** @internal */
  export const TRACK = _("track")
  /** @internal */
  export const U = _("u")
  /** @internal */
  export const UL = _("ul")
  /** @internal */
  export const VAR = _("var")
  /** @internal */
  export const VIDEO = _("video")
  /** @internal */
  export const WBR = _("wbr")

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
