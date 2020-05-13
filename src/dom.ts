import { o } from './observable'
import { Mixin } from './mixins'

/**
 * CSS Style attribute definition for the style={} attribute
 */
export type StyleDefinition =
  o.RO<Partial<CSSStyleDeclaration>>
  | o.ROProps<Partial<CSSStyleDeclaration>>

/**
 * CSS classes for the class={} attribute
 */
export type ClassDefinition = {[name: string]: o.RO<any>} | o.RO<string>

/**
 * Used with [[$on]] or [[Mixin#on]]
 */
export type Listener<EventType extends Event, N extends Node = Node> = (ev: EventType & { currentTarget: N }) => any

/**
 * Symbol property on `Node` to an array of observers that are started when the node is `init()` or `inserted()` and
 * stopped on `removed()`.
 * @category low level dom, toc
 */
export const sym_observers = Symbol('elt-observers')

/**
 * Symbol property added on `Node` to track the status of the node ; if it's been init(), inserted() or more.
 * Its value type is `string`.
 * @category low level dom, toc
 */
export const sym_mount_status = Symbol('elt-mount-status')

/**
 * This symbol is added as a property of the DOM nodes to store mixins associated with it.
 *
 * The more "correct" way of achieving this would have been to create
 * a WeakSet, but since the performance is not terrific (especially
 * when the number of elements gets high), the symbol solution was retained.
 * @category low level dom, toc
 */
export const sym_mixins = Symbol('elt-mixins')

/**
 * A symbol property on `Node` to an array of functions to run when the node is **init**, which is to
 * say usually right when it was created but already added to a parent (which can be a `DocumentFragment`).
 * @category low level dom, toc
 */
export const sym_init = Symbol('elt-init')

/**
 * A symbol property on `Node` to an array of functions to run when the node is **inserted** into a document.
 * @category low level dom, toc
 */
export const sym_inserted = Symbol('elt-inserted')

/**
 * A symbol property on `Node` to an array of functions to run when the node is **removed** from a document.
 * @category low level dom, toc
 */
export const sym_removed = Symbol('elt-removed')

const NODE_IS_INITED =        0x001
const NODE_IS_INSERTED =      0x010
const NODE_IS_OBSERVING =     0x100


// Elt adds a few symbol properties on the nodes it creates.
declare global {

  interface Node {
    [sym_mount_status]: number // we cheat on the undefined as all masking operations as undefined is considered 0
    [sym_mixins]?: Mixin<any>[]
    [sym_observers]?: o.Observer<any>[]

    // Note: the following section is somewhat "incorrect", as the correct typing here
    // would be (n: this) => void for the functions.
    // However, doing so then prevents some simple code like
    // var n: Node = some_node.nextSibling, since its sym_init would then be (n: ChildNode) => void.
    // This would cause too much code to break, so too bad, but we won't do that.

    [sym_init]?: ((n: Node, parent: Node) => void)[]
    [sym_inserted]?: ((n: Node, parent: Node) => void)[]
    [sym_removed]?: ((n: Node, parent: Node) => void)[]
  }
}


function _node_call_cbks(node: Node, sym: typeof sym_init | typeof sym_inserted | typeof sym_removed, parent?: Node) {
  var cbks = node[sym]
  parent = parent ?? node.parentNode!
  if (cbks) {
    for (var i = 0, l = cbks.length; i < l; i++) {
      cbks[i](node, parent)
    }
  }

  var mx = node[sym_mixins]
  if (mx) {
    if (sym === sym_init) {
      for (i = 0, l = mx.length; i < l; i++) {
        mx[i].init(node, parent)
      }
    } else if (sym === sym_inserted) {
      for (i = 0, l = mx.length; i < l; i++) {
        mx[i].inserted(node, parent)
      }
    } else if (sym === sym_removed) {
      for (i = 0, l = mx.length; i < l; i++) {
        mx[i].removed(node, parent)
      }
    }
  }
}


function _node_start_observers(node: Node) {
  var obs = node[sym_observers]
  if (obs) {
    for (var i = 0, l = obs.length; i < l; i++) {
      obs[i].startObserving()
    }
  }
  var mx = node[sym_mixins]
  if (mx) {
    for (i = 0, l = mx.length; i < l; i++) {
      mx[i].startObservers()
    }
  }
}


function _node_stop_observers(node: Node) {
  var obs = node[sym_observers]
  if (obs) {
    for (var i = 0, l = obs.length; i < l; i++) {
      obs[i].stopObserving()
    }
  }
  var mx = node[sym_mixins]
  if (mx) {
    for (i = 0, l = mx.length; i < l; i++) {
      mx[i].stopObservers()
    }
  }
}


