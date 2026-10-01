/*
 * Maintainer notes — rules for changing `RepeatVirtual` or any measure-driven list. They do not
 * apply to ordinary `Repeat` code.
 *
 * - Never interleave layout reads (`getBoundingClientRect`, `scrollTop`, …) with observable-driven
 *   DOM writes in one loop: every read after a write forces a reflow, making the pass O(n) reflows.
 *   Read once, compute, write in one batch, converge on later frames.
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

type RowMeasure<O extends o.IReadonlyObservable<any[] | null | undefined>> = {
  item: RepeatItem<O>
  index: number
  bounds: ItemBounds
}

/**
 * The scroll area of one {@link RepeatVirtual}: a plain element that scrolls, and holds the two
 * padders standing for the rows that aren't rendered above and below the visible ones. They live in
 * its shadow root, around a `<slot>` that shows its children:
 *
 * ```
 * <e-virtual-scroll>
 *   #shadow-root: [top padder] <slot> [bottom padder]
 *   …children (the RepeatVirtual itself, or the element that holds it)
 * ```
 *
 * It needs a bounded height to scroll. Its base style (`display: block; overflow: auto`) is a
 * default any stylesheet can override.
 */
export class EVirtualScroll extends HTMLElement {
  readonly padder_top: HTMLElement
  readonly padder_bottom: HTMLElement
  /** The RepeatVirtual using this scroll area, while it is connected. */
  owner: object | null = null

