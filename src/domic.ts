
import {
  O,
  Observable
} from 'domic-observable'

import {
  ArrayOrSingle,
  BasicAttributes,
  Child,
  ComponentInstanciator,
  ClassObject,
  ClassDefinition,
  ComponentFn,
  D,
  Decorator,
  Instantiator,
  SingleChild,
  StyleDefinition,
} from './types'

import {
  Component,
  Controller,
  DefaultController,
} from './controller'

import {
  Write
} from './verbs'


function _apply_class(node: Element, c: string) {
  if (!c) return
  c.split(/\s+/g).forEach(c => node.classList.add(c))
}

function _remove_class(node: Element, c: string) {
  if (!c) return
  c.split(/\s+/g).forEach(c => node.classList.remove(c))
}

/**
 *
 */
function applyClass(node: Element, c: ClassDefinition, ct: DefaultController): DefaultController {
  if (typeof c === 'string') {
    _apply_class(node, c)
  } else if (c instanceof Observable) {
    if (!ct) ct = new DefaultController()
    let old_class: string = null
    ct.observe(c, str => {
      if (old_class) _remove_class(node, old_class)
      _apply_class(node, str)
      old_class = str
    })
  } else {
    // c is an object
    for (let x in c) {
      if (c[x] instanceof Observable) {
        if (!ct) ct = new DefaultController()
        ct.observe(c[x], applied => {
          applied ? _apply_class(node, x) : _remove_class(node, x)
        })
      } else {
        if (c[x])
          _apply_class(node, x)
      }
    }
  }

  return ct
}

function applyStyle(node: HTMLElement, c: StyleDefinition, ct: DefaultController): DefaultController {
  if (typeof c === 'string') {
    node.setAttribute('style', c)
  } else if (c instanceof Observable) {
    if (!ct) ct = new DefaultController()
    ct.observe(c, str => {
      node.setAttribute('style', str)
    })
  } else {
    // c is an object
    for (let x in c as any) {
      if ((c as any)[x] instanceof Observable) {
        if (!ct) ct = new DefaultController()
        ct.observe((c as any)[x], value => {
          (node.style as any)[x] = value
        })
      } else {
        if ((c as any)[x])
          (node.style as any)[x] = (c as any)[x]
      }
    }
  }

  return ct
}


/**
 * Apply attribute to the node
 */
function applyAttribute(node: Element, name: string, value: O<any>, ct: DefaultController): DefaultController {

  if (value instanceof Observable) {
    if (!ct) ct = new DefaultController()
    ct.observe(value, val => {
      if (val != null)
        node.setAttribute(name, val)
      else {
        node.removeAttribute(name)
      }
    })
  } else {
    if (value != null) node.setAttribute(name, value)
  }

  return ct

}


/**
 *
 */
export function getDocumentFragment(children: Child[]) {
  var result = document.createDocumentFragment()

  _foreach(children, c => {
    // Do not do anything with null
    if (c == null) return

    if (Array.isArray(c)) {
      result.appendChild(getDocumentFragment(c))
    } else if (c instanceof Observable) {
      result.appendChild(Write(c))
    } else if (!(c instanceof Node)) {
      result.appendChild(document.createTextNode(c.toString()))
    } else {
      result.appendChild(c)
    }
  })

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


/**
 * Apply a function to each element of the provided array if
 * it is an array or to the single element if it was not.
 *
 * Does nothing if null was supplied.
 */
export function _foreach<T>(maybe_array: ArrayOrSingle<T>, fn: (a: T) => any): void {
  if (!maybe_array) return

  if (Array.isArray(maybe_array)) {
    for (var e of maybe_array)
      fn(e)
  } else {
    fn(maybe_array)
  }
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
export const d: D = <D>function d(elt: any, attrs: BasicAttributes, ...children: Child[]): Node {

  if (!elt) throw new Error(`d() needs at least a string, a function or a Component`)

  let node: Node = null

  // Classes and style are applied at the end of this function and are thus
  // never passed to other node definitions.
  let comp: Component = null
  let ct: DefaultController = null
  let controllers: Controller[] = null

  let decorators: ArrayOrSingle<Decorator> = null
  let style: ArrayOrSingle<StyleDefinition> = null
  let cls: ArrayOrSingle<ClassDefinition> = null

  if (attrs) {
    decorators = attrs.$$
    style = attrs.style
    cls = attrs.class
    if (cls) delete attrs.class
    if (style) delete attrs.style
    if (decorators) delete attrs.$$
  } else {
    attrs = {}
  }

  if (typeof elt === 'string') {
    var ns = NS[elt] || attrs.xmlns
    node = ns ? document.createElementNS(ns, elt) : document.createElement(elt)

    for (var x in attrs as any) {
      ct = applyAttribute(node as Element, x, (attrs as any)[x], ct)
    }

    // Append children to the node.
    if (children) {
      node.appendChild(getDocumentFragment(children))
    }

  } else if (typeof elt === 'function' && elt.prototype.render) {
    // elt is an instantiator / Component
    let kls = elt as Instantiator<Component>
    comp = new kls(attrs)
    node = comp.render(getDocumentFragment(children))

  } else if (typeof elt === 'function') {
    // elt is just a creator function
    node = elt(attrs, getDocumentFragment(children))
  }
  controllers = Controller.init(node)

  if (comp) comp.bindToNode(node)

  // decorators are run now. If class and style were defined, they will be applied to the
  // final node.
  _foreach(decorators, d => d(node))

  // Class attributes and Style attributes are special and forwarded accross nodes and are thus
  // always added (unlike other attributes which are simply passed forward)
  _foreach(cls, cl => {
    ct = applyClass(node as Element, cl, ct)
  })

  _foreach(style, st => {
    ct = applyStyle(node as HTMLElement, st, ct)
  })

  if (ct) ct.bindToNode(node)

  // Call onrender on component now that all the linking is done.
  controllers.forEach(c => c.onrender.forEach(r => r.call(c, node)))

  return node
}

d.createElement = d
