import { o } from './observable'
import { e } from './elt'
import { Mixin } from './mixins'

export const sym_observers = Symbol('observers')
export const sym_mount_status = Symbol('sym_mount_status')
/**
 * This symbol is added as a property of the DOM nodes to store
 * an array of mixins.
 *
 * The more "correct" way of achieving this would have been to create
 * a WeakSet, but since the performance is not terrific (especially
 * when the number of elements gets high), the symbol solution was retained.
 */
export const sym_mixins = Symbol('element-mixins')

declare global {
  interface Node {
    [sym_mount_status]?: 'init' | 'inserted' // note : unmounted is the same as undefined as far as elt knows.
    [sym_mixins]?: Mixin<any>
  }
}

/**
 * Call controllers' mount() functions.
 * @internal
 */
export function node_init(node: Node) {
  var mx = node[sym_mixins]
  node[sym_mount_status] = 'init'
  while (mx) {
    (mx as any).node = node
    mx.init?.(node)
    mx = mx.next_mixin
  }
  var obs = node[sym_observers]
  if (obs) {
    for (var i = 0, l = obs.length; i < l; i++) {
      obs[i].startObserving()
    }
  }
}


/**
 * @internal
 */
export function node_inserted(node: Node) {
  var nodes = [node] as Node[] // the nodes we will have to tell they're inserted

  var iter = node.firstChild as Node | null | undefined
  var stack = [] as Node[]
  // We build here a stack where parents are added first and children last
  while (iter) {
    nodes.push(iter) // always push the current node
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
    } else {
      // no first child, no next sibling, just unpack the stack
      iter = stack.pop()
    }
  }

  // Call inserted on the node list we just built.
  for (var i = 0, l = nodes.length; i < l; i++) {
    var n = nodes[i]
    n[sym_mount_status] = 'inserted' // now inserted
    var mx = n[sym_mixins]
    while (mx) {
      mx.inserted?.(n)
      mx = mx.next_mixin
    }
  }
}


/**
 * Apply unmount to a node.
 * @internal
 */
function _apply_removed(node: Node) {
  var obs = node[sym_observers]
  if (obs) {
    for (var i = 0, l = obs.length; i < l; i++) {
      obs[i].stopObserving()
    }
  }
  node[sym_mount_status] = undefined
  var mx = node[sym_mixins]
  while (mx) {
    mx.deinit?.(node)
    mx = mx.next_mixin
  }
}

/**
 * Call controller's unmount functions recursively
 * @category mounting
 */
export function node_removed(node: Node) {

  const unmount: Node[] = []
  const node_stack: Node[] = []
  var iter: Node | null = node.firstChild

  // We need to store all the nodes for which we'll call unmount() beforehand,
  // as an unmount() handler may further remove nodes that were already
  // unmounted from the DOM and which could be missed if we naively traversed
  // the unmounted children.
  //
  // The array construction is done iteratively for performance considerations.
  while (iter) {

    // Push firstChildren first
    while (iter.firstChild) {
      node_stack.push(iter)
      iter = iter.firstChild
    }

    unmount.push(iter)

    // When we're here, we're on a terminal node, so
    // we're going to have to process it.

    while (iter && !iter.nextSibling) {
      iter = node_stack.pop()!
      if (iter)
        unmount.push(iter)
    }

    // So now we're going to traverse the next node.
    iter = iter && iter.nextSibling
  }

  unmount.push(node)

  for (var tuple of unmount) {
    _apply_removed(tuple)
  }

}


/**
 * Remove a `node` from the DOM and call `removed` on its mixins as well as `deinit` on itself
 * and all its children's Mixins.
 *
 * Prefer using it over `Node.removeChild` or `Node.remove()` as not unmounting Mixins will leave
 * `#o.Observable`s still being watched and lead to memory leaks.
 *
 * @param node The node to remove from the DOM
 * @category mounting
 */
export function remove_and_deinit(node: Node): void {
  const parent = node.parentNode!
  if (parent) {
    node_removed(node)
    var mx = node[sym_mixins]
    while (mx) {
      mx.removed?.(node, parent)
      mx = mx.next_mixin
    }
    // (m as any).node = null
    parent.removeChild(node)
  }
}


