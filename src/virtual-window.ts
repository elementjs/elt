/*
 * Maintainer notes — rules for changing `VirtualWindow` (the base of `RepeatVirtual` and
 * `RepeatCircular`) or any measure-driven list. They do not apply to ordinary `Repeat` code.
 *
 * Positions are logical: measured along the list's axis (vertical, or horizontal with `.Horizontal()`),
 * growing from the list's start towards its end whatever the direction (in right-to-left, the start
 * is on the physical right). `Axis` turns the browser's physical values into logical ones, once per
 * read: nothing else in the windowing knows about directions. "Start" and "end" below are logical.
 *
 * - Never interleave layout reads (`getBoundingClientRect`, `scrollTop`, …) with observable-driven
 *   DOM writes in one loop: every read after a write forces a reflow, making the pass O(n) reflows.
 *   Read once, compute, write in one batch, converge on later frames.
 * - Nothing is measured while the user scrolls within the margins. An IntersectionObserver watches
 *   the two padders and runs a pass when one comes within `threshold / 2` of the viewport. A pass
 *   reads the viewport and the two ends of the rendered content; rows are read only when the window
 *   changes, from each end, stopping at the first row that doesn't qualify (the trim count, the row
 *   pinned across the change), and the one read after the write (the pinned row's new position) is
 *   the pass's only forced layout.
 * - The observer only reports changes of inside/outside its zone: after every window change, restart
 *   watching the padders so that one still short gets reported again. The scroll listener still
 *   handles jumps (one scroll farther than the viewport), which can carry a padder across the zone
 *   without it ever being inside.
 * - Keep the content stable through the **start padder**, never by writing the scroll position while
 *   the user scrolls. The list writes the scroll position only as one write outside any windowing
 *   pass, through `scroll_by` (which tells `on_scroll` it was not the user's jump): an explicit jump
 *   (`setPosition`, the initial position), rows prepended to a `RepeatVirtual` (content grows before
 *   the pinned row, and the padder can't shrink below 0), a `RepeatCircular` recentring once scrolling
 *   has stopped.
 * - The start padder is measurement-driven (the real sizes of the rows it replaces, gaps and margins
 *   included, since it is the measured shift of the pinned row), not `index * estimate`. The end
 *   padder may stay estimate-only: it is after everything on screen.
 * - Keep `overflow-anchor: none` on the scroll area so the browser's own scroll anchoring doesn't
 *   fight the padder. The list sets it inline on the scroll area it finds, and restores the previous
 *   value when the last list using that scroll area disconnects.
 * - The padders are `<e-virtual-padder>` elements right next to the rows, in the element holding
 *   them: `[prefix][start padder][rows…][end padder][suffix]`. Not in a shadow root around that
 *   element (as they once were): a sticky row is held inside its parent's box, so padders outside
 *   that box let the box's edge, and the sticky row with it, come into view on a scroll the list
 *   hasn't caught up with yet. Next to the rows, the parent spans the whole scroll size. See
 *   docs/src/adr/0004-virtual-padders-next-to-rows.md.
 * - A padder shows only while rows are hidden on its side (`display: none` otherwise). Shown, it
 *   always stands for at least one row, whose gap pays for the padder's own gap: hiding it as those
 *   rows render swaps equal sizes, so no gap value ever needs to be known. Never show a padder
 *   standing for no row: its gap would be an extra seam at the list's end.
 * - Its layout properties are inline styles, which no stylesheet rule (a packed container's padding
 *   on its children, …) out-ranks short of `!important`.
 */

import type { Renderable } from "./types"

import { o } from "./observable"

import { node_append, node_observe, node_on_connected, node_on_disconnected } from "./dom"

import { Repeat } from "./verbs"

import { sym_insert } from "./symbols"

const debug = {
  red: "color: #ff3c00; font-weight: bold;",
  green: "color: #66f100; font-weight: bold;",
}

export type RepeatItem<Obs extends Repeat.RepeatedObservable<any>> = Repeat.RepeatItemElement<Obs>

/** Logical bounds of a row: its start, its end, and its size along the axis. */
type ItemBounds = { start: number; end: number; size: number }

/**
 * The list's axis and direction: physical values of the browser turned into logical ones (see the
 * maintainer notes). Chosen once per connection.
 */
type Axis = {
  horizontal: boolean
  /** Logical start and end of a box. */
  start(r: DOMRect): number
  end(r: DOMRect): number
  /** The scroll offset, growing towards the list's end. */
  scroll(area: HTMLElement): number
  /** Scroll by `delta` towards the list's end. */
  scroll_by(area: HTMLElement, delta: number): void
  /** The visible size of the scroll area along the axis. */
  client_size(area: HTMLElement): number
  /** The scroll area's border on its start side. */
  border_start(area: HTMLElement): number
  /** The scroll area's `scroll-padding` on its start side: room covered by something (a sticky header). */
  scroll_padding_start(style: CSSStyleDeclaration): number
}

