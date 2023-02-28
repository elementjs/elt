import { o } from "./observable"
import type { ClassDefinition, StyleDefinition, Listener } from "./types"

/**
 * Symbol property on `Node` to an array of observers that are started when the node is `init()` or `inserted()` and
 * stopped on `removed()`.
 * @internal
 */
export const sym_observers = Symbol("elt-observers")

/**
 * Symbol property added on `Node` to track the status of the node ; if it's been init(), inserted() or more.
 * Its value type is `string`.
 * @internal
 */
export const sym_mount_status = Symbol("elt-mount-status")

/**
 * This symbol is added as a property of the DOM nodes to store mixins associated with it.
 *
 * The more "correct" way of achieving this would have been to create
 * a WeakSet, but since the performance is not terrific (especially
 * when the number of elements gets high), the symbol solution was retained.
 * @internal
 */
export const sym_objects = Symbol("elt-mixins")

/**
 * A symbol property on `Node` to an array of functions to run when the node is **init**, which is to
 * say usually right when it was created but already added to a parent (which can be a `DocumentFragment`).
 * @internal
 */
export const sym_init = Symbol("elt-init")

/**
 * A symbol property on `Node` to an array of functions to run when the node is **inserted** into a document.
 * @internal
 */
export const sym_inserted = Symbol("elt-inserted")

/**
 * A symbol property on `Node` to an array of functions to run when the node is **removed** from a document.
 * @internal
 */
export const sym_removed = Symbol("elt-removed")

const NODE_IS_INITED =        0x001
const NODE_IS_INSERTED =      0x010
const NODE_IS_OBSERVING =     0x100


export type LifecycleCallback<N = Node> = (n: N, parent: Node) => void

// Elt adds a few symbol properties on the nodes it creates.
declare global {

  interface Node {
    [sym_mount_status]: number // we cheat on the undefined as all masking operations as undefined is considered 0
    [sym_objects]?: object[]
    [sym_observers]?: o.Observer<any>[]

    [sym_init]?: LifecycleCallback[]
    [sym_inserted]?: LifecycleCallback[]
    [sym_removed]?: LifecycleCallback[]
  }
}


function _node_call_cbks(node: Node, sym: typeof sym_init | typeof sym_inserted | typeof sym_removed, parent?: Node) {
  const cbks = node[sym]
  parent = parent ?? node.parentNode!
  if (cbks) {
    for (let i = 0, l = cbks.length; i < l; i++) {
      cbks[i](node, parent)
    }
  }

}


function _node_start_observers(node: Node) {
  const obs = node[sym_observers]
  if (obs) {
    for (let i = 0, l = obs.length; i < l; i++) {
      obs[i].startObserving()
    }
  }
}


