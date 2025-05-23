import { o } from "./observable"
import type { ClassDefinition, StyleDefinition, Listener, Inserter, Attrs, Renderable, } from "./types"
import { sym_connected_status, sym_observers, sym_connected, sym_disconnected, sym_insert, sym_attrs, } from "./symbols"

const NODE_IS_CONNECTED =      0b001
const NODE_IS_OBSERVING =     0b010

export type LifecycleCallback<N = Node> = (n: N) => void

declare global {
  interface Node {
    [sym_connected_status]: number // we cheat on the undefined as all masking operations as undefined is considered 0
    [sym_observers]?: o.Observer<any>[]

    [sym_connected]?: LifecycleCallback[]
    [sym_disconnected]?: LifecycleCallback[]
  }
}


/**
 * The comment holder is a class meant to help verbs and observables maintain nodes between two comments.
 */
export class CommentHolder extends Comment {

  end: Comment | null = null

  /** Change and update this nodes' content */
  updateRenderable(renderable: Renderable<Node>) {
    const parent = this.parentNode!

    if (this.end != null) {
      const end = this.end
      while (this.nextSibling != null && this.nextSibling !== end) {
        node_remove(this.nextSibling)
      }
    } else {
      this.end = document.createComment(this.textContent??"!")
      node_append(parent, this.end, this.nextSibling)
    }

    node_append(parent, renderable, this.nextSibling)
  }

  /** Remove the node and its handled content from the DOM */
  remove() {
    if (this.end != null) {
      const end = this.end
      while (this.nextSibling != null && this.nextSibling !== end) {
        node_remove(this.nextSibling)
      }
      node_remove(this.end)
      node_remove(this)
    }
  }

  /** Move this node and its contents to a new destination */
  moveTo(parent: Node, refchild: Node | null = null) {
    parent.insertBefore(this, refchild)
    const end = this.end
    if (end == null) {
      return
    }
    let iter = this as Node | null
    let next: Node | null = this.nextSibling as Node | null
    do {
      iter = next
      if (iter == null) { break }
      next = iter.nextSibling
      parent.insertBefore(iter, refchild)
      if (iter === end) { break }
    } while (true)
  }
}


