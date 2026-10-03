/*
 * Maintainer notes — rules for changing `RepeatVirtual` or any measure-driven list. They do not
 * apply to ordinary `Repeat` code.
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
 * - Keep the content stable through the **top padder**, never by writing `scrollTop` while the user
 *   scrolls.
 * - The top padder is measurement-driven (the real heights of the rows it replaces, gaps and margins
 *   included, since it is the measured shift of the pinned row), not `index * estimate`. The bottom
 *   padder may stay estimate-only: it is below everything on screen.
 * - Keep `overflow-anchor: none` on the scroll area so the browser's own scroll anchoring doesn't
 *   fight the padder. The list sets it inline on the scroll area it finds, and restores the previous
 *   value when the last list using that scroll area disconnects.
 * - The padders are `<e-virtual-padder>` elements right next to the rows, in the element holding
 *   them: `[prefix][top padder][rows…][bottom padder][suffix]`. Not in a shadow root around that
 *   element (as they once were): a sticky row is held inside its parent's box, so padders outside
 *   that box let the box's edge, and the sticky row with it, come into view on a scroll the list
 *   hasn't caught up with yet. Next to the rows, the parent spans the whole scroll height. See
 *   docs/src/adr/0004-virtual-padders-next-to-rows.md.
 * - A padder shows only while rows are hidden on its side (`display: none` otherwise). Shown, it
 *   always stands for at least one row, whose gap pays for the padder's own gap: hiding it as those
 *   rows render swaps equal heights, so no gap value ever needs to be known. Never show a padder
 *   standing for no row: its gap would be an extra seam at the list's end.
 * - Its layout properties are inline styles, which no stylesheet rule (a packed container's padding
 *   on its children, …) out-ranks short of `!important`.
 */

import type { Renderable } from "./types"

import { o } from "./observable"

import {
  node_add_event_listener,
  node_append,
  node_observe,
  node_on_connected,
  node_on_disconnected,
  without_motion,
} from "./dom"

import { If, Repeat } from "./verbs"

import { sym_insert } from "./symbols"

const debug = {
  red: "color: #ff3c00; font-weight: bold;",
  green: "color: #66f100; font-weight: bold;",
}

type RepeatItem<Obs extends Repeat.RepeatedObservable<any>> = Repeat.RepeatItemElement<Obs>

type ItemBounds = { top: number; bottom: number; height: number }

/** Inline style of a padder: what it must be whatever rules the page has for its parent's children. */
const PADDER_STYLE =
  "display: none; grid-column: 1 / -1; flex: none; box-sizing: content-box; height: 0; min-height: 0; padding: 0; margin: 0; border: 0;"

/** Creates one of a list's two padders (see the maintainer notes). */
function create_padder(): HTMLElement {
  const padder = document.createElement("e-virtual-padder")
  padder.setAttribute("aria-hidden", "true")
  padder.style.cssText = PADDER_STYLE
  return padder
}

/** `overflow-y` values that make an element a scroll area the user can scroll. */
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

/**
 * A {@link Repeat} that only renders the rows near the visible part of its scroll area: the nearest
 * ancestor that scrolls vertically (`overflow-y: auto`, `scroll` or `overlay`). The rows above and
 * below are replaced by two padders, `<e-virtual-padder>` elements placed right before and after the
 * rows, sized from measured and estimated row heights. The page itself is never used as the scroll
 * area: without a scrolling ancestor, the list reports an error when connected.
 *
 * ```tsx
 * <div style="height: 400px; overflow: auto">
 *   <e-column>{RepeatVirtual(o_rows, (o_row) => <e-row>{o_row.p("label")}</e-row>)}</e-column>
 * </div>
 * ```
 *
 * The list turns the browser's scroll anchoring off on its scroll area (`overflow-anchor: none`,
 * inline) while it is connected: the list keeps its rows in place itself, and the browser would
 * fight it.
 *
 * ## Requirement: rows must have a (reasonably) intrinsic height
 *
 * Each rendered row's height must depend essentially on **its own content**, not
 * on which *other* rows happen to be rendered at the same time. The scroller
 * pins the first visible row across every windowing change to keep the viewport
 * stable, but it cannot predict the height of rows it adds or removes — so if
 * adding/removing off-screen rows changes the height of on-screen rows, the
 * viewport will still jump.
 *
 * The classic offender is a shared `<table>`: with `table-layout: auto` the
 * column widths are computed from *all* currently-rendered cells, so adding a
 * row with wide content re-wraps cells in other rows (1 line ↔ 2 lines). If you
 * virtualize rows inside a single table, set **`table-layout: fixed`** (or give
 * the columns explicit widths) so a row's height no longer depends on its
 * siblings. The same goes for grid columns sized by their content (`auto`,
 * `max-content`). Per-row content that wraps based only on the container width is
 * fine; content that wraps based on sibling rows is not.
 *
 * Rows may still change height (images loading, async content, responsive
 * wrapping) — that is handled — as long as the change isn't *caused by* the
 * windowing itself.
 *
 * @group Verbs
 */
