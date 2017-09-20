
import {MixinHolder} from './mixins'

export type MaybeNode = Node | null

const mnsym = Symbol('mounted')

export function _apply_mount(node: Node) {
  var mh = MixinHolder.getIfExists(node);

  (node as any)[mnsym] = true

  if (mh && !mh.mounted)
    mh.mount(node as Element, node.parentNode!)
}

/**
 * Call controllers' mount() functions.
 */
export function _mount(node: Node, target?: Node) {
  var node_stack: Node[] = []
  // var mount: Node[] = [node]
  var iter: Node | null | undefined = node.firstChild!

  _apply_mount(node)
  if (!node.firstChild) return

  // Iterative tree traversal
  do {

    _apply_mount(iter)
    // mount.push(iter)

    // Push firstChildren first
    while (iter.firstChild) {
      node_stack.push(iter)
      iter = iter.firstChild
      _apply_mount(iter)
      // mount.push(iter)
    }

    while (!iter.nextSibling) {
      iter = node_stack.pop()
      if (!iter) break
    }

    // So now we're going to traverse the next node.
    if (iter) iter = iter.nextSibling

  } while (iter)
}


// node, parent, previous, next
export type MountTuple = [Node, MaybeNode, MaybeNode, MaybeNode]


/**
 * Apply unmount to a node.
 */
export function _apply_unmount(tuple: MountTuple) {
  var node = tuple[0];
  (node as any)[mnsym] = false

  var mh = MixinHolder.getIfExists(node)

  if (!mh || !mh.mounted) return
  mh.unmount(tuple[0] as Element, tuple[1]!, tuple[2], tuple[3])
}

/**
 * Call controller's unmount functions recursively
 */
export function _unmount(node: Node, target: Node, prev: MaybeNode, next: MaybeNode) {

  const unmount: MountTuple[] = []
  const node_stack: Node[] = []
  var iter: MaybeNode = node

  // We need to store all the nodes for which we'll call unmount() beforehand,
  // as an unmount() handler may further remove nodes that were already
  // unmounted from the DOM and which could be missed if we naively traversed
  // the unmounted children.
  //
  // The array construction is done iteratively for performance considerations.
  do {

    // Push firstChildren first
    while (iter.firstChild) {
      node_stack.push(iter)
      iter = iter.firstChild
    }

    unmount.push([iter, iter.parentNode || target, null, null])

    // When we're here, we're on a terminal node, so
    // we're going to have to process it.

    while (!iter.nextSibling) {
      iter = node_stack.pop()!
      if (!iter) break
      unmount.push([iter, iter.parentNode || target, null, null])
    }

    // So now we're going to traverse the next node.
    if (iter) iter = iter.nextSibling

  } while (iter)

  for (var tuple of unmount) {
    _apply_unmount(tuple)
  }

}

/**
 * Call mount and unmount on the node controllers.
 */
export function applyMutations(records: MutationRecord[]) {
  var i = 0

  for (var record of records) {
    var target = record.target
    var added = record.addedNodes
    for (i = 0; i < added.length; i++) {
      // console.log(added[i])
      if ((added[i] as any)[mnsym]) continue

      // We check for parentNode as sometimes the node is added and removed
      // very fast and thus still gets put in the added records and immediately
      // in the removed record.
      if (added[i].parentNode) _mount(added[i], target)
    }

    var removed = record.removedNodes
    for (i = 0; i < removed.length; i++) {
      if (!(removed[i] as any)[mnsym]) continue
      _unmount(removed[i], target, record.previousSibling, record.nextSibling)
    }
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
