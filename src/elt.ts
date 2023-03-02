import { o } from "./observable"

import {
  node_observe,
  node_add_child,
  node_clear
} from "./dom"

import {
  Attrs,
  AttrsNodeType,
  ElementMap,
  EmptyAttributes,
  Insertable,
  Renderable,
} from "./types"

////////////////////////////////////////////////////////


const SVG = "http://www.w3.org/2000/svg"
const NS = new Map<string, string>([
  ["svg", SVG],
  ["circle", SVG],
  ["clipPath", SVG],
  ["defs", SVG],
  ["desc", SVG],
  ["ellipse", SVG],
  ["feBlend", SVG],
  ["feColorMatrix", SVG],
  ["feComponentTransfer", SVG],
  ["feComposite", SVG],
  ["feConvolveMatrix", SVG],
  ["feDiffuseLighting", SVG],
  ["feDisplacementMap", SVG],
  ["feDistantLight", SVG],
  ["feFlood", SVG],
  ["feFuncA", SVG],
  ["feFuncB", SVG],
  ["feFuncG", SVG],
  ["feFuncR", SVG],
  ["feGaussianBlur", SVG],
  ["feImage", SVG],
  ["feMerge", SVG],
  ["feMergeNode", SVG],
  ["feMorphology", SVG],
  ["feOffset", SVG],
  ["fePointLight", SVG],
  ["feSpecularLighting", SVG],
  ["feSpotLight", SVG],
  ["feTile", SVG],
  ["feTurbulence", SVG],
  ["filter", SVG],
  ["foreignObject", SVG],
  ["g", SVG],
  ["image", SVG],
  ["line", SVG],
  ["linearGradient", SVG],
  ["marker", SVG],
  ["mask", SVG],
  ["metadata", SVG],
  ["path", SVG],
  ["pattern", SVG],
  ["polygon", SVG],
  ["polyline", SVG],
  ["radialGradient", SVG],
  ["rect", SVG],
  ["stop", SVG],
  ["switch", SVG],
  ["symbol", SVG],
  ["text", SVG],
  ["textPath", SVG],
  ["tspan", SVG],
  ["use", SVG],
  ["view", SVG],
])


