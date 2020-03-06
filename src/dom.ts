import { o } from './observable'
import { StyleDefinition, ClassDefinition } from './elt'
import { Mixin } from './mixins'

export type Listener<EventType extends Event, N extends Node = Node> = (ev: EventType & { currentTarget: N }) => any

/**
 * Symbol property on `Node` to an array of observers that are started when the node is `init()` and
 * stopped on `deinit()`.
 * @internal
 */
export const sym_observers = Symbol('elt-observers')

/**
 * Symbol property added on `Node` to track the status of the node ; if it's been init(), inserted() or more.
 * Its value type is `string`.
 * @internal
 */
export const sym_mount_status = Symbol('elt-mount-status')

/**
 * This symbol is added as a property of the DOM nodes to store mixins associated with it.
 *
 * The more "correct" way of achieving this would have been to create
 * a WeakSet, but since the performance is not terrific (especially
 * when the number of elements gets high), the symbol solution was retained.
 * @internal
 */
export const sym_mixins = Symbol('elt-mixins')

/**
 * A symbol property on `Node` to an array of functions to run when the node is **init**, which is to
 * say usually right when it was created but already added to a parent (which can be a `DocumentFragment`).
 * @internal
 */
export const sym_init = Symbol('elt-init')

/**
 * A symbol property on `Node` to an array of functions to run when the node is **inserted** into a document.
 * @internal
 */
export const sym_inserted = Symbol('elt-inserted')

/**
 * A symbol property on `Node` to an array of functions to run when the node is **removed** from a document.
 * @internal
 */
export const sym_removed = Symbol('elt-removed')

const NODE_IS_INITED = 0x01
const NODE_IS_INSERTED = 0x10
const NODE_IS_OBSERVING = 0x100