/**
 * Return `true` if this node is currently observing its associated observables.
 * @category low level dom, toc
 */
export function node_is_observing(node: Node) {
  return !!(node[sym_mount_status] & NODE_IS_OBSERVING)
}


/**
 * Return `true` is the init() phase was already executed on this node.
 * @category low level dom, toc
 */
export function node_is_inited(node: Node) {
  return !!(node[sym_mount_status] & NODE_IS_INITED)
}


/**
 * Return `true` if the node is *considered* inserted in the document.
 *
 * There can be a slight variation between the result of this function and `node.isConnected`, since
 * its status is potentially updated after the node was inserted or removed from the dom, or could
 * have been forced to another value by a third party.
 *
 * @category low level dom, toc
 */
export function node_is_inserted(node: Node) {
  return !!(node[sym_mount_status] & NODE_IS_INSERTED)
}


/**
 * Call init() functions on a node, and start its observers.
 * @internal
 */
export function node_do_init(node: Node) {

  if (!(node[sym_mount_status] & NODE_IS_INITED)) {
    _node_call_cbks(node, sym_init)
    // We free the inits
    node[sym_init] = undefined
  }


  // _node_start_observers(node)
  // We now refresh all the observers so that they trigger their behaviour.
  // They are however not started, since nodes could be discarded.
  var observers = node[sym_observers]
  if (observers) {
    for (var i = 0, l = observers.length; i < l; i++) {
      observers[i].refresh()
    }
  }

  var mx = node[sym_mixins]
  if (mx) {
    for (var i = 0, l = mx.length; i < l; i++) {
      var mx_observers = mx[i]._observers
      for (var j = 0, lj = mx_observers.length; j < lj; j++) {
        mx_observers[j].refresh()
      }
    }
  }

  node[sym_mount_status] = NODE_IS_INITED
  // node[sym_mount_status] = NODE_IS_INITED | NODE_IS_OBSERVING
}


function _apply_inserted(node: Node) {

  var st = node[sym_mount_status] || 0

  // init if it was not done
  if (!(st & NODE_IS_INITED)) _node_call_cbks(node, sym_init)

  // restart observers
  if (!(st & NODE_IS_OBSERVING)) _node_start_observers(node)

  // then, call inserted.
  if (!(st & NODE_IS_INSERTED)) _node_call_cbks(node, sym_inserted)

  node[sym_mount_status] = NODE_IS_INITED | NODE_IS_INSERTED | NODE_IS_OBSERVING // now inserted
}


/**
 * @internal
 */
export function node_do_inserted(node: Node) {
  if (node[sym_mount_status] & NODE_IS_INSERTED) return

  var iter = node.firstChild as Node | null | undefined
  var stack = [] as Node[]

  _apply_inserted(node)

  while (iter) {
    var already_inserted = iter[sym_mount_status] & NODE_IS_INSERTED
    if (!already_inserted) {
      _apply_inserted(iter)
    }

    var first: ChildNode | null
    // we ignore an entire subtree if the node is already marked as inserted
    // in all other cases, the node will be inserted
    if (!already_inserted && (first = iter.firstChild)) {
      var next = iter.nextSibling // where we'll pick up when we unstack.
      if (next)
        stack.push(next)
      iter = first // we will keep going to the children
      continue
    } else if (iter.nextSibling) {
      iter = iter.nextSibling
      continue
    }

    iter = stack.pop()
  }
}


/**
 * Apply unmount to a node.
 * @internal
 */
function _apply_removed(node: Node, prev_parent: Node) {
  var st = node[sym_mount_status]

  if (st & NODE_IS_OBSERVING) {
    _node_stop_observers(node)
    st = st ^ NODE_IS_OBSERVING
  }

  if (st & NODE_IS_INSERTED) {
    _node_call_cbks(node, sym_removed)
    st = st ^ NODE_IS_INSERTED
  }

  node[sym_mount_status] = st
}

/**
 * Traverse the node tree of `node` and call the `removed()` handlers, begininning by the leafs and ending
 * on the root.
 *
 * If `prev_parent` is not supplied, then the `removed` is not run, but observers are stopped.
 *
 * @internal
 */
