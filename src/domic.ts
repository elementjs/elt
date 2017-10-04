
import {
  MaybeObservable,
  Observable
} from 'domic-observable'

import {
  Attrs,
  Insertable,
  ClassDefinition,
  StyleDefinition,
  ComponentFn,
  ComponentInstanciator
} from './types'

import {
  Mixin
} from './mixins'

import {
  Display
} from './verbs'


function _apply_class(node: Element, c: string) {
  if (!c) return
  for (var _ of c.split(/\s+/g))
    node.classList.add(_)
}

function _remove_class(node: Element, c: string) {
  if (!c) return
  for (var _ of c.split(/\s+/g))
    node.classList.remove(_)
}


/**
 * Private mixin used by the d() function when binding on
 */
export class AttrsMixin extends Mixin {

  /**
   *
   */
  observeAttribute(node: Element, name: string, value: MaybeObservable<any>) {
    this.observe(value, val => {
      if (val === true)
      node.setAttribute(name, '')
      else if (val != null && val !== false)
        node.setAttribute(name, val)
      else
        // We can remove safely even if it doesn't exist as it won't raise an exception
        node.removeAttribute(name)    
    }, true)
  }

  observeStyle(node: HTMLElement, style: StyleDefinition) {
    if (style instanceof Observable) {
      this.observe(style, st => {
        for (var x in st) {
          (node.style as any)[x] = (st as any)[x]
        }
      }, true)
    } else {
      // c is a MaybeObservableObject
      var st = style as any
      for (let x in st) {
        this.observe(st[x], value => {
          (node.style as any)[x] = value
        }, true)
      }
    }
  }

  observeClass(node: Element, c: ClassDefinition) {
    if (c instanceof Observable || typeof c === 'string') {
      // c is an Observable<string>
      this.observe(c, (str, old_class) => {
        if (old_class) _remove_class(node, old_class)
        _apply_class(node, str)
      }, true)
    } else {
      // c is a MaybeObservableObject
      for (let x in c) {
        this.observe(c[x], applied => applied ? _apply_class(node, x) : _remove_class(node, x), true)
      }
    }
  }

}


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
    } else if (c instanceof Observable) {
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
    iter = iter.nextSibling
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

/**
 * Create Nodes with a twist.
 *
 * This function is the base of domic ; it creates Nodes and glues together
 * Controllers, decorators, classes and style.
 */

export function d(elt: ComponentFn, attrs: Attrs | null, ...children: Insertable[]): Element
export function d(elt: string, attrs: Attrs | null, ...children: Insertable[]): HTMLElement
export function d<A>(elt: ComponentInstanciator<A>, attrs: A | null, ...children: Insertable[]): Element
export function d(elt: any, _attrs: Attrs | null, ...children: Insertable[]): Element {

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
    }

  } else if (typeof elt === 'function' && elt.prototype.render) {

    // elt is an instantiator / Component
    var comp = new elt()
    comp.attrs = attrs

    node = comp.render(getDocumentFragment(children))
    comp.addToNode(node)

  } else if (typeof elt === 'function') {
    // elt is just a creator function
    node = elt(attrs, getDocumentFragment(children))
  }

  const {class: cls, style, $$, id, ...rest} = attrs

  // Classes and style are applied at the end of this function and are thus
  // never passed to other node definitions.
  if (_attrs || cls || style || id) {
    var mx = new AttrsMixin()
    mx.addToNode(node)

    if (typeof elt === 'string') {
      // when building a simple DOM node, then all the attributes
      // are meant to be applied.
      for (var x in rest) {
        mx.observeAttribute(node, x, (rest as any)[x])
      }
    }

    if (id) mx.observeAttribute(node, 'id', id)

    if (cls) {
      var classes = Array.isArray(cls) ? cls : [cls]
      for (var c of classes) {
        mx.observeClass(node, c)
      }
    }

    if (style) {
      mx.observeStyle(node as HTMLElement, style)
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


declare global {
  function D(elt: ComponentFn, attrs: Attrs, ...children: Insertable[]): Node
  function D(elt: string, attrs: Attrs, ...children: Insertable[]): HTMLElement
  function D<A>(elt: ComponentInstanciator<A>, attrs: A, ...children: Insertable[]): Node
}


if (typeof window !== 'undefined' && typeof (window as any).D === 'undefined') {
  (window as any).D = d
}
