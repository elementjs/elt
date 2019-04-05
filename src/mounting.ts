
import {getMixins} from './mixins'

export const mnsym = Symbol('element-mounted')

declare global {
  interface Node {
    [mnsym]: boolean
  }
}


export function _apply_mount(node: Node) {
  (node as any)[mnsym] = true
  var mx = getMixins(node)
  if (!mx) return
  for (var m of mx)
    m.mount(node)
}

/**
 * Call controllers' mount() functions.
 */
export function mount(node: Node) {
  // mount was already applied
  if ((node as any)[mnsym] === true) return
  _apply_mount(node)
}


// node, parent, previous, next
export type UnmountTuple = [Node, Node | null, Node | null, Node | null]


/**
 * Apply unmount to a node.
 */
export function _apply_unmount(tuple: UnmountTuple) {
  var node = tuple[0] as any;
  node[mnsym] = false
  var mx = getMixins(node)

  if (!mx) return
  for (var m of mx) m.unmount(tuple[0] as Element, tuple[1]!, tuple[2], tuple[3])
}

/**
 * Call controller's unmount functions recursively
 */
export function unmount(node: Node, target: Node, prev: Node | null, next: Node | null) {

  // The node is already unmounted
  if ((node as any)[mnsym] !== true) return

  const unmount: UnmountTuple[] = []
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

    unmount.push([iter, iter.parentNode || target, iter.previousSibling, iter.nextSibling])

    // When we're here, we're on a terminal node, so
    // we're going to have to process it.

    while (iter && !iter.nextSibling) {
      iter = node_stack.pop()!
      if (iter)
        unmount.push([iter, iter.parentNode || target, iter.previousSibling, iter.nextSibling])
    }

    // So now we're going to traverse the next node.
    iter = iter && iter.nextSibling
  }

  unmount.push([node, node.parentNode || target, prev, next])

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
 */
export function remove_and_unmount(node: Node): void {
  const parent = node.parentNode!
  const prev = node.previousSibling
  const next = node.nextSibling
  if (parent) parent.removeChild(node)
  unmount(node, parent, prev, next)
}


/**
 * An alternative way of inserting a child into the DOM that immediately calls
 * mount() on the node and its children.
 *
 * @param parent
 * @param node
 * @param refchild
 */
export function insert_before_and_mount(parent: Node, node: Node, refchild: Node | null = null) {
  var df = document.createDocumentFragment()
  df.appendChild(node)
  mount(node)
  parent.insertBefore(df, refchild)
}


/**
 * Alias for insert_before_and_mount
 */
export const append_child_and_mount = insert_before_and_mount as (parent: Node, child: Node) => void