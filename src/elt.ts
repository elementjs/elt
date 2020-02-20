import { o } from './observable'

import {
  Mixin,
  Component,
} from './mixins'

import {
  $Display
} from './verbs'

import {
  node_init,
  node_observe_class,
  node_observe_style,
  node_observe_attribute,
  node_add_mixin
} from './dom'



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


function isComponent(kls: any): kls is new (attrs: e.JSX.Attrs<any>) => Component<any> {
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


var _decorator_map = new WeakMap<Function, Comment>()

/**
 * Separates decorators and mixins from nodes or soon-to-be-nodes from children.
 * Returns a tuple containing the decorators/mixins/attrs in one part and the children in the other.
 * The resulting arrays are 1-dimensional and do not contain null or undefined.
 * @internal
 */
export function separate_children_from_rest(children: e.JSX.Insertable<any>[], dm: (Decorator<any> | Mixin<any> | e.JSX.EmptyAttributes<any>)[] = [], chld: e.JSX.Renderable[] = []) {
  for (var i = 0, l = children.length; i < l; i++) {
    var c = children[i]
    if (c == null) continue
    if (Array.isArray(c)) {
      separate_children_from_rest(c, dm, chld)
    } else if (c instanceof Node || typeof c === 'string' || typeof c === 'number' || o.isReadonlyObservable(c)) {
      chld.push(c)
    } else if (typeof c === 'function') {
      var cmt = document.createComment('decorator ' + c.name)
      _decorator_map.set(c, cmt)
      chld.push(cmt)
      dm.push(c)
    } else {
      dm.push(c)
    }
  }
  return [dm, chld] as const
}


export function renderable_to_node(r: e.JSX.Renderable) {
  if (r == null)
    return null
  else if (typeof r === 'string' || typeof r === 'number')
    return document.createTextNode(r.toString())
  else if (o.isReadonlyObservable(r))
    return $Display(r)
  else
    return r
}


/**
 * Create Nodes with a twist.
 *
 * This function is the base of element ; it creates Nodes and glues together
 * Controllers, decorators, classes and style.
 * @category jsx
 */
export function e<K extends keyof HTMLElementTagNameMap>(elt: K, ...children: e.JSX.Insertable<HTMLElementTagNameMap[K]>[]): HTMLElementTagNameMap[K]
export function e(elt: string, ...children: e.JSX.Insertable<HTMLElement>[]): HTMLElement
export function e<A extends e.JSX.EmptyAttributes<any>>(elt: new (a: A) => Component<A>, attrs: A, ...children: e.JSX.Insertable<e.JSX.NodeType<A>>[]): e.JSX.NodeType<A>
export function e<A extends e.JSX.EmptyAttributes<any>>(elt: (attrs: A, children: E.JSX.Renderable[]) => e.JSX.NodeType<A>, attrs: A, ...children: e.JSX.Insertable<e.JSX.NodeType<A>>[]): e.JSX.NodeType<A>
export function e<N extends Node>(elt: any, ...children: e.JSX.Insertable<N>[]): N {
  if (!elt) throw new Error(`e() needs at least a string, a function or a Component`)

  let node: N = null! // just to prevent the warnings later

  var is_basic_node = typeof elt === 'string'

  // const fragment = get_dom_insertable(children) as DocumentFragment
  const [dm, chld] = separate_children_from_rest(children)

  if (is_basic_node) {
    // create a simple DOM node
    var ns = NS[elt] // || attrs.xmlns
    node = ns ? document.createElementNS(ns, elt) : document.createElement(elt)

    for (var i = 0, l = chld.length; i < l; i++) {
      var c = renderable_to_node(chld[i])
      if (c) {
        node.appendChild(c)
        node_init(c)
      }
      //
      // mount(c)
    }

  } else if (isComponent(elt)) {

    // elt is an instantiator / Component
    var attrs = (dm[0] ?? {}) as e.JSX.EmptyAttributes<any>
    var comp = new elt(attrs)

    node = comp.render(chld) as N
    node_add_mixin(node, comp)
  } else if (typeof elt === 'function') {
    // elt is just a creator function
    var attrs = (dm[0] ?? {}) as e.JSX.EmptyAttributes<any>
    node = elt(attrs, chld)
  }

  // Classes and style are applied at the end of this function and are thus
  // never passed to other node definitions.
  var mx = new AttrsMixin();
  // AttrsMixin doesn't use anything else than its nodes. It has no init(), and
  // we're not adding it to the node until we know that it would observe it.
  (mx.node as any) = node

  for (var i = 0, l = dm.length; i < l; i++) {
    var cur = dm[i]
    if (typeof cur === 'function') {
      var res = cur(node)
      if (!res || res === node) continue
      var nd = renderable_to_node(res)
      if (!nd) continue
      var cmt = _decorator_map.get(cur)
      if (!cmt) continue
      cmt.parentNode?.insertBefore(nd, cmt)
    } else if (cur instanceof Mixin) {
      node_add_mixin(node, cur)
    } else {
      // attributes object.
      var at = cur as e.JSX.HTMLAttributes<HTMLElement>
      var keys = Object.keys(at)
      for (var j = 0, l2 = keys.length; j < l2; j++) {
        var key = keys[j]
        if (key === 'class') {
          var _cls = at.class!
          if (!Array.isArray(_cls)) node_observe_class(node as unknown as Element, _cls)
          else {
            for (var _c of _cls) node_observe_class(node as unknown as Element, _c)
          }
        } else if (key === 'style') {
          node_observe_style(node as unknown as HTMLElement, at.style!)
        } else if (key === '$$') {
          continue
        } else if (is_basic_node || GLOBAL_ATTRIBUTES[key as keyof typeof GLOBAL_ATTRIBUTES]) {
          // Observe all attributes for simple elements
          node_observe_attribute(node as unknown as Element, key, (at as any)[key])
        }
      }
    }
  }

  return node
}


import { Fragment as F } from './verbs'
import { Decorator } from './decorators'


export namespace e {

  /**
   * Extend the JSX namespace to be able to use .tsx code.
   */
  export namespace JSX {
    export type Element = Node

    export interface ElementChildrenAttribute {
      $$children: any
    }

    /**
     * The prototype JSX functions have to conform to.
     * @category jsx
     */
    export interface ElementClassFn<N extends Node> {
      (attrs: EmptyAttributes<N>, children: e.JSX.Renderable[]): N
    }

    export type ElementClass<N extends Node> = ElementClassFn<N> | Component<EmptyAttributes<any>>

    ///////////////////////////////////////////////////////////////////////////
    // Now following are the default attributes for HTML and SVG nodes.

    /**
     * Renderables are the types understood by the `Display` verb and that can be rendered into
     * the DOM without efforts or need to transform. It is used by the `Insertable` type
     * to define what can go between `{ curly braces }` in JSX code.
     * @category jsx
     */
    export type Renderable = o.RO<string | number | Node | null | undefined>

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
    export type Insertable<N extends Node> = Mixin<N> | Decorator<N> | e.JSX.Attrs<N> | Renderable | Insertable<N>[]

    /**
     * Attributes used on elements that are not actually HTML Elements
     */
    export interface EmptyAttributes<N extends Node> {
      $$children?: o.RO<Insertable<N>> | o.RO<Insertable<N>>[]
    }

    export type NodeType<At extends EmptyAttributes<any>> = At extends EmptyAttributes<infer N> ? N : never


    /**
     * CSS classes for the class={} attribute
     */
    export type ClassDefinition = {[name: string]: o.RO<any>} | o.RO<string>


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
     * Basic attributes used on all HTML nodes, which can be reused when making components
     * to benefit from the class / style / id... attributes defined here.
     *
     * ```jsx
     * function MyComponent(a: Attrs & {some_attribute: string}, ch: DocumentFragment) {
     *   return <div>{ch} {a.some_attribute}</div>
     * }
     *
     * // With Attrs, all the basic elements are available.
     * <MyComponent id='some_id' class='css_class_1'/>
     * ```
     *
     * This type should be used as first argument to all components definitions.
     * @category jsx
     */
    export interface Attrs<N extends Node> extends EmptyAttributes<N> {
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

      xmlns?: string
    }


    export interface HTMLAttributes<N extends HTMLElement> extends Attrs<N> {

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

    export interface SVGAttributes<N extends SVGElement = SVGElement> extends Attrs<N> {
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
      a: HTMLAttributes<HTMLElementTagNameMap['a']>
      abbr: HTMLAttributes<HTMLElementTagNameMap['abbr']>
      address: HTMLAttributes<HTMLElementTagNameMap['address']>
      area: HTMLAttributes<HTMLElementTagNameMap['area']>
      article: HTMLAttributes<HTMLElementTagNameMap['article']>
      aside: HTMLAttributes<HTMLElementTagNameMap['aside']>
      audio: HTMLAttributes<HTMLElementTagNameMap['audio']>
      b: HTMLAttributes<HTMLElementTagNameMap['b']>
      base: HTMLAttributes<HTMLElementTagNameMap['base']>
      bdi: HTMLAttributes<HTMLElementTagNameMap['bdi']>
      bdo: HTMLAttributes<HTMLElementTagNameMap['bdo']>
      big: HTMLAttributes<HTMLElement>
      blockquote: HTMLAttributes<HTMLElementTagNameMap['blockquote']>
      body: HTMLAttributes<HTMLElementTagNameMap['body']>
      br: HTMLAttributes<HTMLElementTagNameMap['br']>
      button: HTMLAttributes<HTMLElementTagNameMap['button']>
      canvas: HTMLAttributes<HTMLElementTagNameMap['canvas']>
      caption: HTMLAttributes<HTMLElementTagNameMap['caption']>
      cite: HTMLAttributes<HTMLElementTagNameMap['cite']>
      code: HTMLAttributes<HTMLElementTagNameMap['code']>
      col: HTMLAttributes<HTMLElementTagNameMap['col']>
      colgroup: HTMLAttributes<HTMLElementTagNameMap['colgroup']>
      data: HTMLAttributes<HTMLElementTagNameMap['data']>
      datalist: HTMLAttributes<HTMLElementTagNameMap['datalist']>
      dd: HTMLAttributes<HTMLElementTagNameMap['dd']>
      del: HTMLAttributes<HTMLElementTagNameMap['del']>
      details: HTMLAttributes<HTMLElementTagNameMap['details']>
      dfn: HTMLAttributes<HTMLElementTagNameMap['dfn']>
      dialog: HTMLAttributes<HTMLElementTagNameMap['dialog']>
      div: HTMLAttributes<HTMLElementTagNameMap['div']>
      dl: HTMLAttributes<HTMLElementTagNameMap['dl']>
      dt: HTMLAttributes<HTMLElementTagNameMap['dt']>
      em: HTMLAttributes<HTMLElementTagNameMap['em']>
      embed: HTMLAttributes<HTMLElementTagNameMap['embed']>
      fieldset: HTMLAttributes<HTMLElementTagNameMap['fieldset']>
      figcaption: HTMLAttributes<HTMLElementTagNameMap['figcaption']>
      figure: HTMLAttributes<HTMLElementTagNameMap['figure']>
      footer: HTMLAttributes<HTMLElementTagNameMap['footer']>
      form: HTMLAttributes<HTMLElementTagNameMap['form']>
      h1: HTMLAttributes<HTMLElementTagNameMap['h1']>
      h2: HTMLAttributes<HTMLElementTagNameMap['h2']>
      h3: HTMLAttributes<HTMLElementTagNameMap['h3']>
      h4: HTMLAttributes<HTMLElementTagNameMap['h4']>
      h5: HTMLAttributes<HTMLElementTagNameMap['h5']>
      h6: HTMLAttributes<HTMLElementTagNameMap['h6']>
      head: HTMLAttributes<HTMLElementTagNameMap['head']>
      header: HTMLAttributes<HTMLElementTagNameMap['header']>
      hr: HTMLAttributes<HTMLElementTagNameMap['hr']>
      html: HTMLAttributes<HTMLElementTagNameMap['html']>
      i: HTMLAttributes<HTMLElementTagNameMap['i']>
      iframe: HTMLAttributes<HTMLElementTagNameMap['iframe']>
      img: HTMLAttributes<HTMLElementTagNameMap['img']>
      input: HTMLAttributes<HTMLElementTagNameMap['input']>
      ins: HTMLAttributes<HTMLElementTagNameMap['ins']>
      kbd: HTMLAttributes<HTMLElementTagNameMap['kbd']>
      keygen: HTMLAttributes<HTMLElement> // ???
      label: HTMLAttributes<HTMLElementTagNameMap['label']>
      legend: HTMLAttributes<HTMLElementTagNameMap['legend']>
      li: HTMLAttributes<HTMLElementTagNameMap['li']>
      link: HTMLAttributes<HTMLElementTagNameMap['link']>
      main: HTMLAttributes<HTMLElementTagNameMap['main']>
      map: HTMLAttributes<HTMLElementTagNameMap['map']>
      mark: HTMLAttributes<HTMLElementTagNameMap['mark']>
      menu: HTMLAttributes<HTMLElementTagNameMap['menu']>
      menuitem: HTMLAttributes<HTMLElement> // ??
      meta: HTMLAttributes<HTMLElementTagNameMap['meta']>
      meter: HTMLAttributes<HTMLElementTagNameMap['meter']>
      nav: HTMLAttributes<HTMLElementTagNameMap['nav']>
      noscript: HTMLAttributes<HTMLElementTagNameMap['noscript']>
      object: HTMLAttributes<HTMLElementTagNameMap['object']>
      ol: HTMLAttributes<HTMLElementTagNameMap['ol']>
      optgroup: HTMLAttributes<HTMLElementTagNameMap['optgroup']>
      option: HTMLAttributes<HTMLElementTagNameMap['option']>
      output: HTMLAttributes<HTMLElementTagNameMap['output']>
      p: HTMLAttributes<HTMLElementTagNameMap['p']>
      param: HTMLAttributes<HTMLElementTagNameMap['param']>
      picture: HTMLAttributes<HTMLElementTagNameMap['picture']>
      pre: HTMLAttributes<HTMLElementTagNameMap['pre']>
      progress: HTMLAttributes<HTMLElementTagNameMap['progress']>
      q: HTMLAttributes<HTMLElementTagNameMap['q']>
      rp: HTMLAttributes<HTMLElementTagNameMap['rp']>
      rt: HTMLAttributes<HTMLElementTagNameMap['rt']>
      ruby: HTMLAttributes<HTMLElementTagNameMap['ruby']>
      s: HTMLAttributes<HTMLElementTagNameMap['s']>
      samp: HTMLAttributes<HTMLElementTagNameMap['samp']>
      script: HTMLAttributes<HTMLElementTagNameMap['script']>
      section: HTMLAttributes<HTMLElementTagNameMap['section']>
      select: HTMLAttributes<HTMLElementTagNameMap['select']>
      small: HTMLAttributes<HTMLElementTagNameMap['small']>
      source: HTMLAttributes<HTMLElementTagNameMap['source']>
      span: HTMLAttributes<HTMLElementTagNameMap['span']>
      strong: HTMLAttributes<HTMLElementTagNameMap['strong']>
      style: HTMLAttributes<HTMLElementTagNameMap['style']>
      sub: HTMLAttributes<HTMLElementTagNameMap['sub']>
      summary: HTMLAttributes<HTMLElementTagNameMap['summary']>
      sup: HTMLAttributes<HTMLElementTagNameMap['sup']>
      table: HTMLAttributes<HTMLElementTagNameMap['table']>
      tbody: HTMLAttributes<HTMLElementTagNameMap['tbody']>
      td: HTMLAttributes<HTMLElementTagNameMap['td']>
      textarea: HTMLAttributes<HTMLElementTagNameMap['textarea']>
      tfoot: HTMLAttributes<HTMLElementTagNameMap['tfoot']>
      th: HTMLAttributes<HTMLElementTagNameMap['th']>
      thead: HTMLAttributes<HTMLElementTagNameMap['thead']>
      time: HTMLAttributes<HTMLElementTagNameMap['time']>
      title: HTMLAttributes<HTMLElementTagNameMap['title']>
      tr: HTMLAttributes<HTMLElementTagNameMap['tr']>
      track: HTMLAttributes<HTMLElementTagNameMap['track']>
      u: HTMLAttributes<HTMLElementTagNameMap['u']>
      ul: HTMLAttributes<HTMLElementTagNameMap['ul']>
      'var': HTMLAttributes<HTMLElementTagNameMap['var']>
      video: HTMLAttributes<HTMLElementTagNameMap['video']>
      wbr: HTMLAttributes<HTMLElementTagNameMap['wbr']>

      svg: SVGAttributes<SVGElementTagNameMap['svg']>
      circle: SVGAttributes<SVGElementTagNameMap['circle']>
      clipPath: SVGAttributes<SVGElementTagNameMap['clipPath']>
      defs: SVGAttributes<SVGElementTagNameMap['defs']>
      desc: SVGAttributes<SVGElementTagNameMap['desc']>
      ellipse: SVGAttributes<SVGElementTagNameMap['ellipse']>
      feBlend: SVGAttributes<SVGElementTagNameMap['feBlend']>
      feColorMatrix: SVGAttributes<SVGElementTagNameMap['feColorMatrix']>
      feComponentTransfer: SVGAttributes<SVGElementTagNameMap['feComponentTransfer']>
      feComposite: SVGAttributes<SVGElementTagNameMap['feComposite']>
      feConvolveMatrix: SVGAttributes<SVGElementTagNameMap['feConvolveMatrix']>
      feDiffuseLighting: SVGAttributes<SVGElementTagNameMap['feDiffuseLighting']>
      feDisplacementMap: SVGAttributes<SVGElementTagNameMap['feDisplacementMap']>
      feDistantLight: SVGAttributes<SVGElementTagNameMap['feDistantLight']>
      feFlood: SVGAttributes<SVGElementTagNameMap['feFlood']>
      feFuncA: SVGAttributes<SVGElementTagNameMap['feFuncA']>
      feFuncB: SVGAttributes<SVGElementTagNameMap['feFuncB']>
      feFuncG: SVGAttributes<SVGElementTagNameMap['feFuncG']>
      feFuncR: SVGAttributes<SVGElementTagNameMap['feFuncR']>
      feGaussianBlur: SVGAttributes<SVGElementTagNameMap['feGaussianBlur']>
      feImage: SVGAttributes<SVGElementTagNameMap['feImage']>
      feMerge: SVGAttributes<SVGElementTagNameMap['feMerge']>
      feMergeNode: SVGAttributes<SVGElementTagNameMap['feMergeNode']>
      feMorphology: SVGAttributes<SVGElementTagNameMap['feMorphology']>
      feOffset: SVGAttributes<SVGElementTagNameMap['feOffset']>
      fePointLight: SVGAttributes<SVGElementTagNameMap['fePointLight']>
      feSpecularLighting: SVGAttributes<SVGElementTagNameMap['feSpecularLighting']>
      feSpotLight: SVGAttributes<SVGElementTagNameMap['feSpotLight']>
      feTile: SVGAttributes<SVGElementTagNameMap['feTile']>
      feTurbulence: SVGAttributes<SVGElementTagNameMap['feTurbulence']>
      filter: SVGAttributes<SVGElementTagNameMap['filter']>
      foreignObject: SVGAttributes<SVGElementTagNameMap['foreignObject']>
      g: SVGAttributes<SVGElementTagNameMap['g']>
      image: SVGAttributes<SVGElementTagNameMap['image']>
      line: SVGAttributes<SVGElementTagNameMap['line']>
      linearGradient: SVGAttributes<SVGElementTagNameMap['linearGradient']>
      marker: SVGAttributes<SVGElementTagNameMap['marker']>
      mask: SVGAttributes<SVGElementTagNameMap['mask']>
      metadata: SVGAttributes<SVGElementTagNameMap['metadata']>
      path: SVGAttributes<SVGElementTagNameMap['path']>
      pattern: SVGAttributes<SVGElementTagNameMap['pattern']>
      polygon: SVGAttributes<SVGElementTagNameMap['polygon']>
      polyline: SVGAttributes<SVGElementTagNameMap['polyline']>
      radialGradient: SVGAttributes<SVGElementTagNameMap['radialGradient']>
      rect: SVGAttributes<SVGElementTagNameMap['rect']>
      stop: SVGAttributes<SVGElementTagNameMap['stop']>
      switch: SVGAttributes<SVGElementTagNameMap['switch']>
      symbol: SVGAttributes<SVGElementTagNameMap['symbol']>
      text: SVGAttributes<SVGElementTagNameMap['text']>
      textPath: SVGAttributes<SVGElementTagNameMap['textPath']>
      tspan: SVGAttributes<SVGElementTagNameMap['tspan']>
      use: SVGAttributes<SVGElementTagNameMap['use']>
      view: SVGAttributes<SVGElementTagNameMap['view']>

    }

  }

  export function mkwrapper<K extends keyof HTMLElementTagNameMap>(elt: K): (...args: (e.JSX.Insertable<HTMLElementTagNameMap[K]> | e.JSX.HTMLAttributes<HTMLElementTagNameMap[K]>)[]) => HTMLElementTagNameMap[K]
  export function mkwrapper(elt: string): (...args: (e.JSX.Insertable<HTMLElement> | e.JSX.HTMLAttributes<HTMLElement>)[]) => HTMLElement
  export function mkwrapper<K extends keyof HTMLElementTagNameMap>(elt: K): (...args: (e.JSX.Insertable<HTMLElementTagNameMap[K]> | e.JSX.HTMLAttributes<HTMLElementTagNameMap[K]>)[]) => HTMLElementTagNameMap[K] {
    return (...args) => {
      return e(elt, ...args)
    }
  }

  export const $A = mkwrapper('a')
  export const $ABBR = mkwrapper('abbr')
  export const $ADDRESS = mkwrapper('address')
  export const $AREA = mkwrapper('area')
  export const $ARTICLE = mkwrapper('article')
  export const $ASIDE = mkwrapper('aside')
  export const $AUDIO = mkwrapper('audio')
  export const $B = mkwrapper('b')
  export const $BASE = mkwrapper('base')
  export const $BDI = mkwrapper('bdi')
  export const $BDO = mkwrapper('bdo')
  export const $BIG = mkwrapper('big')
  export const $BLOCKQUOTE = mkwrapper('blockquote')
  export const $BODY = mkwrapper('body')
  export const $BR = mkwrapper('br')
  export const $BUTTON = mkwrapper('button')
  export const $CANVAS = mkwrapper('canvas')
  export const $CAPTION = mkwrapper('caption')
  export const $CITE = mkwrapper('cite')
  export const $CODE = mkwrapper('code')
  export const $COL = mkwrapper('col')
  export const $COLGROUP = mkwrapper('colgroup')
  export const $DATA = mkwrapper('data')
  export const $DATALIST = mkwrapper('datalist')
  export const $DD = mkwrapper('dd')
  export const $DEL = mkwrapper('del')
  export const $DETAILS = mkwrapper('details')
  export const $DFN = mkwrapper('dfn')
  export const $DIALOG = mkwrapper('dialog')
  export const $DIV = mkwrapper('div')
  export const $DL = mkwrapper('dl')
  export const $DT = mkwrapper('dt')
  export const $EM = mkwrapper('em')
  export const $EMBED = mkwrapper('embed')
  export const $FIELDSET = mkwrapper('fieldset')
  export const $FIGCAPTION = mkwrapper('figcaption')
  export const $FIGURE = mkwrapper('figure')
  export const $FOOTER = mkwrapper('footer')
  export const $FORM = mkwrapper('form')
  export const $H1 = mkwrapper('h1')
  export const $H2 = mkwrapper('h2')
  export const $H3 = mkwrapper('h3')
  export const $H4 = mkwrapper('h4')
  export const $H5 = mkwrapper('h5')
  export const $H6 = mkwrapper('h6')
  export const $HEAD = mkwrapper('head')
  export const $HEADER = mkwrapper('header')
  export const $HR = mkwrapper('hr')
  export const $HTML = mkwrapper('html')
  export const $I = mkwrapper('i')
  export const $IFRAME = mkwrapper('iframe')
  export const $IMG = mkwrapper('img')
  export const $INPUT = mkwrapper('input')
  export const $INS = mkwrapper('ins')
  export const $KBD = mkwrapper('kbd')
  export const $KEYGEN = mkwrapper('keygen')
  export const $LABEL = mkwrapper('label')
  export const $LEGEND = mkwrapper('legend')
  export const $LI = mkwrapper('li')
  export const $LINK = mkwrapper('link')
  export const $MAIN = mkwrapper('main')
  export const $MAP = mkwrapper('map')
  export const $MARK = mkwrapper('mark')
  export const $MENU = mkwrapper('menu')
  export const $MENUITEM = mkwrapper('menuitem')
  export const $META = mkwrapper('meta')
  export const $METER = mkwrapper('meter')
  export const $NAV = mkwrapper('nav')
  export const $NOSCRIPT = mkwrapper('noscript')
  export const $OBJECT = mkwrapper('object')
  export const $OL = mkwrapper('ol')
  export const $OPTGROUP = mkwrapper('optgroup')
  export const $OPTION = mkwrapper('option')
  export const $OUTPUT = mkwrapper('output')
  export const $P = mkwrapper('p')
  export const $PARAM = mkwrapper('param')
  export const $PICTURE = mkwrapper('picture')
  export const $PRE = mkwrapper('pre')
  export const $PROGRESS = mkwrapper('progress')
  export const $Q = mkwrapper('q')
  export const $RP = mkwrapper('rp')
  export const $RT = mkwrapper('rt')
  export const $RUBY = mkwrapper('ruby')
  export const $S = mkwrapper('s')
  export const $SAMP = mkwrapper('samp')
  export const $SCRIPT = mkwrapper('script')
  export const $SECTION = mkwrapper('section')
  export const $SELECT = mkwrapper('select')
  export const $SMALL = mkwrapper('small')
  export const $SOURCE = mkwrapper('source')
  export const $SPAN = mkwrapper('span')
  export const $STRONG = mkwrapper('strong')
  export const $STYLE = mkwrapper('style')
  export const $SUB = mkwrapper('sub')
  export const $SUMMARY = mkwrapper('summary')
  export const $SUP = mkwrapper('sup')
  export const $TABLE = mkwrapper('table')
  export const $TBODY = mkwrapper('tbody')
  export const $TD = mkwrapper('td')
  export const $TEXTAREA = mkwrapper('textarea')
  export const $TFOOT = mkwrapper('tfoot')
  export const $TH = mkwrapper('th')
  export const $THEAD = mkwrapper('thead')
  export const $TIME = mkwrapper('time')
  export const $TITLE = mkwrapper('title')
  export const $TR = mkwrapper('tr')
  export const $TRACK = mkwrapper('track')
  export const $U = mkwrapper('u')
  export const $UL = mkwrapper('ul')
  export const $VAR = mkwrapper('var')
  export const $VIDEO = mkwrapper('video')
  export const $WBR = mkwrapper('wbr')

  export const createElement = e
  export const Fragment: (at: e.JSX.Attrs<DocumentFragment>, ch: e.JSX.Renderable[]) => DocumentFragment = F //(at: Attrs, ch: DocumentFragment): e.JSX.Element
}

declare var global: any
if ('undefined' !== typeof window && typeof (window as any).E === 'undefined' || typeof global !== 'undefined' && typeof (global.E) === 'undefined') {
  (window as any).E = e
}

declare global {

  const E: typeof e

  namespace E.JSX {
    export type Element = Node
    export type ElementChildrenAttribute = e.JSX.ElementChildrenAttribute
    export type ElementClassFn<N extends Node> = e.JSX.ElementClassFn<N>
    export type ElementClass<N extends Node> = e.JSX.ElementClass<N>
    export type IntrinsicElements = e.JSX.IntrinsicElements

    export type Renderable = e.JSX.Renderable
    export type Insertable<N extends Node> = e.JSX.Insertable<N>
    export type ClassDefinition = e.JSX.ClassDefinition
    export type StyleDefinition = e.JSX.StyleDefinition
    export type Attrs<N extends Node> = e.JSX.Attrs<N>
    export type EmptyAttributes<N extends Node = Node> = e.JSX.EmptyAttributes<N>
    export type HTMLAttributes<N extends HTMLElement> = e.JSX.HTMLAttributes<N>
    export type SVGAttributes<N extends SVGElement = SVGElement> = e.JSX.SVGAttributes<N>
  }
}
