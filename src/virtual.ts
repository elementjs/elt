/*
 * Maintainer notes — rules for changing `RepeatVirtual` or any measure-driven list. They do not
 * apply to ordinary `Repeat` code.
 *
 * - Never interleave layout reads (`getBoundingClientRect`, `scrollTop`, …) with observable-driven
 *   DOM writes in one loop: every read after a write forces a reflow, making the pass O(n) reflows.
 *   Read once, compute, write in one batch, converge on later frames.
 * - Nothing is measured while the user scrolls within the margins. An IntersectionObserver watches
 *   two empty elements at the edges of the rendered content (in the scroll area's shadow root) and
 *   runs a pass when one comes within `threshold / 2` of the viewport. A pass reads the viewport and
 *   the two edges; rows are read only when the window changes, from each end, stopping at the first
 *   row that doesn't qualify (the trim count, the row pinned across the change), and the one read
 *   after the write (the pinned row's new position) is the pass's only forced layout.
 * - The observer only reports changes of inside/outside its zone: after every window change, restart
 *   watching the edges so that one still short gets reported again. The scroll listener still
 *   handles jumps (one scroll farther than the viewport), which can carry an edge across the zone
 *   without it ever being inside.
 * - Keep the content stable through the **top padder**, never by writing `scrollTop` while the user
 *   scrolls.
 * - The top padder is measurement-driven (the real heights of the rows it replaces), not
 *   `index * estimate`; snap it to `0` at index `0`. The bottom padder may stay estimate-only.
 * - Keep `overflow-anchor: none` on the scroll area so the browser's own scroll anchoring doesn't
 *   fight the padder.
 * - The padders live in `e-virtual-scroll`'s shadow root, never in the user's DOM: there, no
 *   rule written for the user's elements (a packed container's children, …) can reach them. They
 *   can't be the scroll area's own padding instead: a scroll area's padding is part of its own box,
 *   so it would grow to the padding's height and stop scrolling.
 */

import type { Attrs, Renderable } from "./types"

import { o } from "./observable"

import { node_add_event_listener, node_append, node_observe, node_on_connected, node_on_disconnected } from "./dom"

import { If, Repeat } from "./verbs"

import { sym_insert } from "./symbols"

const debug = {
  red: "color: #ff3c00; font-weight: bold;",
  green: "color: #66f100; font-weight: bold;",
}

type RepeatItem<Obs extends Repeat.RepeatedObservable<any>> = Repeat.RepeatItemElement<Obs>

type ItemBounds = { top: number; bottom: number; height: number }

/**
 * The scroll area of one {@link RepeatVirtual}: a plain element that scrolls, and holds the two
 * padders standing for the rows that aren't rendered above and below the visible ones. They live in
 * its shadow root, around a `<slot>` that shows its children:
 *
 * ```
 * <e-virtual-scroll>
 *   #shadow-root: [top padder] [top edge] <slot> [bottom edge] [bottom padder]
 *   …children (the RepeatVirtual itself, or the element that holds it)
 * ```
 *
 * It needs a bounded height to scroll. Its base style (`display: block; overflow: auto`) is a
 * default any stylesheet can override.
 */
export class EVirtualScroll extends HTMLElement {
  readonly padder_top: HTMLElement
  readonly padder_bottom: HTMLElement
  /** Empty lines at the top and bottom edges of the rendered content, watched by the list's
   * IntersectionObserver: one entering the zone near the viewport means that side needs rows. */
  readonly edge_top: HTMLElement
  readonly edge_bottom: HTMLElement
  /** The RepeatVirtual using this scroll area, while it is connected. */
  owner: object | null = null

  constructor() {
    super()
    const shadow = this.attachShadow({ mode: "open" })
    const style = document.createElement("style")
    // :host rules lose to any rule of the page, so these are defaults.
    style.textContent = `:host { display: block; overflow: auto; overflow-anchor: none; }`
    this.padder_top = document.createElement("div")
    this.padder_bottom = document.createElement("div")
    this.edge_top = document.createElement("div")
    this.edge_bottom = document.createElement("div")
    shadow.append(
      style,
      this.padder_top,
      this.edge_top,
      document.createElement("slot"),
      this.edge_bottom,
      this.padder_bottom,
    )
  }
}

