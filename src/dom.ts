import { o } from "./observable"
import type { ClassDefinition, ClassValue, StyleDefinition, Listener, Appender, Attrs, Renderable } from "./types"
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

const NODE_IS_CONNECTED = 0b00001
const NODE_IS_OBSERVING = 0b00010
/** Removed, but kept in the page while its leave hooks run. Condemned: it never comes back. */
const NODE_IS_LEAVING = 0b00100
/** The start marker of a verb's content (a CommentHolder): what lies up to its `end` is that verb's. */
const NODE_IS_VERB = 0b01000
/** Set while the node's observers start on connection: a verb re-rendering then catches up, it doesn't update. */
const NODE_IS_CONNECTING = 0b10000
/** Bits that survive connections and disconnections. */
const NODE_KEPT = NODE_IS_LEAVING | NODE_IS_VERB

declare const DEBUG: boolean

export type LifecycleCallback<N = Node> = (n: N) => void

/**
 * A function run when a node leaves the page (see {@link node_on_leave}). Returning a promise keeps
 * the node in the page until it settles ; returning nothing removes it right away.
 */
export type LeaveCallback<N extends Element = Element> = (node: N) => PromiseLike<unknown> | void

export interface LeaveOptions {
  /** Keep the leaving node in the layout until it is removed, instead of floating it out of it at once. */
  flow?: boolean
  /**
   * Run even when the removal isn't an update of the node's verb: inside another verb's content, or a
   * removal without `motion`. It never keeps an ancestor in the page: only the removed node, or a node
   * inside a removed node that stays anyway.
   */
  always?: boolean
}

/** A function run when a node enters the page (see {@link node_on_enter}). */
export type EnterCallback<N extends Element = Element> = (node: N) => unknown

export interface EnterOptions {
  /**
   * Run on every connection, even when it isn't an update of the node's verb: a verb's first render,
   * arriving with an ancestor, an insertion without `motion`. Never on moves.
   */
  always?: boolean
}

interface LeaveHook {
  fn: LeaveCallback<any>
  flow: boolean
  always: boolean
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
 * The content of a verb: what lies between this comment and its `end` comment. Verbs and observables
 * shown as children render through it.
 *
 * It marks a boundary for motion: what a verb manages enters and leaves with that verb's updates, not
 * with the updates of the verbs around it (docs/md/motion.md).
 */
export class CommentHolder extends Comment {
  end: Comment | null = null

  /** `verb` false: the holder is a unit of the verb around it (a Repeat item), not a verb of its own. */
  constructor(data?: string, verb = true) {
    super(data)
    if (verb) this[sym_connected_status] = NODE_IS_VERB
  }

  /**
   * Replace the content by `renderable`. With `motion`, this is an update of the verb: the content
   * plays its exit and the new content its entry. A re-render while the holder is being connected (a
   * verb catching up on what changed while it was out of the page) is never an update.
   *
   * Will only work if the CommentHolder has a parent ; use a DocumentFragment when preparing the node.
   */
  updateRenderable(renderable: Renderable<Node>, motion = false) {
    const parent = this.parentNode
    if (parent == null) throw new Error("CommentHolder.updateRenderable: not attached to a parent")
    motion &&= !this.isConnecting

    if (this.end != null) {
      this.empty(motion)
    } else {
      this.end = document.createComment(`${this.textContent ?? ""} end`)
      node_append(parent, this.end, this.nextSibling)
    }

    node_append(parent, renderable, this.nextSibling, motion)
  }

  /** Remove the content between this node and its end marker ; with `motion`, as an update. */
  empty(motion = false) {
    const end = this.end
    if (end == null || end.parentNode !== this.parentNode) return
    const first = this.nextSibling
    // `end` is a later sibling, so both are non-null whenever the range is not empty
    if (first !== end) node_remove_range(first as Node, end.previousSibling as Node, motion)
  }