export function node_do_remove(node: Node, prev_parent: Node) {

  const node_stack: Node[] = []
  var iter: Node | null = node.firstChild

  while (iter) {

    var first: ChildNode | null
    while ((first = iter.firstChild) && (first[sym_mount_status] & NODE_IS_INSERTED)) {
      node_stack.push(iter)
      iter = first
    }

    _apply_removed(iter, iter.parentNode!)

    // When we're here, we're on a terminal node, so
    // we're going to have to process it.

    while (iter && !iter.nextSibling) {
      iter = node_stack.pop()!
      if (iter) _apply_removed(iter, iter.parentNode!)
    }

    // So now we're going to traverse the next node.
    iter = iter && iter.nextSibling
  }

  _apply_removed(node, prev_parent)
}


/**
 * Remove a `node` from the tree and call `removed` on its mixins and all the `removed` callbacks..
 *
 * This function is mostly used by verbs that don't want to wait for the mutation observer
 * callback registered in [[setup_mutation_observer]]
 *
 * @category low level dom, toc
 */
export function remove_node(node: Node): void {
  const parent = node.parentNode!
  if (parent) {
    parent.removeChild(node)
  }
  node_do_remove(node, parent) // just stop observers otherwise...
}


/**
 * This is where we keep track of the registered documents.
 * @internal
 */
const _registered_documents = new WeakSet<Document>()

/**
 * Setup the mutation observer that will be in charge of listening to document changes
 * so that the `init`, `inserted` and `removed` life-cycle callbacks are called.
 *
 * This should be the first thing done at the top level of a project using ELT.
 *
 * If the code opens another window, it **must** use `setup_mutation_observer` on the newly created
 * window's document or other `Node` that will hold the ELT application.
 *
 * This function also registers a listener on the `unload` event of the `document` or `ownerDocument`
 * to stop all the observers when the window closes.
 *
 * ```tsx
 * import { o, setup_mutation_observer, $inserted, $observe } from 'elt'
 * // typically in the top-level app.tsx or index.tsx of your project :
 * // setup_mutation_observer(document)
 *
 * const o_test = o(1)
 *
 * // This example may require a popup permission from your browser.
 * // Upon closing the window, the console.log will stop.
 * const new_window = window.open(undefined, '_blank', 'menubar=0,status=0,toolbar=0')
 * if (new_window) {
 *   setup_mutation_observer(new_window.document)
 *   new_window.document.body.appendChild(<div>
 *     {$inserted(() => console.log('inserted.'))}
 *     {$observe(o_test, t => console.log('window sees t:', t))}
 *     HELLO.
 *   </div>)
 * }
 *
 * setInterval(() => {
 *   o_test.mutate(t => t + 1)
 * }, 1000)
 *
 * @category dom, toc
 */
export function setup_mutation_observer(node: Node) {
  if (!node.isConnected && !!node.ownerDocument)
    throw new Error(`cannot setup mutation observer on a Node that is not connected in a document`)


  var obs = new MutationObserver(records => {
    for (var i = 0, l = records.length; i < l; i++) {
      var record = records[i]
      for (var added = Array.from(record.addedNodes), j = 0, lj = added.length; j < lj; j++) {
        var added_node = added[j]
        node_do_inserted(added_node)
      }
      for (var removed = Array.from(record.removedNodes), j = 0, lj = removed.length; j < lj; j++) {
        var removed_node = removed[j]
        node_do_remove(removed_node, record.target)
      }
    }
  })

  // Make sure that when closing the window, everything gets cleaned up
  const target_document = (node.ownerDocument ?? node) as Document

  if (!_registered_documents.has(target_document)) {
    target_document.defaultView?.addEventListener('unload', ev => {
      // Calls a `removed` on all the nodes in the closing window.
      node_do_remove(target_document.firstChild!, target_document)
      obs.disconnect()
    })
  }

  // observe modifications to *all the tree*
  obs.observe(node, {
    childList: true,
    subtree: true
  })

  return obs
}


/**
 * Insert a `node` to a `parent`'s child list before `refchild`, mimicking `Node.insertBefore()`.
 * This function is used by verbs and `e()` to run the `init()` and `inserted()` callbacks before
 * the mutation observer for performance reasons.
 *
 *  - Call the `init()` methods on `#Mixin`s present on the nodes that were not already mounted
 *  - Call the `inserted()` methods on `#Mixin`'s present on **all** the nodes and their descendents
 *     if `parent` is already inside the DOM.
 *
 * @category low level dom, toc
 */