export function setup_base_styles(doc = document) {
  const style = doc.createElement("style")
  style.append(`e-display,e-if,e-switch,e-repeat,e-repeat-scroll,e-ritem,e-iter{ display: contents }`)
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
export function Display(obs: o.RO<Renderable>): Node {
  const d = document.createElement("e-display")
  node_observe(d, obs, renderable => {
    node_clear(d)
    node_add_child(d, renderable)
  }, undefined, true)
  return d
}


/**
 * Create Nodes with a twist.
 *
 * This function is the base of element ; it creates Nodes and glues together
 * Controllers, decorators, classes and style.
 * @category dom, toc
 */
export function e<N extends Node>(elt: N, ...children: (Insertable<N> | Attrs<N>)[]): N
export function e<K extends keyof ElementMap & keyof SVGElementTagNameMap>(
  elt: K,
  ...children: (Insertable<SVGElementTagNameMap[K]> | ElementMap[K])[]
): SVGElementTagNameMap[K]
export function e<K extends keyof ElementMap & keyof HTMLElementTagNameMap>(
  elt: K,
  ...children: (Insertable<HTMLElementTagNameMap[K]> | ElementMap[K])[]
): HTMLElementTagNameMap[K]
export function e(elt: string, ...children: (Insertable<HTMLElement> | Attrs<HTMLElement>)[]): HTMLElement
export function e<A extends EmptyAttributes<any>>(elt: (attrs: A) => AttrsNodeType<A>, attrs: A, ...children: Insertable<AttrsNodeType<A>>[]): AttrsNodeType<A>
// eslint-disable-next-line @typescript-eslint/ban-types
export function e<N extends Node>(elt: string | Node | Function, ...children: (Insertable<N> | Attrs<N>)[]): N {
  if (!elt) throw new Error("e() needs at least a string, a function or a Component")

  let node: N // just to prevent the warnings later

  let is_basic_node = true

  // create a simple DOM node
  if (typeof elt === "string") {
    const ns = NS.get(elt) // || attrs.xmlns
    node = (ns ? document.createElementNS(ns, elt) : document.createElement(elt)) as unknown as N
    is_basic_node = true
  } else if (elt instanceof Node) {
    node = elt as N
  } else {
    // elt is just a creator function
    node = elt(children[0] ?? {})
    is_basic_node = false
  }

  for (let i = 0, l = children.length; i < l; i++) {
    node_add_child(node, children[i], null, is_basic_node)
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
export function Fragment(...children: (Insertable<DocumentFragment> | EmptyAttributes<DocumentFragment>)[]): DocumentFragment {
  const fr = document.createDocumentFragment()
  // This is a trick, children may contain lots of stuff
  return e(fr, children as Renderable[])
}

const $ = Fragment


export namespace e {

  /**
   * @internal
   */
  export function renderable_to_node(r: Renderable): Node | null
  export function renderable_to_node(r: Renderable, null_as_comment: true): Node
  export function renderable_to_node(r: Renderable, null_as_comment = false): Node | null {
    if (r == null)
      return null_as_comment ? document.createComment(" null ") : null
    else if (typeof r === "string" || typeof r === "number")
      return document.createTextNode(r.toString())
    else if (o.isReadonlyObservable(r))
      return Display(r)
    else if (Array.isArray(r)) {
      const df = document.createDocumentFragment()
      for (let i = 0, l = r.length; i < l; i++) {
        const r2 = renderable_to_node(r[i], null_as_comment as true)
        if (r2) df.appendChild(r2)
      }
      return df
    } else {
      return r
    }
  }

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
  export function mkwrapper<K extends keyof ElementMap & keyof HTMLElementTagNameMap>(elt: K): (...args: (Insertable<HTMLElementTagNameMap[K]> | ElementMap[K])[]) => HTMLElementTagNameMap[K]
  export function mkwrapper(elt: string): (...args: (Insertable<HTMLElement> | Attrs<HTMLElement>)[]) => HTMLElement
  export function mkwrapper<K extends keyof HTMLElementTagNameMap & keyof ElementMap>(elt: K): (...args: (Insertable<HTMLElementTagNameMap[K]> | ElementMap[K])[]) => HTMLElementTagNameMap[K] {
    return (...args) => {
      return e<K>(elt, ...args)
    }
  }

  /** @internal */
  export const A = mkwrapper("a")
  /** @internal */
  export const ABBR = mkwrapper("abbr")
  /** @internal */
  export const ADDRESS = mkwrapper("address")
  /** @internal */
  export const AREA = mkwrapper("area")
  /** @internal */
  export const ARTICLE = mkwrapper("article")
  /** @internal */
  export const ASIDE = mkwrapper("aside")
  /** @internal */
  export const AUDIO = mkwrapper("audio")
  /** @internal */
  export const B = mkwrapper("b")
  /** @internal */
  export const BASE = mkwrapper("base")
  /** @internal */
  export const BDI = mkwrapper("bdi")
  /** @internal */
  export const BDO = mkwrapper("bdo")
  /** @internal */
  export const BIG = mkwrapper("big")
  /** @internal */
  export const BLOCKQUOTE = mkwrapper("blockquote")
  /** @internal */
  export const BODY = mkwrapper("body")
  /** @internal */
  export const BR = mkwrapper("br")
  /** @internal */
  export const BUTTON = mkwrapper("button")
  /** @internal */
  export const CANVAS = mkwrapper("canvas")
  /** @internal */
  export const CAPTION = mkwrapper("caption")
  /** @internal */
  export const CITE = mkwrapper("cite")
  /** @internal */
  export const CODE = mkwrapper("code")
  /** @internal */
  export const COL = mkwrapper("col")
  /** @internal */
  export const COLGROUP = mkwrapper("colgroup")
  /** @internal */
  export const DATA = mkwrapper("data")
  /** @internal */
  export const DATALIST = mkwrapper("datalist")
  /** @internal */
  export const DD = mkwrapper("dd")
  /** @internal */
  export const DEL = mkwrapper("del")
  /** @internal */
  export const DETAILS = mkwrapper("details")
  /** @internal */
  export const DFN = mkwrapper("dfn")
  /** @internal */
  export const DIALOG = mkwrapper("dialog")
  /** @internal */
  export const DIV = mkwrapper("div")
  /** @internal */
  export const DL = mkwrapper("dl")
  /** @internal */
  export const DT = mkwrapper("dt")
  /** @internal */
  export const EM = mkwrapper("em")
  /** @internal */
  export const EMBED = mkwrapper("embed")
  /** @internal */
  export const FIELDSET = mkwrapper("fieldset")
  /** @internal */
  export const FIGCAPTION = mkwrapper("figcaption")
  /** @internal */
  export const FIGURE = mkwrapper("figure")
  /** @internal */
  export const FOOTER = mkwrapper("footer")
  /** @internal */
  export const FORM = mkwrapper("form")
  /** @internal */
  export const H1 = mkwrapper("h1")
  /** @internal */
  export const H2 = mkwrapper("h2")
  /** @internal */
  export const H3 = mkwrapper("h3")
  /** @internal */
  export const H4 = mkwrapper("h4")
  /** @internal */
  export const H5 = mkwrapper("h5")
  /** @internal */
  export const H6 = mkwrapper("h6")
  /** @internal */
  export const HEAD = mkwrapper("head")
  /** @internal */
  export const HEADER = mkwrapper("header")
  /** @internal */
  export const HR = mkwrapper("hr")
  /** @internal */
  export const HTML = mkwrapper("html")
  /** @internal */
  export const I = mkwrapper("i")
  /** @internal */
  export const IFRAME = mkwrapper("iframe")
  /** @internal */
  export const IMG = mkwrapper("img")
  /** @internal */
  export const INPUT = mkwrapper("input")
  /** @internal */
  export const INS = mkwrapper("ins")
  /** @internal */
  export const KBD = mkwrapper("kbd")
  /** @internal */
  export const KEYGEN = mkwrapper("keygen")
  /** @internal */
  export const LABEL = mkwrapper("label")
  /** @internal */
  export const LEGEND = mkwrapper("legend")
  /** @internal */
  export const LI = mkwrapper("li")
  /** @internal */
  export const LINK = mkwrapper("link")
  /** @internal */
  export const MAIN = mkwrapper("main")
  /** @internal */
  export const MAP = mkwrapper("map")
  /** @internal */
  export const MARK = mkwrapper("mark")
  /** @internal */
  export const MENU = mkwrapper("menu")
  /** @internal */
  export const MENUITEM = mkwrapper("menuitem")
  /** @internal */
  export const META = mkwrapper("meta")
  /** @internal */
  export const METER = mkwrapper("meter")
  /** @internal */
  export const NAV = mkwrapper("nav")
  /** @internal */
  export const NOSCRIPT = mkwrapper("noscript")
  /** @internal */
  export const OBJECT = mkwrapper("object")
  /** @internal */
  export const OL = mkwrapper("ol")
  /** @internal */
  export const OPTGROUP = mkwrapper("optgroup")
  /** @internal */
  export const OPTION = mkwrapper("option")
  /** @internal */
  export const OUTPUT = mkwrapper("output")
  /** @internal */
  export const P = mkwrapper("p")
  /** @internal */
  export const PARAM = mkwrapper("param")
  /** @internal */
  export const PICTURE = mkwrapper("picture")
  /** @internal */
  export const PRE = mkwrapper("pre")
  /** @internal */
  export const PROGRESS = mkwrapper("progress")
  /** @internal */
  export const Q = mkwrapper("q")
  /** @internal */
  export const RP = mkwrapper("rp")
  /** @internal */
  export const RT = mkwrapper("rt")
  /** @internal */
  export const RUBY = mkwrapper("ruby")
  /** @internal */
  export const S = mkwrapper("s")
  /** @internal */
  export const SAMP = mkwrapper("samp")
  /** @internal */
  export const SCRIPT = mkwrapper("script")
  /** @internal */
  export const SECTION = mkwrapper("section")
  /** @internal */
  export const SELECT = mkwrapper("select")
  /** @internal */
  export const SMALL = mkwrapper("small")
  /** @internal */
  export const SOURCE = mkwrapper("source")
  /** @internal */
  export const SPAN = mkwrapper("span")
  /** @internal */
  export const STRONG = mkwrapper("strong")
  /** @internal */
  export const STYLE = mkwrapper("style")
  /** @internal */
  export const SUB = mkwrapper("sub")
  /** @internal */
  export const SUMMARY = mkwrapper("summary")
  /** @internal */
  export const SUP = mkwrapper("sup")
  /** @internal */
  export const TABLE = mkwrapper("table")
  /** @internal */
  export const TBODY = mkwrapper("tbody")
  /** @internal */
  export const TD = mkwrapper("td")
  /** @internal */
  export const TEXTAREA = mkwrapper("textarea")
  /** @internal */
  export const TFOOT = mkwrapper("tfoot")
  /** @internal */
  export const TH = mkwrapper("th")
  /** @internal */
  export const THEAD = mkwrapper("thead")
  /** @internal */
  export const TIME = mkwrapper("time")
  /** @internal */
  export const TITLE = mkwrapper("title")
  /** @internal */
  export const TR = mkwrapper("tr")
  /** @internal */
  export const TRACK = mkwrapper("track")
  /** @internal */
  export const U = mkwrapper("u")
  /** @internal */
  export const UL = mkwrapper("ul")
  /** @internal */
  export const VAR = mkwrapper("var")
  /** @internal */
  export const VIDEO = mkwrapper("video")
  /** @internal */
  export const WBR = mkwrapper("wbr")

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
