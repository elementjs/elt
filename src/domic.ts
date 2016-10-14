
import {
  O,
  Observable
} from 'stalkr'

import {
  ArrayOrSingle,
  BasicAttributes,
  Child,
  ClassObject,
  ClassDefinition,
  CreatorFn,
  Decorator,
  Instantiator,
  SingleChild,
  StyleDefinition,
} from './types'

import {
  Component,
  Controller,
  DefaultController,
  NodeControllerMap,
} from './controller'


/**
 * Call controller's mount() functions recursively
 */
function _mount(node: Node) {
  let controllers = NodeControllerMap.get(node)
  if (!controllers) return

  for (var c of controllers) {
    c.mounted = true
    for (var f of c.mountfns) {
      f()
    }
  }

  var ch = node.firstChild
  while (ch) {
    _mount(ch)
    ch = ch.nextSibling
  }
}


/**
 * Call controller's unmount functions recursively
 */
function _unmount(node: Node) {
  let controllers = NodeControllerMap.get(node)
  if (!controllers) return

  for (var c of controllers) {
    c.mounted = false
    for (var f of c.unmountfns) {
      f()
    }
  }

  var ch = node.firstChild
  while (ch) {
    _unmount(ch)
    ch = ch.nextSibling
  }
}


/**
 * Call mount and unmount on the node controllers.
 */
function applyMutations(records: MutationRecord[]) {
  var i = 0

  for (var record of records) {
    var added = record.addedNodes
    for (i = 0; i < added.length; i++)
      _mount(added[i])

    var removed = record.removedNodes
    for (i = 0; i < removed.length; i++)
      _unmount(removed[i])
  }
}


/**
 * Set up the mounting mechanism.
 *
 * @param node: the root node from which we will listen to the document
 *    mutations.
 */
export function setupMounting(node: Node): void {

  var mutator = new MutationObserver(applyMutations)

  mutator.observe(node, {
    subtree: true,
    childList: true
  })

}


/**
 *
 */
function applyClass(node: Element, c: ClassDefinition, ct: DefaultController): DefaultController {
  if (typeof c === 'string') {
    node.classList.add(c)
  } else if (c instanceof Observable) {
    if (!ct) ct = new DefaultController()
    let old_class: string = null
    ct.observe(c, str => {
      if (old_class) node.classList.remove(old_class)
      node.classList.add(str)
      old_class = str
    })
  } else {
    // c is an object
    for (let x in c) {
      if (c[x] instanceof Observable) {
        if (!ct) ct = new DefaultController()
        ct.observe(c[x], applied => applied ? node.classList.add(x) : node.classList.remove(x))
      } else {
        if (c[x])
          node.classList.add(x)
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
      node.setAttribute(name, val)
    })
  } else {
    node.setAttribute(name, value)
  }

  return ct

}


export interface D {
  (elt: CreatorFn, attrs: BasicAttributes, ...children: Child[]): Node
  (elt: Instantiator<Component>, attrs: BasicAttributes, ...children: Child[]): Node
  (elt: string, attrs: BasicAttributes, ...children: Child[]): Node

  createElement(elt: CreatorFn, attrs: BasicAttributes, ...children: Child[]): Node
}


function append(node: Node, c: SingleChild) {
  if (!(c instanceof Node)) {
    node.appendChild(document.createTextNode(typeof c === 'number' ? c.toString() : c))
  } else {
    node.appendChild(c)
  }
}

export const d: D = <D>function d(elt: any, attrs: BasicAttributes, ...children: Child[]): Node {

  let node: Node = null

  // Classes and style are applied at the end of this function and are thus
  // never passed to other node definitions.
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
  }

  if (typeof elt === 'string') {
    node = document.createElement(elt)
    controllers = []
    NodeControllerMap.set(node, controllers)

    for (var x in attrs as any) {
      ct = applyAttribute(node as Element, x, (attrs as any)[x], ct)
    }

    // Append children to the node.
    if (children) {
      for (var c of children as Child[]) {
        if (Array.isArray(c)) {
          for (var _ch of c)
            append(node, _ch)
        } else {
          append(node, c)
        }
      }
    }

  } else if (typeof elt === 'function' && elt.prototype.render) {
    // elt is an instantiator
    let kls = elt as Instantiator<Component>
    let c = new kls()
    c.attrs = attrs
    node = c.render(children)
    controllers = NodeControllerMap.get(node)
    controllers.push(c)


  } else if (typeof elt === 'function') {
    // elt is just a creator function
    node = elt(attrs, children)
    controllers = NodeControllerMap.get(node)
  }

  // decorators are run now. If class and style were defined, they will be applied to the
  // final node.
  if (decorators) {
    if (!Array.isArray(decorators)) decorators = [decorators]
    for (var d of decorators as Decorator[]) {
      d(node)
    }
  }

  // Class attributes and Style attributes are special and forwarded accross nodes and are thus
  // always added (unlike other attributes which are simply passed forward)
  if (cls) {
    if (Array.isArray(cls)) {
      for (var cl of cls)
        // oooo, ugly cast !
        ct = applyClass(node as Element, cl, ct)
    } else {
      ct = applyClass(node as Element, cls, ct)
    }
  }

  if (style) {
    if (Array.isArray(style)) {
      for (var st of style)
        ct = applyStyle(node as HTMLElement, st, ct)
    } else {
      ct = applyStyle(node as HTMLElement, style, ct)
    }
  }

  return node
}

d.createElement = d