/**
 * Insert a `node` to a `parent`'s child list before `refchild`.
 *
 * This method should **always** be used instead of `Node.appendChild` or `Node.insertBefore` when
 * dealing with nodes created with `#e`, as it performs the following operations on top of adding
 * them :
 *
 *  - Call the `mount()` methods on `#Mixin`s present on the nodes that were not already mounted
 *  - Call the `inserted()` methods on `#Mixin`'s present on **all** the nodes and their descendents
 *     if `parent` is already inside the DOM.
 *
 * @category mounting
 */
export function insert_before_and_init(parent: Node, node: Node, refchild: Node | null = null) {
  var parent_is_inserted = !parent[sym_mount_status] // if parent_is_inserted, then we have to call inserted() on the added nodes.

  if (!(node instanceof DocumentFragment)) {
    var df = document.createDocumentFragment()
    df.appendChild(node)
    node = df
  }

  var iter = node.firstChild
  var to_insert = parent_is_inserted ? [] as Node[] : undefined
  while (iter) {
    node_init(iter)
    if (parent_is_inserted) to_insert!.push(iter)
    iter = iter.nextSibling
  }

  parent.insertBefore(node, refchild)

  // now the elements are inserted, they're in the DOM. We should now call inserted() on them.
  if (parent_is_inserted) {
    // If this symbol is undefined, it means the parent was most likely not created by elt.
    // We check that its document events are handled by us.
    for (var i = 0, l = to_insert!.length; i < l; i++) {
      var n = to_insert![i]
      node_inserted(n)
    }
  }
}


/**
 * Alias for `#insert_before_and_mount` that mimicks `Node.appendChild()`
 * @category mounting
 */
export function append_child_and_init(parent: Node, child: Node) {
  insert_before_and_init(parent, child)
}

declare global {
  interface Node {
    [sym_observers]?: o.Observer<any>[]
  }
}

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
  if (node[sym_mount_status]) obser.startObserving() // this *may* be a problem ? FIXME TODO
  // we might need to track the mounting status of a node.
  return obser
}

export function node_unobserve(node: Node, obsfn: o.Observer<any> | o.Observer.ObserverFunction<any>) {
  node[sym_observers] = node[sym_observers]?.filter(ob => {
    const res = ob === obsfn || ob.fn === obsfn
    if (res) {
      ob.stopObserving()
    }
    return res
  })
}

/**
 *
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

export function node_observe_style(node: HTMLElement | SVGElement, style: e.JSX.StyleDefinition) {
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

export function node_observe_class(node: Element, c: e.JSX.ClassDefinition) {
  if (!c) return
  if (typeof c === 'string' || c.constructor !== Object) {
    // c is an Observable<string>
    node_observe(node, c, (str, chg) => {
      if (chg.hasOldValue()) _remove_class(node, chg.oldValue() as string)
      _apply_class(node, str)
    })
  } else {
    var ob = c as {[name: string]: o.RO<any>}
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
 * Remove a Mixin from the array of mixins associated with this Node.
 * @param node The node the mixin will be removed from
 * @param mixin The mixin object we want to remove
 */
export function node_remove_mixin(node: Node, mixin: Mixin): void {
  var mx = node[sym_mixins]
  if (!mx) return
  if (mx === mixin) {
    node[sym_mixins] = mixin.next_mixin
  } else {
    var iter = mx
    while (iter) {
      if (iter.next_mixin === mixin) {
        iter.next_mixin = mixin.next_mixin
        return
      }
    }
  }
}


/**
 * Associate a `mixin` to a `node`.
 *
 * All it does is add it to the chained list of mixins accessible on `node[sym_mixins]` and
 * set `mixin.node` to the corresponding node.
 *
 * In general, to add a mixin to a node, prefer adding it to its children.
 *
 * ```tsx
 * var my_mixin = new Mixin()
 *
 * // these are equivalent
 * <div>{my_mixin}</div>
 * var d = <div/>; node_add_mixin(d, mixin);
 * ```
 */
export function node_add_mixin(node: Node, mixin: Mixin): void {
  mixin.next_mixin = node[sym_mixins]
  node[sym_mixins] = mixin
  mixin.node = node
}


/**
 * Remove all the nodes between `start` (included) and `end` (not included), calling `removed` and `unmount` if needed.
 * @category helper
 */
export function node_remove_between(start: Node, end: Node) {
  // this is done in reverse order
  var iter = start as Node | null

  if (!iter) return

  while (iter && iter !== end) {
    var next = iter.nextSibling as Node | null
    remove_and_deinit(iter!)
    iter = next
  }

}