export function insert_before_and_init(parent: Node, node: Node, refchild: Node | null = null) {
  var df: DocumentFragment

  if (!(node instanceof DocumentFragment)) {
    df = document.createDocumentFragment()
    df.appendChild(node)
  } else {
    df = node
  }

  var iter = df.firstChild
  while (iter) {
    node_do_init(iter)
    iter = iter.nextSibling
  }

  var first = df.firstChild
  var last = df.lastChild
  parent.insertBefore(df, refchild)

  // If the parent was in the document, then we have to call inserted() on all the
  // nodes we're adding.
  if (parent.isConnected && first && last) {
    iter = last
    // we do it in reverse because Display and the likes do it from previous to next.
    while (iter) {
      var next = iter.previousSibling
      node_do_inserted(iter)
      if (iter === first) break
      iter = next as ChildNode | null
    }
  }
}


/**
 * Alias for `#insert_before_and_mount` that mimicks `Node.appendChild()`
 * @category low level dom, toc
 */
export function append_child_and_init(parent: Node, child: Node) {
  insert_before_and_init(parent, child)
}


/**
 * Tie the observal of an `#Observable` to the presence of this node in the DOM.
 *
 * Used mostly by [[$observe]] and [[Mixin.observe]]
 *
 * @category low level dom, toc
 */
export function node_observe<T>(node: Node, obs: o.RO<T>, obsfn: o.Observer.Callback<T>, observer_callback?: (obs: o.Observer<T>) => any): o.Observer<T> | null {
  if (!(o.isReadonlyObservable(obs))) {
    // If the node is already inited, run the callback
    if (node[sym_mount_status] & NODE_IS_INITED)
      obsfn(obs, o.NoValue)
    else
      // otherwise, call it when inited
      node_on(node, sym_init, () => obsfn(obs, o.NoValue))
    return null
  }
  // Create the observer and append it to the observer array of the node
  var obser = obs.createObserver(obsfn)
  if (observer_callback) observer_callback(obser)
  node_add_observer(node, obser)
  return obser
}


/**
 * Associate an `observer` to a `node`. If the `node` is in the document, then
 * the `observer` is called as its [[o.Observable]] changes.
 *
 * If `node` is removed from the dom, then `observer` is disconnected from
 * its [[o.Observable]]. This helps in preventing memory leaks for those variables
 * that `observer` may close on.
 *
 * @category low level dom, toc
 */
export function node_add_observer<T>(node: Node, observer: o.Observer<T>) {
  if (node[sym_observers] == undefined)
    node[sym_observers] = []
  node[sym_observers]!.push(observer)
  if (node[sym_mount_status] & NODE_IS_OBSERVING) observer.startObserving()
}


/**
 * Attach an event `listener` to a `node`, where `event` can potentially be an array.
 *
 * The listener is typed as having `currentTarget` as the type of the node the event is added on, if known.
 *
 * Used mostly by [[Mixin.on]] and [[$on]]
 *
 * @category low level dom, toc
 */
export function node_add_event_listener<N extends Element, K extends (keyof DocumentEventMap)[]>(node: N, name: K, listener: Listener<DocumentEventMap[K[number]], N>, useCapture?: boolean): void
export function node_add_event_listener<N extends Element, K extends keyof DocumentEventMap>(node: N, event: K, listener: Listener<DocumentEventMap[K], N>, useCapture?: boolean): void
export function node_add_event_listener<N extends Element>(node: N, event: string | string[], listener: Listener<Event, N>, useCapture?: boolean): void
export function node_add_event_listener<N extends Node>(node: N, ev: string | string[], listener: Listener<Event, N>): void {
  if (Array.isArray(ev))
    // we have to force typescript's hands on the listener typing, as we **know** for certain that current_target
    // is the right type here.
    for (var e of ev) node.addEventListener(e, listener as any)
  else {
    node.addEventListener(ev, listener as any)
  }
}


/**
 * Stop a node from observing an observable, even if it is still in the DOM
 * @category low level dom, toc
 */
export function node_unobserve(node: Node, obsfn: o.Observer<any> | o.Observer.Callback<any>) {
  const is_observing = node[sym_mount_status] & NODE_IS_OBSERVING
  node[sym_observers] = node[sym_observers]?.filter(ob => {
    const res = ob === obsfn || ob.fn === obsfn
    if (res && is_observing) {
      // stop the observer before removing it from the list if the node was observing
      ob.stopObserving()
    }
    return !res
  })
}


/**
 * Observe an attribute and update the node as needed.
 * @category low level dom, toc
 */
export function node_observe_attribute(node: Element, name: string, value: o.RO<string | boolean>) {
  node_observe(node, value, val => {
    if (val === true)
      node.setAttribute(name, '')
    else if (val != null && val !== false)
      node.setAttribute(name, val)
    else
      // We can remove safely even if it doesn't exist as it won't raise an exception
      node.removeAttribute(name)
  })
}


/**
 * Observe a style (as JS defines it) and update the node as needed.
 * @category low level dom, toc
 */
