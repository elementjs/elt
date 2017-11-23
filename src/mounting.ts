
import {getMixins} from './mixins'

export type MaybeNode = Node | null

const mnsym = Symbol('element-mounted')

export function _apply_mount(node: Node): void
export function _apply_mount(node: any) {
  node[mnsym] = true
  var mx = getMixins(node)
  if (!mx) return
  for (var m of mx)
    if (!m.mounted) m.mount(node, node.parentNode)
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

    // Push firstChildren first
    while (iter.firstChild) {
      node_stack.push(iter)
      iter = iter.firstChild
      _apply_mount(iter)
    }

    while (iter && !iter.nextSibling) {
      iter = node_stack.pop()
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
  var node = tuple[0] as any;
  node[mnsym] = false
  var mx = getMixins(node)

  if (!mx) return
  for (var m of mx) if (m.mounted) m.unmount(tuple[0] as Element, tuple[1]!, tuple[2], tuple[3])
}

/**
 * Call controller's unmount functions recursively
 */
export function _unmount(node: Node, target: Node, prev: MaybeNode, next: MaybeNode) {

  const unmount: MountTuple[] = []
  const node_stack: Node[] = []
  var iter: MaybeNode = node.firstChild

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
      if ((removed[i] as any)[mnsym] === false) continue
      _unmount(removed[i], target, record.previousSibling, record.nextSibling)
    }
  }
}

export const symmount = Symbol('mounting')
/**
 * Set up the mounting mechanism. All nodes added as children to the `node` parameter
 * will have their mixins called accordingly whenever they get added to or removed
 * from the DOM.
 *
 * This is generally the first element function you should call, before adding any
 * node created by `d()` to the DOM.
 *
 * Behind the scenes, it uses the DOM MutationObserver to accomplish its magic, so
 * the browser will need to implement it for element to work (as of typing this in september
 * 2017, they almost all do, at least all the current big browsers)
 *
 * @param node: the root node from which we will listen to the document
 *    mutations.
 */
export function setupMounting(node: Node): void {

  const n = node as any
  if (n[symmount]) return

  var mutator = new MutationObserver(applyMutations)

  mutator.observe(node, {
    subtree: true,
    childList: true
  })

  n[symmount] = true
}


if (window.document && !(window as any).ELEMENT_NO_AUTO_SETUP_MOUNTING) {
  setupMounting(document)
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
export function removeNode(node: Node): void {
  const parent = node.parentNode!
  const prev = node.previousSibling
  const next = node.nextSibling
  if (parent) parent.removeChild(node)
  _unmount(node, parent, prev, next)
}