// Elt adds a few symbol properties on the nodes it creates.
declare global {

  interface Node {
    [sym_mount_status]: number // we cheat on the undefined as all masking operations as undefined is considered 0
    [sym_mixins]?: Mixin<any>
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
  if (!cbks) return

  parent = parent ?? node.parentNode!
  for (var i = 0, l = cbks.length; i < l; i++) {
    cbks[i](node, parent)
  }
}


function _node_start_observers(node: Node) {
  var obs = node[sym_observers]
  if (!obs) return
  for (var i = 0, l = obs.length; i < l; i++) {
    obs[i].startObserving()
  }
}


function _node_stop_observers(node: Node) {
  var obs = node[sym_observers]
  if (!obs) return
  for (var i = 0, l = obs.length; i < l; i++) {
    obs[i].stopObserving()
  }
}


/**
 * Return `true` if this node is currently observing its associated observables.
 */
export function node_is_observing(node: Node) {
  return !!(node[sym_mount_status] & NODE_IS_OBSERVING)
}


/**
 * Return `true` is the init() phase was already executed on this node.
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
 * @category dom, toc
 */
export function node_is_inserted(node: Node) {
  return !!(node[sym_mount_status] & NODE_IS_INSERTED)
}


/**
 * Call init() functions on a node, and start its observers.
 * @category internal
 */
export function node_do_init(node: Node) {

  // if there is anything in the status, it means the node was inited before,
  // so we don't do that again.
  if (!(node[sym_mount_status] & NODE_IS_INITED))
    _node_call_cbks(node, sym_init)

  if (!(node[sym_mount_status] & NODE_IS_OBSERVING))
    // call init functions
    _node_start_observers(node)

  node[sym_mount_status] = NODE_IS_INITED | NODE_IS_OBSERVING
}


function _apply_inserted(node: Node) {

  var st = node[sym_mount_status] || 0

  // init if it was not done
  if (!(st & NODE_IS_INITED)) _node_call_cbks(node, sym_init)

  // restart observers
  if (!(st & NODE_IS_OBSERVING)) _node_start_observers(node)

  // then, call inserted.
  if (!(st & NODE_IS_INSERTED)) {
    _node_call_cbks(node, sym_inserted)
  }

  node[sym_mount_status] = NODE_IS_INITED | NODE_IS_INSERTED | NODE_IS_OBSERVING // now inserted
}


/**
 * @category internal
 */
export function node_do_inserted(node: Node) {
  if (node[sym_mount_status] & NODE_IS_INSERTED) return

  var iter = node.firstChild as Node | null | undefined
  var stack = [] as Node[]
  // We build here a stack where parents are added first and children last

  _apply_inserted(node)

  while (iter) {
    // we ignore an entire subtree if the node is already marked as inserted
    // in all other cases, the node will be inserted
    if (!(iter[sym_mount_status] & NODE_IS_INSERTED)) {
      _apply_inserted(iter)

      var first = iter.firstChild
      if (first) {
        var next = iter.nextSibling // where we'll pick up when we unstack.
        if (next)
          stack.push(next)
        iter = first // we will keep going to the children
        continue
      } else if (iter.nextSibling) {
        iter = iter.nextSibling
        continue
      }
    }

    iter = stack.pop()
  }
}


/**
 * Apply unmount to a node.
 * @internal
 */
function _apply_removed(node: Node, prev_parent: Node | null) {
  var st = node[sym_mount_status]

  if (st & NODE_IS_OBSERVING) {
    _node_stop_observers(node)
    st = st ^ NODE_IS_OBSERVING
  }

  if (prev_parent && st & NODE_IS_INSERTED) {
    _node_call_cbks(node, sym_removed)
    st = st ^ NODE_IS_INSERTED
  }

  node[sym_mount_status] = st
}

/**
 * Traverse the node tree of `node` and call the `deinit()` handlers, begininning by the leafs and ending
 * on the root.
 *
 * If `prev_parent` is not supplied, then the `remove` is not run, but observers stop.
 *
 * @category dom, toc
 */
export function node_do_remove(node: Node, prev_parent: Node | null) {

  const node_stack: Node[] = []
  var iter: Node | null = node.firstChild

  while (iter) {

    while (iter.firstChild) {
      node_stack.push(iter)
      iter = iter.firstChild
    }

    _apply_removed(iter, prev_parent ? iter.parentNode! : null)
    if (prev_parent)

    // When we're here, we're on a terminal node, so
    // we're going to have to process it.

    while (iter && !iter.nextSibling) {
      iter = node_stack.pop()!
      if (iter) _apply_removed(iter, prev_parent ? iter.parentNode! : null)
    }

    // So now we're going to traverse the next node.
    iter = iter && iter.nextSibling
  }

  _apply_removed(node, prev_parent)
}


/**
 * Remove a `node` from the DOM and call `removed` on its mixins as well as `deinit` on itself
 * and all its children's Mixins.
 *
 * Prefer using it over `Node.removeChild` or `Node.remove()` as not unmounting Mixins will leave
 * `#o.Observable`s still being watched and lead to memory leaks.
 *
 * @param node The node to remove from the DOM
 * @category dom, toc
 */
export function remove_and_deinit(node: Node): void {
  const parent = node.parentNode!
  if (parent) {
    // (m as any).node = null
    parent.removeChild(node)
    node_do_remove(node, parent)
  } else {
    node_do_remove(node, null) // just deinit otherwise...
  }
}


/**
 * Setup the mutation observer that will be in charge of listening to document changes
 * so that the `init`, `inserted`, `deinit` and `removed` hooks are called on the nodes
 * as needed.
 *
 * This should be the first thing done when importing
 */
export function setup_mutation_observer(node: Node) {
  if (!node.isConnected)
    throw new Error(`cannot setup mutation observer on a Node that is not connected in a document`)

  var obs = new MutationObserver(records => {
    for (var i = 0, l = records.length; i < l; i++) {
      var record = records[i]
      for (var added = Array.from(record.addedNodes), j = 0, lj = added.length; j < lj; j++) {
        var added_node = added[j]

        // skip this node if it is already marked as inserted, as it means verbs already
        // have performed the mounting for this element
        if (added_node[sym_mount_status] & NODE_IS_INSERTED) {
          continue
        }
        node_do_inserted(added_node)
      }
      for (var removed = Array.from(record.removedNodes), j = 0, lj = removed.length; j < lj; j++) {
        var removed_node = removed[j]
        node_do_remove(removed_node, record.target)
      }
    }
  })

  // Make sure that when closing the window, everything gets cleaned up
  ;(node.ownerDocument ?? node).addEventListener('unload', ev => {
    node_do_remove(node, null) // technically, the nodes were not removed, but we want to at least shut down all observers.
    obs.disconnect()
  })

  // observe modifications to *all the tree*
  obs.observe(node, {
    childList: true,
    subtree: true
  })

  return obs
}


/**
 * Insert a `node` to a `parent`'s child list before `refchild`.
 *
 * This method should **always** be used instead of `Node.appendChild` or `Node.insertBefore` when
 * dealing with nodes created with `#e`, as it performs the following operations on top of adding
 * them :
 *
 *  - Call the `init()` methods on `#Mixin`s present on the nodes that were not already mounted
 *  - Call the `inserted()` methods on `#Mixin`'s present on **all** the nodes and their descendents
 *     if `parent` is already inside the DOM.
 *
 * @category dom, toc
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
 * @category dom, toc
 */
export function append_child_and_init(parent: Node, child: Node) {
  insert_before_and_init(parent, child)
}


/**
 * Tie the observal of an `#Observable` to the presence of this node in the DOM.
 *
 * Observers are called whenever the observable changes **and** the node is contained
 * in the document.
 *
 * @category dom, toc
 */
export function node_observe<T>(node: Node, obs: o.RO<T>, obsfn: o.Observer.ObserverFunction<T>): o.Observer<T> | null {
  if (!(o.isReadonlyObservable(obs))) {
    obsfn(obs, new o.Changes(obs))
    return null
  }
  // Create the observer and append it to the observer array of the node
  var obser = obs.createObserver(obsfn)
  if (node[sym_observers] == undefined)
    node[sym_observers] = []
  node[sym_observers]!.push(obser)

  if (node[sym_mount_status] & NODE_IS_OBSERVING) obser.startObserving() // this *may* be a problem ? FIXME TODO
  // we might need to track the mounting status of a node.
  return obser
}


export function node_add_event_listener<N extends Element, K extends (keyof DocumentEventMap)[]>(node: N, name: K, listener: Listener<DocumentEventMap[K[number]], N>, useCapture?: boolean): void
export function node_add_event_listener<N extends Element, K extends keyof DocumentEventMap>(node: N, event: K, listener: Listener<DocumentEventMap[K], N>, useCapture?: boolean): void
export function node_add_event_listener<N extends Element>(node: N, event: string | string[], listener: Listener<Event, N>, useCapture?: boolean): void
export function node_add_event_listener<N extends Node>(node: N, ev: any, listener: Listener<Event, N>): void {
  if (Array.isArray(ev))
    for (var e of ev) node.addEventListener(e, listener as any)
  else {
    node.addEventListener(ev, listener as any)
  }
}


/**
 * Stop a node from observing an observable, even if it is still in the DOM
 * @category dom, toc
 */
export function node_unobserve(node: Node, obsfn: o.Observer<any> | o.Observer.ObserverFunction<any>) {
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
 * @category dom, toc
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
 * @category dom, toc
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
 * @category dom, toc
 */
export function node_observe_class(node: Element, c: ClassDefinition) {
  if (!c) return
  if (typeof c === 'string' || c.constructor !== Object) {
    // c is an Observable<string>
    node_observe(node, c, (str, chg) => {
      if (chg.hasOldValue()) _remove_class(node, chg.oldValue() as string)
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


function _apply_class(node: Element, c: any) {
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
 * Register a callback to be called on one of the life-cycle events provided by elt.
 * In general, [`$init()`](#$init), [`$inserted()`](#inserted), [`$deinit()`](#$deinit) and [`$removed()`](#$removed) are more commonly used.
 *
 * ```tsx
 * import { sym_inserted, node_on } from 'elt'
 *
 * var node = <div></div>
 * node_on(node, sym_inserted, (n, parent) => {
 *   console.log('do something')
 * })
 * ```
 *
 * @category dom, toc
 */
export function node_on<N extends Node>(
  node: N,
  sym: typeof sym_init | typeof sym_inserted | typeof sym_removed,
  fn: (n: N, parent: Node) => void
) {
  (node[sym] = node[sym] ?? []).push(fn as (n: Node, parent: Node) => void)
}


/**
 * @category dom, toc
 */
export function node_off<N extends Node>(
  node: N,
  sym: typeof sym_init | typeof sym_inserted | typeof sym_removed,
  fn: (n: N, parent: Node) => void
) {
  (node[sym] = node[sym] ?? []).filter(f => f !== fn as (n: Node, parent: Node) => void)
}


/**
 * Remove all the nodes after `start` until `until` (included), calling `removed` and `deinit` as needed.
 * @category dom, toc
 */
export function node_remove_after(start: Node, until: Node | null) {
  if (!start) return

  var next: Node | null
  while ((next = start.nextSibling)) {
    remove_and_deinit(next)
    if (next === until) break
  }

}