import { o } from './observable'

import {
  Mixin,
  Component,
  node_add_mixin
} from './mixins'

import {
  $Display
} from './verbs'

import {
  node_observe_class,
  node_observe_style,
  node_observe_attribute,
  insert_before_and_init,
  append_child_and_init,
} from './dom'


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


function isComponent(kls: any): kls is new (attrs: Attrs<any>) => Component<any> {
  return kls.prototype instanceof Component
}


var _decorator_map = new WeakMap<Function, Comment>()

/**
 * Renderables are the types understood by the `Display` verb and that can be rendered into
 * the DOM without efforts or need to transform. It is used by the `Insertable` type
 * to define what can go between `{ curly braces }` in JSX code.
 * @category dom, toc
 */
export type Renderable = o.RO<string | number | Node | null | undefined>

/**
 * @category dom, toc
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
export type Insertable<N extends Node> = Mixin<N> | Decorator<N> | Renderable | Insertable<N>[]

/**
 * Attributes used on elements that are not actually HTML Elements
 */
export interface EmptyAttributes<N extends Node> {
  $$children?: o.RO<Insertable<N>> | o.RO<Insertable<N>>[]
}

/**
 * For a given attribute type used in components, give its related `Node` type.
 * @category dom, toc
 */
export type AttrsNodeType<At extends EmptyAttributes<any>> = At extends EmptyAttributes<infer N> ? N : never


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
 * @category dom, toc
 */
export interface Attrs<N extends Node> extends EmptyAttributes<N> {
  id?: NRO<string | null>
  class?: ClassDefinition | ClassDefinition[] // special attributes
  style?: StyleDefinition
}


/**
 * Create Nodes with a twist.
 *
 * This function is the base of element ; it creates Nodes and glues together
 * Controllers, decorators, classes and style.
 * @category dom, toc
 */
