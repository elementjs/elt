
import { sym_mixins } from './mixins'

export const sym_uninserted = Symbol('unmounted')

declare global {
  interface Node {
    [sym_uninserted]?: boolean
  }
}

/**
 * Call controllers' mount() functions.
 * @internal
 */
export function mount(node: Node) {
  var mx = node[sym_mixins]
  while (mx) {
    mx.mount(node)
    mx = mx.next_mixin
  }
}


/**
 * @internal
 */
export function mounting_inserted(node: Node) {
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
    n[sym_uninserted] = false // now inserted
    var mx = n[sym_mixins]
    while (mx) {
      mx.inserted(n)
      mx = mx.next_mixin
    }
  }
}


/**
 * Apply unmount to a node.
 * @internal
 */
function _apply_unmount(node: Node) {
  node[sym_uninserted] = true
  var mx = node[sym_mixins]
  while (mx) {
    mx.unmount(node)
    mx = mx.next_mixin
  }
}

/**
 * Call controller's unmount functions recursively
 * @category mounting
 */
export function unmount(node: Node) {

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
    _apply_unmount(tuple)
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
export function remove_and_unmount(node: Node): void {
  const parent = node.parentNode!
  if (parent) {
    unmount(node)
    var mx = node[sym_mixins]
    while (mx) {
      mx.removed(node, parent)
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
export function insert_before_and_mount(parent: Node, node: Node, refchild: Node | null = null) {
  var parent_is_inserted = !parent[sym_uninserted] // if parent_is_inserted, then we have to call inserted() on the added nodes.

  if (!(node instanceof DocumentFragment)) {
    var df = document.createDocumentFragment()
    df.appendChild(node)
    node = df
  }

  var iter = node.firstChild
  var to_insert = parent_is_inserted ? [] as Node[] : undefined
  while (iter) {
    mount(iter)
    if (parent_is_inserted) to_insert!.push(iter)
    iter = iter.nextSibling
  }

  parent.insertBefore(node, refchild)

  // now the elements are inserted, they're in the DOM. We should now call inserted() on them.
  if (parent_is_inserted) {
    for (var i = 0, l = to_insert!.length; i < l; i++) {
      var n = to_insert![i]
      mounting_inserted(n)
    }
  }
}


/**
 * Alias for `#insert_before_and_mount` that mimicks `Node.appendChild()`
 * @category mounting
 */
export function append_child_and_mount(parent: Node, child: Node) {
  insert_before_and_mount(parent, child)
}
