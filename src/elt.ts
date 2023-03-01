import { o } from "./observable"

import {
  node_observe_class,
  node_observe_style,
  node_observe_attribute,
  insert_before_and_init,
  node_do_remove,
  node_observe
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

export type WrappedComponent<N extends Node> = {
  componentFn: (at: Attrs<N>, children: Renderable[]) => N
}


let cmt_count = 0
/**
 * A [[Mixin]] made to store nodes between two comments.
 *
 * Can be used as a base to build verbs more easily.
 * @category dom, toc
 */
export class CommentContainer {

  /** The Comment marking the end of the node handled by this Mixin */
  node = document.createComment(`-- ${this.constructor.name} start --`)
  end = document.createComment(`-- ${this.constructor.name} ${cmt_count ++} --`)

  /**
   * Remove all nodes between this.start and this.node
   */
  clear() {
    const end = this.end
    const node = this.node
    const parent = node.parentNode!
    let iter: ChildNode | null = end.previousSibling
    while (iter !== node) {
      parent.removeChild(iter!)
      node_do_remove(iter!, parent)
      iter = end.previousSibling
    }
  }

  /**
   * Update the contents between `this.node` and `this.end` with `cts`. `cts` may be
   * a `DocumentFragment`.
   */
  setContents(cts: Node | null) {
    this.clear()

    // Insert the new comment before the end
    if (cts) insert_before_and_init(this.node.parentNode!, cts, this.end)
  }

  render(): Comment {
    return e(this.node,
      $init(node => node.parentNode!.insertBefore(this.end, node.nextSibling))
    )
  }
}



/**
 * Displays and actualises the content of an Observable containing
 * Node, string or number into the DOM.
 *
 * This is the class that is used whenever an observable is used as
 * a child.
 */
export class Displayer extends CommentContainer {

  /**
   * The `Displayer` expects `Renderable` values.
   */
  constructor(public _obs: o.RO<Renderable>) {
    super()
  }

  render() {
    const res = super.render()
    node_observe(res, this._obs, value => {
      this.setContents(e.renderable_to_node(value))
    })
    return res
  }

}


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
  if (!(obs instanceof o.Observable)) {
    return e.renderable_to_node(obs as Renderable, true)
  }

  return (new Displayer(obs)).render()
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

  let node: N = null! // just to prevent the warnings later

  const is_basic_node = typeof elt === "string" || elt instanceof Node

  if (is_basic_node) {
    // create a simple DOM node
    if (typeof elt === "string") {
      const ns = NS.get(elt) // || attrs.xmlns
      node = (ns ? document.createElementNS(ns, elt) : document.createElement(elt)) as unknown as N
    } else {
      node = elt as N
    }

  } else if (typeof elt === "function") {
    // elt is just a creator function
    node = elt(children[0] ?? {})
  }

  function handle_child_array(array: any[]) {
    for (let i = 0, l = array.length; i < l; i++) {
      const child = array[i]
      if (!child) continue
      if (typeof child === "function") {
        // decorator
        const res = child(node)
        if (res) {
          handle_child_array([res])
        }
      } else if (Array.isArray(child)) {
        handle_child_array(child)
      } else if (child.constructor === Object) {
        e.handle_attrs(node as any, child as any, is_basic_node)
      } else {
        // if not a decorator, then a potential child
        const nd = e.renderable_to_node(child as Renderable)
        if (nd) {
          insert_before_and_init(node, nd)
        }
      }
    }
  }
  handle_child_array(children)

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


import { $init } from "./decorators"


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

  // All these attributes are forwarded and part of the basic Attrs
  const basic_attrs = new Set(["id", "slot", "part", "role", "tabindex", "lang", "inert", "title", "autofocus", "nonce"])

  /**
   * Handle attributes for simple nodes
   * @internal
   */
  export function handle_attrs(node: HTMLElement, attrs: Attrs<any>, is_basic_node: boolean) {
    const keys = Object.keys(attrs) as (keyof typeof attrs)[]
    for (let i = 0, l = keys.length; i < l; i++) {
      const key = keys[i]
      if (key === "class" && attrs.class) {
        const clss = attrs.class
        if (Array.isArray(clss))
          for (let j = 0, lj = clss.length; j < lj; j++) node_observe_class(node, clss[j])
        else
          node_observe_class(node, attrs.class!)
      } else if (key === "style" && attrs.style) {
        node_observe_style(node, attrs.style)
      } else if (is_basic_node || basic_attrs.has(key)) {
        node_observe_attribute(node, key, (attrs as any)[key])
      }
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
