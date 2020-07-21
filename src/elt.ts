import { o } from './observable'

import {
  Component
} from './component'

import {
  ClassDefinition,
  StyleDefinition,
  node_observe_class,
  node_observe_style,
  node_observe_attribute,
  insert_before_and_init,
  append_child_and_init,
  node_remove_after
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


function isComponentClass(kls: any): kls is new (attrs: Attrs<any>) => Component<any> {
  return kls.prototype instanceof Component
}


var cmt_count = 0
/**
 * A [[Mixin]] made to store nodes between two comments.
 *
 * Can be used as a base to build verbs more easily.
 * @category dom, toc
 */
export class CommentContainer extends Component<EmptyAttributes<Comment>> {

  /** The Comment marking the end of the node handled by this Mixin */
  end = document.createComment(`-- ${this.constructor.name} ${cmt_count ++} --`)

  constructor() { super({}) }

  /**
   * Remove all nodes between this.start and this.node
   */
  clear() {
    if (this.end.previousSibling !== this.node)
      node_remove_after(this.node, this.end.previousSibling!)
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
    return e(document.createComment(this.constructor.name),
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
    return e(super.render(), $observe(this._obs, value =>
      this.setContents(e.renderable_to_node(value)))
    )
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
 * @category low level dom, toc
 */
export function Display(obs: o.RO<Renderable>): Node {
  if (!(obs instanceof o.Observable)) {
    return e.renderable_to_node(obs as Renderable, true)
  }

  return new Displayer(obs).renderAndAttach([])
}


/**
 * Renderables are the types understood by the `Display` verb and that can be rendered into
 * the DOM without efforts or need to transform. It is used by the `Insertable` type
 * to define what can go between `{ curly braces }` in JSX code.
 * @category dom, toc
 */
export type Renderable = o.RO<string | number | Node | null | undefined | {[e.sym_render](): Node} | Renderable[]>

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
export type Insertable<N extends Node> = Decorator<N> | Renderable | Insertable<N>[]

/**
 * Attributes used on elements that are not actually HTML Elements
 */
export interface EmptyAttributes<N extends Node> {
  /**
   * This attribute is the one used by TSX to validate what can be inserted
   * as a child in a TSX expression.
   */
  $$children?: o.RO<Insertable<N>> | o.RO<Insertable<N>>[]
}

/**
 * For a given attribute type used in components, give its related `Node` type.
 *
 * @code ../examples/attrsnodetype.tsx
 *
 * @category dom, toc
 */
export type AttrsNodeType<At extends EmptyAttributes<any>> = At extends EmptyAttributes<infer N> ? N : never


/**
 * A helper type since all HTML / SVG attributes can be null or undefined.
 * @inline
 * @internal
 */
export type NRO<T> = o.RO<T | null | undefined>


/**
 * Basic attributes used on all HTML nodes, which can be reused when making components
 * to benefit from the class / style / id... attributes defined here.
 *
 * Attrs **must** always specify the returned node type as its type argument.
 *
 * @code ../examples/attrs.tsx
 *
 * This type should be used as first argument to all components definitions.
 * @category dom, toc
 */
export interface Attrs<N extends Node = HTMLElement> extends EmptyAttributes<N> {
  /** A document id */
  id?: NRO<string | null>
  /** Class definition(s), see [[$class]] for possible uses */
  class?: ClassDefinition | ClassDefinition[] // special attributes
  /** Style definition, see [[$style]] for use */
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
export function e<K extends keyof SVGElementTagNameMap>(elt: K, ...children: (Insertable<SVGElementTagNameMap[K]> | e.JSX.SVGAttributes<SVGElementTagNameMap[K]>)[]): SVGElementTagNameMap[K]
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
  var decorators_map: [Decorator<N>, Comment][] = []
  var renderables: Renderable[] = []
  e.handle_raw_children(children, attrs, decorators_map, renderables)

  if (is_basic_node) {
    // create a simple DOM node
    if (typeof elt === 'string') {
      var ns = NS[elt] // || attrs.xmlns
      node = (ns ? document.createElementNS(ns, elt) : document.createElement(elt)) as unknown as N
    } else {
      node = elt as N
    }

    // We have to perform this check, as decorators respond with a comment to insert their content
    // once the component has been created, and it cannot be inserted to a comment node.
    // In practice, the type checker should respond with an error when trying to return nodes from
    // a decorator applied to a comment.
    if (!(node instanceof Comment)) {
      for (i = 0, l = renderables.length; i < l; i++) {
        var c = e.renderable_to_node(renderables[i])
        if (c) {
          if (!(node instanceof Comment)) append_child_and_init(node, c)
        }
      }
    }

  } else if (typeof elt === 'function') {
    // elt is just a creator function
    node = elt(attrs, renderables)
  } else if (isComponentClass(elt)) {
    node = new elt(attrs).renderAndAttach(renderables) as unknown as N
  }

  // we have to cheat a bit here.
  e.handle_attrs(node as any, attrs, is_basic_node)

  // Handle decorators on the node
  for (i = 0, l = decorators_map.length; i < l; i++) {
    var item = decorators_map[i]
    e.handle_decorator(node, item[1], item[0])
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


import { Decorator, $observe, $init } from './decorators'


export namespace e {

  /**
   * Implement this property on any object to be able to insert it as a node
   * child. The signature it implements is `() => Renderable`.
   *
   * @code ../examples/e.sym_render.tsx
   *
   * @category toc, dom
   */
  export const sym_render = Symbol('renderable')

  /** @internal */
  export function is_renderable_object(c: any): c is {[sym_render](): Node} {
    return c && c[sym_render]
  }

  /**
   * FIXME : re document this !
   * @internal
   */
  export function handle_raw_children(children: (Insertable<any> | Attrs<any>)[], attrs: Attrs<any>, decorators: [Decorator<any>, Comment][], chld: Renderable[]) {
    for (var i = 0, l = children.length; i < l; i++) {
      var c = children[i]
      if (c == null) continue
      if (Array.isArray(c)) {
        handle_raw_children(c, attrs, decorators, chld)
      } else if (c instanceof Node || typeof c === 'string' || typeof c === 'number' || o.isReadonlyObservable(c) || is_renderable_object(c)) {
        chld.push(c)
      } else if (typeof c === 'function') {
        // FIXME / WARNING : as it stands, this implementation is broken, as if the same decorator is called while
        // being executed, then the comment node will be messed.
        var cmt = document.createComment('decorator ' + c.name)
        // I should keep the comment / function association instead of using a map, the decorators variable should reflect that.
        chld.push(cmt)
        decorators.push([c, cmt])
      } else {
        // We just copy the attrs properties onto the attrs object
        Object.assign(attrs, c)
      }
    }
  }

  /**
   * @internal
   */
  export function renderable_to_node(r: Renderable): Node | null
  export function renderable_to_node(r: Renderable, null_as_comment: true): Node
  export function renderable_to_node(r: Renderable, null_as_comment = false): Node | null {
    if (r == null)
      return null_as_comment ? document.createComment(' null ') : null
    else if (typeof r === 'string' || typeof r === 'number')
      return document.createTextNode(r.toString())
    else if (o.isReadonlyObservable(r))
      return Display(r)
    else if (Array.isArray(r)) {
      var df = document.createDocumentFragment()
      for (var i = 0, l = r.length; i < l; i++) {
        var r2 = renderable_to_node(r[i], null_as_comment as true)
        if (r2) df.appendChild(r2)
      }
      return df
    } else if (is_renderable_object(r)) {
      return r[e.sym_render]()
    } else {
      return r
    }
  }

  export function handle_decorator_result(node: Node, insert: Comment | undefined, res: ReturnType<Decorator<Node>>): void {
    // if there is not result, or the result is the node itself, do nothing
    if (res == null || res === node) return

    if (typeof res === 'function') {
      var res2 = res(node)
      return handle_decorator_result(node, insert, res2)
    }

    if (Array.isArray(res)) {
      for (var i = 0, l = res.length; i < l; i++) {
        const ri = res[i]
        handle_decorator_result(node, insert, ri)
      }
      return
    }

    // Ignore the nodes that may be created if there is nowhere to insert them to
    if (!insert) return

    var nd = renderable_to_node(res)
    if (nd == null) return
    // insert the resulting node right next to the comment
    insert_before_and_init(node, nd, insert)

  }

  /**
   * @internal
   */
  export function handle_decorator(node: Node, insert: Comment, decorator: Decorator<any>): void {
    var res: ReturnType<Decorator<Node>> = decorator(node)
    handle_decorator_result(node, insert, res)
  }

  /**
   * Handle attributes for simple nodes
   * @internal
   */
  export function handle_attrs(node: HTMLElement, attrs: e.JSX.HTMLAttributes<any>, is_basic_node: boolean) {
    var keys = Object.keys(attrs) as (keyof typeof attrs)[]
    for (var i = 0, l = keys.length; i < l; i++) {
      var key = keys[i]
      if (key === 'class' && attrs.class) {
        var clss = attrs.class
        if (Array.isArray(clss))
          for (var j = 0, lj = clss.length; j < lj; j++) node_observe_class(node, clss[j])
        else
          node_observe_class(node, attrs.class!)
      } else if (key === 'style' && attrs.style) {
        node_observe_style(node, attrs.style)
      } else if (key === 'id' || is_basic_node) {
        node_observe_attribute(node, key, attrs[key])
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
      (attrs: EmptyAttributes<N>, children: Renderable[]): N
    }

    /** @internal */
    export type ElementClass = ElementClassFn<any> | Component<EmptyAttributes<any>>

    ///////////////////////////////////////////////////////////////////////////
    // Now following are the default attributes for HTML and SVG nodes.

    /** @internal */
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

    /** @internal */
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

    /** @internal */
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
   * @internal
   */
  export function mkwrapper<K extends keyof HTMLElementTagNameMap>(elt: K): (...args: (Insertable<HTMLElementTagNameMap[K]> | e.JSX.HTMLAttributes<HTMLElementTagNameMap[K]>)[]) => HTMLElementTagNameMap[K]
  export function mkwrapper(elt: string): (...args: (Insertable<HTMLElement> | e.JSX.HTMLAttributes<HTMLElement>)[]) => HTMLElement
  export function mkwrapper<K extends keyof HTMLElementTagNameMap>(elt: K): (...args: (Insertable<HTMLElementTagNameMap[K]> | e.JSX.HTMLAttributes<HTMLElementTagNameMap[K]>)[]) => HTMLElementTagNameMap[K] {
    return (...args) => {
      return e<K>(elt, ...args)
    }
  }

  /** @internal */
  export const A = mkwrapper('a')
  /** @internal */
  export const ABBR = mkwrapper('abbr')
  /** @internal */
  export const ADDRESS = mkwrapper('address')
  /** @internal */
  export const AREA = mkwrapper('area')
  /** @internal */
  export const ARTICLE = mkwrapper('article')
  /** @internal */
  export const ASIDE = mkwrapper('aside')
  /** @internal */
  export const AUDIO = mkwrapper('audio')
  /** @internal */
  export const B = mkwrapper('b')
  /** @internal */
  export const BASE = mkwrapper('base')
  /** @internal */
  export const BDI = mkwrapper('bdi')
  /** @internal */
  export const BDO = mkwrapper('bdo')
  /** @internal */
  export const BIG = mkwrapper('big')
  /** @internal */
  export const BLOCKQUOTE = mkwrapper('blockquote')
  /** @internal */
  export const BODY = mkwrapper('body')
  /** @internal */
  export const BR = mkwrapper('br')
  /** @internal */
  export const BUTTON = mkwrapper('button')
  /** @internal */
  export const CANVAS = mkwrapper('canvas')
  /** @internal */
  export const CAPTION = mkwrapper('caption')
  /** @internal */
  export const CITE = mkwrapper('cite')
  /** @internal */
  export const CODE = mkwrapper('code')
  /** @internal */
  export const COL = mkwrapper('col')
  /** @internal */
  export const COLGROUP = mkwrapper('colgroup')
  /** @internal */
  export const DATA = mkwrapper('data')
  /** @internal */
  export const DATALIST = mkwrapper('datalist')
  /** @internal */
  export const DD = mkwrapper('dd')
  /** @internal */
  export const DEL = mkwrapper('del')
  /** @internal */
  export const DETAILS = mkwrapper('details')
  /** @internal */
  export const DFN = mkwrapper('dfn')
  /** @internal */
  export const DIALOG = mkwrapper('dialog')
  /** @internal */
  export const DIV = mkwrapper('div')
  /** @internal */
  export const DL = mkwrapper('dl')
  /** @internal */
  export const DT = mkwrapper('dt')
  /** @internal */
  export const EM = mkwrapper('em')
  /** @internal */
  export const EMBED = mkwrapper('embed')
  /** @internal */
  export const FIELDSET = mkwrapper('fieldset')
  /** @internal */
  export const FIGCAPTION = mkwrapper('figcaption')
  /** @internal */
  export const FIGURE = mkwrapper('figure')
  /** @internal */
  export const FOOTER = mkwrapper('footer')
  /** @internal */
  export const FORM = mkwrapper('form')
  /** @internal */
  export const H1 = mkwrapper('h1')
  /** @internal */
  export const H2 = mkwrapper('h2')
  /** @internal */
  export const H3 = mkwrapper('h3')
  /** @internal */
  export const H4 = mkwrapper('h4')
  /** @internal */
  export const H5 = mkwrapper('h5')
  /** @internal */
  export const H6 = mkwrapper('h6')
  /** @internal */
  export const HEAD = mkwrapper('head')
  /** @internal */
  export const HEADER = mkwrapper('header')
  /** @internal */
  export const HR = mkwrapper('hr')
  /** @internal */
  export const HTML = mkwrapper('html')
  /** @internal */
  export const I = mkwrapper('i')
  /** @internal */
  export const IFRAME = mkwrapper('iframe')
  /** @internal */
  export const IMG = mkwrapper('img')
  /** @internal */
  export const INPUT = mkwrapper('input')
  /** @internal */
  export const INS = mkwrapper('ins')
  /** @internal */
  export const KBD = mkwrapper('kbd')
  /** @internal */
  export const KEYGEN = mkwrapper('keygen')
  /** @internal */
  export const LABEL = mkwrapper('label')
  /** @internal */
  export const LEGEND = mkwrapper('legend')
  /** @internal */
  export const LI = mkwrapper('li')
  /** @internal */
  export const LINK = mkwrapper('link')
  /** @internal */
  export const MAIN = mkwrapper('main')
  /** @internal */
  export const MAP = mkwrapper('map')
  /** @internal */
  export const MARK = mkwrapper('mark')
  /** @internal */
  export const MENU = mkwrapper('menu')
  /** @internal */
  export const MENUITEM = mkwrapper('menuitem')
  /** @internal */
  export const META = mkwrapper('meta')
  /** @internal */
  export const METER = mkwrapper('meter')
  /** @internal */
  export const NAV = mkwrapper('nav')
  /** @internal */
  export const NOSCRIPT = mkwrapper('noscript')
  /** @internal */
  export const OBJECT = mkwrapper('object')
  /** @internal */
  export const OL = mkwrapper('ol')
  /** @internal */
  export const OPTGROUP = mkwrapper('optgroup')
  /** @internal */
  export const OPTION = mkwrapper('option')
  /** @internal */
  export const OUTPUT = mkwrapper('output')
  /** @internal */
  export const P = mkwrapper('p')
  /** @internal */
  export const PARAM = mkwrapper('param')
  /** @internal */
  export const PICTURE = mkwrapper('picture')
  /** @internal */
  export const PRE = mkwrapper('pre')
  /** @internal */
  export const PROGRESS = mkwrapper('progress')
  /** @internal */
  export const Q = mkwrapper('q')
  /** @internal */
  export const RP = mkwrapper('rp')
  /** @internal */
  export const RT = mkwrapper('rt')
  /** @internal */
  export const RUBY = mkwrapper('ruby')
  /** @internal */
  export const S = mkwrapper('s')
  /** @internal */
  export const SAMP = mkwrapper('samp')
  /** @internal */
  export const SCRIPT = mkwrapper('script')
  /** @internal */
  export const SECTION = mkwrapper('section')
  /** @internal */
  export const SELECT = mkwrapper('select')
  /** @internal */
  export const SMALL = mkwrapper('small')
  /** @internal */
  export const SOURCE = mkwrapper('source')
  /** @internal */
  export const SPAN = mkwrapper('span')
  /** @internal */
  export const STRONG = mkwrapper('strong')
  /** @internal */
  export const STYLE = mkwrapper('style')
  /** @internal */
  export const SUB = mkwrapper('sub')
  /** @internal */
  export const SUMMARY = mkwrapper('summary')
  /** @internal */
  export const SUP = mkwrapper('sup')
  /** @internal */
  export const TABLE = mkwrapper('table')
  /** @internal */
  export const TBODY = mkwrapper('tbody')
  /** @internal */
  export const TD = mkwrapper('td')
  /** @internal */
  export const TEXTAREA = mkwrapper('textarea')
  /** @internal */
  export const TFOOT = mkwrapper('tfoot')
  /** @internal */
  export const TH = mkwrapper('th')
  /** @internal */
  export const THEAD = mkwrapper('thead')
  /** @internal */
  export const TIME = mkwrapper('time')
  /** @internal */
  export const TITLE = mkwrapper('title')
  /** @internal */
  export const TR = mkwrapper('tr')
  /** @internal */
  export const TRACK = mkwrapper('track')
  /** @internal */
  export const U = mkwrapper('u')
  /** @internal */
  export const UL = mkwrapper('ul')
  /** @internal */
  export const VAR = mkwrapper('var')
  /** @internal */
  export const VIDEO = mkwrapper('video')
  /** @internal */
  export const WBR = mkwrapper('wbr')

  /**
   * An alias to conform to typescript's JSX
   * @internal
   */
  export const createElement = e

  /** @internal */
  export const Fragment: (at: EmptyAttributes<DocumentFragment>, ch: Renderable[]) => DocumentFragment = $ //(at: Attrs, ch: DocumentFragment): e.JSX.Element
}

declare var global: any
if (typeof global !== 'undefined' && typeof (global.E) === 'undefined') {
  (global as any).E = e
}

if ('undefined' !== typeof window && typeof (window as any).E === 'undefined') {
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

    export type HTMLAttributes<N extends HTMLElement> = e.JSX.HTMLAttributes<N>
    export type SVGAttributes<N extends SVGElement = SVGElement> = e.JSX.SVGAttributes<N>
  }
}