function _node_call_cbks(node: Node, sym: typeof sym_connected | typeof sym_disconnected) {
  const cbks = node[sym]
  if (cbks) {
    for (let i = 0, l = cbks.length; i < l; i++) {
      try {
        cbks[i](node)
      } catch(e) {
        // Callbacks should
        console.error("connected/disconnected callbacks should not throw", e)
      }
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
 * @group Dom
 */
export function node_is_observing(node: Node) {
  return !!(node[sym_connected_status] & NODE_IS_OBSERVING)
}


/**
 * Return `true` if the node is *considered* inserted in the document.
 *
 * There can be a slight variation between the result of this function and `node.isConnected`, since
 * its status is potentially updated after the node was inserted or removed from the dom, or could
 * have been forced to another value by a third party.
 *
 * @group Dom
 */
export function node_is_connected(node: Node) {
  return !!(node[sym_connected_status] & NODE_IS_CONNECTED)
}


function _apply_connected(node: Node) {

  const st = node[sym_connected_status] || 0

  node[sym_connected_status] = NODE_IS_CONNECTED | NODE_IS_OBSERVING // now inserted

  // restart observers
  if (!(st & NODE_IS_OBSERVING)) _node_start_observers(node)

  // then, call inserted.
  if (!(st & NODE_IS_CONNECTED)) _node_call_cbks(node, sym_connected)
}


/**
 * @internal
 */
export function node_do_connected(node: Node) {
  if (node[sym_connected_status] & NODE_IS_CONNECTED) return

  _apply_connected(node)
  let iter = node.firstChild
  while (iter) {
    node_do_connected(iter)
    iter = iter.nextSibling
  }
}


/**
 * Apply unmount to a node.
 * @internal
 */
function _apply_disconnected(node: Node) {
  const st = node[sym_connected_status]

  node[sym_connected_status] = 0

  if (st & NODE_IS_OBSERVING) {
    _node_stop_observers(node)
  }

  if (st & NODE_IS_CONNECTED) {
    _node_call_cbks(node, sym_disconnected)
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
export function node_do_disconnect(node: Node) {

  let iter = node.firstChild
  while (iter) {
    node_do_disconnect(iter)
    iter = iter.nextSibling
  }

  _apply_disconnected(node)
}


/**
 * Remove a `node` from the tree and call `removed` on its mixins and all the `removed` callbacks..
 *
 * This function is mostly used by verbs that don't want to wait for the mutation observer
 * callback registered in {@link setup_mutation_observer}
 *
 * @group Dom
 */
export function node_remove(node: Node): void {
  node_do_disconnect(node) // just stop observers otherwise...
  const parent = node.parentNode!
  if (parent) {
    parent.removeChild(node)
  }
}


/**
 * Remove all elements within a node and call the remove callback.
 * @group Dom
 */
export function node_clear(node: Node): void {
  while (node.firstChild) {
    const c = node.firstChild
    node.removeChild(c)
    node_do_disconnect(c)
  }
}


/**
 * This is where we keep track of the registered documents.
 * @internal
 */
const _registered_documents = new WeakSet<Document>()

/**
 * Setup the mutation observer that will be in charge of listening to document changes
 * so that the `connected` and `disconnected` life-cycle callbacks are called.
 *
 * Only to be used when nodes will be appended by a third party library that won't call the hooks otherwise.
 *
 * ```tsx
 * [[include:../examples/setup_mutation_observer.tsx]]
 * ```
 *
 * @group Dom
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
          node_do_disconnect(removed_node)
        }
      }
      for (let added = record.addedNodes, j = 0, lj = added.length; j < lj; j++) {
        const added_node = added[j]
        node_do_connected(added_node)
      }
    }
  })

  // Make sure that when closing the window, everything gets cleaned up
  const target_document = (node.ownerDocument ?? node) as Document

  if (!_registered_documents.has(target_document)) {
    target_document.defaultView?.addEventListener("unload", () => {
      // Calls a `removed` on all the nodes in the closing window.
      node_do_disconnect(target_document.firstChild!)
      obs.disconnect()
    })
  }

  // observe modifications to *all the tree*
  obs.observe(node, {
    childList: true,
    subtree: true,
  })

  node_do_connected(node)

  return obs
}


const basic_attrs = new Set(["id", "slot", "part", "role", "tabindex", "lang", "inert", "title", "autofocus", "nonce"])


function is_inserter(ins: any): ins is Inserter<Node> {
  return typeof ins?.[sym_insert] === "function"
}


/**
 * Process an insertable and insert it where desired.
 *
 * @param node The parent to insert the node on
 * @param renderable The insertable that has to be handled
 * @param refchild The child before which to append
 * @group Dom
 */
export function node_append<N extends Node>(node: N, renderable: Renderable<N> | Attrs<N>, refchild: Node | null = null, is_basic_node = true) {
  if (renderable == null || renderable === false) return

  if (typeof renderable === "string") {
    // A simple string
    node.insertBefore(document.createTextNode(renderable), refchild)

  } else if (renderable instanceof Node) {
    // A node being added
    if (renderable.nodeType === Node.DOCUMENT_FRAGMENT_NODE) { // DocumentFragment
      let start = renderable.firstChild
      if (start == null) return // there are no children to append, nothing more to do

      node.insertBefore(renderable, refchild)

      if (node.isConnected) {
        do {
          node_do_connected(start!)
          start = start!.nextSibling
        } while (start && start !== refchild)
      }
    } else {

      node.insertBefore(renderable, refchild)
      if (node.isConnected) {
        node_do_connected(renderable)
      }
    }

  } else if (renderable instanceof Function) {
    // A decorator
    const res = renderable(node)
    if (res != null) node_append(node, res as Inserter<N>, refchild, is_basic_node)

  } else if (is_inserter(renderable)) {

    renderable[sym_insert](node, refchild)

  } else if (typeof (renderable as any)[Symbol.iterator] === "function") {
    // An array of children
    for (const item of renderable as Iterable<N>) {
      node_append(node, item, refchild, is_basic_node)
    }

  } else if (renderable.constructor === Object) {
    // An attribute object. We assume this is an Element that is being handled
    const _node = node as unknown as HTMLElement
    const attrs = renderable as unknown as Attrs<HTMLElement>
    for (let key in attrs) {
      const value = attrs[key as keyof typeof attrs]
      if (key === "class") {
        if (value == null || value === false) continue
        if (Array.isArray(value))
          for (let j = 0, lj = value.length; j < lj; j++) node_observe_class(_node, value[j])
        else
          node_observe_class(_node, value as ClassDefinition)
      } else if (key === "style") {
        if (value == null || value === false) continue
        node_observe_style(_node, value as StyleDefinition)
      } else if (is_basic_node || basic_attrs.has(key)) {
        node_observe_attribute(_node, key, (attrs as any)[key])
      }
    }
  } else if (typeof (renderable as any).then === "function") {
    const _pro = renderable as Promise<Renderable<N>>
    const cmt = document.createComment("promise-loading")
    node.insertBefore(cmt, refchild)
    _pro.then(res => {
      if (!cmt.parentNode) return
      node_append(cmt.parentNode as unknown as N, res, cmt)
      cmt.textContent = "promise-resolved"
    }).catch(e => {
      console.error(e)
      cmt.textContent = "promise-error: " + e.toString()
    })
  } else {
    // Otherwise, make it a string and append it.
    node.insertBefore(document.createTextNode(renderable.toString()), refchild)
  }
}


export interface $ShadowOptions extends Partial<ShadowRootInit> {
  css?: string | CSSStyleSheet | (CSSStyleSheet | string)[]
}

/**
 * Attach a shadow root and insert a child on it.
 *
 * Mostly, a DocumentFragment is expected for `child`.
 *
 * If css is provided on opts, adds the sheets onto the shadowroot, by adopting them if available on the browser or adding <style> nodes.
 *
 * @internal
 * @param node The node to create a shadow on
 * @param child The child to add onto the shadow root once created
 * @param opts Options for the creation of the shadow root
 * @param add_callbacks Whether to add inserted/removed callbacks (when not using EltCustomElement for instance)
 */
export function node_attach_shadow(node: HTMLElement, child: Node, opts: $ShadowOptions, add_callbacks: boolean) {

  const shadow = node.attachShadow({
    mode: opts?.mode ?? "open",
    delegatesFocus: opts?.delegatesFocus ?? true,
    slotAssignment: opts?.slotAssignment ?? "named",
  })

  let css = opts?.css
  if (css != null) {
    if (!Array.isArray(css)) { css = [css] }
    const sheets = css.filter(c => c instanceof CSSStyleSheet) as CSSStyleSheet[]
    if (sheets.length) shadow.adoptedStyleSheets = [...shadow.adoptedStyleSheets, ...sheets]
    const strings = css.filter(c => typeof c === "string")
    if (strings.length) {
      const style = document.createElement("style")
      style.append(strings.join("\n"))
      shadow.insertBefore(style, null)
    }
  }

  shadow.insertBefore(opts == null ? opts as Node : child as Node, null)

  if (add_callbacks) {
    node_on_connected(node, () => {
      node_do_connected(shadow)
    })

    node_on_disconnected(node, () => {
      node_do_disconnect(shadow)
    })
  }

  return shadow
}

/**
 * Tie the observal of an `#Observable` to the presence of this `node` in the DOM.
 *
 * Used mostly by {@link $observe} and {@link Mixin.observe}
 *
 * @group Dom
 */
export function node_observe<T>(
  node: Node,
  obs: o.RO<T>,
  obsfn: o.ObserverCallback<T>,
  options?: o.ObserveOptions<T>
): o.Observer<T> | null {
  if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
    console.warn("observing on a fragment does nothing")
    return null
  }

  if (!(o.isReadonlyObservable(obs))) {
    // If the node is already inited, run the callback
    if (!options?.changes_only) {
      if (options?.immediate)
        obsfn(obs as T, o.NoValue)
      else
        node_on_connected(node, () => obsfn(obs as T, o.NoValue))
    }
    return null
  }
  // Create the observer and append it to the observer array of the node
  const obser = options?.changes_only ? new o.SilentObserver(obsfn, obs) : new o.Observer(obsfn, obs)
  options?.observer_callback?.(obser)
  node_add_observer(node, obser)
  if (options?.immediate) obser.refresh()
  return obser
}


/**
 * Associate an `observer` to a `node`. If the `node` is in the document, then
 * the `observer` is called as its {@link o.Observable} changes.
 *
 * If `node` is removed from the dom, then `observer` is disconnected from
 * its {@link o.Observable}. This helps in preventing memory leaks for those variables
 * that `observer` may close on.
 *
 * @group Dom
 */
export function node_add_observer<T>(node: Node, observer: o.Observer<T>) {
  if (node[sym_observers] == undefined)
    node[sym_observers] = []
  node[sym_observers]!.push(observer)
  if (node[sym_connected_status] & NODE_IS_OBSERVING) observer.startObserving()
}

declare global {
  interface GlobalEventHandlersEventMap {
    // [x: string]: Event
  }
}

export type KEvent = keyof GlobalEventHandlersEventMap

export type EventForKey<K extends KEvent> =
  K extends keyof GlobalEventHandlersEventMap ? GlobalEventHandlersEventMap[K]
  : Event

export type EventsForKeys<K extends KEvent | KEvent[]> =
  K extends any[] ? EventForKey<K[number]>
  : K extends KEvent ? EventForKey<K>
  : Event

export function node_add_event_listener<N extends Node, K extends KEvent | KEvent[]>(node: N, key: K, listener: Listener<EventsForKeys<K>, N>, useCapture?: boolean | AddEventListenerOptions): void
export function node_add_event_listener<N extends EventTarget, K extends KEvent | KEvent[]>(node: Node, target: N, key: K, listener: Listener<EventsForKeys<K>, N>, useCapture?: boolean | AddEventListenerOptions): void
export function node_add_event_listener(node: any, target: any, events: any, listener?: any, use_capture?: any): void {

  if (typeof target === "string" || Array.isArray(target)) {
    // This is the short version, target is the events
    use_capture = listener
    listener = events
    events = target
    target = node // now both target and node have the same value
  }

  function add_listener(event: string, listener: Listener<any>) {
    function add() { target.addEventListener(event, listener, use_capture) }
    // If the targeted node is not the same, then we *must* remove the event listener if the node observing the events goes away. Otherwise, we get memory leaks.
    node_on_connected(node, add)
    if (node.isConnected) add()
    node_on_disconnected(node, () => { target.removeEventListener(event, listener, use_capture) })
  }

  if (Array.isArray(events)) {
    for (let i = 0, l = events.length; i < l; i++) {
      const event = events[i]
      add_listener(event, listener, )
    }
  } else {
    add_listener(events, listener)
  }

}


/**
 * Stop a `node` from observing an observable, or an observer, or an observer function.
 * @returns The number of deactivated observers
 * @group Dom
 */
export function node_unobserve(node: Node, obsfn: o.Observer<any> | o.ObserverCallback<any> | o.Observable<any>) {
  const is_observing = node[sym_connected_status] & NODE_IS_OBSERVING
  const prev_len = node[sym_observers]?.length ?? 0
  node[sym_observers] = node[sym_observers]?.filter(ob => {
    const res = ob === obsfn || ob.fn === obsfn || ob.observable === obsfn
    if (res && is_observing) {
      // stop the observer before removing it from the list if the node was observing
      ob.stopObserving()
    }
    return !res
  })

  return prev_len - (node[sym_observers]?.length??0)
}


/**
 * Set an attribute value on a node. If the provided `value` is an observable, the node will then observe it and change the attribute accordingly.
 *
 * If `value` is a string, the attribute is changed on the node and is observable on the dom. If it is `true`, the attribute is set with an empty string. If it is `false` or nullish, it is removed entirely.
 *
 * If `value` is any other type, it will update the property of the same name on the target node. This is mostly useful when defining custom elements to expose selected properties directly to elt.
 *
 * Caveat: if you wish to expose custom elements to the outside world, be sure to only expose properties this way that are not essential for your component to work, as these non-string properties will most likely not be accessible by anything other than elt. This way of working is for convenience only and for typechecking purposes.
 *
 * This does not do the reverse : if the node decides to change the attribute value, the observable is not notified. This could be achieved using a MutationObserver.
 *
 * @group Dom
 */
export function node_observe_attribute(node: Element, name: string, value: o.RO<string | boolean | null | undefined | number>) {

  // Try to see if we're setting an attribute on an EltCustomElement. This will bypass the setAttribute logic to allow other values than string.
  const custom_attrs = node[sym_attrs]?.get(name)
  if (custom_attrs != null) {
    // Set the value without trying to interpret it.
    node_observe(node, value, val => {
      node.setAttribute(name, value as any)
    }, { immediate: true })

    return
  }

  // Regular setAttribute logic
  node_observe(node, value, val => {
    if (val == null || val === false) {
      node.removeAttribute(name)
      return
    }
    if (val === true) {
      if (node.getAttribute(name) !== "") node.setAttribute(name, "")
    } else {
      if (val !== node.getAttribute(name)) node.setAttribute(name, val.toString())
    }
  }, { immediate: true })
}


/**
 * Observe a style (as JS defines it) and update the node as needed.
 * @group Dom
 */
export function node_observe_style(node: HTMLElement | SVGElement, style: StyleDefinition) {
  if (o.is_observable(style)) {
    node_observe(node, style, st => {
      if (st == null)
      if (typeof st === "string") {
        node.setAttribute("style", st)
        return
      }

      const ns = node.style
      const props = Object.keys(st)
      for (let i = 0, l = props.length; i < l; i++) {
        const x = props[i]
        const css_name = x.replace(/[A-Z]/g, m => "-" + m.toLowerCase())
        const value = st[x as any] as any
        if (value) {
          ns.setProperty(css_name, value)
        } else {
          ns.removeProperty(css_name)
        }
      }
    }, { immediate: true })
  } else if (typeof style === "string") {
    node.setAttribute("style", style)
  } else {
    // c is a MaybeObservableObject
    const st = style as any
    const props = Object.keys(st)
    for (let i = 0, l = props.length; i < l; i++) {
      const x = props[i]
      const css_name = x.replace(/[A-Z]/g, m => "-" + m.toLowerCase())
      node_observe(node, st[x], value => {
        if (!value) {
          node.style.removeProperty(css_name)
        } else {
          node.style.setProperty(css_name, value)
        }
      }, { immediate: true })
    }
  }
}


/**
 * Observe a complex class definition and update the node as needed.
 * @group Dom
 */
export function node_observe_class(node: Element, c: ClassDefinition) {
  if (!c) return
  if (typeof c === "string" || typeof c === "boolean" || c.constructor !== Object) {
    // c is an Observable<string>
    node_observe(node, c, (str, chg) => {
      if (chg !== o.NoValue && !!chg) _remove_class(node, chg as string)
      if (!!str) _apply_class(node, str)
    }, { immediate: true })
  } else {
    const ob = c as { [name: string]: o.RO<any> }
    // c is a MaybeObservableObject
    const props = Object.keys(ob)
    for (let i = 0, l = props.length; i < l; i++) {
      const x = props[i]
      node_observe(node, ob[x], (applied, chg) => {
        if (applied) _apply_class(node, x)
        else if (chg !== o.NoValue) _remove_class(node, x)
      }, { immediate: true })
    }
  }
}


function _apply_class(node: Element, c: ClassDefinition | ClassDefinition[] | null | false) {
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
 * @group Dom
 * @param node
 * @param callback
 */
export function node_on_connected<N extends Node>(node: N, callback: LifecycleCallback<N>) {
  node_on(node, sym_connected, callback)
}

/**
 * Run a `callback` whenever this `node` is removed from the dom.
 * @group Dom
 * @param node
 * @param callback
 */
export function node_on_disconnected<N extends Node>(node: N, callback: LifecycleCallback<N>) {
  node_on(node, sym_disconnected, callback)
}


/**
 * Unregister a previously registered `callback` for the inserted lifecycle event of this `node`.
 * @group Dom
 * @param node
 * @param callback
 */
export function node_off_connected<N extends Node>(node: N, callback: LifecycleCallback<N>) {
  node_off(node, sym_connected, callback)
}

/**
 * Unregister a previously registered `callback` for the removed lifecycle event of this `node`.
 * @group Dom
 * @param node
 * @param callback
 */
export function node_off_disconnected<N extends Node>(node: N, callback: LifecycleCallback<N>) {
  node_off(node, sym_disconnected, callback)
}

/* @internal */
function node_on<N extends Node>(
  node: N,
  sym: typeof sym_connected | typeof sym_disconnected,
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
  sym: typeof sym_connected | typeof sym_disconnected,
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