export function RepeatVirtual<O extends o.IReadonlyObservable<any[] | null | undefined>>(
  obs: O,
  renderfn?: (
    ob: O extends o.IObservable<(infer T)[] | null | undefined, any[]>
      ? o.Observable<T>
      : O extends o.IReadonlyObservable<(infer T)[] | null | undefined>
        ? o.ReadonlyObservable<T>
        : never,
    n: o.ReadonlyObservable<number>,
  ) => Renderable<HTMLElement>,
) {
  return new RepeatVirtual.Repeater<O>(obs, renderfn as any)
}

export namespace RepeatVirtual {
  /** Virtual list window backed by {@link Repeat} view reconciliation. */
  export class Repeater<O extends o.IReadonlyObservable<any[] | null | undefined>> extends Repeat.Repeater<O> {
    /** The number of pixels beyond the visible area within which rows are created / dropped */
    protected threshold = 500

    /** The scroll area, found when the list is connected */
    protected scroll_area: HTMLElement | null = null

    /** Stand for the rows above and below the rendered ones (see the maintainer notes). */
    protected padder_top = create_padder()
    protected padder_bottom = create_padder()

    /** `display` of a shown padder: `table-row` among a table's rows, `block` anywhere else. */
    protected padder_display = "block"

    o_pos_start = o(0)
    o_pos_end = o(0)

    o_padding_top = o(0)
    o_padding_bottom = o(0)

    /** Estimated row height in pixels, refined from measurements as rows are rendered */
    protected item_size = 64

    /** The index shown first when the list is connected */
    protected initial_position = 0

    /** Re-evaluates when the scroll area's size changes (the padders' observer only reports padders
     * crossing its line, not the viewport growing past rows it already rendered). */
    protected _observer = new ResizeObserver(() => {
      this.eval()
    })

    /** Watches the two padders: one entering the zone near the viewport means that side needs rows.
     * Created when connected, since its root is the scroll area. */
    protected _padder_io: IntersectionObserver | null = null

    scroll_last_top = -1

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

    /** How many pixels beyond the visible area rows are created or dropped (default 500). */
    Threshold(px: number) {
      this.threshold = px
      return this
    }

    /** The estimated row height in pixels (default 64), refined as rows are measured. A close
     * estimate makes the scrollbar accurate sooner. */
    ItemSize(px: number) {
      this.item_size = px
      return this
    }

    /** The index to show first when the list is connected (default 0). */
    InitialPosition(index: number) {
      this.initial_position = index
      return this
    }

    constructor(
      obs: O,
      renderfn?: (
        ob: O extends o.IObservable<(infer T)[] | null | undefined, (infer T)[]>
          ? o.Observable<T>
          : O extends o.ReadonlyObservable<(infer T)[] | null | undefined>
            ? o.ReadonlyObservable<T>
            : never,
        n: o.RO<number>,
      ) => Renderable<HTMLElement>,
    ) {
      super(obs, renderfn as unknown as Repeat.RenderItemFn<O>)
      this.ForView(this.o_pos_start, this.o_pos_end)
    }

    /**
     * The nearest ancestor, in the flattened tree, that scrolls vertically. The page itself doesn't
     * count (`body` and `html` end the search): a virtual list's scroll area is always deliberate.
     */
    protected find_scroll_area(): HTMLElement {
      const body = document.body
      const html = document.documentElement
      for (let el = flat_parent(this.__list); el != null && el !== body && el !== html; el = flat_parent(el)) {
        if (el instanceof HTMLElement && SCROLLING_OVERFLOW.has(getComputedStyle(el).overflowY)) return el
      }
      throw new Error(
        "RepeatVirtual must be inside an element that scrolls vertically (overflow-y: auto or scroll) and has a bounded height",
      )
    }

