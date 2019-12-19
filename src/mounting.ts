
import { sym_mixins } from './mixins'

export const sym_uninserted = Symbol('unmounted')

declare global {
  interface Node {
    [sym_uninserted]?: boolean
  }
}

/**
 * Call controllers' mount() functions.
 * @category mounting
 */
export function mount(node: Node) {
  var mx = node[sym_mixins]
  while (mx) {
    mx.mount(node)
    mx = mx.next_mixin
  }
}


/**
 *
 */
export function mounting_inserted(node: Node) {

}


/**
 * Apply unmount to a node.
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
 * A node.remove() alternative that synchronously calls _unmount
 * on it, to avoid situations where some observables that would trigger
 * a removal also trigger an error (like on .p() on a now inexistant property).
 *
 * It is advised though not mandatory to use this function instead of using
 * parent.removeChild() when possible.
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
 * An alternative way of inserting a child into the DOM that immediately calls
 * mount() on the node and its children.
 *
 * @param parent
 * @param node
 * @param refchild
 * @category mounting
 */
export function insert_before_and_mount(parent: Node, node: Node, refchild: Node | null = null) {
  var df = document.createDocumentFragment()
  df.appendChild(node)
  mount(node)
  parent.insertBefore(df, refchild)
}


/**
 * Alias for insert_before_and_mount
 * @category mounting
 */
export function append_child_and_mount(parent: Node, child: Node) {
  insert_before_and_mount(parent, child)
}
