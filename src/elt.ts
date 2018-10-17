
import {
  o
} from './observable'

import {
  Attrs,
  Insertable,
  ComponentFn,
  ComponentInstanciator
} from './types'

import {
  Mixin,
  Component
} from './mixins'

import {
  Display
} from './verbs'
import { added } from './mounting';



/**
 * Private mixin used by the d() function when binding on
 */
export class AttrsMixin extends Mixin<HTMLElement> { }


////////////////////////////////////////////////////////

/**
 *
 */
export function getDocumentFragment(ch: Insertable|Insertable[]) {
  var result = document.createDocumentFragment()
  if (!ch) return result

  var children = Array.isArray(ch) ? ch : [ch]

  for (var c of children) {
    // Do not do anything with null or undefined
    if (c == null) continue

    if (Array.isArray(c)) {
      result.appendChild(getDocumentFragment(c))
    } else if (c instanceof o.Observable) {
      result.appendChild(Display(c))
    } else if (!(c instanceof Node)) {
      result.appendChild(document.createTextNode(c.toString()))
    } else {
      result.appendChild(c)
    }
  }

  return result
}


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

  if (!elt) throw new Error(`d() needs at least a string, a function or a Component`)

  let node: Element = null! // just to prevent the warnings later

  var attrs = _attrs || {} as Attrs

  if (typeof elt === 'string') {
    // create a simple DOM node
    var ns = NS[elt] || attrs.xmlns
    node = ns ? document.createElementNS(ns, elt) : document.createElement(elt)

    // Append children to the node.
    if (children) {
      node.appendChild(getDocumentFragment(children))
      var _child = node.firstChild as Node | null
      while (_child) {
        added(_child, node)
        _child = _child.nextSibling
      }
    }

  } else if (isComponent(elt)) {

    // elt is an instantiator / Component
    var comp = new elt(attrs)

    node = comp.render(getDocumentFragment(children))
    comp.addToNode(node)

  } else if (typeof elt === 'function') {
    // elt is just a creator function
    node = elt(attrs, getDocumentFragment(children))
  }

  const {class: cls, style, $$, id, contenteditable, hidden, accesskey, dir, draggable, dropzone, lang, spellcheck, tabindex, title, translate, ...rest} = attrs

  // Classes and style are applied at the end of this function and are thus
  // never passed to other node definitions.
  if (_attrs || cls || style || accesskey || contenteditable || dir || draggable || dropzone || id || lang || spellcheck || tabindex || title || translate) {
    var mx = new AttrsMixin()
    mx.addToNode(node as HTMLElement) // we're cheating on the type.

    if (typeof elt === 'string') {
      // when building a simple DOM node, then all the attributes
      // are meant to be applied.
      for (var x in rest) {
        mx.observeAttribute(x, (rest as any)[x])
      }
    }

    if (accesskey) mx.observeAttribute('accesskey', accesskey)
    if (contenteditable) mx.observeAttribute('contenteditable', accesskey)
    if (dir) mx.observeAttribute('dir', dir)
    if (draggable) mx.observeAttribute('draggable', draggable)
    if (dropzone) mx.observeAttribute('dropzone', dropzone)
    if (id) mx.observeAttribute('id', id)
    if (lang) mx.observeAttribute('lang', lang)
    if (spellcheck) mx.observeAttribute('spellcheck', spellcheck)
    if (tabindex) mx.observeAttribute('tabindex', tabindex)
    if (title) mx.observeAttribute('title', title)
    if (translate) mx.observeAttribute('translate', translate)

    if (cls) {
      if (Array.isArray(cls)) {
        for (var c of cls) {
          mx.observeClass(c)
        }
      } else {
        mx.observeClass(cls)
      }
    }

    if (style) {
      mx.observeStyle(style)
    }
  }

  // decorators are run now. If class and style were defined, they will be applied to the
  // final node.
  if ($$) {
    var mixins = Array.isArray($$) ? $$ : [$$]
    for (var d of mixins) {
      d.addToNode(node)
    }
  }

  return node
}