const VERTICAL: Axis = {
  horizontal: false,
  start: (r) => r.top,
  end: (r) => r.bottom,
  scroll: (area) => area.scrollTop,
  scroll_by: (area, delta) => {
    area.scrollTop += delta
  },
  client_size: (area) => area.clientHeight,
  border_start: (area) => area.clientTop,
  scroll_padding_start: (style) => Number.parseFloat(style.scrollPaddingTop) || 0,
}

const HORIZONTAL: Axis = {
  horizontal: true,
  start: (r) => r.left,
  end: (r) => r.right,
  scroll: (area) => area.scrollLeft,
  scroll_by: (area, delta) => {
    area.scrollLeft += delta
  },
  client_size: (area) => area.clientWidth,
  border_start: (area) => area.clientLeft,
  scroll_padding_start: (style) => Number.parseFloat(style.scrollPaddingLeft) || 0,
}

/** Right-to-left: the start is on the right, and `scrollLeft` goes from 0 down to negative values. */
const HORIZONTAL_RTL: Axis = {
  horizontal: true,
  start: (r) => -r.right,
  end: (r) => -r.left,
  scroll: (area) => -area.scrollLeft,
  scroll_by: (area, delta) => {
    area.scrollLeft -= delta
  },
  client_size: (area) => area.clientWidth,
  // `clientLeft` is the left border (and a scrollbar placed on the left): the right border is what
  // remains of the box once the visible part and the left side are taken out.
  border_start: (area) => area.offsetWidth - area.clientWidth - area.clientLeft,
  scroll_padding_start: (style) => Number.parseFloat(style.scrollPaddingRight) || 0,
}

/** Inline style of a padder: what it must be whatever rules the page has for its parent's children.
 * It spans every track across the axis, so that it never takes a cell of a grid. */
const PADDER_STYLE =
  "display: none; flex: none; box-sizing: content-box; min-height: 0; min-width: 0; padding: 0; margin: 0; border: 0;"
const PADDER_VERTICAL = `${PADDER_STYLE} grid-column: 1 / -1; height: 0;`
const PADDER_HORIZONTAL = `${PADDER_STYLE} grid-row: 1 / -1; width: 0;`

/** Creates one of a list's two padders (see the maintainer notes). */
function create_padder(): HTMLElement {
  const padder = document.createElement("e-virtual-padder")
  padder.setAttribute("aria-hidden", "true")
  padder.style.cssText = PADDER_VERTICAL
  return padder
}

/** `overflow` values that make an element a scroll area the user can scroll. */
const SCROLLING_OVERFLOW = new Set(["auto", "scroll", "overlay"])

/** The parent of `node` in the flattened tree: a slotted node's slot, a shadow root's host. */
function flat_parent(node: Node): Element | null {
  if (node instanceof Element && node.assignedSlot != null) return node.assignedSlot
  const parent = node.parentNode
  if (parent instanceof ShadowRoot) return parent.host
  return parent instanceof Element ? parent : null
}

/** `display` values of an element whose children are table rows. */
const TABLE_ROW_PARENTS = new Set([
  "table",
  "inline-table",
  "table-row-group",
  "table-header-group",
  "table-footer-group",
])

/** `display` values of an element that lays out a block child along either axis. */
const FLEX_OR_GRID = new Set(["flex", "inline-flex", "grid", "inline-grid"])

/** Lists per scroll area, and the inline `overflow-anchor` it had before the first one. */
const anchor_holds = new WeakMap<HTMLElement, { count: number; previous: string }>()

/** Turns the browser's scroll anchoring off on `area` while at least one list uses it. */
function hold_anchor(area: HTMLElement) {
  const hold = anchor_holds.get(area)
  if (hold != null) {
    hold.count++
    return
  }
  anchor_holds.set(area, { count: 1, previous: area.style.overflowAnchor })
  area.style.overflowAnchor = "none"
}

function release_anchor(area: HTMLElement) {
  const hold = anchor_holds.get(area)
  if (hold == null) return
  if (--hold.count > 0) return
  anchor_holds.delete(area)
  area.style.overflowAnchor = hold.previous
}

/** What a virtual list's render function receives. */
export type VirtualRenderFn<O extends o.IReadonlyObservable<any[] | null | undefined>> = (
  ob: O extends o.IObservable<(infer T)[] | null | undefined, (infer T)[]>
    ? o.Observable<T>
    : O extends o.ReadonlyObservable<(infer T)[] | null | undefined>
      ? o.ReadonlyObservable<T>
      : never,
  n: o.RO<number>,
) => Renderable<HTMLElement>

