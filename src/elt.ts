import {
  Attrs,
  ComponentFn,
  ComponentInstanciator,
  Insertable
} from './types'

import {
  Mixin,
  Component
} from './mixins'

import {
  getDOMInsertable
} from './verbs'

import { mount } from './mounting'



/**
 * Private mixin used by the e() function when watching style, classes and other attributes.
 */
export class AttrsMixin extends Mixin<HTMLElement> { }


////////////////////////////////////////////////////////


/**
 * get the children of a node in an array
 * @param node the node
 */
export function getChildren(node: Node): Node[] {
  const result: Node[] = []
  let iter = node.firstChild

  while (iter) {
    result.push(iter)
    iter = iter.nextSibling as ChildNode | null
  }

  return result
}


const SVG = "http://www.w3.org/2000/svg"
const NS = {
  // SVG nodes, shamelessly stolen from React.
  svg: SVG,

  circle: SVG,
  clipPath: SVG,
  defs: SVG,
  desc: SVG,
  ellipse: SVG,
  feBlend: SVG,
  feColorMatrix: SVG,
  feComponentTransfer: SVG,
  feComposite: SVG,
  feConvolveMatrix: SVG,
  feDiffuseLighting: SVG,
  feDisplacementMap: SVG,
  feDistantLight: SVG,
  feFlood: SVG,
  feFuncA: SVG,
  feFuncB: SVG,
  feFuncG: SVG,
  feFuncR: SVG,
  feGaussianBlur: SVG,
  feImage: SVG,
  feMerge: SVG,
  feMergeNode: SVG,
  feMorphology: SVG,
  feOffset: SVG,
  fePointLight: SVG,
  feSpecularLighting: SVG,
  feSpotLight: SVG,
  feTile: SVG,
  feTurbulence: SVG,
  filter: SVG,
  foreignObject: SVG,
  g: SVG,
  image: SVG,
  line: SVG,
  linearGradient: SVG,
  marker: SVG,
  mask: SVG,
  metadata: SVG,
  path: SVG,
  pattern: SVG,
  polygon: SVG,
  polyline: SVG,
  radialGradient: SVG,
  rect: SVG,
  stop: SVG,
  switch: SVG,
  symbol: SVG,
  text: SVG,
  textPath: SVG,
  tspan: SVG,
  use: SVG,
  view: SVG,
} as {[name: string]: string}


function isComponent(kls: any): kls is new (attrs: Attrs) => Component<any> {
  return kls.prototype instanceof Component
}

export const GLOBAL_ATTRIBUTES = {
  accesskey: true,
  contenteditable: true,
  dir: true,
  draggable: true,
  dropzone: true,
  id: true,
  lang: true,
  spellcheck: true,
  tabindex: true,
  title: true,
  translate: true,
} as {[attr: string]: boolean}


/**
 * Create Nodes with a twist.
 *
 * This function is the base of element ; it creates Nodes and glues together
 * Controllers, decorators, classes and style.
 */