    protected first_item(): RepeatItem<O> | null {
      const end = this.__list.end
      const n = this.__list.nextSibling
      if (n == null || n === end || !(n instanceof Repeat.RepeatItemElement)) {
        return null
      }
      return n
    }

    protected last_item(): RepeatItem<O> | null {
      const end = this.__list.end
      if (end == null) {
        return null
      }
      let iter: Node | null = end.previousSibling
      while (iter != null && iter !== this.__list) {
        if (iter instanceof Repeat.RepeatItemElement) {
          return iter
        }
        iter = iter.previousSibling
      }
      return null
    }

    protected next_item(item: RepeatItem<O>): RepeatItem<O> | null {
      const end = this.__list.end
      let iter: Node | null = item.end?.nextSibling ?? item.nextSibling
      while (iter != null && iter !== end) {
        if (iter instanceof Repeat.RepeatItemElement) {
          return iter
        }
        iter = iter.nextSibling
      }
      return null
    }

    /**
     * Rough index of the row at the scroll area's top: the scroll offset, less what sits above the
     * list in the scroll content (a header, other content, another list), over the estimated row
     * height. Reads layout: call it before writing anything.
     */
    protected estimateIndexFromScroll() {
      const count = o.get(this.obs)?.length ?? 0
      const area = this.scroll_area
      if (count === 0 || area == null) {
        return 0
      }
      // Where the list starts in the scroll content: its top padder's top, or its first row's.
      const top = this.pos_start > 0 ? this.padder_top.getBoundingClientRect().top : this.content_top()
      const lead = top == null ? 0 : top - area.getBoundingClientRect().top - area.clientTop + area.scrollTop
      return Math.max(0, Math.min(count - 1, Math.floor((area.scrollTop - lead) / this.item_size)))
    }

    protected jump_threshold() {
      return Math.max(this.threshold, this.scroll_area?.clientHeight ?? 0)
    }

    protected boundsValid(bounds: { top: number; bottom: number; height?: number }) {
      return bounds.top !== Infinity && bounds.bottom !== -Infinity && (bounds.height == null || bounds.height > 0)
    }

    /** Bottom spacer is purely an estimate of the not-yet-rendered tail; changing
     * it never moves on-screen content, so it can be recomputed freely. */
    protected update_padding_bottom() {
      const count = o.get(this.obs)?.length ?? 0
      this.o_padding_bottom.set(Math.max(0, count - this.pos_end) * this.item_size)
    }

    /** Full (re)estimate of both spacers. Used only on a hard reposition
     * ({@link setPosition}) or data change, where there is no anchor to preserve. */
    protected update_padding() {
      this.o_padding_top.set(this.pos_start * this.item_size)
      this.update_padding_bottom()
    }

    /** How many rows probably fill the visible area, with a margin of 10 (only the margin before
     * connection, when there's no visible area yet). */
    protected screenful() {
      return Math.ceil((this.scroll_area?.clientHeight ?? 0) / this.item_size + 10)
    }

    /** Re-render the viewport around index `n`, replacing whatever was rendered */
    setPosition(n: number) {
      const count = o.get(this.obs)?.length ?? 0
      if (count === 0 || this.scroll_area == null) {
        o.transaction(() => {
          this.o_pos_start.set(0)
          this.o_pos_end.set(0)
        })
        this.update_padding()
        this.reconcileView(0, 0)
        return
      }

      // Land with a margin's worth of rows on both sides of the viewport, not just below it: with
      // nothing rendered above, a scroll back up drawn before the next pass shows the blank top padder.
      const target = Math.max(0, Math.min(n, count - 1))
      const margin_rows = Math.ceil(this.threshold / this.item_size)
      const start = Math.max(0, target - margin_rows)
      const end = Math.min(count, target + this.screenful() + margin_rows)

      o.transaction(() => {
        this.o_pos_start.set(start)
        this.o_pos_end.set(end)
      })
      this.update_padding()
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
      io.unobserve(this.padder_top)
      io.unobserve(this.padder_bottom)
      io.observe(this.padder_top)
      io.observe(this.padder_bottom)
    }