/**
 * The windowing shared by {@link RepeatVirtual} and {@link RepeatCircular}: only the rows near the
 * visible part of the scroll area are rendered, the others stood for by two padders. What differs is
 * what lies past the rendered rows: a list's true ends, or a ring's endless runway.
 *
 * Indices here are a row's position in the window's index space: the list's indices for a list,
 * unbounded integers for a ring ({@link lower} and {@link upper} are its bounds).
 */
export abstract class VirtualWindow<
  O extends o.IReadonlyObservable<any[] | null | undefined>,
> extends Repeat.Repeater<O> {
  /** The number of pixels beyond the visible area within which rows are created / dropped */
  protected threshold = 500

  /** The scroll area, found when the list is connected */
  protected scroll_area: HTMLElement | null = null

  /** Set by `.Horizontal()`: the list is laid out, scrolled and measured horizontally. */
  protected horizontal = false

  /** Set at connection, from `horizontal` and the direction of the rows' parent. */
  protected axis: Axis = VERTICAL

  /** Stand for the rows before and after the rendered ones (see the maintainer notes). */
  protected padder_start = create_padder()
  protected padder_end = create_padder()

  /** `display` of a shown padder: `table-row` among a table's rows, `block` anywhere else. */
  protected padder_display = "block"

  o_pos_start = o(0)
  o_pos_end = o(0)

  o_padding_start = o(0)
  o_padding_end = o(0)

  /** Estimated row size in pixels, refined from measurements as rows are rendered */
  protected item_size = 64

  /** The index shown first when the list is connected */
  protected initial_position = 0

  /** Whether a position was asked for (`InitialPosition`, `setPosition`), not the default 0. */
  protected explicit_position = false

  /** Index to bring to the start of the visible area once the scroll area has a size. */
  protected pending_target: number | null = null

  /** Re-evaluates when the scroll area's size changes (the padders' observer only reports padders
   * crossing its line, not the viewport growing past rows it already rendered). */
  protected _observer = new ResizeObserver(() => {
    this.eval()
  })

  /** Watches the two padders: one entering the zone near the viewport means that side needs rows.
   * Created when connected, since its root is the scroll area. */
  protected _padder_io: IntersectionObserver | null = null

  /** The last scroll offset seen or written, to tell jumps from small scrolls. */
  protected scroll_last = 0

  /** Last index window we reconciled, to skip the redundant observer-driven pass
   * that fires right after an explicit {@link reconcileView}. */
  protected _last_view_start = -1
  protected _last_view_end = -1

  debug = 0

  get pos_start() {
    return o.get(this.o_pos_start)
  }

  get pos_end() {
    return o.get(this.o_pos_end)
  }

  /** The verb's name, for errors. */
  protected abstract readonly verb_name: string
  /** The first index of the index space (`-Infinity` for a ring). */
  protected abstract lower(): number
  /** One past the last index of the index space (`Infinity` for a ring). */
  protected abstract upper(): number
  /** Rough index of the row at the visible area's start. Reads layout: call it before writing anything. */
  protected abstract estimateIndexFromScroll(): number
  /** Size both padders afresh after the window was replaced (reposition, data change), where there is
   * no anchor to preserve. `old_start` is where the window started before. */
  protected abstract update_padding(old_start: number): void
  /** Size the end padder after a window change (it never moves on-screen content). */
  protected abstract update_padding_end(): void
  /** The index `setPosition(n)` brings to the visible area's start, null when there are no rows. */
  protected abstract target_of(n: number): number | null

  /** How many pixels beyond the visible area rows are created or dropped (default 500). */
  Threshold(px: number) {
    this.threshold = px
    return this
  }

  /** The estimated row size in pixels (default 64), refined as rows are measured. A close
   * estimate makes the scrollbar accurate sooner. */
  ItemSize(px: number) {
    this.item_size = px
    return this
  }

  /** The row shown first, at the start of the visible area, when the list is connected or its rows
   * appear (default 0). Negative counts from the end: -1 is the last row. */
  InitialPosition(index: number) {
    this.initial_position = index
    this.explicit_position = true
    return this
  }

  /** Lay the list out, scroll it and measure it horizontally: rows side by side, in a scroll area
   * that scrolls horizontally. Right-to-left when the rows' parent is (`direction: rtl`). */
  Horizontal() {
    this.horizontal = true
    return this
  }

  constructor(obs: O, renderfn?: VirtualRenderFn<O>) {
    super(obs, renderfn as unknown as Repeat.RenderItemFn<O>)
    this.ForView(this.o_pos_start, this.o_pos_end)
  }

  /** The number of items in the list. */
  protected length() {
    return o.get(this.obs)?.length ?? 0
  }

  /** Whether rows are hidden before (after) the rendered ones. */
  protected has_before() {
    return this.length() > 0 && this.pos_start > this.lower()
  }

  protected has_after() {
    return this.length() > 0 && this.pos_end < this.upper()
  }

  /**
   * The nearest ancestor, in the flattened tree, that scrolls along the axis. The page itself doesn't
   * count (`body` and `html` end the search): a virtual list's scroll area is always deliberate.
   */
  protected find_scroll_area(): HTMLElement {
    const body = document.body
    const html = document.documentElement
    for (let el = flat_parent(this.__list); el != null && el !== body && el !== html; el = flat_parent(el)) {
      if (!(el instanceof HTMLElement)) continue
      const style = getComputedStyle(el)
      if (SCROLLING_OVERFLOW.has(this.horizontal ? style.overflowX : style.overflowY)) return el
    }
    const name = this.verb_name
    throw new Error(
      this.horizontal
        ? `${name} must be inside an element that scrolls horizontally (overflow-x: auto or scroll) and has a bounded width`
        : `${name} must be inside an element that scrolls vertically (overflow-y: auto or scroll) and has a bounded height`,
    )
  }

  /**
   * The first item met walking from `from` (included) towards the list's end, or its start when
   * `backward`, skipping other nodes (an item's content, a leaving row). Null past the list's
   * markers.
   */
  protected find_item(from: Node | null | undefined, backward: boolean): RepeatItem<O> | null {
    const stop = backward ? this.__list : this.__list.end
    for (let iter = from; iter != null && iter !== stop; iter = backward ? iter.previousSibling : iter.nextSibling) {
      if (iter instanceof Repeat.RepeatItemElement) return iter
    }
    return null
  }

  protected first_item() {
    return this.find_item(this.__list.nextSibling, false)
  }

  protected last_item() {
    return this.find_item(this.__list.end?.previousSibling, true)
  }

  protected next_item(item: RepeatItem<O>) {
    return this.find_item((item.end ?? item).nextSibling, false)
  }

  protected prev_item(item: RepeatItem<O>) {
    return this.find_item(item.previousSibling, true)
  }

  protected jump_threshold() {
    const area = this.scroll_area
    return Math.max(this.threshold, area == null ? 0 : this.axis.client_size(area))
  }

  protected boundsValid(bounds: ItemBounds) {
    return bounds.start !== Infinity && bounds.end !== -Infinity && bounds.size > 0
  }

  /** How many rows probably fill the visible area, with a margin of 10 (only the margin before
   * connection, when there's no visible area yet). */
  protected screenful() {
    const area = this.scroll_area
    return Math.ceil((area == null ? 0 : this.axis.client_size(area)) / this.item_size + 10)
  }

  /** The logical bounds of the scroll area, with its size along the axis. */
  protected region(area: HTMLElement) {
    const r = area.getBoundingClientRect()
    const start = this.axis.start(r)
    const end = this.axis.end(r)
    return { start, end, size: end - start }
  }

  /**
   * Show row `n` (negative: counted from the end) at the start of the visible area, rendering the rows
   * around it. Before the list is connected, or while it is empty, it sets the row shown first
   * once there are rows.
   */
  setPosition(n: number) {
    this.explicit_position = true
    this.jump_to(n)
  }

  /** {@link setPosition}, from the list itself (the initial position). */
  protected jump_to(n: number) {
    const target = this.scroll_area == null ? null : this.target_of(n)
    if (target == null) {
      this.initial_position = n
      if (this.scroll_area != null) this.reposition(0)
      return
    }
    this.reposition(target)
    // The first rows, never moved: the scroll area shows them as laid out, with what comes before
    // the list (a sticky header).
    if (n === 0 && !this.explicit_position) return
    this.pending_target = target
    // After the current transaction, if any, has written the rows and the padders, before the paint.
    queueMicrotask(() => this.scroll_to_pending())
  }

  /** The rendered row at `index`, if any. */
  protected item_at_index(index: number): RepeatItem<O> | null {
    for (let item = this.first_item(); item != null; item = this.next_item(item)) {
      if (item[Repeat.sym_obs].o_prop.get() === index) return item
    }
    return null
  }

  /**
   * Scroll so that the row at {@link pending_target} is at the start of the visible area: one layout
   * read, one scroll write. An explicit jump is not a user scroll (see the maintainer notes). Waits
   * for a scroll area with a size (hidden at connection).
   */
  protected scroll_to_pending() {
    const area = this.scroll_area
    const target = this.pending_target
    if (area == null || target == null) return
    const region = this.region(area)
    if (region.size === 0) return
    const item = this.item_at_index(target)
    const bounds = item == null ? null : this.getBounds(item)
    if (bounds == null || !this.boundsValid(bounds)) {
      // Not rendered (the window moved since): the next pass retries.
      this.eval()
      return
    }
    this.pending_target = null
    // `scroll-padding` is where the scroll area says what covers its start (a sticky header).
    const padding = this.axis.scroll_padding_start(getComputedStyle(area))
    this.scroll_by(bounds.start - region.start - this.axis.border_start(area) - padding)
  }

  /**
   * Scroll by `delta` pixels towards the list's end. Every scroll the list writes goes through here:
   * `on_scroll` would take it for a user's jump if it didn't know.
   */
  protected scroll_by(delta: number) {
    // biome-ignore lint/style/noNonNullAssertion: only called while connected, with a scroll area
    const area = this.scroll_area!
    if (delta === 0) return
    this.axis.scroll_by(area, delta)
    this.scroll_last = this.axis.scroll(area)
    this.scroll_last_valid = true
  }

  /** Render the window around index `n`, replacing whatever was rendered, without scrolling: the
   * scroll position stays the user's, the start padder is sized so the rows land around it. */
  protected reposition(n: number) {
    const old_start = this.pos_start
    if (this.length() === 0 || this.scroll_area == null) {
      o.transaction(() => {
        this.o_pos_start.set(0)
        this.o_pos_end.set(0)
      })
      this.update_padding(old_start)
      this.reconcileView(0, 0)
      return
    }

    // Land with a margin's worth of rows on both sides of the viewport, not just after it: with
    // nothing rendered before, a scroll back drawn before the next pass shows the blank start padder.
    const lower = this.lower()
    const upper = this.upper()
    const target = Math.max(lower, Math.min(n, upper - 1))
    const margin_rows = Math.ceil(this.threshold / this.item_size)
    const start = Math.max(lower, target - margin_rows)
    const end = Math.min(upper, target + this.screenful() + margin_rows)

    o.transaction(() => {
      this.o_pos_start.set(start)
      this.o_pos_end.set(end)
    })
    this.update_padding(old_start)
    this.reconcileView(start, end)
    this.observe_padders()
    this.eval()
  }

  /** Restart watching both padders, so the observer reports their state afresh on the next frame
   * even if it didn't change: after a window change that fell short, a padder still inside the zone
   * would otherwise never be reported again. (`observe` on a watched target does nothing.) */
  protected observe_padders() {
    const io = this._padder_io
    const area = this.scroll_area
    if (io == null || area == null) return
    io.unobserve(this.padder_start)
    io.unobserve(this.padder_end)
    io.observe(this.padder_start)
    io.observe(this.padder_end)
  }

  /** Show each padder only while rows are hidden on its side (see the maintainer notes). */
  protected update_padders_display() {
    this.padder_start.style.display = this.has_before() ? this.padder_display : "none"
    this.padder_end.style.display = this.has_after() ? this.padder_display : "none"
  }

  /** Keep `anchor` at the same viewport position after a view change by absorbing the
   * shift into the *start padder* — never by writing the scroll position. Writing it
   * mid-scroll fights the browser's own scrolling and is what made it flicker.
   * Because the padder carries the measured shift (not `index * estimate`), the
   * rendered content stays put regardless of how wrong the size estimate is. */
  protected preserveScrollAnchor(anchor: RepeatItem<O>, anchor_start_before: number) {
    const new_start = this.getBounds(anchor).start
    // Guard against a transiently unmeasurable anchor (Infinity) poisoning the
    // padder; a frame with no correction is harmless, a NaN padder is not.
    if (!Number.isFinite(new_start) || !Number.isFinite(anchor_start_before)) {
      return
    }
    const shift = new_start - anchor_start_before
    if (shift !== 0) {
      this.o_padding_start.set(Math.max(0, o.get(this.o_padding_start) - shift))
    }
  }

  protected applyViewChange(
    new_pos_start: number,
    new_pos_end: number,
    anchor: RepeatItem<O> | null,
    anchor_start_before: number | null,
  ) {
    if (new_pos_start === this.pos_start && new_pos_end === this.pos_end) {
      return false
    }

    // The transaction's view-observer reconcile updates the end padder and the
    // DOM rows, but deliberately leaves the start padder alone (see reconcile_view),
    // so the rows shift by exactly the size of what was added/removed before them.
    o.transaction(() => {
      this.o_pos_start.set(new_pos_start)
      this.o_pos_end.set(new_pos_end)
    })

    if (anchor != null && anchor_start_before != null) {
      this.preserveScrollAnchor(anchor, anchor_start_before)
    }

    // At the very start the padder must be exactly 0; snap away any drift the
    // incremental measured corrections may have accumulated.
    if (new_pos_start === this.lower()) {
      this.o_padding_start.set(0)
    }

    return true
  }

  /**
   * Rows read from the start, stopping as soon as possible: how many lie entirely before
   * `trim_before` (pass `-Infinity` to trim none), then the first row reaching the viewport's start,
   * `view_start` — the row pinned across the change. Anything before it is off-screen, so a reflow
   * there is absorbed by the start padder instead of moving the visible content.
   */
  protected scanStart(trim_before: number, view_start: number) {
    let trim = 0
    let trimming = true
    for (let item = this.first_item(); item != null; item = this.next_item(item)) {
      const bounds = this.getBounds(item)
      if (!this.boundsValid(bounds)) break
      if (trimming && bounds.end < trim_before) {
        trim++
        continue
      }
      trimming = false
      if (bounds.end > view_start) return { trim, anchor: item, anchor_start: bounds.start }
    }
    return { trim, anchor: null, anchor_start: null }
  }

  /** Rows read from the end backwards, stopping at the first that doesn't qualify: how many lie
   * entirely after `limit`. */
  protected countAfter(limit: number) {
    let count = 0
    for (let item = this.last_item(); item != null; item = this.prev_item(item)) {
      const bounds = this.getBounds(item)
      if (!this.boundsValid(bounds) || bounds.start <= limit) break
      count++
    }
    return count
  }

  /**
   * Position of the start of the rendered content: the start padder's end while it shows, else the
   * first row that has a box.
   */
  protected content_start(): number | null {
    if (this.has_before()) return this.axis.end(this.padder_start.getBoundingClientRect())
    for (let item = this.first_item(); item != null; item = this.next_item(item)) {
      const bounds = this.getBounds(item)
      if (this.boundsValid(bounds)) return bounds.start
    }
    return null
  }

  /** Position of the end of the rendered content (see {@link content_start}). */
  protected content_end(): number | null {
    if (this.has_after()) return this.axis.start(this.padder_end.getBoundingClientRect())
    for (let item = this.last_item(); item != null; item = this.prev_item(item)) {
      const bounds = this.getBounds(item)
      if (this.boundsValid(bounds)) return bounds.end
    }
    return null
  }

  /** The padders' observer reported: a pass, told which padders it saw inside its zone. */
  protected on_padders(entries: IntersectionObserverEntry[]) {
    if (this.scroll_area == null) return
    let start = false
    let end = false
    // Entries are in time order: the last one for a padder is its current state. A hidden padder
    // (no rows left on its side) is reported outside.
    for (const entry of entries) {
      if (entry.target === this.padder_start) start = entry.isIntersecting
      else if (entry.target === this.padder_end) end = entry.isIntersecting
    }
    this.real_eval(start, end)
  }

  /**
   * One windowing pass. Run when a padder crosses the line `threshold / 2` away from the viewport
   * (the IntersectionObserver), and on demand on the next frame after a reposition, a data change
   * or a resize ({@link eval}). It reads the viewport and the two ends of the rendered content, and
   * only reads more rows when the window changes.
   */
  protected real_eval = (start_inside = false, end_inside = false) => {
    const area = this.scroll_area
    if (area == null || this.length() === 0 || this.pos_end === this.pos_start) {
      return
    }

    const region = this.region(area)
    // A hidden scroll area has no layout: every side would look short, and the window would grow
    // to the whole list. Its ResizeObserver runs a pass once it shows.
    if (region.size === 0) {
      return
    }
    if (this.pending_target != null) {
      this.scroll_to_pending()
      return
    }
    const content_start = this.content_start()
    const content_end = this.content_end()
    if (content_start == null || content_end == null) {
      return
    }
    const threshold = this.threshold

    // The rendered content is entirely out of the zone (programmatic jump, a jump the scroll
    // listener didn't see): reposition wholesale from a scroll estimate.
    if (content_end < region.start - threshold || content_start > region.end + threshold) {
      const idx = this.estimateIndexFromScroll()
      if (idx < this.pos_start || idx >= this.pos_end) {
        this.reposition(idx)
        return
      }
    }

    // Refine the average row-size estimate from the content's extent (gaps between rows
    // included). Damped, and only committed
    // past 1px so sub-pixel noise never re-jitters the padders / scrollbar; but taken as is when it
    // is more than 25% off (the first pass with a wrong `ItemSize`), since every margin computed
    // from it until then is off by as much.
    const measured = (content_end - content_start) / (this.pos_end - this.pos_start)
    const diff = measured - this.item_size
    if (measured > 0 && Math.abs(diff) > 1) {
      this.item_size += Math.abs(diff) > this.item_size / 4 ? diff : diff / 4
    }

    // A side whose rendered margin fell under half the threshold is refilled to the threshold in
    // one change, rather than by a row or two every frame: each change costs a layout of all the
    // rendered rows (a subgrid lays out its whole grid again), whatever the number of rows added.
    const before = region.start - content_start
    const after = content_end - region.end
    const low = threshold / 2
    // A padder the observer reports inside its zone is short, whatever the measures say: it counts
    // a padder lying exactly on its line as inside, where `after < low` doesn't (and the two may
    // round differently). Not growing then would leave that padder inside, never reported again.
    const grow_start = this.has_before() && (start_inside || before < low)
    const grow_end = this.has_after() && (end_inside || after < low)
    if (!grow_start && !grow_end) {
      return
    }

    let new_start = this.pos_start
    let new_end = this.pos_end
    if (grow_start) {
      new_start -= Math.max(1, Math.ceil((threshold - before) / this.item_size))
    }
    if (grow_end) {
      new_end += Math.max(1, Math.ceil((threshold - after) / this.item_size))
    }

    // The side opposite the one growing is the one the scroll moves away from: trim it back to the
    // threshold in the same change.
    const pinned = this.scanStart(grow_end && !grow_start ? region.start - threshold : -Infinity, region.start)
    new_start += pinned.trim
    if (grow_start && !grow_end) {
      new_end -= this.countAfter(region.end + threshold)
    }

    const upper = this.upper()
    new_start = Math.max(this.lower(), Math.min(new_start, upper))
    new_end = Math.max(new_start, Math.min(new_end, upper))

    if (this.debug >= 3 && (new_start !== this.pos_start || new_end !== this.pos_end)) {
      console.log(
        `%cwindow [${this.pos_start},${this.pos_end}) -> [${new_start},${new_end})`,
        new_start < this.pos_start || new_end > this.pos_end ? debug.green : debug.red,
      )
    }

    if (this.applyViewChange(new_start, new_end, pinned.anchor, pinned.anchor_start)) {
      // The estimate may have under/over-shot: have the padders reported afresh on the next frame.
      this.observe_padders()
    }
  }

  /** Wrapper for real_eval that limits it to animationFrames */
  protected eval = (() => {
    let _requested_animation_frame: number | null = null
    return () => {
      if (_requested_animation_frame == null) {
        _requested_animation_frame = requestAnimationFrame(() => {
          this.real_eval()
          _requested_animation_frame = null
        })
      }
    }
  })()

  /** Union one element's box, or descend when it generates no box (e.g. display:contents). */
  protected measureElement(elt: HTMLElement, res: ItemBounds) {
    const r = elt.getBoundingClientRect()
    if ((this.axis.horizontal ? r.width : r.height) > 0) {
      res.start = Math.min(res.start, this.axis.start(r))
      res.end = Math.max(res.end, this.axis.end(r))
      return
    }

    let child = elt.firstElementChild
    while (child != null) {
      if (child instanceof HTMLElement) {
        this.measureElement(child, res)
      }
      child = child.nextElementSibling
    }
  }

  /** Logical bounds of one repeat item's rendered content. */
  protected getBounds(r: RepeatItem<O>): ItemBounds {
    const res: ItemBounds = { start: Infinity, end: -Infinity, size: 0 }

    const end = r.end
    let iter: Node | null = r.nextSibling
    while (iter != null && iter !== end) {
      if (iter instanceof HTMLElement) {
        this.measureElement(iter, res)
      }
      iter = iter.nextSibling
    }

    res.size = res.end - res.start
    return res
  }

  /** The list's index of the row at index `i` of the index space. */
  protected data_index(i: number) {
    return i
  }

  /**
   * The index of the row `px` pixels from the start of the visible area (its centre line, for a wheel),
   * null when no rendered row is there. One layout read: call it when scrolling stops, not on every
   * scroll (see the maintainer notes).
   */
  itemAt(px: number): number | null {
    const area = this.scroll_area
    if (area == null) return null
    const line = this.region(area).start + this.axis.border_start(area) + px
    for (let item = this.first_item(); item != null; item = this.next_item(item)) {
      const bounds = this.getBounds(item)
      if (this.boundsValid(bounds) && bounds.start <= line && line < bounds.end) {
        return this.data_index(item[Repeat.sym_obs].o_prop.get())
      }
    }
    return null
  }

  /** Explicit windowing pass (used at init and after {@link setPosition}). Records
   * the window so the observer-driven {@link reconcile_view} that fires from the
   * same `o_pos_*` write skips the identical second reconciliation.
   *
   * `_last_view_*` is written by {@link before_reconcile}, right before the reconcile runs. */
  protected override reconcileView(start: number, end: number) {
    if (start === this._last_view_start && end === this._last_view_end) {
      return this
    }
    return super.reconcileView(start, end)
  }

  protected override reconcile_view() {
    // Only the end padder here — the start padder is owned by the anchor
    // correction in applyViewChange and must not be reset to an estimate.
    this.update_padding_end()
    if (this.pos_start === this._last_view_start && this.pos_end === this._last_view_end) {
      return
    }
    super.reconcile_view()
  }

  /** Record the window being reconciled (see {@link reconcileView}). */
  protected override before_reconcile(override?: Repeat.View) {
    this._last_view_start = override?.start ?? this.pos_start
    this._last_view_end = override?.end ?? this.pos_end
  }

  /** Scroll listener of the scroll area, bound so that the disconnection can remove it. */
  protected on_scroll = () => {
    // biome-ignore lint/style/noNonNullAssertion: only listening while connected, with a scroll area
    const area = this.scroll_area!
    // The list's own writes update `scroll_last` (scroll_by), so a difference is the user's scroll.
    const st = this.axis.scroll(area)
    const prev = this.scroll_last

    if (this.scroll_last_valid) {
      const delta = st - prev
      if (Math.abs(delta) > this.jump_threshold()) {
        this.scroll_last = st
        this.reposition(this.estimateIndexFromScroll())
        this.on_scrolled()
        return
      }
    }

    // Smaller scrolls are the padders' observer's business.
    this.scroll_last = st
    this.scroll_last_valid = true
    this.on_scrolled()
  }

  /** Whether {@link scroll_last} holds an offset (a right-to-left offset can be negative). */
  protected scroll_last_valid = false

  /** Called after each scroll event the list saw (a ring watches for the scroll to stop). */
  protected on_scrolled() {}

  /** The window of the previous rendering, if any, says nothing of the new one. */
  protected override renew_markers() {
    super.renew_markers()
    this._last_view_start = -1
    this._last_view_end = -1
    this.scroll_last_valid = false
  }

  /** Called once connected, the scroll area found, before the first position: a subclass's own setup. */
  protected on_connect(_area: HTMLElement) {}

  /** Called on disconnection, before the scroll area is forgotten. */
  protected on_disconnect(_area: HTMLElement) {}

  /** What the subclass inserts around the rows (prefix, suffix, empty content), once the markers exist. */
  protected insert_extras(_o_count: o.RO<number>) {}

  /** Insert the list. Nothing is rendered until it is connected and has found its scroll area. */
  override [sym_insert](parent: Node, refchild: Node | null): void {
    if (this.renderfn == null) {
      throw new Error(`${this.verb_name} needs a Render function`)
    }
    this.renew_markers()

    node_on_disconnected(this.__list, () => {
      this._observer.disconnect()
      this._padder_io?.disconnect()
      this._padder_io = null
      if (this.scroll_area != null) {
        this.on_disconnect(this.scroll_area)
        this.scroll_area.removeEventListener("scroll", this.on_scroll)
        release_anchor(this.scroll_area)
      }
      this.scroll_area = null
    })

    node_on_connected(this.__list, () => {
      const area = this.find_scroll_area()
      this.scroll_area = area
      hold_anchor(area)
      const parent = this.__list.parentElement
      const parent_style = parent == null ? null : getComputedStyle(parent)
      this.axis = !this.horizontal ? VERTICAL : parent_style?.direction === "rtl" ? HORIZONTAL_RTL : HORIZONTAL
      // Among a table's rows, a padder must be a row itself: a block there would be wrapped in an
      // anonymous row and cell by the browser. Side by side with inline rows, it is inline itself.
      const display = parent_style?.display ?? "block"
      this.padder_display = TABLE_ROW_PARENTS.has(display)
        ? "table-row"
        : this.horizontal && !FLEX_OR_GRID.has(display)
          ? "inline-block"
          : "block"
      this.update_padders_display()
      this._observer.observe(area)
      // Rows changing size after render (images, fonts, async content) move the padders, which
      // this observer reports once one crosses its line: no need to watch the rows' container.
      const margin = `${this.threshold / 2}px`
      this._padder_io = new IntersectionObserver((entries) => this.on_padders(entries), {
        root: area,
        rootMargin: this.horizontal ? `0px ${margin}` : `${margin} 0px`,
      })
      this.on_connect(area)

      this.jump_to(this.initial_position)

      // Added on each connection and removed on each disconnection: the area may change in between.
      area.addEventListener("scroll", this.on_scroll)
    })

    // [prefix][start padder][rows…][end padder][suffix]: the rows go between the list's marker and
    // its end marker, created right after it by updateRenderable. Put together in a fragment, inserted last:
    // a parent already in the page connects the list at once, and its connection needs all of it in place.
    const style = this.horizontal ? PADDER_HORIZONTAL : PADDER_VERTICAL
    this.padder_start.style.cssText = style
    this.padder_end.style.cssText = style
    const frag = document.createDocumentFragment()
    frag.append(this.__prefix, this.padder_start, this.__empty, this.__list, this.padder_end, this.__suffix)
    this.__list.updateRenderable(null)

    // Written synchronously, so that preserveScrollAnchor's read right after a view change sees
    // the padders as they now are (shown or hidden, at their new size).
    const size_prop = this.horizontal ? "width" : "height"
    const o_count = o.tf(this.obs, (lst) => lst?.length ?? 0)
    node_observe(this.__list, this.o_padding_start, (px) => {
      this.padder_start.style[size_prop] = `${px ?? 0}px`
    })
    node_observe(this.__list, this.o_padding_end, (px) => {
      this.padder_end.style[size_prop] = `${px ?? 0}px`
    })
    node_observe(this.__list, o.join(this.o_pos_start, this.o_pos_end, o_count), () => {
      this.update_padders_display()
    })

    this.insert_extras(o_count)

    this.start_observing()
    node_append(parent, frag, refchild)
  }
}