export function e<N extends Node>(elt: N, ...children: (Insertable<N> | Attrs<N>)[]): N
export function e<K extends keyof HTMLElementTagNameMap>(elt: K, ...children: (Insertable<HTMLElementTagNameMap[K]> | e.JSX.HTMLAttributes<HTMLElementTagNameMap[K]>)[]): HTMLElementTagNameMap[K]
export function e(elt: string, ...children: Insertable<HTMLElement>[]): HTMLElement
export function e<A extends EmptyAttributes<any>>(elt: new (a: A) => Component<A>, attrs: A, ...children: Insertable<AttrsNodeType<A>>[]): AttrsNodeType<A>
export function e<A extends EmptyAttributes<any>>(elt: (attrs: A, children: Renderable[]) => AttrsNodeType<A>, attrs: A, ...children: Insertable<AttrsNodeType<A>>[]): AttrsNodeType<A>
export function e<N extends Node>(elt: string | Node | Function, ...children: (Insertable<N> | Attrs<N>)[]): N {
  if (!elt) throw new Error(`e() needs at least a string, a function or a Component`)

  let node: N = null! // just to prevent the warnings later

  var is_basic_node = typeof elt === 'string' || elt instanceof Node

  // const fragment = get_dom_insertable(children) as DocumentFragment
  var i = 0
  var l = 0
  var attrs: Attrs<N> = {}
  var decorators: Decorator<N>[] = []
  var mixins: Mixin<N>[] = []
  var renderables: Renderable[] = []
  e.separate_children_from_rest(children, attrs, decorators, mixins, renderables)

  if (is_basic_node) {
    // create a simple DOM node
    if (typeof elt === 'string') {
      var ns = NS[elt] // || attrs.xmlns
      node = (ns ? document.createElementNS(ns, elt) : document.createElement(elt)) as unknown as N
    } else {
      node = elt as N
    }

    for (i = 0, l = renderables.length; i < l; i++) {
      var c = e.renderable_to_node(renderables[i])
      if (c) {
        append_child_and_init(node, c)
      }
    }

  } else if (isComponent(elt)) {
    // elt is an instantiator / Component
    var comp = new elt(attrs)

    node = comp.render(renderables) as N
    node_add_mixin(node, comp)
  } else if (typeof elt === 'function') {
    // elt is just a creator function
    node = elt(attrs, renderables)
  }

  // we have to cheat a bit here.
  e.handle_attrs(node as any, attrs, is_basic_node)

  // Handle decorators on the node
  for (i = 0, l = decorators.length; i < l; i++) {
    e.handle_decorator(node, decorators[i])
  }

  // Add the mixins
  for (i = 0, l = mixins.length; i < l; i++) {
    node_add_mixin(node, mixins[i])
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
 * // If using jsxFactory, you have to import $Fragment and use it
 * import { $Fragment as $ } from 'elt'
 *
 * document.body.appendChild(<$>
 *   <p>Content</p>
 *   <p>More Content</p>
 * </$>)
 *
 * // If using jsxNamespace as "e" or "E", the following works out of the box
 * document.body.appendChild(<>
 *   <p>Content</p>
 *   <p>More Content</p>
 * </>)
 *
 * ```
 *
 * @category dom, toc
 */
export function $Fragment(...children: (Insertable<DocumentFragment> | EmptyAttributes<DocumentFragment>)[]): DocumentFragment {
  const fr = document.createDocumentFragment()
  // This is a trick, children may contain lots of stuff
  return e(fr, children as Renderable[])
}


import { Decorator } from './decorators'


export namespace e {


  /**
   * Separates decorators and mixins from nodes or soon-to-be-nodes from children.
   * Returns a tuple containing the decorators/mixins/attrs in one part and the children in the other.
   * The resulting arrays are 1-dimensional and do not contain null or undefined.
   * @category internal
   */
  export function separate_children_from_rest(children: (Insertable<any> | Attrs<any>)[], attrs: Attrs<any>, decorators: Decorator<any>[], mixins: Mixin<any>[], chld: Renderable[]) {
    for (var i = 0, l = children.length; i < l; i++) {
      var c = children[i]
      if (c == null) continue
      if (Array.isArray(c)) {
        separate_children_from_rest(c, attrs, decorators, mixins, chld)
      } else if (c instanceof Node || typeof c === 'string' || typeof c === 'number' || o.isReadonlyObservable(c)) {
        chld.push(c)
      } else if (typeof c === 'function') {
        var cmt = document.createComment('decorator ' + c.name)
        _decorator_map.set(c, cmt)
        chld.push(cmt)
        decorators.push(c)
      } else if (c instanceof Mixin) {
        mixins.push(c)
      } else {
        // We just copy the attrs properties onto the attrs object
        Object.assign(attrs, c)
      }
    }
  }

  /**
   * @category internal
   */
  export function renderable_to_node(r: Renderable): Node | null
  export function renderable_to_node(r: Renderable, null_as_comment: true): Node
  export function renderable_to_node(r: Renderable, null_as_comment = false) {
    if (r == null)
      return null_as_comment ? document.createComment(' null ') : null
    else if (typeof r === 'string' || typeof r === 'number')
      return document.createTextNode(r.toString())
    else if (o.isReadonlyObservable(r))
      return $Display(r)
    else
      return r
  }

  /**
   * @category internal
   */
  export function handle_decorator(node: Node, decorator: Decorator<any>) {
    var res: ReturnType<Decorator<Node>>
    var dec_iter = decorator
    // while the decorator returns a decorator, keep calling it.
    while (typeof (res = dec_iter(node)) === 'function') { dec_iter = res }
    // If it returns nothing or the node itself, don't do anything
    if (res == null || res === node) return
    if (res instanceof Mixin) {
      node_add_mixin(node, res)
      return
    }
    var nd = renderable_to_node(res)
    if (nd == null) return
    var cmt = _decorator_map.get(decorator)
    // If there was no comment associated with this decorator, do nothing
    if (!cmt) return
    // insert the resulting node right next to the comment
    insert_before_and_init(node, nd, cmt)
  }

  /**
   * Handle attributes for simple nodes
   * @category internal
   */
  export function handle_attrs(node: HTMLElement, attrs: e.JSX.HTMLAttributes<any>, is_basic_node: boolean) {
    var keys = Object.keys(attrs) as (keyof typeof attrs)[]
    for (var i = 0, l = keys.length; i < l; i++) {
      var key = keys[i]
      if (key === 'class') {
        var clss = attrs.class!
        if (Array.isArray(clss))
          for (var j = 0, lj = clss.length; j < lj; j++) node_observe_class(node, clss[j])
        else
          node_observe_class(node, attrs.class!)
      } else if (key === 'style') {
        node_observe_style(node, attrs.style!)
      } else if (key === 'id' || is_basic_node) {
        node_observe_attribute(node, key, attrs[key])
      }
    }
  }

  /**
   * Extend the JSX namespace to be able to use .tsx code.
   */
  export namespace JSX {
    /** @category internal */
    export type Element = Node

    /** @category internal */
    export interface ElementChildrenAttribute {
      $$children: any
    }

    /**
     * The signature function components should conform to.
     * @category internal
     */
    export interface ElementClassFn<N extends Node> {
      (attrs: EmptyAttributes<N>, children: Renderable[]): N
    }

    /** @category internal */
    export type ElementClass<N extends Node> = ElementClassFn<N> | Component<EmptyAttributes<any>>

    ///////////////////////////////////////////////////////////////////////////
    // Now following are the default attributes for HTML and SVG nodes.

    /** @category internal */
    export interface HTMLAttributes<N extends HTMLElement> extends Attrs<N> {

      contenteditable?: NRO<'true' | 'false' | 'inherit'>
      dir?: NRO<'ltr' | 'rtl' | 'auto'>
      draggable?: NRO<'true' | 'false' | 'auto'>
      dropzone?: NRO<'copy' | 'move' | 'link'>
      lang?: NRO<string>
      translate?: NRO<'yes' | 'no'>
      xmlns?: string

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

    /** @category internal */
    export interface SVGAttributes<N extends SVGElement = SVGElement> extends Attrs<N> {

      contenteditable?: NRO<'true' | 'false' | 'inherit'>
      hidden?: NRO<boolean>
      accesskey?: NRO<string>
      lang?: NRO<string>
      tabindex?: NRO<number>
      title?: NRO<string>
      xmlns?: string

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

    /** @category internal */
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

  /**
   * A wrapper maker for basic elements, used to generate all of the $A, $DIV, ...
   * @category internal
   */
  export function mkwrapper<K extends keyof HTMLElementTagNameMap>(elt: K): (...args: (Insertable<HTMLElementTagNameMap[K]> | e.JSX.HTMLAttributes<HTMLElementTagNameMap[K]>)[]) => HTMLElementTagNameMap[K]
  export function mkwrapper(elt: string): (...args: (Insertable<HTMLElement> | e.JSX.HTMLAttributes<HTMLElement>)[]) => HTMLElement
  export function mkwrapper<K extends keyof HTMLElementTagNameMap>(elt: K): (...args: (Insertable<HTMLElementTagNameMap[K]> | e.JSX.HTMLAttributes<HTMLElementTagNameMap[K]>)[]) => HTMLElementTagNameMap[K] {
    return (...args) => {
      return e<K>(elt, ...args)
    }
  }

  /** @category internal */
  export const $A = mkwrapper('a')
  /** @category internal */
  export const $ABBR = mkwrapper('abbr')
  /** @category internal */
  export const $ADDRESS = mkwrapper('address')
  /** @category internal */
  export const $AREA = mkwrapper('area')
  /** @category internal */
  export const $ARTICLE = mkwrapper('article')
  /** @category internal */
  export const $ASIDE = mkwrapper('aside')
  /** @category internal */
  export const $AUDIO = mkwrapper('audio')
  /** @category internal */
  export const $B = mkwrapper('b')
  /** @category internal */
  export const $BASE = mkwrapper('base')
  /** @category internal */
  export const $BDI = mkwrapper('bdi')
  /** @category internal */
  export const $BDO = mkwrapper('bdo')
  /** @category internal */
  export const $BIG = mkwrapper('big')
  /** @category internal */
  export const $BLOCKQUOTE = mkwrapper('blockquote')
  /** @category internal */
  export const $BODY = mkwrapper('body')
  /** @category internal */
  export const $BR = mkwrapper('br')
  /** @category internal */
  export const $BUTTON = mkwrapper('button')
  /** @category internal */
  export const $CANVAS = mkwrapper('canvas')
  /** @category internal */
  export const $CAPTION = mkwrapper('caption')
  /** @category internal */
  export const $CITE = mkwrapper('cite')
  /** @category internal */
  export const $CODE = mkwrapper('code')
  /** @category internal */
  export const $COL = mkwrapper('col')
  /** @category internal */
  export const $COLGROUP = mkwrapper('colgroup')
  /** @category internal */
  export const $DATA = mkwrapper('data')
  /** @category internal */
  export const $DATALIST = mkwrapper('datalist')
  /** @category internal */
  export const $DD = mkwrapper('dd')
  /** @category internal */
  export const $DEL = mkwrapper('del')
  /** @category internal */
  export const $DETAILS = mkwrapper('details')
  /** @category internal */
  export const $DFN = mkwrapper('dfn')
  /** @category internal */
  export const $DIALOG = mkwrapper('dialog')
  /** @category internal */
  export const $DIV = mkwrapper('div')
  /** @category internal */
  export const $DL = mkwrapper('dl')
  /** @category internal */
  export const $DT = mkwrapper('dt')
  /** @category internal */
  export const $EM = mkwrapper('em')
  /** @category internal */
  export const $EMBED = mkwrapper('embed')
  /** @category internal */
  export const $FIELDSET = mkwrapper('fieldset')
  /** @category internal */
  export const $FIGCAPTION = mkwrapper('figcaption')
  /** @category internal */
  export const $FIGURE = mkwrapper('figure')
  /** @category internal */
  export const $FOOTER = mkwrapper('footer')
  /** @category internal */
  export const $FORM = mkwrapper('form')
  /** @category internal */
  export const $H1 = mkwrapper('h1')
  /** @category internal */
  export const $H2 = mkwrapper('h2')
  /** @category internal */
  export const $H3 = mkwrapper('h3')
  /** @category internal */
  export const $H4 = mkwrapper('h4')
  /** @category internal */
  export const $H5 = mkwrapper('h5')
  /** @category internal */
  export const $H6 = mkwrapper('h6')
  /** @category internal */
  export const $HEAD = mkwrapper('head')
  /** @category internal */
  export const $HEADER = mkwrapper('header')
  /** @category internal */
  export const $HR = mkwrapper('hr')
  /** @category internal */
  export const $HTML = mkwrapper('html')
  /** @category internal */
  export const $I = mkwrapper('i')
  /** @category internal */
  export const $IFRAME = mkwrapper('iframe')
  /** @category internal */
  export const $IMG = mkwrapper('img')
  /** @category internal */
  export const $INPUT = mkwrapper('input')
  /** @category internal */
  export const $INS = mkwrapper('ins')
  /** @category internal */
  export const $KBD = mkwrapper('kbd')
  /** @category internal */
  export const $KEYGEN = mkwrapper('keygen')
  /** @category internal */
  export const $LABEL = mkwrapper('label')
  /** @category internal */
  export const $LEGEND = mkwrapper('legend')
  /** @category internal */
  export const $LI = mkwrapper('li')
  /** @category internal */
  export const $LINK = mkwrapper('link')
  /** @category internal */
  export const $MAIN = mkwrapper('main')
  /** @category internal */
  export const $MAP = mkwrapper('map')
  /** @category internal */
  export const $MARK = mkwrapper('mark')
  /** @category internal */
  export const $MENU = mkwrapper('menu')
  /** @category internal */
  export const $MENUITEM = mkwrapper('menuitem')
  /** @category internal */
  export const $META = mkwrapper('meta')
  /** @category internal */
  export const $METER = mkwrapper('meter')
  /** @category internal */
  export const $NAV = mkwrapper('nav')
  /** @category internal */
  export const $NOSCRIPT = mkwrapper('noscript')
  /** @category internal */
  export const $OBJECT = mkwrapper('object')
  /** @category internal */
  export const $OL = mkwrapper('ol')
  /** @category internal */
  export const $OPTGROUP = mkwrapper('optgroup')
  /** @category internal */
  export const $OPTION = mkwrapper('option')
  /** @category internal */
  export const $OUTPUT = mkwrapper('output')
  /** @category internal */
  export const $P = mkwrapper('p')
  /** @category internal */
  export const $PARAM = mkwrapper('param')
  /** @category internal */
  export const $PICTURE = mkwrapper('picture')
  /** @category internal */
  export const $PRE = mkwrapper('pre')
  /** @category internal */
  export const $PROGRESS = mkwrapper('progress')
  /** @category internal */
  export const $Q = mkwrapper('q')
  /** @category internal */
  export const $RP = mkwrapper('rp')
  /** @category internal */
  export const $RT = mkwrapper('rt')
  /** @category internal */
  export const $RUBY = mkwrapper('ruby')
  /** @category internal */
  export const $S = mkwrapper('s')
  /** @category internal */
  export const $SAMP = mkwrapper('samp')
  /** @category internal */
  export const $SCRIPT = mkwrapper('script')
  /** @category internal */
  export const $SECTION = mkwrapper('section')
  /** @category internal */
  export const $SELECT = mkwrapper('select')
  /** @category internal */
  export const $SMALL = mkwrapper('small')
  /** @category internal */
  export const $SOURCE = mkwrapper('source')
  /** @category internal */
  export const $SPAN = mkwrapper('span')
  /** @category internal */
  export const $STRONG = mkwrapper('strong')
  /** @category internal */
  export const $STYLE = mkwrapper('style')
  /** @category internal */
  export const $SUB = mkwrapper('sub')
  /** @category internal */
  export const $SUMMARY = mkwrapper('summary')
  /** @category internal */
  export const $SUP = mkwrapper('sup')
  /** @category internal */
  export const $TABLE = mkwrapper('table')
  /** @category internal */
  export const $TBODY = mkwrapper('tbody')
  /** @category internal */
  export const $TD = mkwrapper('td')
  /** @category internal */
  export const $TEXTAREA = mkwrapper('textarea')
  /** @category internal */
  export const $TFOOT = mkwrapper('tfoot')
  /** @category internal */
  export const $TH = mkwrapper('th')
  /** @category internal */
  export const $THEAD = mkwrapper('thead')
  /** @category internal */
  export const $TIME = mkwrapper('time')
  /** @category internal */
  export const $TITLE = mkwrapper('title')
  /** @category internal */
  export const $TR = mkwrapper('tr')
  /** @category internal */
  export const $TRACK = mkwrapper('track')
  /** @category internal */
  export const $U = mkwrapper('u')
  /** @category internal */
  export const $UL = mkwrapper('ul')
  /** @category internal */
  export const $VAR = mkwrapper('var')
  /** @category internal */
  export const $VIDEO = mkwrapper('video')
  /** @category internal */
  export const $WBR = mkwrapper('wbr')

  /**
   * An alias to conform to typescript's JSX
   * @category internal
   */
  export const createElement = e

  /** @category internal */
  export const Fragment: (at: EmptyAttributes<DocumentFragment>, ch: Renderable[]) => DocumentFragment = $Fragment //(at: Attrs, ch: DocumentFragment): e.JSX.Element
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

    export type HTMLAttributes<N extends HTMLElement> = e.JSX.HTMLAttributes<N>
    export type SVGAttributes<N extends SVGElement = SVGElement> = e.JSX.SVGAttributes<N>
  }
}