    /** Show each padder only while rows are hidden on its side (see the maintainer notes). */
    protected update_padders_display() {
      const count = o.get(this.obs)?.length ?? 0
      this.padder_top.style.display = this.pos_start > 0 ? this.padder_display : "none"
      this.padder_bottom.style.display = this.pos_end < count ? this.padder_display : "none"
    }

    /** Keep `anchor` at the same viewport Y after a view change by absorbing the
     * shift into the *top spacer* — never by writing `scrollTop`. Writing scrollTop
     * mid-scroll fights the browser's own scrolling and is what made it flicker.
     * Because the spacer carries the measured shift (not `index * estimate`), the
     * rendered content stays put regardless of how wrong the size estimate is. */
    protected preserveScrollAnchor(anchor: RepeatItem<O>, anchor_top_before: number) {
      const new_top = this.getBounds(anchor).top
      // Guard against a transiently unmeasurable anchor (Infinity) poisoning the
      // spacer; a frame with no correction is harmless, a NaN spacer is not.
      if (!Number.isFinite(new_top) || !Number.isFinite(anchor_top_before)) {
        return
      }
      const shift = new_top - anchor_top_before
      if (shift !== 0) {
        this.o_padding_top.set(Math.max(0, o.get(this.o_padding_top) - shift))
      }
    }

    protected applyViewChange(
      new_pos_start: number,
      new_pos_end: number,
      anchor: RepeatItem<O> | null,
      anchor_top_before: number | null,
    ) {
      if (new_pos_start === this.pos_start && new_pos_end === this.pos_end) {
        return false
      }

      // The transaction's view-observer reconcile updates the bottom spacer and the
      // DOM rows, but deliberately leaves the top spacer alone (see reconcile_view),
      // so the rows shift by exactly the height of what was added/removed above.
      o.transaction(() => {
        this.o_pos_start.set(new_pos_start)
        this.o_pos_end.set(new_pos_end)
      })

      if (anchor != null && anchor_top_before != null) {
        this.preserveScrollAnchor(anchor, anchor_top_before)
      }

      // At the very top the spacer must be exactly 0; snap away any drift the
      // incremental measured corrections may have accumulated.
      if (new_pos_start === 0) {
        this.o_padding_top.set(0)
      }

      return true
    }

    protected prev_item(item: RepeatItem<O>): RepeatItem<O> | null {
      let iter: Node | null = item.previousSibling
      while (iter != null && iter !== this.__list) {
        if (iter instanceof Repeat.RepeatItemElement) {
          return iter
        }
        iter = iter.previousSibling
      }
      return null
    }

    /**
     * Rows read from the top down, stopping as soon as possible: how many lie fully above
     * `trim_above` (pass `-Infinity` to trim none), then the first row reaching the viewport's top,
     * `view_top` — the row pinned across the change. Anything above it is off-screen, so a reflow
     * there is absorbed by the top padder instead of moving the visible content.
     */
    protected scanTop(trim_above: number, view_top: number) {
      let trim = 0
      let trimming = true
      for (let item = this.first_item(); item != null; item = this.next_item(item)) {
        const bounds = this.getBounds(item)
        if (!this.boundsValid(bounds)) break
        if (trimming && bounds.bottom < trim_above) {
          trim++
          continue
        }
        trimming = false
        if (bounds.bottom > view_top) return { trim, anchor: item, anchor_top: bounds.top }
      }
      return { trim, anchor: null, anchor_top: null }
    }

    /** Rows read from the bottom up, stopping at the first that doesn't qualify: how many lie fully
     * below `limit`. */
    protected countBelow(limit: number) {
      let count = 0
      for (let item = this.last_item(); item != null; item = this.prev_item(item)) {
        const bounds = this.getBounds(item)
        if (!this.boundsValid(bounds) || bounds.top <= limit) break
        count++
      }
      return count
    }

    /**
     * Viewport Y of the top of the rendered content: the top padder's lower side while it shows,
     * else the first row that has a box.
     */
    protected content_top(): number | null {
      if (this.pos_start > 0) return this.padder_top.getBoundingClientRect().bottom
      for (let item = this.first_item(); item != null; item = this.next_item(item)) {
        const bounds = this.getBounds(item)
        if (this.boundsValid(bounds)) return bounds.top
      }
      return null
    }

