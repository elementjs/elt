
import {
  o
} from './observable'

import {
  Attrs,
  Renderable,
  ComponentFn,
  ComponentInstanciator
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
 * Private mixin used by the d() function when binding on
 */
export class AttrsMixin extends Mixin<HTMLElement> { }


////////////////////////////////////////////////////////


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
export function e(elt: ComponentFn, attrs: Attrs | null, ...children: o.RO<Renderable>[]): Element
export function e(elt: string, attrs: Attrs | null, ...children: o.RO<Renderable>[]): HTMLElement
export function e<A>(elt: ComponentInstanciator<A>, attrs: A | null, ...children: o.RO<Renderable>[]): Element
export function e(elt: any, _attrs: Attrs | null, ...children: o.RO<Renderable>[]): Element {

  if (!elt) throw new Error(`d() needs at least a string, a function or a Component`)

  let node: Element = null! // just to prevent the warnings later

  var attrs = _attrs || {} as Attrs
  var is_basic_node = typeof elt === 'string'

  const fragment = getDOMInsertable(children) as DocumentFragment

  if (is_basic_node) {
    // create a simple DOM node
    var ns = NS[elt] || attrs.xmlns
    node = ns ? document.createElementNS(ns, elt) : document.createElement(elt)

    var _child = fragment.firstChild as Node | null
    while (_child) {
      mount(_child)
      _child = _child.nextSibling
    }

    // Append children to the node.
    node.appendChild(fragment)

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

  for (var key in attrs) {
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

  // decorators are run now. If class and style were defined, they will be applied to the
  // final node.
  var $$ = attrs.$$
  if ($$) {
    var mixins = Array.isArray($$) ? $$ : [$$]
    for (var d of mixins) {
      d.addToNode(node)
    }
  }

  return node
}
