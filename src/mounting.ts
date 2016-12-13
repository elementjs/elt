
import {Controller} from './controller'

export function _apply_mount(node: Node) {
  var controllers = Controller.all(node)

  if (!controllers) return

  for (var c of controllers) {
    // ignore spurious unmounts (should not happen, but let's be cautious)
    if (c.mounted) continue
    c.mounted = true

    for (var f of c.onmount) {
      f.call(c, node)
    }

  }

}

/**
 * Call controllers' mount() functions.
 */
export function _mount(node: Node, target?: Node) {
  var iter = node
  var node_stack: Node[] = []

  // Iterative tree traversal
  do {

    _apply_mount(iter)

    // Push firstChildren first
    while (iter.firstChild) {
      node_stack.push(iter)
      iter = iter.firstChild
      _apply_mount(iter)
    }

    while (!iter.nextSibling) {
      iter = node_stack.pop()
      if (!iter) break
    }

    // So now we're going to traverse the next node.
    if (iter) iter = iter.nextSibling

  } while (iter)

}


/**
 * Apply unmount to a node.
 */
export function _apply_unmount(tuple: Node[]) {
  var node = tuple[0]
  var controllers = Controller.all(node)

  if (!controllers) return

  for (var c of controllers) {
    // ignore spurious unmounts (should not happen, but let's be cautious)
    if (!c.mounted) continue
    c.mounted = false

    for (var f of c.onunmount) {
      f.apply(c, tuple)
    }

  }
}


/**
 * Call controller's unmount functions recursively
 */
export function _unmount(node: Node, target: Node, prev: Node, next: Node) {

  const unmount: [Node, Node, Node, Node][] = []
  const node_stack: Node[] = []
  var iter: Node = node

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
      iter = node_stack.pop()
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
    for (i = 0; i < added.length; i++)
      _mount(added[i], target)

    var removed = record.removedNodes
    for (i = 0; i < removed.length; i++)
      _unmount(removed[i], target, record.previousSibling, record.nextSibling)
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
