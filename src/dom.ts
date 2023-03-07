import { Display, DisplayComment } from "./elt"
import { o } from "./observable"
import type { ClassDefinition, StyleDefinition, Listener, Insertable, Attrs, Renderable } from "./types"

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
 * A symbol property on `Node` to an array of functions to run when the node is **inserted** into a document.
 * @internal
 */
export const sym_inserted = Symbol("elt-inserted")

/**
 * A symbol property on `Node` to an array of functions to run when the node is **removed** from a document.
 * @internal
 */
export const sym_removed = Symbol("elt-removed")

const NODE_IS_INSERTED =      0b001
const NODE_IS_OBSERVING =     0b010


export type LifecycleCallback<N = Node> = (n: N) => void

// Elt adds a few symbol properties on the nodes it creates.
declare global {

  interface Node {
    [sym_mount_status]: number // we cheat on the undefined as all masking operations as undefined is considered 0
    [sym_observers]?: o.Observer<any>[]

    [sym_inserted]?: LifecycleCallback[]
    [sym_removed]?: LifecycleCallback[]
  }
}


function _node_call_cbks(node: Node, sym: typeof sym_inserted | typeof sym_removed) {
  const cbks = node[sym]
  if (cbks) {
    for (let i = 0, l = cbks.length; i < l; i++) {
      cbks[i](node)
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


function _apply_inserted(node: Node) {

  const st = node[sym_mount_status] || 0

  node[sym_mount_status] = NODE_IS_INSERTED | NODE_IS_OBSERVING // now inserted

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
function _apply_removed(node: Node) {
  const st = node[sym_mount_status]

  node[sym_mount_status] = 0

  if (st & NODE_IS_OBSERVING) {
    _node_stop_observers(node)
  }

  if (st & NODE_IS_INSERTED) {
    _node_call_cbks(node, sym_removed)
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
export function node_do_remove(node: Node) {

  let iter = node.firstChild
  while (iter) { // first[sym_mount_status] & NODE_IS_INSERTED
    node_do_remove(iter)
    iter = iter.nextSibling
  }

  _apply_removed(node)
}


/**
 * Remove a `node` from the tree and call `removed` on its mixins and all the `removed` callbacks..
 *
 * This function is mostly used by verbs that don't want to wait for the mutation observer
 * callback registered in [[setup_mutation_observer]]
 *
 * @category low level dom, toc
 */
export function node_remove(node: Node): void {
  node_do_remove(node) // just stop observers otherwise...
  const parent = node.parentNode!
  if (parent) {
    parent.removeChild(node)
  }
}


/**
 * Remove all elements within a node and call the remove callback.
 * @category low level dom, toc
 */
export function node_clear(node: Node): void {
  while (node.firstChild) {
    const c = node.firstChild
    node.removeChild(c)
    node_do_remove(c)
  }
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
          node_do_remove(removed_node)
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
      node_do_remove(target_document.firstChild!)
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


const basic_attrs = new Set(["id", "slot", "part", "role", "tabindex", "lang", "inert", "title", "autofocus", "nonce"])


/**
 * Process an insertable and insert it where desired.
 *
 * @param node The parent to insert the node on
 * @param insertable The insertable that has to be handled
 * @param refchild The child before which to append
 */
export function node_append<N extends Node>(node: N, insertable: Insertable<N> | Attrs<N>, refchild: Node | null = null, is_basic_node = true) {
  if (insertable == null) return

  if (typeof insertable === "string") {
    // A simple string
    node.insertBefore(document.createTextNode(insertable), refchild)

  } else if (insertable instanceof Node) {
    // A node being added
    if (insertable.nodeType === 11) { // DocumentFragment
      let start = insertable.firstChild
      if (start == null) return // there are no children to append, nothing more to do

      node.insertBefore(insertable, refchild)

      if (node.isConnected) {
        do {
          node_do_inserted(start!)
          start = start!.nextSibling
        } while (start && start !== refchild)
      }
    } else {
      node.insertBefore(insertable, refchild)
      if (node.isConnected) {
        node_do_inserted(insertable)
      }
    }

  } else if (insertable instanceof Function) {
    // A decorator
    const res = insertable(node)
    if (res != null) node_append(node, res as Insertable<N>, refchild, is_basic_node)

  } else if (o.isReadonlyObservable(insertable)) {
    // An observable to display
    const disp = node.nodeType === 1 && ((node as unknown as Element).shadowRoot != null || (node as unknown as Element).namespaceURI === "http://www.w3.org/2000/svg") ?
      DisplayComment(insertable as o.Observable<Renderable>)
      : Display(insertable)

    node_append(node, disp, refchild, is_basic_node)

  } else if (Array.isArray(insertable)) {
    // An array of children
    for (let i = 0, l = insertable.length; i < l; i++)
      node_append(node, insertable[i], refchild, is_basic_node)

  } else if (insertable.constructor === Object) {
    // An attribute object. We assume this is an Element that is being handled
    const _node = node as unknown as HTMLElement
    const attrs = insertable as unknown as Attrs<HTMLElement>
    for (let key in attrs) {
      if (key === "class" && attrs.class) {
        const clss = attrs.class
        if (Array.isArray(clss))
          for (let j = 0, lj = clss.length; j < lj; j++) node_observe_class(_node, clss[j])
        else
          node_observe_class(_node, attrs.class!)
      } else if (key === "style" && attrs.style) {
        node_observe_style(_node, attrs.style)
      } else if (is_basic_node || basic_attrs.has(key)) {
        node_observe_attribute(_node, key, (attrs as any)[key])
      }
    }
  } else {
    // Otherwise, make it a string and append it.
    node.insertBefore(document.createTextNode(insertable.toString()), refchild)
  }
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
    if (immediate)
      obsfn(obs, o.NoValue)
    else
      node_on_inserted(node, () => obsfn(obs, o.NoValue))
    return null
  }
  // Create the observer and append it to the observer array of the node
  const obser = obs.createObserver(obsfn)
  if (observer_callback) observer_callback(obser)
  node_add_observer(node, obser)
  if (immediate) obser.refresh()
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
      node_observe(node, ob[x], (applied, chg) => {
        if (applied) _apply_class(node, x)
        else if (chg !== o.NoValue) _remove_class(node, x)
      }, undefined, true)
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
  let cs = c?.toString()
  if (!cs) return
  for (const _ of cs.split(/\s+/g)) {
    if (_) node.classList.add(_)
  }
}

function _remove_class(node: Element, c: string) {
  if (Array.isArray(c)) {
    for (let i = 0, l = c.length; i < l; i++) {
      _remove_class(node, c[i])
    }
    return
  }
  const cs = c?.toString()
  if (!cs) return
  for (const _ of cs.split(/\s+/g)) {
    if (_) node.classList.remove(_)
  }
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
  sym: typeof sym_inserted | typeof sym_removed,
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
  sym: typeof sym_inserted | typeof sym_removed,
  callback: LifecycleCallback<N>
) {
  const cbks = node[sym]
  if (cbks == null) return
  const idx = cbks.indexOf(callback as LifecycleCallback)
  if (idx > -1)
    cbks.splice(idx, 1)
}


export function animate(node: Element, keyframes: Keyframe[], options?: KeyframeAnimationOptions) {
  const animation = node.animate(keyframes, options)
  return new Promise<void>((accept, reject) => {
    animation.onfinish = (ev) => accept()
    animation.oncancel = (ev) => accept()
    animation.onremove = (ev) => reject(ev)
  })
}