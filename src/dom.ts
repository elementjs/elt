import { o } from "./observable"
import type { ClassDefinition, StyleDefinition, Listener, Appender, Attrs, Renderable } from "./types"
import {
  sym_connected_status,
  sym_observers,
  sym_connected,
  sym_disconnected,
  sym_insert,
  sym_attrs,
  sym_leave,
  sym_enter,
} from "./symbols"

const NODE_IS_CONNECTED = 0b001
const NODE_IS_OBSERVING = 0b010
/** Removed, but kept in the page while its leave hooks run. Condemned: it never comes back. */
const NODE_IS_LEAVING = 0b100

export type LifecycleCallback<N = Node> = (n: N) => void

/**
 * A function run when a node leaves the page (see {@link node_on_leave}). Returning a promise keeps
 * the node in the page until it settles ; returning nothing removes it right away.
 */
export type LeaveCallback<N extends Element = Element> = (node: N) => PromiseLike<unknown> | void

export interface LeaveOptions {
  /** Keep the leaving node in the layout until it is removed, instead of floating it out of it at once. */
  flow?: boolean
}

/** A function run when a node enters the page (see {@link node_on_enter}). */
export type EnterCallback<N extends Element = Element> = (node: N) => unknown

export interface EnterOptions {
  /** Run on every connection, including when the node arrives with an ancestor (never on moves). */
  always?: boolean
}

interface LeaveHook {
  fn: LeaveCallback<any>
  flow: boolean
}

declare global {
  interface Node {
    [sym_connected_status]: number // we cheat on the undefined as all masking operations as undefined is considered 0
    [sym_observers]?: o.Observer<any>[]

    [sym_connected]?: LifecycleCallback[]
    [sym_disconnected]?: LifecycleCallback[]
    [sym_leave]?: LeaveHook[]
    [sym_enter]?: EnterCallback<any>[]
  }
}

/** Safari does not ship `moveBefore` yet ; there, moves fall back to remove + insert and lose focus. */
const HAS_MOVE_BEFORE = typeof Element !== "undefined" && "moveBefore" in Element.prototype

/**
 * The comment holder is a class meant to help verbs and observables maintain nodes between two comments.
 */
export class CommentHolder extends Comment {
  end: Comment | null = null

  /** Change and update this nodes' content. Will only work if the CommentHolder has a parent ; use a DocumentFragment when preparing the node. */
  updateRenderable(renderable: Renderable<Node>) {
    const parent = this.parentNode
    if (parent == null) throw new Error("CommentHolder.updateRenderable: not attached to a parent")

    if (this.end != null) {
      this.empty()
    } else {
      this.end = document.createComment(`${this.textContent ?? ""} end`)
      node_append(parent, this.end, this.nextSibling)
    }

    node_append(parent, renderable, this.nextSibling)
  }

  /** Remove the content between this node and its end marker. */
  empty() {
    const end = this.end
    if (end == null || end.parentNode !== this.parentNode) return
    const first = this.nextSibling
    // `end` is a later sibling, so both are non-null whenever the range is not empty
    if (first !== end) node_remove_range(first as Node, end.previousSibling as Node)
  }

  /** Whether something other than leaving nodes sits between this node and its end marker. */
  get hasContent() {
    let n = this.nextSibling
    while (n != null && n !== this.end && n[sym_connected_status] & NODE_IS_LEAVING) n = n.nextSibling
    return n !== this.end
  }

  /** The last node this holder spans : its end marker when it has one in the same parent, itself otherwise. */
  get last(): Node {
    const end = this.end
    return end != null && end.parentNode === this.parentNode ? end : this
  }

  /** Remove the node and its handled content from the DOM */
  override remove() {
    node_remove_range(this, this.last)
  }

  /** Move this node and its contents to a new destination */
  moveTo(parent: Node, refchild: Node | null = null) {
    node_move_range(this, this.last, parent, refchild)
  }
}