    /** Viewport Y of the bottom of the rendered content (see {@link content_top}). */
    protected content_bottom(list_count: number): number | null {
      if (this.pos_end < list_count) return this.padder_bottom.getBoundingClientRect().top
      for (let item = this.last_item(); item != null; item = this.prev_item(item)) {
        const bounds = this.getBounds(item)
        if (this.boundsValid(bounds)) return bounds.bottom
      }
      return null
    }

    /** The padders' observer reported: a pass, told which padders it saw inside its zone. */
    protected on_padders(entries: IntersectionObserverEntry[]) {
      const area = this.scroll_area
      if (area == null) return
      let top = false
      let bottom = false
      // Entries are in time order: the last one for a padder is its current state. A hidden padder
      // (no rows left on its side) is reported outside.
      for (const entry of entries) {
        if (entry.target === this.padder_top) top = entry.isIntersecting
        else if (entry.target === this.padder_bottom) bottom = entry.isIntersecting
      }
      this.real_eval(top, bottom)
    }

    /**
     * One windowing pass. Run when a padder crosses the line `threshold / 2` away from the viewport
     * (the IntersectionObserver), and on demand on the next frame after a reposition, a data change
     * or a resize ({@link eval}). It reads the viewport and the two ends of the rendered content, and
     * only reads more rows when the window changes.
     */
    protected real_eval = (top_inside = false, bottom_inside = false) => {
      const area = this.scroll_area
      const list_count = o.get(this.obs)?.length ?? 0
      if (area == null || list_count === 0 || this.pos_end === this.pos_start) {
        return
      }

      const region = area.getBoundingClientRect()
      // A hidden scroll area has no layout: every side would look short, and the window would grow
      // to the whole list. Its ResizeObserver runs a pass once it shows.
      if (region.height === 0) {
        return
      }
      const content_top = this.content_top()
      const content_bottom = this.content_bottom(list_count)
      if (content_top == null || content_bottom == null) {
        return
      }
      const threshold = this.threshold

      // The rendered content is entirely out of the zone (programmatic jump, a jump the scroll
      // listener didn't see): reposition wholesale from a scroll estimate.
      if (content_bottom < region.top - threshold || content_top > region.bottom + threshold) {
        const idx = this.estimateIndexFromScroll()
        if (idx < this.pos_start || idx >= this.pos_end) {
          this.setPosition(idx)
          return
        }
      }

      // Refine the average row-height estimate from the content's extent (gaps between rows
      // included). Damped, and only committed
      // past 1px so sub-pixel noise never re-jitters the padders / scrollbar; but taken as is when it
      // is more than 25% off (the first pass with a wrong `ItemSize`), since every margin computed
      // from it until then is off by as much.
      const measured = (content_bottom - content_top) / (this.pos_end - this.pos_start)
      const diff = measured - this.item_size
      if (measured > 0 && Math.abs(diff) > 1) {
        this.item_size += Math.abs(diff) > this.item_size / 4 ? diff : diff / 4
      }

      // A side whose rendered margin fell under half the threshold is refilled to the threshold in
      // one change, rather than by a row or two every frame: each change costs a layout of all the
      // rendered rows (a subgrid lays out its whole grid again), whatever the number of rows added.
      const above = region.top - content_top
      const below = content_bottom - region.bottom
      const low = threshold / 2
      // A padder the observer reports inside its zone is short, whatever the measures say: it counts
      // a padder lying exactly on its line as inside, where `below < low` doesn't (and the two may
      // round differently). Not growing then would leave that padder inside, never reported again.
      const grow_top = this.pos_start > 0 && (top_inside || above < low)
      const grow_bottom = this.pos_end < list_count && (bottom_inside || below < low)
      if (!grow_top && !grow_bottom) {
        return
      }

      let new_start = this.pos_start
      let new_end = this.pos_end
      if (grow_top) {
        new_start -= Math.max(1, Math.ceil((threshold - above) / this.item_size))
      }
      if (grow_bottom) {
        new_end += Math.max(1, Math.ceil((threshold - below) / this.item_size))
      }

      // The side opposite the one growing is the one the scroll moves away from: trim it back to the
      // threshold in the same change.
      const top = this.scanTop(grow_bottom && !grow_top ? region.top - threshold : -Infinity, region.top)
      new_start += top.trim
      if (grow_top && !grow_bottom) {
        new_end -= this.countBelow(region.bottom + threshold)
      }

      new_start = Math.max(0, Math.min(new_start, list_count))
      new_end = Math.max(new_start, Math.min(new_end, list_count))

      if (this.debug >= 3 && (new_start !== this.pos_start || new_end !== this.pos_end)) {
        console.log(
          `%cwindow [${this.pos_start},${this.pos_end}) -> [${new_start},${new_end})`,
          new_start < this.pos_start || new_end > this.pos_end ? debug.green : debug.red,
        )
      }

      if (this.applyViewChange(new_start, new_end, top.anchor, top.anchor_top)) {
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
      if (r.height > 0) {
        res.top = Math.min(res.top, r.top)
        res.bottom = Math.max(res.bottom, r.bottom)
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

    /** Viewport-relative bounds of one repeat item's rendered content. */
    protected getBounds(r: RepeatItem<O>): ItemBounds {
      const res: ItemBounds = { top: Infinity, bottom: -Infinity, height: 0 }

      const end = r.end
      let iter: Node | null = r.nextSibling
      while (iter != null && iter !== end) {
        if (iter instanceof HTMLElement) {
          this.measureElement(iter, res)
        }
        iter = iter.nextSibling
      }

      res.height = res.bottom - res.top
      return res
    }

    /** Explicit windowing pass (used at init and after {@link setPosition}). Records
     * the window so the observer-driven {@link reconcile_view} that fires from the
     * same `o_pos_*` write skips the identical second reconciliation.
     *
     * `_last_view_*` is written *inside* `update_lock` so it is only recorded when
     * the reconcile actually ran — `o.exclusive_lock` is non-reentrant, so a call
     * made while the lock is already held is a no-op and must not poison the cache. */
    override reconcileView(start: number, end: number) {
      if (start === this._last_view_start && end === this._last_view_end) {
        return this
      }
      this.update_lock(() => {
        this._last_view_start = start
        this._last_view_end = end
        const lst = (o.get(this.obs) as unknown as NonNullable<o.ObservedType<O>>) ?? []
        // Rows come and go with the window, not with the data: no motion.
        without_motion(() => this.updateChildren(lst, { start, end }))
      })
      return this
    }

    protected override reconcile_view() {
      // Only the bottom spacer here — the top spacer is owned by the anchor
      // correction in applyViewChange and must not be reset to an estimate.
      this.update_padding_bottom()
      if (this.pos_start === this._last_view_start && this.pos_end === this._last_view_end) {
        return
      }
      this.update_lock(() => {
        this._last_view_start = this.pos_start
        this._last_view_end = this.pos_end
        const lst = (o.get(this.obs) as unknown as NonNullable<o.ObservedType<O>>) ?? []
        without_motion(() => this.updateChildren(lst))
      })
    }

    protected override updateChildrenPre(
      new_lst: NonNullable<o.ObservedType<O>>,
      old_lst: NonNullable<o.ObservedType<O>> | o.NoValue,
    ) {
      // The list content changed: the windowing cache no longer reflects the DOM,
      // so force the next reconcile to run rather than dedup against a stale window.
      this._last_view_start = -1
      this._last_view_end = -1

      // Items appended while the window reaches the list's end show right away rather than on the
      // next frame (an "add" button expects to find its row): grow the window, by a screenful at
      // most, so a large append doesn't render everything. The next eval trims what's off-screen.
      if (
        old_lst !== o.NoValue &&
        new_lst.length > old_lst.length &&
        this.pos_end > this.pos_start &&
        this.pos_end === old_lst.length
      ) {
        this.o_pos_end.set(Math.min(new_lst.length, this.pos_end + this.screenful()))
      }

      if (old_lst !== o.NoValue && old_lst.length > new_lst.length) {
        const len = new_lst.length
        if (this.pos_end > len) {
          this.o_pos_end.set(len)
        }
        if (this.pos_start > this.pos_end) {
          this.o_pos_start.set(this.pos_end)
        }
      }

      this.updateChildren(new_lst)
      this.update_padding()

      if (new_lst.length === 0) {
        o.transaction(() => {
          this.o_pos_start.set(0)
          this.o_pos_end.set(0)
        })
        return
      }

      this.eval()
      if (this.pos_end === this.pos_start) {
        this.setPosition(0)
      }
    }

    /** Insert the list. Nothing is rendered until it is connected and has found its scroll area. */
    override [sym_insert](parent: Node, refchild: Node | null): void {
      if (this.renderfn == null) {
        throw new Error("RepeatVirtual needs a Render function")
      }

      node_on_disconnected(this.__list, () => {
        this._observer.disconnect()
        this._padder_io?.disconnect()
        this._padder_io = null
        if (this.scroll_area != null) release_anchor(this.scroll_area)
        this.scroll_area = null
      })

      node_on_connected(this.__list, () => {
        const area = this.find_scroll_area()
        this.scroll_area = area
        hold_anchor(area)
        // Among a table's rows, a padder must be a row itself: a block there would be wrapped in an
        // anonymous row and cell by the browser.
        const parent = this.__list.parentElement
        this.padder_display =
          parent != null && TABLE_ROW_PARENTS.has(getComputedStyle(parent).display) ? "table-row" : "block"
        this.update_padders_display()
        this._observer.observe(area)
        // Rows changing height after render (images, fonts, async content) move the padders, which
        // this observer reports once one crosses its line: no need to watch the rows' container.
        this._padder_io = new IntersectionObserver((entries) => this.on_padders(entries), {
          root: area,
          rootMargin: `${this.threshold / 2}px 0px`,
        })

        this.setPosition(this.initial_position)

        node_add_event_listener(this.__list, area, "scroll", () => {
          // We never write scrollTop (anchoring is done via the top padder), so
          // every scroll event is a genuine user scroll.
          const st = area.scrollTop
          const prev_top = this.scroll_last_top

          if (prev_top >= 0) {
            const delta = st - prev_top
            if (Math.abs(delta) > this.jump_threshold()) {
              this.scroll_last_top = st
              this.setPosition(this.estimateIndexFromScroll())
              return
            }
          }

          // Smaller scrolls are the padders' observer's business.
          this.scroll_last_top = st
        })
      })

      // [prefix][top padder][rows…][bottom padder][suffix]: the rows go between the list's marker and
      // its end marker, created right after it by updateRenderable.
      node_append(parent, this.__prefix, refchild)
      node_append(parent, this.padder_top, refchild)
      node_append(parent, this.__empty, refchild)
      node_append(parent, this.__list, refchild)
      node_append(parent, this.padder_bottom, refchild)
      node_append(parent, this.__suffix, refchild)
      this.__list.updateRenderable(null)

      // Written synchronously, so that preserveScrollAnchor's read right after a view change sees
      // the padders as they now are (shown or hidden, at their new height).
      const o_count = o.tf(this.obs, (lst) => lst?.length ?? 0)
      node_observe(this.__list, this.o_padding_top, (px) => {
        this.padder_top.style.height = `${px ?? 0}px`
      })
      node_observe(this.__list, this.o_padding_bottom, (px) => {
        this.padder_bottom.style.height = `${px ?? 0}px`
      })
      node_observe(this.__list, o.join(this.o_pos_start, this.o_pos_end, o_count), () => {
        this.update_padders_display()
      })

      // Prefix and suffix belong to the list's true start and end, not to the edges of the rendered
      // window: they only show while the first (last) item is rendered.
      const prefix = this.prefix
      if (prefix != null) {
        this.__prefix.updateRenderable(
          If(
            o.expression((get) => get(o_count) > 0 && get(this.o_pos_start) === 0 && get(this.o_pos_end) > 0),
            () => prefix(this.obs),
          ),
        )
      }
      const suffix = this.suffix
      if (suffix != null) {
        this.__suffix.updateRenderable(
          If(
            o.expression((get) => get(o_count) > 0 && get(this.o_pos_end) === get(o_count)),
            () => suffix(this.obs),
          ),
        )
      }
      const on_empty = this.on_empty
      if (on_empty != null) {
        this.__empty.updateRenderable(
          If(
            o.tf(o_count, (n) => n === 0),
            () => on_empty(),
          ),
        )
      }

      this.observer = node_observe(
        this.__list,
        this.obs,
        (lst, old_lst) => {
          this.update_lock(() => {
            this.updateChildrenPre(
              (lst as unknown as NonNullable<o.ObservedType<O>>) ?? [],
              (old_lst as unknown as NonNullable<o.ObservedType<O>>) ?? [],
            )
          })
        },
        { immediate: true },
      )

      if (this.o_view_start != null && this.o_view_end != null) {
        this.view_observer = node_observe(this.__list, o.join(this.o_view_start, this.o_view_end), () => {
          this.reconcile_view()
        })
      }
    }
  }
}