export function e(elt: ComponentFn, attrs: Attrs | null, ...children: Insertable[]): Element
export function e(elt: string, attrs: Attrs | null, ...children: Insertable[]): HTMLElement
export function e<A>(elt: ComponentInstanciator<A>, attrs: A | null, ...children: Insertable[]): Element
export function e(elt: any, _attrs: Attrs | null, ...children: Insertable[]): Element {

  if (!elt) throw new Error(`e() needs at least a string, a function or a Component`)

  let node: Element = null! // just to prevent the warnings later

  var attrs = _attrs || {} as Attrs
  var is_basic_node = typeof elt === 'string'

  const fragment = getDOMInsertable(children) as DocumentFragment

  if (is_basic_node) {
    // create a simple DOM node
    var ns = NS[elt] || attrs.xmlns
    node = ns ? document.createElementNS(ns, elt) : document.createElement(elt)

    // Append children to the node.
    node.appendChild(fragment)

    var _child = node.firstChild as Node | null
    while (_child) {
      mount(_child)
      _child = _child.nextSibling
    }

  } else if (isComponent(elt)) {

    // elt is an instantiator / Component
    var comp = new elt(attrs)

    node = comp.render(fragment)
    comp.addToNode(node)

  } else if (typeof elt === 'function') {
    // elt is just a creator function
    node = elt(attrs, fragment)
  }

  // Classes and style are applied at the end of this function and are thus
  // never passed to other node definitions.
  var mx = new AttrsMixin();
  // AttrsMixin doesn't use anything else than its nodes. It has no init(), and
  // we're not adding it to the node until we know that it would observe it.
  (mx.node as any) = node as HTMLElement

  var keys = Object.keys(attrs)
  for (var i = 0, l = keys.length; i < l; i++) {
    var key = keys[i]
    if (key === 'class') {
      var _cls = attrs.class!
      if (!Array.isArray(_cls)) mx.observeClass(_cls)
      else {
        for (var _c of _cls) mx.observeClass(_c)
      }
    } else if (key === 'style') {
      mx.observeStyle(attrs.style!)
    } else if (key === '$$') {
      continue
    } else if (is_basic_node || GLOBAL_ATTRIBUTES[key]) {
      // Observe all attributes for simple elements
      mx.observeAttribute(key, (attrs as any)[key])
    }
  }

  if (mx.observers.length)
    mx.addToNode(node as HTMLElement)

  // decorators are run now.
  var $$ = attrs.$$
  if ($$) {
    if (Array.isArray($$)) {
      for (var i = 0, l = $$.length; i < l; i++) {
        var d = $$[i]
        d.addToNode(node)
      }
    } else {
      $$.addToNode(node)
    }
  }

  return node
}


import {
  HTMLAttributes, SVGAttributes
} from './types'

import {EmptyAttributes} from './types'

/** @hidden */
export type ElementAlias = Element

import { Fragment as F } from './verbs'

export namespace e {
  export const createElement = e //(elt: ComponentFn, attrs: Attrs, ...children: Insertable[]): Node
  // export const createElement(elt: string, attrs: Attrs, ...children: Insertable[]): HTMLElement
  // export const createElement<A>(elt: ComponentInstanciator<A>, attrs: A, ...children: Insertable[]): Node
  export const Fragment = F //(at: Attrs, ch: DocumentFragment): e.JSX.Element
}

/**
 * Extend the JSX namespace to be able to use .tsx code.
 */
export namespace e.JSX {
  export type Element = ElementAlias

  export interface ElementAttributesProperty {
    attrs: any
  }

  export interface ElementChildrenAttribute {
    $$children: any
  }

  export interface ElementClassFn {
    (attrs: EmptyAttributes, children: DocumentFragment): Element
  }

  export type ElementClass = ElementClassFn | Component