export function node_observe_style(node: HTMLElement | SVGElement, style: StyleDefinition) {
  if (style instanceof o.Observable) {
    node_observe(node, style, st => {
      const ns = node.style
      var props = Object.keys(st)
      for (var i = 0, l = props.length; i < l; i++) {
        let x = props[i]
        ns.setProperty(x.replace(/[A-Z]/g, m => '-' + m.toLowerCase()), st[x])
      }
    })
  } else {
    // c is a MaybeObservableObject
    var st = style as any
    var props = Object.keys(st)
    for (var i = 0, l = props.length; i < l; i++) {
      let x = props[i]
      node_observe(node, st[x], value => {
        node.style.setProperty(x.replace(/[A-Z]/g, m => '-' + m.toLowerCase()), value)
      })
    }
  }
}


/**
 * Observe a complex class definition and update the node as needed.
 * @category low level dom, toc
 */
export function node_observe_class(node: Element, c: ClassDefinition) {
  if (!c) return
  if (typeof c === 'string' || c.constructor !== Object) {
    // c is an Observable<string>
    node_observe(node, c, (str, chg) => {
      if (chg !== o.NoValue) _remove_class(node, chg as string)
      _apply_class(node, str)
    })
  } else {
    var ob = c as { [name: string]: o.RO<any> }
    // c is a MaybeObservableObject
    var props = Object.keys(ob)
    for (var i = 0, l = props.length; i < l; i++) {
      let x = props[i]
      node_observe(node, ob[x], applied => applied ? _apply_class(node, x) : _remove_class(node, x))
    }
  }
}


function _apply_class(node: Element, c: ClassDefinition | ClassDefinition[] | null) {
  if (Array.isArray(c)) {
    for (var i = 0, l = c.length; i < l; i++) {
      _apply_class(node, c[i])
    }
    return
  }
  c = c == null ? null : c.toString()
  if (!c) return
  var is_svg = node instanceof SVGElement
  if (is_svg) {
    for (var _ of c.split(/\s+/g))
      if (_) node.classList.add(_)
  } else
    node.className += ' ' + c
}

function _remove_class(node: Element, c: string) {
  if (Array.isArray(c)) {
    for (var i = 0, l = c.length; i < l; i++) {
      _remove_class(node, c[i])
    }
    return
  }
  c = c == null ? null! : c.toString()
  if (!c) return
  var is_svg = node instanceof SVGElement
  var name = node.className
  for (var _ of c.split(/\s+/g))
    if (_) {
      if (is_svg)
        node.classList.remove(_)
      else
        name = name.replace(' ' + _, '')
    }
  if (!is_svg)
    node.setAttribute('class', name)
}


/**
 * Register a `callback` to be called for the life-cycle event `sym` on `node`.
 * [[$init]], [[$inserted]] and [[$removed]] are more commonly used, or alternatively [[Mixin#init]], [[Mixin#inserted]] or [[Mixin#removed]]
 *
 * This is mostly used internally.
 *
 * ```tsx
 * import { sym_inserted, node_on } from 'elt'
 *
 * var node = <div></div>
 * node_on(node, sym_inserted, (node, parent) => console.log('inserted'))
 *
 * // the former is achieved more easily by doing that:
 * import { $inserted } from 'elt'
 * <div>
 *   {$inserted((node, parent) => console.log('inserted'))}
 * </div>
 * ```
 *
 * @category low level dom, toc
 */
export function node_on<N extends Node>(
  node: N,
  sym: typeof sym_init | typeof sym_inserted | typeof sym_removed,
  callback: (n: N, parent: Node) => void
) {
  (node[sym] = node[sym] ?? []).push(callback as (n: Node, parent: Node) => void)
}


/**
 * Remove a previously associated `callback` from the life-cycle event `sym` for the `node`.
 * @category low level dom, toc
 */
export function node_off<N extends Node>(
  node: N,
  sym: typeof sym_init | typeof sym_inserted | typeof sym_removed,
  callback: (n: N, parent: Node) => void
) {
  (node[sym] = node[sym] ?? []).filter(f => f !== callback as (n: Node, parent: Node) => void)
}


/**
 * Remove all the nodes after `start` until `until` (included), calling `removed` and stopping observables as needed.
 * @category low level dom, toc
 */
export function node_remove_after(start: Node, until: Node | null) {
  if (!start) return

  var next: Node | null
  var parent = start.parentNode!
  while ((next = start.nextSibling)) {
    parent.removeChild(next)
    node_do_remove(next, parent)
    if (next === until) break
  }

}