function _node_call_cbks(node: Node, sym: typeof sym_connected | typeof sym_disconnected) {
  const cbks = node[sym]
  if (cbks) {
    for (let i = 0, l = cbks.length; i < l; i++) {
      try {
        cbks[i](node)
      } catch (e) {
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
  const st = node[sym_connected_status]
  if (st & NODE_IS_CONNECTED) return
  // A leaving node put back in the page (its detached ancestor re-inserted, a late mutation record)
  // is condemned : it goes now, it is never reconnected.
  if (st & NODE_IS_LEAVING) {
    node.parentNode?.removeChild(node)
    return
  }

  _apply_connected(node)
  let iter = node.firstChild
  while (iter) {
    // saved first : connecting `iter` may remove it
    const next = iter.nextSibling
    node_do_connected(iter)
    iter = next
  }
}

/**
 * Apply unmount to a node.
 * @internal
 */
function _apply_disconnected(node: Node) {
  const st = node[sym_connected_status]

  // A leaving node stays condemned, even inside a removed ancestor that is later put back.
  node[sym_connected_status] = st & NODE_IS_LEAVING

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

let _range: Range | null = null

/** When false, leave hooks are not run : every removal is instant. */
let _motion_enabled = true

/**
 * Turn motion on or off for the whole page. Off, every node leaves the page at once, as if it had no
 * leave hook. Tests usually turn it off.
 *
 * @group Motion
 */
export function motion_enabled(enabled: boolean) {
  _motion_enabled = enabled
}

/** Depth of {@link without_motion} calls in progress. */
let _motion_suspended = 0

/** Whether enter and leave hooks may run now. @internal */
export function motion_is_enabled() {
  return _motion_enabled && _motion_suspended === 0
}

/**
 * Run `fn` with motion off: nodes it removes leave at once and nodes it inserts don't enter. Used by
 * windowed lists, whose rows come and go with scrolling, not with the data.
 *
 * @internal
 */
export function without_motion<T>(fn: () => T): T {
  _motion_suspended++
  try {
    return fn()
  } finally {
    _motion_suspended--
  }
}

/**
 * Run `fn` when `node` leaves the page : when it is one of the nodes removed by `node_remove`, a verb
 * or a comment holder (not a descendant of one), while it is connected.
 *
 * `node` is disconnected first (its observers stop, its `disconnected` callbacks run). If `fn`
 * returns a promise, `node` stays in the page until it settles, marked with the `e-leaving` attribute
 * and `inert`, and out of the layout unless `opts.flow` is set ; elt then removes it. If it returns
 * nothing, `node` is removed right away.
 *
 * A leaving node is condemned : removing it again, moving it, or putting it back in the page removes it
 * at once.
 *
 * @group Motion
 */
export function node_on_leave<N extends Element>(node: N, fn: LeaveCallback<N>, opts?: LeaveOptions) {
  node[sym_leave] ??= []
  node[sym_leave].push({ fn, flow: !!opts?.flow })
}

/**
 * Run `fn` when `node` enters the page : when it is inserted by `node_append` (a verb, a comment
 * holder, a direct call) into a parent that is in the page, as the inserted node or one of the
 * top-level nodes of an inserted fragment. Not when it arrives with an ancestor (the first render of
 * a tree built offscreen, then mounted), not on moves, not when inserted into a detached parent.
 *
 * With `opts.always`, `fn` runs on every connection instead (still never on moves). Nothing runs while
 * motion is off ({@link motion_enabled}).
 *
 * @group Motion
 */
export function node_on_enter<N extends Element>(node: N, fn: EnterCallback<N>, opts?: EnterOptions) {
  if (opts?.always) {
    node_on_connected(node, (n) => {
      if (motion_is_enabled()) fn(n)
    })
    return
  }
  node[sym_enter] ??= []
  node[sym_enter].push(fn)
}

/** Run the enter hooks of `node`, just inserted into the page by `node_append` and connected. */
function _node_enter(node: Node) {
  const hooks = node[sym_enter]
  if (hooks == null || !motion_is_enabled() || !(node[sym_connected_status] & NODE_IS_CONNECTED)) return
  for (let i = 0, l = hooks.length; i < l; i++) {
    try {
      hooks[i](node)
    } catch (e) {
      console.error("enter hooks should not throw", e)
    }
  }
}

/** Display values of table parts : positioned absolutely, they would stop being table parts. */
const TABLE_PARTS = new Set([
  "table-row",
  "table-cell",
  "table-row-group",
  "table-header-group",
  "table-footer-group",
  "table-column",
  "table-column-group",
  "table-caption",
])

/** A leaving node and what its removal needs. */
interface Leaving {
  node: Element
  /** Its inline style before it was taken out of the layout, restored if it does not leave after all. */
  style: string | null
  promises: PromiseLike<unknown>[]
}

/**
 * Take `nodes` out of the layout while keeping them visually in place, for those that can be ; the
 * others keep their space. Reads and writes are batched : two forced layouts in all.
 */
function float_out(nodes: Leaving[]) {
  const rects: (DOMRect | null)[] = []
  const offsets: number[] = []
  for (const l of nodes) {
    const el = l.node
    // Only HTML elements are laid out by the flow and know their offsets ; table parts stop being
    // table parts once absolute, and a box split over several lines has no single rectangle.
    if (
      !(el instanceof HTMLElement) ||
      (l.node[sym_leave] as LeaveHook[]).some((h) => h.flow) ||
      TABLE_PARTS.has(getComputedStyle(el).display) ||
      el.getClientRects().length > 1
    ) {
      rects.push(null)
      continue
    }
    rects.push(el.getBoundingClientRect())
    offsets.push(el.offsetTop, el.offsetLeft, el.offsetWidth, el.offsetHeight)
  }

  for (let i = 0, j = 0; i < nodes.length; i++) {
    if (rects[i] == null) continue
    const l = nodes[i]
    const st = (l.node as HTMLElement).style
    l.style = st.cssText
    st.position = "absolute"
    st.boxSizing = "border-box"
    st.margin = "0"
    st.top = `${offsets[j++]}px`
    st.left = `${offsets[j++]}px`
    st.width = `${offsets[j++]}px`
    st.height = `${offsets[j++]}px`
  }

  // `offsetTop` / `offsetLeft` are relative to the offsetParent, absolute positioning to the containing
  // block ; they differ under a transformed or contained ancestor. Shift by what moved.
  const after = rects.map((r, i) => (r == null ? null : nodes[i].node.getBoundingClientRect()))
  for (let i = 0; i < nodes.length; i++) {
    const r = rects[i]
    const a = after[i]
    if (r == null || a == null || (r.top === a.top && r.left === a.left)) continue
    const st = (nodes[i].node as HTMLElement).style
    st.top = `${Number.parseFloat(st.top) + r.top - a.top}px`
    st.left = `${Number.parseFloat(st.left) + r.left - a.left}px`
  }
}

/** Remove a leaving node once its hooks are done, unless something already did. */
function _leave_done(node: Element) {
  if (node[sym_connected_status] & NODE_IS_LEAVING) {
    node[sym_connected_status] = 0
    node.parentNode?.removeChild(node)
  }
}

/**
 * Remove the siblings from `first` to `last` (inclusive). Every removal done by elt goes through
 * here (`node_remove`, `node_clear`, verbs, comment holders).
 *
 * The nodes are disconnected first, so their `disconnected` callbacks still see them in place, then
 * detached : a single node with `removeChild`, a run of several with one Range call. Nodes with leave
 * hooks (see {@link node_on_leave}) may stay in the page while their hooks run ; leaving nodes already
 * in the range are removed at once. With `motion` false, no leave hook runs.
 *
 * @internal
 */
export function node_remove_range(first: Node, last: Node, motion = true): void {
  // Nodes with leave hooks that may leave : connected (removing a detached node is always instant)
  let candidates: Leaving[] | null = null
  const may_leave = motion && motion_is_enabled()
  for (let n: Node | null = first; n != null; n = n.nextSibling) {
    // Already leaving : removed again, it goes now with the rest (its final removal will do nothing).
    n[sym_connected_status] &= ~NODE_IS_LEAVING
    if (may_leave && n[sym_leave] != null && n[sym_connected_status] & NODE_IS_CONNECTED) {
      candidates ??= []
      candidates.push({ node: n as Element, style: null, promises: [] })
    }
    node_do_disconnect(n)
    if (n === last) break
  }

  const parent = first.parentNode
  if (parent == null) return

  let leaving = false
  if (candidates != null) leaving = start_leaving(candidates)

  if (!leaving) {
    // The usual case : everything goes, in one call.
    if (first === last) {
      parent.removeChild(first)
      return
    }
    _range ??= document.createRange()
    _range.setStartBefore(first)
    _range.setEndAfter(last)
    _range.deleteContents()
    return
  }

  // Remove everything but the leaving nodes, one Range call per run in between.
  let run_first: Node | null = null
  let run_last: Node | null = null
  const flush = () => {
    if (run_first == null || run_last == null) return
    if (run_first === run_last) parent.removeChild(run_first)
    else {
      _range ??= document.createRange()
      _range.setStartBefore(run_first)
      _range.setEndAfter(run_last)
      _range.deleteContents()
    }
    run_first = null
  }
  for (let n: Node | null = first; n != null; ) {
    const next: Node | null = n === last ? null : n.nextSibling
    if (n[sym_connected_status] & NODE_IS_LEAVING) flush()
    else {
      run_first ??= n
      run_last = n
    }
    n = next
  }
  flush()
}

/**
 * Float the candidates out of the layout, run their hooks, and mark those that leave. Returns whether
 * any does. The other candidates get their inline style back and are removed with the rest.
 */
function start_leaving(candidates: Leaving[]): boolean {
  // A node without a box shows nothing while leaving : it goes at once.
  const shown = candidates.filter((l) => l.node.getClientRects().length > 0)
  if (shown.length === 0) return false
  // Measured before the hooks : an animation started by a hook would move the node's rectangle.
  float_out(shown)

  let any = false
  for (const l of shown) {
    const node = l.node
    for (const h of node[sym_leave] as LeaveHook[]) {
      try {
        const res = h.fn(node)
        if (res != null && typeof (res as PromiseLike<unknown>).then === "function")
          l.promises.push(res as PromiseLike<unknown>)
      } catch (e) {
        console.error("leave hooks should not throw", e)
      }
    }

    if (l.promises.length === 0) {
      if (l.style != null) (node as HTMLElement).style.cssText = l.style
      continue
    }
    any = true
    node[sym_connected_status] = NODE_IS_LEAVING
    node.setAttribute("e-leaving", "")
    node.setAttribute("inert", "")
    const done = () => _leave_done(node)
    Promise.all(l.promises).then(done, done)
  }
  return any
}

/**
 * Move the siblings from `first` to `last` (inclusive) before `refchild` in `parent`. Every move done
 * by elt goes through here. Leaving nodes are not moved : they are removed at once.
 *
 * @internal
 */
export function node_move_range(first: Node, last: Node, parent: Node, refchild: Node | null): void {
  // Live to live: an atomic move keeps focus, selection, iframes and running animations. The nodes
  // never leave the document, so no connected/disconnected callback has to run.
  const atomic = HAS_MOVE_BEFORE && first.isConnected && parent.isConnected
  let node: Node | null = first
  while (node != null) {
    const next: Node | null = node.nextSibling
    if (node[sym_connected_status] & NODE_IS_LEAVING) node.parentNode?.removeChild(node)
    else if (atomic) (parent as ParentNode).moveBefore(node, refchild)
    else node_append(parent, node, refchild)
    if (node === last) break
    node = next
  }
}

/**
 * Remove a `node` from the tree and call `removed` on its mixins and all the `removed` callbacks. A node inserted with `node_append` should be removed with this function.
 *
 * @group Dom
 */
export function node_remove(node: Node): void {
  node_remove_range(node, node)
}

/**
 * Remove all elements within a node and call the remove callback.
 * @group Dom
 */
export function node_clear(node: Node): void {
  const first = node.firstChild
  // `lastChild` is non-null whenever `firstChild` is
  if (first != null) node_remove_range(first, node.lastChild as Node)
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
 * Only when third-party code uses raw `appendChild` / `removeChild`. Prefer {@link node_append} for elt trees.
 *
 * ```tsx
 * setup_mutation_observer(document.documentElement)
 * ```
 *
 * @group Dom
 */
export function setup_mutation_observer(node: Node) {
  if (!node.isConnected && node.ownerDocument && !(node instanceof ShadowRoot))
    throw new Error("cannot setup mutation observer on a Node that is not connected in a document")

  const obs = new MutationObserver((records) => {
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
      const root = target_document.firstChild
      if (root != null) node_do_disconnect(root)
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

function is_appender(ins: any): ins is Appender<Node> {
  return typeof ins?.[sym_insert] === "function"
}

function insert_before(node: Node, new_child: Node, refchild: Node | null, is_basic_node = false) {
  if (is_basic_node === false && refchild != null) {
    ;(refchild as Comment).before(new_child)
  } else {
    node.insertBefore(new_child, refchild)
  }
}

/**
 * Process an insertable and insert it where desired.
 *
 * @param node The parent to insert the node on
 * @param renderable The insertable that has to be handled
 * @param refchild The child before which to append
 * @group Dom
 */
export function node_append<N extends Node>(
  node: N,
  renderable: Renderable<N> | Attrs<N>,
  refchild: Node | null = null,
  is_basic_node = true,
) {
  if (renderable == null || typeof renderable === "boolean") return

  if (typeof renderable === "string") {
    // A simple string
    insert_before(node, document.createTextNode(renderable), refchild, is_basic_node)
  } else if (renderable instanceof Node) {
    // A node being added
    if (renderable.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
      // DocumentFragment
      let start = renderable.firstChild
      if (start == null) return // there are no children to append, nothing more to do

      insert_before(node, renderable, refchild, is_basic_node)

      if (node.isConnected) {
        // `start` was the fragment's first child, now moved into `node` : walk until the insertion point
        while (start != null && start !== refchild) {
          // saved first : connecting `start` may remove it (a leaving node is never reconnected)
          const next: ChildNode | null = start.nextSibling
          // Fresh from the fragment, so not connected yet : once connected, it enters the page.
          node_do_connected(start)
          _node_enter(start)
          start = next
        }
      }
    } else {
      insert_before(node, renderable, refchild, is_basic_node)
      if (node.isConnected) {
        // Already connected : this is a move, which never enters the page.
        const entering = !(renderable[sym_connected_status] & NODE_IS_CONNECTED)
        node_do_connected(renderable)
        if (entering) _node_enter(renderable)
      } else if (node_is_connected(renderable)) {
        node_do_disconnect(renderable)
      }
    }
  } else if (renderable instanceof Function) {
    // A decorator
    const res = renderable(node)
    if (res != null) node_append(node, res, refchild, is_basic_node)
  } else if (is_appender(renderable)) {
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
    for (const key in attrs) {
      const value = attrs[key as keyof typeof attrs]
      if (key === "class") {
        if (value == null || value === false) continue
        if (Array.isArray(value)) for (let j = 0, lj = value.length; j < lj; j++) node_observe_class(_node, value[j])
        else node_observe_class(_node, value as ClassDefinition)
      } else if (key === "style") {
        if (value == null || value === false) continue
        node_observe_style(_node, value as StyleDefinition)
      } else if (is_basic_node || basic_attrs.has(key) || key.startsWith("data-") || key.startsWith("aria-")) {
        node_observe_attribute(_node, key, (attrs as any)[key])
      }
    }
  } else if (typeof (renderable as any).then === "function") {
    const _pro = renderable as unknown as Promise<Renderable<N>>
    const cmt = document.createComment("promise-loading")
    insert_before(node, cmt, refchild, is_basic_node)
    _pro
      .then((res) => {
        if (!cmt.parentNode) return
        node_append(cmt.parentNode as unknown as N, res, cmt)
        cmt.textContent = "promise-resolved"
      })
      .catch((e) => {
        console.error(e)
        cmt.textContent = `promise-error: ${e.toString()}`
      })
  } else {
    // Otherwise, make it a string and append it.
    insert_before(node, document.createTextNode(renderable.toString()), refchild, is_basic_node)
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
    if (!Array.isArray(css)) {
      css = [css]
    }
    const sheets = css.filter((c) => c instanceof CSSStyleSheet) as CSSStyleSheet[]
    if (sheets.length) shadow.adoptedStyleSheets = [...shadow.adoptedStyleSheets, ...sheets]
    const strings = css.filter((c) => typeof c === "string")
    if (strings.length) {
      const style = document.createElement("style")
      style.append(strings.join("\n"))
      shadow.insertBefore(style, null)
    }
  }

  shadow.insertBefore(opts == null ? (opts as Node) : (child as Node), null)

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
  options?: o.ObserveOptions<T>,
): o.Observer<T> | null {
  if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
    console.warn("observing on a fragment does nothing")
    return null
  }

  if (!o.isReadonlyObservable(obs)) {
    // If the node is already inited, run the callback
    if (!options?.changes_only) {
      if (options?.immediate) obsfn(obs as T, o.NoValue)
      else node_on_connected(node, () => obsfn(obs as T, o.NoValue))
    }
    return null
  }
  // Create the observer and append it to the observer array of the node
  const obser = options?.changes_only ? new o.SilentObserver(obsfn, obs) : new o.Observer(obsfn, obs)
  options?.observer_callback?.(obser)
  node_add_observer(node, obser)
  if (options?.immediate) obser.refreshImmediate()
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
  let observers = node[sym_observers]
  if (observers == null) {
    observers = []
    node[sym_observers] = observers
  }
  observers.push(observer)
  if (node[sym_connected_status] & NODE_IS_OBSERVING) observer.startObserving()
}

declare global {
  interface GlobalEventHandlersEventMap {
    // [x: string]: Event
  }
}

export type KEvent = keyof GlobalEventHandlersEventMap

export type EventForKey<K extends KEvent> = K extends keyof GlobalEventHandlersEventMap
  ? GlobalEventHandlersEventMap[K]
  : Event

export type EventsForKeys<K extends KEvent | KEvent[]> = K extends any[]
  ? EventForKey<K[number]>
  : K extends KEvent
    ? EventForKey<K>
    : Event

export function node_add_event_listener<N extends Node, K extends KEvent | KEvent[]>(
  node: N,
  key: K,
  listener: Listener<EventsForKeys<K>, N>,
  useCapture?: boolean | AddEventListenerOptions,
): void
export function node_add_event_listener<N extends EventTarget, K extends KEvent | KEvent[]>(
  node: Node,
  target: N,
  key: K,
  listener: Listener<EventsForKeys<K>, N>,
  useCapture?: boolean | AddEventListenerOptions,
): void
export function node_add_event_listener(node: any, target: any, events: any, listener?: any, use_capture?: any): void {
  if (typeof target === "string" || Array.isArray(target)) {
    // This is the short version, target is the events
    use_capture = listener
    listener = events
    events = target
    target = node // now both target and node have the same value
  }

  function add_listener(event: string, listener: Listener<any>) {
    function add() {
      target.addEventListener(event, listener, use_capture)
    }
    // If the targeted node is not the same, then we *must* remove the event listener if the node observing the events goes away. Otherwise, we get memory leaks.
    node_on_connected(node, add)
    if (node.isConnected) add()
    node_on_disconnected(node, () => {
      target.removeEventListener(event, listener, use_capture)
    })
  }

  if (Array.isArray(events)) {
    for (let i = 0, l = events.length; i < l; i++) {
      const event = events[i]
      add_listener(event, listener)
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
  node[sym_observers] = node[sym_observers]?.filter((ob) => {
    const res = ob === obsfn || ob.fn === obsfn || ob.observable === obsfn
    if (res && is_observing) {
      // stop the observer before removing it from the list if the node was observing
      ob.stopObserving()
    }
    return !res
  })

  return prev_len - (node[sym_observers]?.length ?? 0)
}

/**
 * Form controls that expose the DOM Constraint Validation API (`ValidityState`,
 * `setCustomValidity`). `contenteditable` elements and most other nodes do not.
 * @group Dom
 */
export type ValidatableElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

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
export function node_observe_attribute(
  node: Element,
  name: string,
  value: o.RO<string | boolean | null | undefined | number>,
) {
  // Try to see if we're setting an attribute on an EltCustomElement. This will bypass the setAttribute logic to allow other values than string.
  const custom_attrs = node[sym_attrs]?.get(name)
  if (custom_attrs != null) {
    // Set the value without trying to interpret it.
    node_observe(
      node,
      value,
      (val) => {
        node.setAttribute(name, val as any)
      },
      { immediate: true },
    )

    return
  }

  // Regular setAttribute logic
  node_observe(
    node,
    value,
    (val) => {
      if (val == null || val === false) {
        node.removeAttribute(name)
        return
      }
      if (val === true) {
        if (node.getAttribute(name) !== "") node.setAttribute(name, "")
      } else {
        if (val !== node.getAttribute(name)) node.setAttribute(name, val.toString())
      }
    },
    { immediate: true },
  )
}

/**
 * Observe a style (as JS defines it) and update the node as needed.
 * @group Dom
 */
export function node_observe_style(node: HTMLElement | SVGElement, style: StyleDefinition) {
  if (o.is_observable(style)) {
    node_observe(
      node,
      style,
      (st) => {
        if (st == null)
          if (typeof st === "string") {
            node.setAttribute("style", st)
            return
          }

        const ns = node.style
        const props = Object.keys(st)
        for (let i = 0, l = props.length; i < l; i++) {
          const x = props[i]
          const css_name = x.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
          const value = st[x as any] as any
          if (value) {
            ns.setProperty(css_name, value)
          } else {
            ns.removeProperty(css_name)
          }
        }
      },
      { immediate: true },
    )
  } else if (typeof style === "string") {
    node.setAttribute("style", style)
  } else {
    // c is a MaybeObservableObject
    const st = style as any
    const props = Object.keys(st)
    for (let i = 0, l = props.length; i < l; i++) {
      const x = props[i]
      const css_name = x.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
      node_observe(
        node,
        st[x],
        (value) => {
          if (!value) {
            node.style.removeProperty(css_name)
          } else {
            node.style.setProperty(css_name, value)
          }
        },
        { immediate: true },
      )
    }
  }
}

function _is_plain_class_object(c: any): c is { [name: string]: o.RO<any> } {
  return c.constructor === Object
}

/**
 * Observe a complex class definition and update the node as needed.
 * @group Dom
 */
export function node_observe_class(node: Element, c: ClassDefinition) {
  if (!c) return
  if (typeof c === "string" || typeof c === "boolean" || !_is_plain_class_object(c)) {
    // c is an Observable<string>
    node_observe(
      node,
      c,
      (str, chg) => {
        if (chg !== o.NoValue && chg) node_remove_class(node, chg as string)
        if (str) node_apply_class(node, str)
      },
      { immediate: true },
    )
  } else {
    const ob = c as { [name: string]: o.RO<any> }
    // c is a MaybeObservableObject
    const props = Object.keys(ob)
    for (let i = 0, l = props.length; i < l; i++) {
      const x = props[i]
      node_observe(
        node,
        ob[x],
        (applied, chg) => {
          if (applied) node_apply_class(node, x)
          else if (chg !== o.NoValue) node_remove_class(node, x)
        },
        { immediate: true },
      )
    }
  }
}

export function node_apply_class(node: Element, c: string | string[] | null | false) {
  if (Array.isArray(c)) {
    for (let i = 0, l = c.length; i < l; i++) {
      node_apply_class(node, c[i])
    }
    return
  }
  const cs = c?.toString()
  if (!cs) return
  for (const _ of cs.split(/\s+/g)) {
    if (_) node.classList.add(_)
  }
}

export function node_remove_class(node: Element, c: string | string[]) {
  if (Array.isArray(c)) {
    for (let i = 0, l = c.length; i < l; i++) {
      node_remove_class(node, c[i])
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
  callback: LifecycleCallback<N>,
) {
  let cbks = node[sym]
  if (cbks == null) {
    cbks = []
    node[sym] = cbks
  }
  cbks.push(callback as LifecycleCallback)
}

/**
 * Remove a previously associated `callback` from the life-cycle event `sym` for the `node`.
 * @internal
 */
function node_off<N extends Node>(
  node: N,
  sym: typeof sym_connected | typeof sym_disconnected,
  callback: LifecycleCallback<N>,
) {
  const cbks = node[sym]
  if (cbks == null) return
  const idx = cbks.indexOf(callback as LifecycleCallback)
  if (idx > -1) cbks.splice(idx, 1)
}
