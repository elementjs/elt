
import {
  O,
  Observable
} from './observable'

import {
  ArrayOrSingle,
  BasicAttributes,
  Child,
  ClassObject,
  ClassDefinition,
  ComponentFn,
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

export interface ComponentInterface<A> {
  attrs: A
  render(children: Child[]): Node
}

export interface ComponentInstanciator<A> {
  new (...a: any[]): ComponentInterface<A>
}


export interface D {
  (elt: ComponentFn, attrs: BasicAttributes, ...children: Child[]): Node
  (elt: string, attrs: BasicAttributes, ...children: Child[]): Node
  <A>(elt: ComponentInstanciator<A>, attrs: A, ...children: Child[]): Node

  createElement(elt: ComponentFn, attrs: BasicAttributes, ...children: Child[]): Node
}


/**
 *
 */
export function getChildren(children: Child[]) {
  var result = document.createDocumentFragment()

  for (var c of children) {
    _foreach(c, c => {
      if (!(c instanceof Node)) {
        result.appendChild(document.createTextNode(typeof c === 'number' ? c.toString() : c))
      } else {
        result.appendChild(c)
      }
    })
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


/**
 * The main instantiation function, used throughout all of Domic.
 */
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
      node.appendChild(getChildren(children))
    }

  } else if (typeof elt === 'function' && elt.prototype.render) {
    // elt is an instantiator
    let kls = elt as Instantiator<Component>
    let c = new kls()
    c.attrs = attrs
    node = c.render(getChildren(children))
    c.setNode(node)
    controllers = NodeControllerMap.get(node)
    if (!controllers) {
      controllers = []
      NodeControllerMap.set(node, controllers)
    }
    controllers.push(c)


  } else if (typeof elt === 'function') {
    // elt is just a creator function
    node = elt(attrs, children)
    controllers = NodeControllerMap.get(node)
  }

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

  return node
}

d.createElement = d
