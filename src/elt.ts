import { o } from './observable'

import {
  Mixin,
  Component
} from './mixins'

import {
  get_dom_insertable
} from './verbs'

import { mount } from './mounting'



/**
 * Private mixin used by the e() function when watching style, classes and other attributes.
 */
export class AttrsMixin extends Mixin<HTMLElement> { }


////////////////////////////////////////////////////////


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


function isComponent(kls: any): kls is new (attrs: e.JSX.Attrs) => Component<any> {
  return kls.prototype instanceof Component
}


const GLOBAL_ATTRIBUTES = {
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
} as const


/**
 * Create Nodes with a twist.
 *
 * This function is the base of element ; it creates Nodes and glues together
 * Controllers, decorators, classes and style.
 */
export function e(elt: string, attrs: e.JSX.Attrs | null, ...children: e.JSX.Insertable[]): HTMLElement
export function e<A extends e.JSX.EmptyAttributes>(elt: (attrs: A, children: DocumentFragment) => Element, attrs: A | null, ...children: e.JSX.Insertable[]): Element
export function e<A extends e.JSX.Attrs>(elt: {new (a: A): Component<A>}, attrs: A | null, ...children: e.JSX.Insertable[]): Element
export function e(elt: any, _attrs: e.JSX.Attrs | null, ...children: e.JSX.Insertable[]): Element {

  if (!elt) throw new Error(`e() needs at least a string, a function or a Component`)

  let node: Element = null! // just to prevent the warnings later

  var attrs = _attrs || {} as e.JSX.Attrs
  var is_basic_node = typeof elt === 'string'

  const fragment = get_dom_insertable(children) as DocumentFragment

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
    } else if (is_basic_node || GLOBAL_ATTRIBUTES[key as keyof typeof GLOBAL_ATTRIBUTES]) {
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


/** @hidden */
type ElementAlias = Element

import { Fragment as F } from './verbs'

export namespace e {

  /**
   * Extend the JSX namespace to be able to use .tsx code.
   */
  export namespace JSX {
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

    ///////////////////////////////////////////////////////////////////////////
    // Now following are the default attributes for HTML and SVG nodes.

    /**
     * Renderables are the types understood by the `Display` verb and that can be rendered into
     * the DOM without efforts or need to transform. It is used by the `Insertable` type
     * to define what can go between `{ curly braces }` in JSX code.
     */
    export type Renderable = string | number | Node | null | undefined | Renderable[]

    /**
     * @api
     * @category jsx
     *
     * The Insertable type describes the types that elt can append to a Node.
     * Anything of the Insertable type can be put `<tag>between braces {'!'}</tag>`.
     *
     * The following types can be used :
     *  - `null` or `undefined` (which output nothing)
     *  - `number`
     *  - `string`
     *  - `Node`
     *  - Arrays of these types, even recursively.
     *
     * `<div>{['hello', ' ', [['world']] ]}</div>` will render `<div>hello world</div>`
     *
    */
    export type Insertable = o.RO<Renderable> | Insertable[]


    /**
     * Attributes used on elements that are not actually HTML Elements
     */
    export interface EmptyAttributes {
      $$children?: o.RO<Insertable> | o.RO<Insertable>[]
    }


    /**
     * CSS classes for the class={} attribute
     */
    export type ClassDefinition = {[name: string]: o.RO<any>} | o.RO<any>


    /**
     * CSS Style attribute definition for the style={} attribute
     */
    export type StyleDefinition =
      o.RO<Partial<CSSStyleDeclaration>>
      | o.MaybeObservableReadonlyObject<Partial<CSSStyleDeclaration>>


    /**
     * A helper type since all HTML / SVG attributes can be null or undefined.
     */
    export type NRO<T> = o.RO<T | null | undefined>


    /**
     * Basic attributes used on all HTML nodes.
     *
     * This type should be used as first argument to all components definitions.
     */
    export interface Attrs extends EmptyAttributes {
      id?: NRO<string>
      contenteditable?: NRO<'true' | 'false' | 'inherit'>
      hidden?: NRO<boolean>
      accesskey?: NRO<string>
      dir?: NRO<'ltr' | 'rtl' | 'auto'>
      draggable?: NRO<'true' | 'false' | 'auto'>
      dropzone?: NRO<'copy' | 'move' | 'link'>
      lang?: NRO<string>
      spellcheck?: NRO<boolean>
      tabindex?: NRO<number>
      title?: NRO<string>
      translate?: NRO<'yes' | 'no'>

      class?: ClassDefinition | ClassDefinition[] // special attributes
      style?: StyleDefinition

      $$?: Mixin | Mixin[]
      xmlns?: string
    }



    export interface HTMLAttributes extends Attrs {

      // Attributes shamelessly stolen from React's type definitions.
      // Standard HTML Attributes
      accept?: NRO<string>
      'accept-charset'?: NRO<string>
      accesskey?: NRO<string>
      action?: NRO<string>
      allowfullscreen?: NRO<boolean>
      allowtransparency?: NRO<boolean>
      alt?: NRO<string>
      async?: NRO<boolean>
      autocomplete?: NRO<string>
      autofocus?: NRO<boolean>
      autoplay?: NRO<boolean>
      capture?: NRO<boolean>
      cellpadding?: NRO<number | string>
      cellspacing?: NRO<number | string>
      charset?: NRO<string>
      challenge?: NRO<string>
      checked?: NRO<boolean>
      classid?: NRO<string>
      classname?: NRO<string>
      cols?: NRO<number>
      colspan?: NRO<number>
      content?: NRO<string>
      // contenteditable?: NRO<boolean>
      contextmenu?: NRO<string>
      controls?: NRO<boolean>
      coords?: NRO<string>
      crossorigin?: NRO<string>
      data?: NRO<string>
      datetime?: NRO<string>
      default?: NRO<boolean>
      defer?: NRO<boolean>
      // dir?: NRO<string>
      disabled?: NRO<boolean>
      download?: NRO<any>
      // draggable?: NRO<boolean>
      enctype?: NRO<string>
      for?: NRO<string>
      form?: NRO<string>
      formaction?: NRO<string>
      formenctype?: NRO<string>
      formmethod?: NRO<string>
      formnovalidate?: NRO<boolean>
      formtarget?: NRO<string>
      frameborder?: NRO<number | string>
      headers?: NRO<string>
      height?: NRO<number | string>
      hidden?: NRO<boolean>
      high?: NRO<number>
      href?: NRO<string>
      hreflang?: NRO<string>
      htmlfor?: NRO<string>
      'http-equiv'?: NRO<string>
      icon?: NRO<string>
      id?: NRO<string>
      inputmode?: NRO<string>
      integrity?: NRO<string>
      is?: NRO<string>
      keyparams?: NRO<string>
      keytype?: NRO<string>
      kind?: NRO<string>
      label?: NRO<string>
      // lang?: NRO<string>
      list?: NRO<string>
      loop?: NRO<boolean>
      low?: NRO<number>
      manifest?: NRO<string>
      marginheight?: NRO<number>
      marginwidth?: NRO<number>
      max?: NRO<number | string>
      maxlength?: NRO<number>
      media?: NRO<string>
      mediagroup?: NRO<string>
      method?: NRO<string>
      min?: NRO<number | string>
      minlength?: NRO<number>
      multiple?: NRO<boolean>
      muted?: NRO<boolean>
      name?: NRO<string>
      novalidate?: NRO<boolean>
      open?: NRO<boolean>
      optimum?: NRO<number>
      pattern?: NRO<string>
      placeholder?: NRO<string>
      poster?: NRO<string>
      preload?: NRO<string>
      radiogroup?: NRO<string>
      readonly?: NRO<boolean>
      rel?: NRO<string>
      required?: NRO<boolean>
      role?: NRO<string>
      rows?: NRO<number>
      rowspan?: NRO<number>
      sandbox?: NRO<string>
      scope?: NRO<string>
      scoped?: NRO<boolean>
      scrolling?: NRO<string>
      seamless?: NRO<boolean>
      selected?: NRO<boolean>
      shape?: NRO<string>
      size?: NRO<number>
      sizes?: NRO<string>
      span?: NRO<number>
      spellcheck?: NRO<boolean>
      src?: NRO<string>
      srcdoc?: NRO<string>
      srclang?: NRO<string>
      srcset?: NRO<string>
      start?: NRO<number>
      step?: NRO<number | string>
      summary?: NRO<string>
      tabindex?: NRO<number>
      target?: NRO<string>
      title?: NRO<string>
      type?: NRO<string>
      usemap?: NRO<string>
      value?: NRO<string | number | boolean>
      width?: NRO<number | string>
      wmode?: NRO<string>
      wrap?: NRO<string>

      // RDFa Attributes
      about?: NRO<string>
      datatype?: NRO<string>
      inlist?: NRO<any>
      prefix?: NRO<string>
      property?: NRO<string>
      resource?: NRO<string>
      typeof?: NRO<string>
      vocab?: NRO<string>

      // Non-standard Attributes
      autocapitalize?: NRO<'word' | 'words' | 'sentences' | 'sentence' | 'characters' | 'character' | 'off'>
      autocorrect?: NRO<string>
      autosave?: NRO<string>
      color?: NRO<string>
      itemprop?: NRO<string>
      itemscope?: NRO<boolean>
      itemtype?: NRO<string>
      itemid?: NRO<string>
      itemref?: NRO<string>
      results?: NRO<number>
      security?: NRO<string>
      unselectable?: NRO<boolean>
    }

    export interface SVGAttributes extends Attrs {
      'clip-path'?: string;
      cx?: NRO<number | string>
      cy?: NRO<number | string>
      d?: NRO<string>
      dx?: NRO<number | string>
      dy?: NRO<number | string>
      fill?: NRO<string>
      'fill-opacity'?: NRO<number | string>
      'font-family'?: NRO<string>
      'font-size'?: NRO<number | string>
      fx?: NRO<number | string>
      fy?: NRO<number | string>
      gradientTransform?: NRO<string>
      gradientUnits?: NRO<string>
      height?: NRO<number | string>
      href?: NRO<string>
      'marker-end'?: NRO<string>
      'marker-mid'?: NRO<string>
      'marker-start'?: NRO<string>
      offset?: NRO<number | string>
      opacity?: NRO<number | string>
      patternContentUnits?: NRO<string>
      patternUnits?: NRO<string>
      points?: NRO<string>
      preserveAspectRatio?: NRO<string>
      r?: NRO<number | string>
      rx?: NRO<number | string>
      ry?: NRO<number | string>
      space?: NRO<string>
      spreadMethod?: NRO<string>
      startOffset?: NRO<string>
      'stop-color'?: NRO<string>
      'stop-opacity'?: NRO<number | string>
      stroke?: NRO<string>
      'stroke-dasharray'?: NRO<string>
      'stroke-linecap'?: NRO<string>
      'stroke-opacity'?: NRO<number | string>
      'stroke-width'?: NRO<number | string>
      'text-anchor'?: NRO<string>
      'text-decoration'?: NRO<string>
      transform?: NRO<string>
      version?: NRO<string>
      viewBox?: NRO<string>
      width?: NRO<number | string>
      x1?: NRO<number | string>
      x2?: NRO<number | string>
      x?: NRO<number | string>
      y1?: NRO<number | string>
      y2?: NRO<number | string>
      y?: NRO<number | string>
    }


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

  export const createElement = e
  export const Fragment: (at: e.JSX.Attrs, ch: DocumentFragment) => JSX.Element = F //(at: Attrs, ch: DocumentFragment): e.JSX.Element
}

declare var global: any
if ('undefined' !== typeof window && typeof (window as any).E === 'undefined' || typeof global !== 'undefined' && typeof (global.E) === 'undefined') {
  (window as any).E = e
}

declare global {

  const E: typeof e

  namespace E.JSX {
    export type Element = ElementAlias
    export type ElementAttributesProperty = e.JSX.ElementAttributesProperty
    export type ElementChildrenAttribute = e.JSX.ElementChildrenAttribute
    export type ElementClassFn = e.JSX.ElementClassFn
    export type ElementClass = e.JSX.ElementClass
    export type IntrinsicElements = e.JSX.IntrinsicElements

    export type Renderable = e.JSX.Renderable
    export type Insertable = e.JSX.Insertable
    export type ClassDefinition = e.JSX.ClassDefinition
    export type StyleDefinition = e.JSX.StyleDefinition
    export type Attrs = e.JSX.Attrs
    export type EmptyAttributes = e.JSX.EmptyAttributes
    export type HTMLAttributes = e.JSX.HTMLAttributes
    export type SVGAttributes = e.JSX.SVGAttributes
  }
}
