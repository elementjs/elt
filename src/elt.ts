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