  /** Whether its observers are starting right now, as it is being connected. */
  get isConnecting() {
    return !!(this[sym_connected_status] & NODE_IS_CONNECTING)
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

  // now inserted ; connecting while its observers start, so a verb re-rendering then knows it catches up
  node[sym_connected_status] = NODE_IS_CONNECTED | NODE_IS_OBSERVING | NODE_IS_CONNECTING | (st & NODE_IS_VERB)

  // restart observers
  if (!(st & NODE_IS_OBSERVING)) _node_start_observers(node)
  node[sym_connected_status] &= ~NODE_IS_CONNECTING

  // then, call inserted.
  if (!(st & NODE_IS_CONNECTED)) _node_call_cbks(node, sym_connected)
}

/**
 * Connect `node` and its subtree. With `entering`, the connection is part of an update (see
 * `node_append`'s `motion`): the subtree's enter hooks run, up to the content of other verbs.
 *
 * @internal
 */
export function node_do_connected(node: Node, entering = false) {
  const st = node[sym_connected_status]
  if (st & NODE_IS_CONNECTED) return
  // A leaving node put back in the page (its detached ancestor re-inserted, a late mutation record)
  // is condemned : it goes now, it is never reconnected.
  if (st & NODE_IS_LEAVING) {
    node.parentNode?.removeChild(node)
    return
  }

  _apply_connected(node)
  if (node.firstChild != null) _connect_siblings(node.firstChild, null, entering)
  if (entering) _node_enter(node)
}

/**
 * Connect the siblings from `first` up to `stop` (excluded). With `entering`, they enter, except what
 * lies between another verb's markers: that is the verb's own content, which only enters with its
 * own updates.
 */
function _connect_siblings(first: Node, stop: Node | null, entering: boolean) {
  const parent = first.parentNode
  let verb_end: Node | null = null
  for (let iter: Node | null = first; iter != null && iter !== stop; ) {
    const next: Node | null = iter.nextSibling
    if (entering && verb_end == null && iter[sym_connected_status] & NODE_IS_VERB)
      verb_end = (iter as CommentHolder).end
    node_do_connected(iter, entering && verb_end == null)
    if (iter === verb_end) verb_end = null
    // Connecting may change what follows: a verb catching up replaces its content. Unless `iter` was
    // removed itself (a leaving node), its current next sibling is where to go on.
    iter = iter.parentNode === parent ? iter.nextSibling : next
  }
}

/**
 * Apply unmount to a node.
 * @internal
 */
function _apply_disconnected(node: Node) {
  const st = node[sym_connected_status]

  // A leaving node stays condemned, even inside a removed ancestor that is later put back.
  node[sym_connected_status] = st & NODE_KEPT

  if (st & NODE_IS_OBSERVING) {
    _node_stop_observers(node)
  }

  if (st & NODE_IS_CONNECTED) {
    _node_call_cbks(node, sym_disconnected)
  }
}

/**
 * Traverse the node tree of `node` and run its `disconnected` callbacks and stop its observers, beginning with
 * the leaves and ending on the root.
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

/**
 * Whether enter and leave hooks run now: motion is on ({@link motion_enabled}) and no
 * {@link without_motion} call is in progress.
 *
 * @group Motion
 */
export function motion_is_enabled() {
  return _motion_enabled && _motion_suspended === 0
}

/**
 * Run `fn` with motion off: nodes it removes leave at once and nodes it inserts don't enter. Windowed
 * lists use it, since their rows come and go with scrolling, not with the data ; so can your own code
 * when it re-renders something that should not look like content arriving or leaving.
 *
 * @group Motion
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
 * Run `fn` when `node` leaves the page with an update of its verb (docs/md/motion.md): when it is
 * removed by that update (or by a removal with `motion`), or is inside such a removed node that has a
 * leave hook of its own. Not when it is another verb's content, not when the removed node around it
 * has no leave hook, not when it is detached. `opts.always`: see {@link LeaveOptions}.
 *
 * `node` is disconnected first (its observers stop, its `disconnected` callbacks run). If `fn`
 * returns a promise, the removed node stays in the page until every such promise settled, marked with
 * the `e-leaving` attribute and `inert`, and out of the layout unless `opts.flow` is set ; elt then
 * removes it. If it returns nothing, nothing waits for it.
 *
 * A leaving node is condemned : removing it again, moving it, or putting it back in the page removes it
 * at once.
 *
 * @group Motion
 */
export function node_on_leave<N extends Element>(node: N, fn: LeaveCallback<N>, opts?: LeaveOptions) {
  node[sym_leave] ??= []
  node[sym_leave].push({ fn, flow: !!opts?.flow, always: !!opts?.always })
}

/**
 * Run `fn` when `node` enters the page with an update of its verb (docs/md/motion.md): when that
 * update (or a `node_append` with `motion`) inserts it, or inserts an ancestor of it, up to the
 * content of other verbs. Not on a verb's first render, not on moves, not into a detached parent.
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

/** Run the enter hooks of `node`, just connected as part of an update. */
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

/** A removed node that may stay while leave hooks run, in itself and its descendants. */
interface Leaving {
  node: Element
  /** The nodes whose hooks run, each with whether its plain (not `always`) hooks run. */
  hooks: [Element, boolean][]
  /** Its inline style before it was taken out of the layout, restored if it does not leave after all. */
  style: string | null
  /** Whether it stays in the layout: a hook asked `flow`, or it can't float. */
  flow: boolean
}

/** Whether `node` has leave hooks that run: `always` ones, and plain ones when `plain`. */
function _has_leave(node: Node, plain: boolean) {
  const hooks = node[sym_leave]
  if (hooks == null) return false
  for (let i = 0; i < hooks.length; i++) if (plain || hooks[i].always) return true
  return false
}

/**
 * Disconnect `node`'s subtree, collecting into `hooks` the descendants whose leave hooks run: plain
 * ones while `plain`, which stops at other verbs' content, `always` ones anywhere.
 */
function _disconnect_collect(node: Node, hooks: [Element, boolean][], plain: boolean) {
  let verb_end: Node | null = null
  let iter = node.firstChild
  while (iter) {
    if (plain && verb_end == null && iter[sym_connected_status] & NODE_IS_VERB) verb_end = (iter as CommentHolder).end
    const p = plain && verb_end == null
    _disconnect_collect(iter, hooks, p)
    if (_has_leave(iter, p)) hooks.push([iter as Element, p])
    if (iter === verb_end) verb_end = null
    iter = iter.nextSibling
  }
  _apply_disconnected(node)
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
    // table parts once absolute, and a box split over several lines (or no box) has no single rectangle.
    if (
      l.flow ||
      !(el instanceof HTMLElement) ||
      TABLE_PARTS.has(getComputedStyle(el).display) ||
      el.getClientRects().length !== 1
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

/**
 * Whether anything of `node` is rendered: a box of its own or, with `display: contents` (no box, its
 * children are laid out in its place), something rendered inside it. Not stopped by nested verbs'
 * content: that stays on screen with the node too. Only nodes without a box are descended into, and
 * the descent stops at the first rendered child.
 */
function _renders(node: Element): boolean {
  if (node.getClientRects().length > 0) return true
  if (getComputedStyle(node).display !== "contents") return false
  for (let c = node.firstChild; c != null; c = c.nextSibling) {
    if (c.nodeType === Node.ELEMENT_NODE) {
      if (_renders(c as Element)) return true
    } else if (c.nodeType === Node.TEXT_NODE) {
      // A text node has no getClientRects of its own ; a range over it gives its line boxes (none
      // for collapsed whitespace). `_range` is free: node_remove_range sets it again after this.
      _range ??= document.createRange()
      _range.selectNodeContents(c)
      if (_range.getClientRects().length > 0) return true
    }
  }
  return false
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
 * detached : a single node with `removeChild`, a run of several with one Range call.
 *
 * With `motion`, the removal is an update (docs/md/motion.md): a removed node with a leave hook stays
 * while its hooks and its descendants' run, up to the content of other verbs (whose markers may be in
 * the range too). Without, only `always` hooks run. Leaving nodes already in the range go at once.
 *
 * @group Dom
 */
export function node_remove_range(first: Node, last: Node, motion = false): void {
  // Removed nodes that may stay: connected (removing a detached node is always instant), with a hook.
  let candidates: Leaving[] | null = null
  const may_leave = motion_is_enabled()
  let verb_end: Node | null = null
  for (let n: Node | null = first; n != null; n = n.nextSibling) {
    // Already leaving : removed again, it goes now with the rest (its final removal will do nothing).
    n[sym_connected_status] &= ~NODE_IS_LEAVING
    if (motion && verb_end == null && n[sym_connected_status] & NODE_IS_VERB) verb_end = (n as CommentHolder).end
    const plain = motion && verb_end == null
    if (may_leave && n[sym_connected_status] & NODE_IS_CONNECTED && _has_leave(n, plain)) {
      const hooks: [Element, boolean][] = []
      _disconnect_collect(n, hooks, plain)
      hooks.push([n as Element, plain])
      candidates ??= []
      candidates.push({ node: n as Element, hooks, style: null, flow: false })
    } else {
      node_do_disconnect(n)
    }
    if (n === verb_end) verb_end = null
    if (n === last) break
  }

  const parent = first.parentNode
  if (parent == null) return

  let leaving = false
  if (candidates != null) leaving = start_leaving(candidates)

  if (!leaving) {
    // The usual case : everything goes, in one call.
    _detach_run(parent, first, last)
    return
  }

  // Remove everything but the leaving nodes, one call per run in between.
  let run_first: Node | null = null
  let run_last: Node | null = null
  for (let n: Node | null = first; n != null; ) {
    const next: Node | null = n === last ? null : n.nextSibling
    if (!(n[sym_connected_status] & NODE_IS_LEAVING)) {
      run_first ??= n
      run_last = n
    } else if (run_first != null && run_last != null) {
      _detach_run(parent, run_first, run_last)
      run_first = null
    }
    n = next
  }
  if (run_first != null && run_last != null) _detach_run(parent, run_first, run_last)
}

/**
 * Detach the siblings `first` to `last` (inclusive) of `parent`, already disconnected: a single node
 * with `removeChild`, several with one Range call (cheaper than one `removeChild` each).
 */
function _detach_run(parent: Node, first: Node, last: Node) {
  if (first === last) {
    parent.removeChild(first)
    return
  }
  _range ??= document.createRange()
  _range.setStartBefore(first)
  _range.setEndAfter(last)
  _range.deleteContents()
}

/**
 * Float the candidates out of the layout, run their hooks and their descendants', and mark those that
 * leave. Returns whether any does. The others get their inline style back and go with the rest.
 */
function start_leaving(candidates: Leaving[]): boolean {
  // Nothing visible to animate (nothing rendered among the nodes whose hooks run): it goes at once.
  const shown = candidates.filter((l) => l.hooks.some(([n]) => _renders(n)))
  if (shown.length === 0) return false
  for (const l of shown)
    l.flow = l.hooks.some(([n, plain]) => (n[sym_leave] as LeaveHook[]).some((h) => h.flow && (plain || h.always)))
  // Measured before the hooks : an animation started by a hook would move the node's rectangle.
  float_out(shown)

  let any = false
  for (const l of shown) {
    const promises: PromiseLike<unknown>[] = []
    for (const [n, plain] of l.hooks) {
      for (const h of n[sym_leave] as LeaveHook[]) {
        if (!plain && !h.always) continue
        try {
          const res = h.fn(n)
          if (res != null && typeof (res as PromiseLike<unknown>).then === "function")
            promises.push(res as PromiseLike<unknown>)
        } catch (e) {
          console.error("leave hooks should not throw", e)
        }
      }
    }

    const node = l.node
    if (promises.length === 0) {
      if (l.style != null) (node as HTMLElement).style.cssText = l.style
      continue
    }
    any = true
    node[sym_connected_status] = NODE_IS_LEAVING | (node[sym_connected_status] & NODE_IS_VERB)
    node.setAttribute("e-leaving", "")
    node.setAttribute("inert", "")
    const done = () => _leave_done(node)
    Promise.all(promises).then(done, done)
    if (DEBUG) {
      setTimeout(() => {
        if (node[sym_connected_status] & NODE_IS_LEAVING)
          console.warn("still waiting for its leave hooks after 5s (a promise that never settles?)", node)
      }, 5000)
    }
  }
  return any
}

/**
 * Move the siblings from `first` to `last` (inclusive) before `refchild` in `parent`. Every move done
 * by elt goes through here. Leaving nodes are not moved : they are removed at once.
 *
 * Between two nodes in the page, the move is atomic (`moveBefore`, where the browser has it): focus,
 * selection and running animations are kept, and no connected / disconnected callback runs.
 *
 * @group Dom
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
 * Remove `node` from the tree: disconnect it (its observers stop, its `disconnected` callbacks run),
 * then detach it. A node inserted with `node_append` should be removed with this function.
 *
 * With `motion`, the removal plays exits like a verb's update would ({@link node_remove_range}).
 *
 * @group Dom
 */
export function node_remove(node: Node, motion = false): void {
  node_remove_range(node, node, motion)
}

/**
 * Remove all the children of `node`, like {@link node_remove}.
 * @group Dom
 */
export function node_clear(node: Node, motion = false): void {
  const first = node.firstChild
  // `lastChild` is non-null whenever `firstChild` is
  if (first != null) node_remove_range(first, node.lastChild as Node, motion)
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
    _registered_documents.add(target_document)
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

/**
 * Insert `new_child` before `refchild`, or at the end of `node`. `refchild` may sit deeper than `node` (the
 * `RefChild` of a component is anywhere in its tree), so the insertion goes through `refchild.before`, which
 * also lets a `RefChild` build its `IfChildren` scaffold.
 */
function insert_before(node: Node, new_child: Node, refchild: Node | null) {
  if (refchild != null) (refchild as ChildNode).before(new_child)
  else node.insertBefore(new_child, null)
}

/**
 * Insert `renderable` into `node`, before `refchild`: a node, a string, an array, an observable, a verb,
 * a promise, a decorator or an attribute object. When `node` is in the page, what it inserts is
 * connected (observers start, `connected` callbacks run).
 *
 * With `motion`, the insertion is an update (docs/md/motion.md): the inserted nodes and their
 * descendants play their entry, up to the content of verbs, which only enters with their own updates.
 *
 * @param node The parent to insert the node on
 * @param renderable The insertable that has to be handled
 * @param refchild The child before which to append
 * @param motion Whether the insertion is an update: its content enters
 * @group Dom
 */
export function node_append<N extends Node>(
  node: N,
  renderable: Renderable<N> | Attrs<N>,
  refchild: Node | null = null,
  motion = false,
) {
  _node_append(node, renderable, refchild, true, motion)
}

/**
 * {@link node_append}, also told whether `node` is an element (`is_basic_node`) or uses a
 * `RefChild` insertion point, for the attributes it accepts.
 *
 * @internal
 */
export function _node_append<N extends Node>(
  node: N,
  renderable: Renderable<N> | Attrs<N>,
  refchild: Node | null,
  is_basic_node: boolean,
  motion: boolean,
) {
  if (renderable == null || typeof renderable === "boolean") return

  if (typeof renderable === "string") {
    // A simple string
    insert_before(node, document.createTextNode(renderable), refchild)
  } else if (renderable instanceof Node) {
    // A node being added
    if (renderable.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
      // DocumentFragment
      const start = renderable.firstChild
      if (start == null) return // there are no children to append, nothing more to do

      insert_before(node, renderable, refchild)

      // `start` was the fragment's first child, now moved into `node` : connect until the insertion point
      if (node.isConnected) _connect_siblings(start, refchild, motion)
    } else {
      insert_before(node, renderable, refchild)
      if (node.isConnected) {
        // Already connected, this is a move: it returns at once, nothing enters.
        node_do_connected(renderable, motion)
      } else if (node_is_connected(renderable)) {
        node_do_disconnect(renderable)
      }
    }
  } else if (renderable instanceof Function) {
    // A decorator
    const res = renderable(node)
    if (res != null) _node_append(node, res, refchild, is_basic_node, motion)
  } else if (is_appender(renderable)) {
    // A verb: its first render is its own, it doesn't enter.
    renderable[sym_insert](node, refchild)
  } else if (typeof (renderable as any)[Symbol.iterator] === "function") {
    // An array of children
    for (const item of renderable as Iterable<N>) {
      _node_append(node, item, refchild, is_basic_node, motion)
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
    // A promise is a verb: its content appears between its markers when it resolves, an update when
    // it is in the page by then.
    const _pro = renderable as unknown as Promise<Renderable<N>>
    const holder = new CommentHolder("promise-loading")
    insert_before(node, holder, refchild)
    if (node.isConnected) node_do_connected(holder)
    // Both handlers in one `.then`: an error while rendering the result is not the promise's error.
    _pro.then(
      (res) => {
        if (!holder.parentNode) return
        holder.textContent = "promise-resolved"
        holder.updateRenderable(res as Renderable<Node>, node_is_connected(holder))
      },
      (e) => {
        console.error(e)
        holder.textContent = `promise-error: ${e.toString()}`
      },
    )
  } else {
    // Otherwise, make it a string and append it.
    insert_before(node, document.createTextNode(renderable.toString()), refchild)
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
  // Every ShadowRootInit option is passed on (`clonable`, `serializable`, …), with elt's defaults
  const { css: _css, ...init } = opts
  const shadow = node.attachShadow({ mode: "open", delegatesFocus: true, slotAssignment: "named", ...init })

  let css = _css
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

  shadow.insertBefore(child, null)

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
 * Used mostly by {@link $observe}; {@link o.ObserverHolder.observe} follows the same rules (see {@link o.make_observer}).
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

  return o.make_observer(node_owner, node, obs, obsfn, options)
}

/** Observers of a node observe while it is in the document. */
const node_owner: o.ObserverOwner<Node> = {
  add: node_add_observer,
  when_observing: node_on_connected,
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

/**
 * Listen to `key` events on `node`, or on another `target`. On the node itself, the listener is added once and
 * lives as long as the node. On another target, it is added while `node` is in the page, and removed when it
 * leaves, so that the target never keeps a removed node alive.
 *
 * @group Dom
 */
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
    if (target === node) {
      // On the node itself, the listener goes away with the node: add it once, whether the node is in the page or
      // not (so that `once` really means once, and no lifecycle callback is needed).
      node.addEventListener(event, listener, use_capture)
      return
    }
    function add() {
      target.addEventListener(event, listener, use_capture)
    }
    // On another target, the listener *must* be removed when the node goes away, or the target keeps it (and the
    // node) alive: it is added while the node is in the page only.
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
  // `style={cond && {...}}`: false (or a stray true) is no style, like null
  if (style == null || typeof style === "boolean") return
  if (o.is_observable(style)) {
    node_observe(
      node,
      style,
      (st: any, old: any) => {
        if (st == null || typeof st === "boolean") {
          node.removeAttribute("style")
          return
        }
        if (typeof st === "string") {
          node.setAttribute("style", st)
          return
        }
        if (typeof old === "string") {
          // The previous value was the whole attribute: start from an empty style
          node.removeAttribute("style")
        } else if (old != null && typeof old === "object") {
          // Remove the properties the previous object had and this one does not
          for (const x of Object.keys(old)) if (!(x in st)) node.style.removeProperty(css_property_name(x))
        }
        for (const x of Object.keys(st)) set_style_property(node, css_property_name(x), st[x])
      },
      { immediate: true },
    )
  } else if (typeof style === "string") {
    node.setAttribute("style", style)
  } else {
    // An object whose values may be observables
    const st = style as any
    for (const x of Object.keys(st)) {
      const css_name = css_property_name(x)
      node_observe(node, st[x], (value) => set_style_property(node, css_name, value), { immediate: true })
    }
  }
}

/** `backgroundColor` → `background-color`; custom properties (`--myColor`) are case-sensitive and kept as they are. */
function css_property_name(name: string) {
  return name.startsWith("--") ? name : name.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
}

/** `null`, `undefined`, `false` and `""` remove the property; any other value (`0` included) sets it. */
function set_style_property(node: HTMLElement | SVGElement, css_name: string, value: unknown) {
  if (value == null || value === false || value === "") node.style.removeProperty(css_name)
  else node.style.setProperty(css_name, String(value))
}

function _is_plain_class_object(c: any): c is { [name: string]: o.RO<any> } {
  return c.constructor === Object
}

/**
 * Observe a complex class definition and update the node as needed.
 * @group Dom
 */
export function node_observe_class(node: Element, c: ClassDefinition) {
  // `class={cond && "x"}`: false, null, undefined (and a stray true) add no class
  if (!c || typeof c === "boolean") return
  if (typeof c === "string" || !_is_plain_class_object(c)) {
    // c is a string, an array of class names, or an observable of either (whose value may be false / null)
    node_observe(
      node,
      c,
      (str, chg) => {
        if (chg !== o.NoValue) node_remove_class(node, chg)
        node_apply_class(node, str)
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

/** Add the classes of `c`, a space-separated string or an array of them. `false`, `null`, `undefined` and `true` (here or as array entries) add nothing. */
export function node_apply_class(node: Element, c: ClassValue | ClassValue[] | true) {
  _class_each(c, (name) => node.classList.add(name))
}

/** Remove the classes of `c`, given as {@link node_apply_class} takes them. */
export function node_remove_class(node: Element, c: ClassValue | ClassValue[] | true) {
  _class_each(c, (name) => node.classList.remove(name))
}

function _class_each(c: ClassValue | ClassValue[] | true, fn: (name: string) => void) {
  if (Array.isArray(c)) {
    for (let i = 0, l = c.length; i < l; i++) _class_each(c[i], fn)
    return
  }
  if (c == null || typeof c === "boolean") return
  const cs = String(c)
  if (!cs) return
  for (const _ of cs.split(/\s+/g)) {
    if (_) fn(_)
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