  export interface IntrinsicElements {
    a: HTMLAttributes
    abbr: HTMLAttributes
    address: HTMLAttributes
    area: HTMLAttributes
    article: HTMLAttributes
    aside: HTMLAttributes
    audio: HTMLAttributes
    b: HTMLAttributes
    base: HTMLAttributes
    bdi: HTMLAttributes
    bdo: HTMLAttributes
    big: HTMLAttributes
    blockquote: HTMLAttributes
    body: HTMLAttributes
    br: HTMLAttributes
    button: HTMLAttributes
    canvas: HTMLAttributes
    caption: HTMLAttributes
    cite: HTMLAttributes
    code: HTMLAttributes
    col: HTMLAttributes
    colgroup: HTMLAttributes
    data: HTMLAttributes
    datalist: HTMLAttributes
    dd: HTMLAttributes
    del: HTMLAttributes
    details: HTMLAttributes
    dfn: HTMLAttributes
    dialog: HTMLAttributes
    div: HTMLAttributes
    dl: HTMLAttributes
    dt: HTMLAttributes
    em: HTMLAttributes
    embed: HTMLAttributes
    fieldset: HTMLAttributes
    figcaption: HTMLAttributes
    figure: HTMLAttributes
    footer: HTMLAttributes
    form: HTMLAttributes
    h1: HTMLAttributes
    h2: HTMLAttributes
    h3: HTMLAttributes
    h4: HTMLAttributes
    h5: HTMLAttributes
    h6: HTMLAttributes
    head: HTMLAttributes
    header: HTMLAttributes
    hr: HTMLAttributes
    html: HTMLAttributes
    i: HTMLAttributes
    iframe: HTMLAttributes
    img: HTMLAttributes
    input: HTMLAttributes
    ins: HTMLAttributes
    kbd: HTMLAttributes
    keygen: HTMLAttributes
    label: HTMLAttributes
    legend: HTMLAttributes
    li: HTMLAttributes
    link: HTMLAttributes
    main: HTMLAttributes
    map: HTMLAttributes
    mark: HTMLAttributes
    menu: HTMLAttributes
    menuitem: HTMLAttributes
    meta: HTMLAttributes
    meter: HTMLAttributes
    nav: HTMLAttributes
    noscript: HTMLAttributes
    object: HTMLAttributes
    ol: HTMLAttributes
    optgroup: HTMLAttributes
    option: HTMLAttributes
    output: HTMLAttributes
    p: HTMLAttributes
    param: HTMLAttributes
    picture: HTMLAttributes
    pre: HTMLAttributes
    progress: HTMLAttributes
    q: HTMLAttributes
    rp: HTMLAttributes
    rt: HTMLAttributes
    ruby: HTMLAttributes
    s: HTMLAttributes
    samp: HTMLAttributes
    script: HTMLAttributes
    section: HTMLAttributes
    select: HTMLAttributes
    small: HTMLAttributes
    source: HTMLAttributes
    span: HTMLAttributes
    strong: HTMLAttributes
    style: HTMLAttributes
    sub: HTMLAttributes
    summary: HTMLAttributes
    sup: HTMLAttributes
    table: HTMLAttributes
    tbody: HTMLAttributes
    td: HTMLAttributes
    textarea: HTMLAttributes
    tfoot: HTMLAttributes
    th: HTMLAttributes
    thead: HTMLAttributes
    time: HTMLAttributes
    title: HTMLAttributes
    tr: HTMLAttributes
    track: HTMLAttributes
    u: HTMLAttributes
    ul: HTMLAttributes
    'var': HTMLAttributes
    video: HTMLAttributes
    wbr: HTMLAttributes

    svg: SVGAttributes
    circle: SVGAttributes
    clipPath: SVGAttributes
    defs: SVGAttributes
    desc: SVGAttributes
    ellipse: SVGAttributes
    feBlend: SVGAttributes
    feColorMatrix: SVGAttributes
    feComponentTransfer: SVGAttributes
    feComposite: SVGAttributes
    feConvolveMatrix: SVGAttributes
    feDiffuseLighting: SVGAttributes
    feDisplacementMap: SVGAttributes
    feDistantLight: SVGAttributes
    feFlood: SVGAttributes
    feFuncA: SVGAttributes
    feFuncB: SVGAttributes
    feFuncG: SVGAttributes
    feFuncR: SVGAttributes
    feGaussianBlur: SVGAttributes
    feImage: SVGAttributes
    feMerge: SVGAttributes
    feMergeNode: SVGAttributes
    feMorphology: SVGAttributes
    feOffset: SVGAttributes
    fePointLight: SVGAttributes
    feSpecularLighting: SVGAttributes
    feSpotLight: SVGAttributes
    feTile: SVGAttributes
    feTurbulence: SVGAttributes
    filter: SVGAttributes
    foreignObject: SVGAttributes
    g: SVGAttributes
    image: SVGAttributes
    line: SVGAttributes
    linearGradient: SVGAttributes
    marker: SVGAttributes
    mask: SVGAttributes
    metadata: SVGAttributes
    path: SVGAttributes
    pattern: SVGAttributes
    polygon: SVGAttributes
    polyline: SVGAttributes
    radialGradient: SVGAttributes
    rect: SVGAttributes
    stop: SVGAttributes
    switch: SVGAttributes
    symbol: SVGAttributes
    text: SVGAttributes
    textPath: SVGAttributes
    tspan: SVGAttributes
    use: SVGAttributes
    view: SVGAttributes

  }
}
