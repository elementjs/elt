
import {O} from 'stalkr'

import {
  BasicAttributes,
  ArrayOrSingle,
  Children, Child,
  Instantiator,
  CreatorFn,
  ClassDefinition,
  StyleDefinition,
  Decorator
} from './types'

import {
  Component, Controller
} from './controller'


function applyClass(node: Element, c: ClassDefinition) {

}

function applyStyle(node: Element, c: StyleDefinition) {

}

function applyAttribute(node: Node, name: string, value: O<any>) {

}


function d(elt: CreatorFn, attrs: BasicAttributes, children: Children): Node
function d(elt: Instantiator<Component>, attrs: BasicAttributes, children: Children): Node
function d(elt: string, attrs: BasicAttributes, children: Children): Node
function d(elt: any, attrs: BasicAttributes, children: Children): Node {

  let node: Node = null

  // Classes and style are applied at the end of this function and are thus
  // never passed to other node definitions.
  let decorators = attrs.$$
  let style = attrs.style
  let cls = attrs.class
  if (cls) delete attrs.class
  if (style) delete attrs.style
  if (decorators) delete attrs.$$

  if (typeof elt === 'string') {
    node = document.createElement(elt)
    for (var x in attrs as any) {
      applyAttribute(node, x, (attrs as any)[x])
    }

    // Append children to the node.
    if (children) {
      if (!Array.isArray(children)) children = [children]
      for (var c of children as Child[]) {
        if (!(c instanceof Node)) {
          node.appendChild(document.createTextNode(typeof c === 'number' ? c.toString() : c))
        } else {
          node.appendChild(c)
        }
      }
    }

  } else if (typeof elt === 'function' && elt.prototype.render) {
    // elt is an instantiator
    let kls = elt as Instantiator<Component>
    let c = new kls()
    c.attrs = attrs
    node = c.render(children)

  } else if (typeof elt === 'function') {
    // elt is just a creator function
    node = elt(attrs, children)
  }

  // decorators are run now. If class and style were defined, they will be applied to the
  // final node.
  if (decorators) {
    if (!Array.isArray(decorators)) decorators = [decorators]
    for (var d of decorators as Decorator[]) {
      node = d(node) || node
    }
  }

  if (cls) {
    if (Array.isArray(cls)) {
      for (var cl of cls)
        // oooo, ugly cast !
        applyClass(node as Element, cl)
    } else {
      applyClass(node as Element, elt)
    }
  }

  if (style) {
    if (Array.isArray(style)) {
      for (var st of style)
        applyStyle(node as Element, st)
    } else {
      applyStyle(node as Element, st)
    }
  }
  // Class attributes and Style attributes are special and forwarded accross nodes and are thus
  // always added (unlike other attributes which are simply passed forward)

  return node
}