  constructor() {
    super()
    const shadow = this.attachShadow({ mode: "open" })
    const style = document.createElement("style")
    // :host rules lose to any rule of the page, so these are defaults.
    style.textContent = `:host { display: block; overflow: auto; overflow-anchor: none; overscroll-behavior: contain; }`
    this.padder_top = document.createElement("div")
    this.padder_bottom = document.createElement("div")
    shadow.append(style, this.padder_top, document.createElement("slot"), this.padder_bottom)
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

    protected _observer = new ResizeObserver(() => {
      this.eval()
    })

    scroll_direction = 0
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

    /** True when the rendered window no longer overlaps the viewport */
    protected viewportMismatch(
      region: DOMRect,
      bounds_first: { top: number; bottom: number },
      bounds_last: { top: number; bottom: number },
    ) {
      if (!this.boundsValid(bounds_first) || !this.boundsValid(bounds_last)) {
        return false
      }
      return bounds_last.bottom < region.top - this.threshold || bounds_first.top > region.bottom + this.threshold
    }

    protected boundsValid(bounds: { top: number; bottom: number; height?: number }) {
      return bounds.top !== Infinity && bounds.bottom !== -Infinity && (bounds.height == null || bounds.height > 0)
    }

    /** Trailing rows fully below the scrollport (symmetric to {@link computeShelfTop}). */
    protected computeShelfBottom(rows: RowMeasure<O>[], region: DOMRect) {
      let count = 0

      for (let i = rows.length - 1; i >= 0; i--) {
        const row = rows[i]
        if (!this.boundsValid(row.bounds)) {
          break
        }
        if (region.bottom + this.threshold < row.bounds.top) {
          count++
        } else {
          break
        }
      }

      return count
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

      const start = Math.max(0, Math.min(n, count - 1))
      const end = Math.min(count, start + this.screenful() + 1)

      o.transaction(() => {
        this.o_pos_start.set(start)
        this.o_pos_end.set(end)
      })
      this.update_padding()
      this.reconcileView(start, end)
      this.eval()
    }

    /** Single layout read: viewport region + every rendered row's bounds. */
    protected measureWindow(): {
      rows: RowMeasure<O>[]
      region: DOMRect
      scroll_top: number
    } | null {
      const area = this.scroll_area
      if (area == null) return null
      const region = area.getBoundingClientRect()
      const scroll_top = area.scrollTop
      const rows: RowMeasure<O>[] = []

      let item: RepeatItem<O> | null = this.first_item()
      while (item != null) {
        rows.push({
          item,
          index: item[Repeat.sym_obs].o_prop.get(),
          bounds: this.getBounds(item),
        })
        item = this.next_item(item)
      }

      if (rows.length === 0) {
        return null
      }

      return { rows, region, scroll_top }
    }

    /** First row that reaches the viewport (its bottom is at or past the scrollport
     * top). This is the row we pin across a view change: anything above it is
     * off-screen, so reflow there is absorbed by the top spacer rather than jumping
     * the visible content. Crucial when rows can reflow (e.g. a shared-width
     * `<table>` where adding/removing rows re-wraps cells of other rows). */
    protected pickAnchor(rows: RowMeasure<O>[], region: DOMRect) {
      for (const row of rows) {
        if (this.boundsValid(row.bounds) && row.bounds.bottom > region.top) {
          return row
        }
      }
      return null
    }

    /** Leading rows fully above the scrollport. */
    protected computeShelfTop(rows: RowMeasure<O>[], region: DOMRect) {
      let count = 0

      for (const row of rows) {
        if (!this.boundsValid(row.bounds)) {
          break
        }
        if (region.top - this.threshold > row.bounds.bottom) {
          count++
        } else {
          break
        }
      }

      return count
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

    protected real_eval = () => {
      const snapshot = this.measureWindow()
      if (snapshot == null) {
        return
      }

      const { rows, region, scroll_top } = snapshot
      const bounds_first = rows[0].bounds
      const bounds_last = rows[rows.length - 1].bounds

      // Rows are in the DOM but not laid out yet (0-height): retry next frame.
      if (!this.boundsValid(bounds_first) || !this.boundsValid(bounds_last)) {
        this.eval()
        return
      }

      // The window drifted entirely off-screen (programmatic jump / large wheel):
      // reposition wholesale from a scroll estimate rather than crawling row by row.
      if (this.viewportMismatch(region, bounds_first, bounds_last)) {
        const idx = this.estimateIndexFromScroll(scroll_top)
        if (idx < this.pos_start || idx >= this.pos_end) {
          this.setPosition(idx)
          return
        }
      }

      // Refine the average row-height estimate. Damped, and only committed past 1px
      // so sub-pixel measurement noise never re-jitters the padders / scrollbar.
      if (this.pos_end !== this.pos_start) {
        const measured = (bounds_last.bottom - bounds_first.top) / (this.pos_end - this.pos_start)
        if (measured > 0 && Math.abs(measured - this.item_size) > 1) {
          this.item_size += (measured - this.item_size) / 4
        }
      }

      const list_count = o.get(this.obs)?.length ?? 0
      const region_top = region.top - this.threshold
      const region_bottom = region.bottom + this.threshold
      const scrolling_up = this.scroll_direction < 0

      // Pin the first visible row across whatever we do this frame. We anchor on
      // EVERY view change (not just top-edge ones): any reconcile — even growing
      // the bottom — can reflow already-rendered rows (shared-width tables), and
      // without a correction that reflow shifts the viewport and rows vanish off
      // the top. The first visible row survives all four operations below, since
      // shelving only removes rows that are a full `threshold` off-screen.
      const top_anchor = this.pickAnchor(rows, region)

      // Compute the whole target window from a SINGLE measurement, then perform a
      // single write. We never re-measure mid-frame — that interleaving of reads
      // and writes (one row at a time) was the source of the layout thrashing.
      // The top/bottom edges are gated by scroll direction so an edge is never
      // grown and trimmed in the same pass (which would oscillate).
      let new_start = this.pos_start
      let new_end = this.pos_end

      if (!scrolling_up) {
        // Scrolling down (or idle): trim from the top, grow at the bottom.
        const shelve = this.computeShelfTop(rows, region)
        if (shelve > 0) {
          new_start = this.pos_start + shelve
        }

        if (this.pos_end < list_count && bounds_last.bottom < region_bottom) {
          // Estimate how many rows cover the gap so the whole gap is filled at once.
          const missing = Math.ceil((region_bottom - bounds_last.bottom) / this.item_size)
          new_end = this.pos_end + Math.max(1, missing)
        }
      } else {
        // Scrolling up: grow at the top, trim from the bottom.
        if (this.pos_start > 0 && bounds_first.top > region_top) {
          const missing = Math.ceil((bounds_first.top - region_top) / this.item_size)
          new_start = this.pos_start - Math.max(1, missing)
        }

        const shelve = this.computeShelfBottom(rows, region)
        if (shelve > 0) {
          new_end = this.pos_end - shelve
        }
      }

      new_start = Math.max(0, Math.min(new_start, list_count))
      new_end = Math.max(new_start, Math.min(new_end, list_count))

      const anchor = top_anchor?.item ?? null
      const anchor_top = top_anchor?.bounds.top ?? null

      if (this.debug >= 3 && (new_start !== this.pos_start || new_end !== this.pos_end)) {
        console.log(
          `%cwindow [${this.pos_start},${this.pos_end}) -> [${new_start},${new_end})`,
          new_start < this.pos_start || new_end > this.pos_end ? debug.green : debug.red,
        )
      }

      if (this.applyViewChange(new_start, new_end, anchor, anchor_top)) {
        // The estimate may have under/over-shot the gap; converge on the next
        // frame. Each pass paints in between, so this is not a busy layout loop.
        this.eval()
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

      this.scroll_direction = 1
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
        // Also watch the element that actually holds the rows: when a row's
        // height changes after render (images, fonts, async content) the
        // container resizes, so we re-evaluate the window and refresh padding.
        const holder = this.__list.parentElement
        if (holder != null && holder !== area) {
          this._observer.observe(holder)
        }

        this.setPosition(this.initial_position)

        node_add_event_listener(this.__list, area, "scroll", () => {
          // We never write scrollTop (anchoring is done via the top padder), so
          // every scroll event is a genuine user scroll.
          const st = area.scrollTop
          const prev_top = this.scroll_last_top

          if (prev_top >= 0) {
            const delta = st - prev_top
            if (Math.abs(delta) > this.jump_threshold()) {
              this.scroll_direction = delta
              this.scroll_last_top = st
              this.setPosition(this.estimateIndexFromScroll(st))
              return
            }
          }

          if (this.scroll_last_top !== st) {
            this.scroll_direction = st - prev_top
            this.scroll_last_top = st
          }

          this.eval()
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
