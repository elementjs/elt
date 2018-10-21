
import {getMixins} from './mixins'

export type MaybeNode = Node | null

const mnsym = Symbol('element-mounted')

function _added(node: Node) {
  var mx = getMixins(node)
  if (!mx) return
  for (var m of mx)
    m.added(node)
}

export function added(node: Node) {
  if (node instanceof DocumentFragment) {
    var _n = node.firstChild as Node | null
    while (_n) {
      _added(_n)
      _n = _n.nextSibling
    }
  } else {
    _added(node)
  }
}


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
export function mount(node: Node, target?: Node) {

  // mount was already applied
  if ((node as any)[mnsym] === true) return

  var node_stack: Node[] = []
  // var mount: Node[] = [node]
  var iter: Node | null | undefined = node.firstChild!

  _apply_mount(node)
  if (!iter) return

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
export function unmount(node: Node, target: Node, prev: MaybeNode, next: MaybeNode) {

  // The node is already unmounted
  if ((node as any)[mnsym] !== true) return

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
export function apply_mutations(records: MutationRecord[]) {
  var i = 0

  for (var record of records) {
    var target = record.target
    var added = record.addedNodes
    for (i = 0; i < added.length; i++) {
      // We check for parentNode as sometimes the node is added and removed
      // very fast and thus still gets put in the added records and immediately
      // in the removed record.
      if (added[i].parentNode) mount(added[i], target)
    }

    var removed = record.removedNodes
    for (i = 0; i < removed.length; i++) {
      unmount(removed[i], target, record.previousSibling, record.nextSibling)
    }
  }
}

export const symmount = Symbol('mounting')

/**
 * Set up an automated mounting mechanism. All nodes added as children to the `node` parameter
 * will have their mixins called accordingly whenever they get added to or removed
 * from the DOM.
 *
 * Note that you should use insert_before_and_mount / remove_and_unmount / append_child_and_mount instead
 * if you're 100% in control of the nodes that get into and out of the document. This function
 * exists mainly for when you're using libraries that will unpredictably insert nodes created
 * with E that you need mounted anyways.
 *
 * Behind the scenes, it uses the DOM MutationObserver to accomplish its magic, so
 * the browser will need to implement it for element to work (as of typing this in september
 * 2017, at least all the current big browsers do)
 *
 * @param node: the root node from which we will listen to the document
 *    mutations.
 */
export function setup_mounting(node: Node): void {

  const n = node as any
  if (n[symmount]) return

  var mutator = new MutationObserver(apply_mutations)

  mutator.observe(node, {
    subtree: true,
    childList: true
  })

  n[symmount] = true
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
  added(node)
  parent.insertBefore(df, refchild)
  mount(node, parent)
}


/**
 * Alias for insert_before_and_mount
 */
export const append_child_and_mount = insert_before_and_mount as (parent: Node, child: Node) => void