function _node_stop_observers(node: Node) {
  const obs = node[sym_observers]
  if (obs) {
    for (let i = 0, l = obs.length; i < l; i++) {
      obs[i].stopObserving()
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
  const observers = node[sym_observers]
  if (observers) {
    for (let i = 0, l = observers.length; i < l; i++) {
      observers[i].refresh()
    }
  }

  node[sym_mount_status] = NODE_IS_INITED
  // node[sym_mount_status] = NODE_IS_INITED | NODE_IS_OBSERVING
}


function _apply_inserted(node: Node) {

  const st = node[sym_mount_status] || 0

  node[sym_mount_status] = NODE_IS_INITED | NODE_IS_INSERTED | NODE_IS_OBSERVING // now inserted

  // init if it was not done
  if (!(st & NODE_IS_INITED)) _node_call_cbks(node, sym_init)

  // restart observers
  if (!(st & NODE_IS_OBSERVING)) _node_start_observers(node)

  // then, call inserted.
  if (!(st & NODE_IS_INSERTED)) _node_call_cbks(node, sym_inserted)
}


/**
 * @internal
 */
export function node_do_inserted(node: Node) {
  if (node[sym_mount_status] & NODE_IS_INSERTED) return

  _apply_inserted(node)
  let iter = node.firstChild
  while (iter) {
    node_do_inserted(iter)
    iter = iter.nextSibling
  }
}


/**
 * Apply unmount to a node.
 * @internal
 */
function _apply_removed(node: Node, prev_parent: Node) {
  const st = node[sym_mount_status]

  node[sym_mount_status] = st ^ NODE_IS_OBSERVING ^ NODE_IS_INSERTED

  if (st & NODE_IS_OBSERVING) {
    _node_stop_observers(node)
  }

  if (st & NODE_IS_INSERTED) {
    _node_call_cbks(node, sym_removed, prev_parent)
  }
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

  let iter = node.firstChild
  while (iter) { // first[sym_mount_status] & NODE_IS_INSERTED
    node_do_remove(iter, node)
    iter = iter.nextSibling
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
 * @code ../examples/setup_mutation_observer.tsx
 *
 * @category dom, toc
 */
export function setup_mutation_observer(node: Node) {
  if (!node.isConnected && !!node.ownerDocument && !(node instanceof ShadowRoot))
    throw new Error("cannot setup mutation observer on a Node that is not connected in a document")


  const obs = new MutationObserver(records => {
    for (let i = 0, l = records.length; i < l; i++) {
      const record = records[i]
      for (let removed = record.removedNodes, j = 0, lj = removed.length; j < lj; j++) {
        const removed_node = removed[j]
        if (!removed_node.isConnected) {
          node_do_remove(removed_node, record.target)
        }
      }
      for (let added = record.addedNodes, j = 0, lj = added.length; j < lj; j++) {
        const added_node = added[j]
        node_do_inserted(added_node)
      }
    }
  })

  // Make sure that when closing the window, everything gets cleaned up
  const target_document = (node.ownerDocument ?? node) as Document

  if (!_registered_documents.has(target_document)) {
    target_document.defaultView?.addEventListener("unload", () => {
      // Calls a `removed` on all the nodes in the closing window.
      node_do_remove(target_document.firstChild!, target_document)
      obs.disconnect()
    })
  }

  // observe modifications to *all the tree*
  obs.observe(node, {
    childList: true,
    subtree: true,
  })

  node_do_inserted(node)

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
  let df: DocumentFragment

  if (!(node instanceof DocumentFragment)) {
    df = document.createDocumentFragment()
    df.appendChild(node)
  } else {
    df = node
  }

  let iter = df.firstChild
  while (iter) {
    node_do_init(iter)
    iter = iter.nextSibling
  }

  const first = df.firstChild
  const last = df.lastChild
  parent.insertBefore(df, refchild)

  // If the parent was in the document, then we have to call inserted() on all the
  // nodes we're adding.
  if (parent.isConnected && first && last) {
    iter = last
    // we do it in reverse because Display and the likes do it from previous to next.
    while (iter) {
      const next = iter.previousSibling
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
 * Tie the observal of an `#Observable` to the presence of this `node` in the DOM.
 *
 * Used mostly by [[$observe]] and [[Mixin.observe]]
 *
 * @category low level dom, toc
 */
export function node_observe<T>(node: Node, obs: o.RO<T>, obsfn: o.Observer.Callback<T>, observer_callback?: (obs: o.Observer<T>) => any, immediate = false): o.Observer<T> | null {
  if (!(o.isReadonlyObservable(obs))) {
    // If the node is already inited, run the callback
    if (immediate || node[sym_mount_status] & NODE_IS_INITED)
      obsfn(obs, o.NoValue)
    else
      node_on_inserted(node, () => obsfn(obs, o.NoValue))
    return null
  }
  // Create the observer and append it to the observer array of the node
  const obser = obs.createObserver(obsfn)
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
export function node_add_event_listener<N extends Node, K extends (keyof GlobalEventHandlersEventMap)[]>(node: N, name: K, listener: Listener<GlobalEventHandlersEventMap[K[number]], N>, useCapture?: boolean): void
export function node_add_event_listener<N extends Node, K extends keyof GlobalEventHandlersEventMap>(node: N, event: K, listener: Listener<GlobalEventHandlersEventMap[K], N>, useCapture?: boolean): void
export function node_add_event_listener<N extends Node>(node: N, event: string | string[], listener: Listener<Event, N>, useCapture?: boolean): void
export function node_add_event_listener<N extends Node>(node: N, ev: string | string[], listener: Listener<Event, N>): void {
  if (Array.isArray(ev))
    // we have to force typescript's hands on the listener typing, as we **know** for certain that current_target
    // is the right type here.
    for (const e of ev) node.addEventListener(e, listener as any)
  else {
    node.addEventListener(ev, listener as any)
  }
}


/**
 * Dispatch a CustomEvent from this node that bubbles and is composed (to traverse ShadowRoots) and cancelable.
 *
 * @param node The node to dispatch the current event from
 * @param event_name The name of the event
 * @param options Additional options, such as { detail }
 * @returns The newly created event
 */
export function node_dispatch(node: Node, event_name: string, options?: CustomEventInit) {
  const event = new CustomEvent(event_name, {
    bubbles: true,
    cancelable: true,
    composed: true,
    detail: {},
    ...options
  });

  node.dispatchEvent(event);

  return event;
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
    if (val === true) {
      if (node.getAttribute(name) !== "") node.setAttribute(name, "")
    } else if (val != null && val !== false) {
      if (val !== node.getAttribute(name)) node.setAttribute(name, val)
    } else {
      // We can remove safely even if it doesn't exist as it won't raise an exception
      node.removeAttribute(name)
    }
  }, undefined, true)

  // If an element gets its attribute set by another source, then update the Observable.
  // Note : This might not be a desired feature.
  if (value instanceof o.Observable) {
    const mo = new MutationObserver(recs => {
      for (let i = 0, l = recs.length; i < l; i++) {
        try {
          value.set?.(node.getAttribute(name)!)
        } catch (e) { console.warn(e) }
      }
    })
    node_on_inserted(node, _ => {
      mo.observe(node, { attributes: true, attributeFilter: [name] })
    })
    node_on_removed(node, _ => {
      mo.disconnect()
    })
  }
}


/**
 * Observe a style (as JS defines it) and update the node as needed.
 * @category low level dom, toc
 */
export function node_observe_style(node: HTMLElement | SVGElement, style: StyleDefinition) {
  if (style instanceof o.Observable) {
    node_observe(node, style, st => {
      const ns = node.style
      const props = Object.keys(st)
      for (let i = 0, l = props.length; i < l; i++) {
        const x = props[i]
        const value = st[x as any] as any
        ns.setProperty(x.replace(/[A-Z]/g, m => "-" + m.toLowerCase()), value)
      }
    }, undefined, true)
  } else {
    // c is a MaybeObservableObject
    const st = style as any
    const props = Object.keys(st)
    for (let i = 0, l = props.length; i < l; i++) {
      const x = props[i]
      node_observe(node, st[x], value => {
        node.style.setProperty(x.replace(/[A-Z]/g, m => "-" + m.toLowerCase()), value)
      }, undefined, true)
    }
  }
}


/**
 * Observe a complex class definition and update the node as needed.
 * @category low level dom, toc
 */
export function node_observe_class(node: Element, c: ClassDefinition) {
  if (!c) return
  if (typeof c === "string" || c.constructor !== Object) {
    // c is an Observable<string>
    node_observe(node, c, (str, chg) => {
      if (chg !== o.NoValue) _remove_class(node, chg as string)
      _apply_class(node, str)
    }, undefined, true)
  } else {
    const ob = c as { [name: string]: o.RO<any> }
    // c is a MaybeObservableObject
    const props = Object.keys(ob)
    for (let i = 0, l = props.length; i < l; i++) {
      const x = props[i]
      node_observe(node, ob[x], applied => applied ? _apply_class(node, x) : _remove_class(node, x), undefined, true)
    }
  }
}


function _apply_class(node: Element, c: ClassDefinition | ClassDefinition[] | null) {
  if (Array.isArray(c)) {
    for (let i = 0, l = c.length; i < l; i++) {
      _apply_class(node, c[i])
    }
    return
  }
  c = c == null ? null : c.toString()
  if (!c) return
  const is_svg = node instanceof SVGElement
  if (is_svg) {
    for (const _ of c.split(/\s+/g))
      if (_) node.classList.add(_)
  } else
    node.className += " " + c
}

function _remove_class(node: Element, c: string) {
  if (Array.isArray(c)) {
    for (let i = 0, l = c.length; i < l; i++) {
      _remove_class(node, c[i])
    }
    return
  }
  c = c == null ? null! : c.toString()
  if (!c) return
  const is_svg = node instanceof SVGElement
  let name = node.className
  for (const _ of c.split(/\s+/g))
    if (_) {
      if (is_svg)
        node.classList.remove(_)
      else
        name = name.replace(" " + _, "")
    }
  if (!is_svg)
    node.setAttribute("class", name)
}

/**
 * Run a `callback` whenever this `node` goes through the init lifecycle event.
 * @category low level dom, toc
 * @param node
 * @param callback
 */
export function node_on_init<N extends Node>(node: N, callback: LifecycleCallback<N>) {
  node_on(node, sym_init, callback)
}

/**
 * Run a `callback` whenever this `node` is inserted into the DOM.
 * @category low level dom, toc
 * @param node
 * @param callback
 */
export function node_on_inserted<N extends Node>(node: N, callback: LifecycleCallback<N>) {
  node_on(node, sym_inserted, callback)
}

/**
 * Run a `callback` whenever this `node` is removed from the dom.
 * @category low level dom, toc
 * @param node
 * @param callback
 */
export function node_on_removed<N extends Node>(node: N, callback: LifecycleCallback<N>) {
  node_on(node, sym_removed, callback)
}

/**
 * Unregister a previously registered `callback` for the init lifecycle event of this `node`.
 * @category low level dom, toc
 * @param node
 * @param callback
 */
export function node_off_init<N extends Node>(node: N, callback: LifecycleCallback<N>) {
  node_off(node, sym_init, callback)
}

/**
 * Unregister a previously registered `callback` for the inserted lifecycle event of this `node`.
 * @category low level dom, toc
 * @param node
 * @param callback
 */
export function node_off_inserted<N extends Node>(node: N, callback: LifecycleCallback<N>) {
  node_off(node, sym_inserted, callback)
}

/**
 * Unregister a previously registered `callback` for the removed lifecycle event of this `node`.
 * @category low level dom, toc
 * @param node
 * @param callback
 */
export function node_off_removed<N extends Node>(node: N, callback: LifecycleCallback<N>) {
  node_off(node, sym_removed, callback)
}

/* @internal */
function node_on<N extends Node>(
  node: N,
  sym: typeof sym_init | typeof sym_inserted | typeof sym_removed,
  callback: LifecycleCallback<N>
) {
  const cbks = (node[sym] ??= [])
  cbks.push(callback as LifecycleCallback)
}


/**
 * Remove a previously associated `callback` from the life-cycle event `sym` for the `node`.
 * @internal
 */
function node_off<N extends Node>(
  node: N,
  sym: typeof sym_init | typeof sym_inserted | typeof sym_removed,
  callback: LifecycleCallback<N>
) {
  const cbks = node[sym]
  if (cbks == null) return
  const idx = cbks.indexOf(callback as LifecycleCallback)
  if (idx > -1)
    cbks.splice(idx, 1)
}