if (typeof customElements !== "undefined" && customElements.get("e-virtual-scroll") == null) {
  customElements.define("e-virtual-scroll", EVirtualScroll)
}

/** Attributes of `<e-virtual-scroll>`. `elt/ui` adds its layout attributes (`border`, `surface`, …). */
export interface EVirtualScrollAttrs extends Attrs<EVirtualScroll> {}

declare module "./types" {
  interface ElementMap {
    "e-virtual-scroll": EVirtualScrollAttrs
  }
}

/**
 * A {@link Repeat} that only renders the rows near the visible part of its scroll area, an
 * `<e-virtual-scroll>`; the rows above and below are replaced by two padders, sized from measured and
 * estimated row heights. It must be a child of the `e-virtual-scroll`, or of one of its children
 * (an `e-grid` in it, for instance):
 *
 * ```tsx
 * <e-virtual-scroll style="height: 400px">
 *   <e-column>{RepeatVirtual(o_rows, (o_row) => <e-row>{o_row.p("label")}</e-row>)}</e-column>
 * </e-virtual-scroll>
 * ```
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
    protected scroll_area: EVirtualScroll | null = null

    o_pos_start = o(0)
    o_pos_end = o(0)

    o_padding_top = o(0)
    o_padding_bottom = o(0)

    /** Estimated row height in pixels, refined from measurements as rows are rendered */
    protected item_size = 64

    /** The index shown first when the list is connected */
    protected initial_position = 0

    /** Re-evaluates when the scroll area's size changes (the edges' observer only reports edges
     * crossing its line, not the viewport growing past rows it already rendered). */
    protected _observer = new ResizeObserver(() => {
      this.eval()
    })

    /** Watches the scroll area's two edges (see {@link EVirtualScroll}); created when connected,
     * since its root is the scroll area. */
    protected _edges: IntersectionObserver | null = null

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
     * The `e-virtual-scroll` this list belongs to: its parent element, or its parent's parent.
     * Anything deeper is refused — the padders stand for rows of this list only, so whatever sits
     * between them and the list has to stay simple to measure.
     */
    protected find_scroll_area(): EVirtualScroll {
      const parent = this.__list.parentElement
      const area =
        parent instanceof EVirtualScroll
          ? parent
          : parent?.parentElement instanceof EVirtualScroll
            ? parent.parentElement
            : null
      if (area == null) {
        throw new Error(
          "RepeatVirtual must be a child of an <e-virtual-scroll>, or of one of its children (e.g. <e-virtual-scroll><e-grid>{RepeatVirtual(...)}</e-grid></e-virtual-scroll>)",
        )
      }
      if (area.owner != null && area.owner !== this) {
        throw new Error("RepeatVirtual: this <e-virtual-scroll> already holds another RepeatVirtual")
      }
      return area
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

    /** Rough index from scroll offset; item_size is only an estimate */
    protected estimateIndexFromScroll(scroll_top: number) {
      const count = o.get(this.obs)?.length ?? 0
      if (count === 0) {
        return 0
      }
      return Math.max(0, Math.min(count - 1, Math.floor(scroll_top / this.item_size)))
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
      // nothing rendered above, the content's top edge is in view as soon as a scroll back up is drawn
      // before the next pass, and a sticky row held in the content's box drops with it.
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
      this.observe_edges()
      this.eval()
    }

    /** Restart watching both edges, so the observer reports their state afresh on the next frame
     * even if it didn't change: after a window change that fell short, an edge still inside the zone
     * would otherwise never be reported again. (`observe` on a watched target does nothing.) */
    protected observe_edges() {
      const io = this._edges
      const area = this.scroll_area
      if (io == null || area == null) return
      io.unobserve(area.edge_top)
      io.unobserve(area.edge_bottom)
      io.observe(area.edge_top)
      io.observe(area.edge_bottom)
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

    /** The edges' observer reported: a pass, told which edges it saw inside its zone. */
    protected on_edges(entries: IntersectionObserverEntry[]) {
      const area = this.scroll_area
      if (area == null) return
      let top = false
      let bottom = false
      // Entries are in time order: the last one for an edge is its current state.
      for (const entry of entries) {
        if (entry.target === area.edge_top) top = entry.isIntersecting
        else if (entry.target === area.edge_bottom) bottom = entry.isIntersecting
      }
      this.real_eval(top, bottom)
    }

    /**
     * One windowing pass. Run when an edge crosses the line `threshold / 2` away from the viewport
     * (the IntersectionObserver), and on demand on the next frame after a reposition, a data change
     * or a resize ({@link eval}). It reads the viewport and the two edges, and only reads rows when
     * the window changes.
     */
    protected real_eval = (edge_top_inside = false, edge_bottom_inside = false) => {
      const area = this.scroll_area
      const list_count = o.get(this.obs)?.length ?? 0
      if (area == null || list_count === 0 || this.pos_end === this.pos_start) {
        return
      }

      const region = area.getBoundingClientRect()
      // A hidden scroll area has no layout: every edge would look short, and the window would grow
      // to the whole list. Its ResizeObserver runs a pass once it shows.
      if (region.height === 0) {
        return
      }
      const content_top = area.edge_top.getBoundingClientRect().top
      const content_bottom = area.edge_bottom.getBoundingClientRect().top
      const threshold = this.threshold

      // The rendered content is entirely out of the zone (programmatic jump, a jump the scroll
      // listener didn't see): reposition wholesale from a scroll estimate.
      if (content_bottom < region.top - threshold || content_top > region.bottom + threshold) {
        const idx = this.estimateIndexFromScroll(area.scrollTop)
        if (idx < this.pos_start || idx >= this.pos_end) {
          this.setPosition(idx)
          return
        }
      }

      // Refine the average row-height estimate from the content's extent (which includes whatever
      // sits around the rows in their container, a header for instance). Damped, and only committed
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
      // An edge the observer reports inside its zone is short, whatever the measures say: it counts
      // an edge lying exactly on its line as inside, where `below < low` doesn't (and the two may
      // round differently). Not growing then would leave that edge inside, never reported again.
      const grow_top = this.pos_start > 0 && (edge_top_inside || above < low)
      const grow_bottom = this.pos_end < list_count && (edge_bottom_inside || below < low)
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
        // The estimate may have under/over-shot: have the edges reported afresh on the next frame.
        this.observe_edges()
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
        this.updateChildren(lst, { start, end })
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
        this.updateChildren(lst)
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
        this._edges?.disconnect()
        this._edges = null
        const area = this.scroll_area
        if (area?.owner === this) {
          // The area may get another list (an If around this one): don't leave it our padders.
          area.owner = null
          area.padder_top.style.height = "0px"
          area.padder_bottom.style.height = "0px"
        }
        this.scroll_area = null
      })

      node_on_connected(this.__list, () => {
        const area = this.find_scroll_area()
        area.owner = this
        this.scroll_area = area
        this._observer.observe(area)
        // Rows changing height after render (images, fonts, async content) move the edges, which
        // this observer reports once one crosses its line: no need to watch the rows' container.
        this._edges = new IntersectionObserver((entries) => this.on_edges(entries), {
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
              this.setPosition(this.estimateIndexFromScroll(st))
              return
            }
          }

          // Smaller scrolls are the edges' observer's business.
          this.scroll_last_top = st
        })
      })

      node_append(parent, this.__prefix, refchild)
      node_append(parent, this.__empty, refchild)
      node_append(parent, this.__list, refchild)
      node_append(parent, this.__suffix, refchild)
      this.__list.updateRenderable(null)

      // The padders are in the scroll area's shadow root, which is only known once connected: the
      // observers live on the list's own marker, so they run while it is connected and see the
      // scroll area set by then. Writing them synchronously keeps preserveScrollAnchor's
      // measurement right after a view change accurate.
      node_observe(this.__list, this.o_padding_top, (px) => {
        if (this.scroll_area != null) this.scroll_area.padder_top.style.height = `${px ?? 0}px`
      })
      node_observe(this.__list, this.o_padding_bottom, (px) => {
        if (this.scroll_area != null) this.scroll_area.padder_bottom.style.height = `${px ?? 0}px`
      })

      // Prefix and suffix belong to the list's true start and end, not to the edges of the rendered
      // window: they only show while the first (last) item is rendered.
      const o_count = o.tf(this.obs, (lst) => lst?.length ?? 0)
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
