
import {
  O,
  Observable
} from './observable'

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


/**
 * Call controller's mount() functions recursively
 */
function _mount(node: Node) {
  let controllers = Controller.all(node)
  if (!controllers) return

  for (var c of controllers) {
    for (var f of c.onmount) {
      f.call(c, node)
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
  let controllers = Controller.all(node)
  if (!controllers) return

  for (var c of controllers) {
    for (var f of c.onunmount) {
      f.call(c, node)
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


function _apply_class(node: Element, c: string) {
  c.split(/\s+/g).forEach(c => node.classList.add(c))
}

function _remove_class(node: Element, c: string) {
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
    node = document.createElement(elt)

    for (var x in attrs as any) {
      ct = applyAttribute(node as Element, x, (attrs as any)[x], ct)
    }

    // Append children to the node.
    if (children) {
      node.appendChild(getDocumentFragment(children))
    }

  } else if (typeof elt === 'function' && elt.prototype.render) {
    // elt is an instantiator
    let kls = elt as Instantiator<Component>
    comp = new kls(attrs)
    node = comp.render(getDocumentFragment(children))

  } else if (typeof elt === 'function') {
    // elt is just a creator function
    node = elt(attrs, getDocumentFragment(children))
  }
  controllers = Controller.init(node)

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
  if (comp) comp.bindToNode(node)
  controllers.forEach(c => c.onrender.forEach(r => r.call(c, node)))

  return node
}

d.createElement = d
