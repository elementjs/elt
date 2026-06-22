import type { Renderable } from "./types"

import { o } from "./observable"

import {
  node_add_event_listener,
  node_append,
  node_observe,
  node_on_connected,
  node_on_disconnected,
} from "./dom"

import { e } from "./elt"

import { Repeat } from "./verbs"

import { sym_insert } from "./symbols"

const debug = {
  red: "color: #ff3c00; font-weight: bold;",
  green: "color: #66f100; font-weight: bold;",
}

type RepeatItem<Obs extends Repeat.RepeatedObservable<any>> =
  Repeat.RepeatItemElement<Obs>

type ItemBounds = { top: number; bottom: number; height: number }

type RowMeasure<O extends o.IReadonlyObservable<any[] | null | undefined>> = {
  item: RepeatItem<O>
  index: number
  bounds: ItemBounds
}

/**
 * A windowed (virtual) scroller: only the rows near the viewport are rendered,
 * the rest are represented by top/bottom spacers sized from an estimated row
 * height. Backed by {@link Repeat} view reconciliation.
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
 * siblings. Per-row content that wraps based only on the container width is
 * fine; content that wraps based on sibling rows is not.
 *
 * Rows may still change height (images loading, async content, responsive
 * wrapping) — that is handled — as long as the change isn't *caused by* the
 * windowing itself.
 */
export function VirtualScroll<
  O extends o.IReadonlyObservable<any[] | null | undefined>
>(
  obs: O,
  renderfn?: (
    ob: O extends o.IObservable<(infer T)[] | null | undefined, any[]>
      ? o.Observable<T>
      : O extends o.IReadonlyObservable<(infer T)[] | null | undefined>
      ? o.ReadonlyObservable<T>
      : never,
    n: o.ReadonlyObservable<number>
  ) => Renderable<HTMLElement>
) {
  return new VirtualScroller(obs as any, renderfn as any)
}

/** Virtual list window backed by {@link Repeat} view reconciliation. */
export class VirtualScroller<
  O extends o.IReadonlyObservable<any[] | null | undefined>
> extends Repeat.Repeater<O> {
  /** The number of pixels after which we try to create/remove elements */
  threshold = 500

  /** The parent element that has overflow. Is usually automatically detected */
  overflow_parent: HTMLElement = null!
  /** Direct child of the overflow parent that contains this scroller */
  prev_parent: Node = null!

  o_pos_start = o(0)
  o_pos_end = o(0)

  o_padding_top = o(0)
  o_padding_bottom = o(0)

  padder_top = e("div", {
    style: { paddingTop: this.o_padding_top.tf(st => `${st ?? 0}px`), overflowAnchor: "none" },
  })
  padder_bottom = e("div", {
    style: { paddingBottom: this.o_padding_bottom.tf(st => `${st ?? 0}px`), overflowAnchor: "none" },
  })

  item_size = 64

  nb_initial_items = 20

  /** The initial position we are to consider when this component is first loaded */
  initial_position = 0

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

  configure(fn: (arg: this) => any) {
    fn(this)
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
      n: o.RO<number>
    ) => Renderable<HTMLElement>
  ) {
    super(obs, renderfn as unknown as Repeat.RenderItemFn<O>)
    this.ForView(this.o_pos_start, this.o_pos_end)
  }

  /** If parent is not provided, we look for it recursively */
  findNearestParent() {
    let prev_parent: Node | null = this.__list
    let iter: Node | null = this.__list
    while (iter && iter !== document.body) {
      if (iter instanceof HTMLElement) {
        const st = getComputedStyle(iter)

        let v = st.getPropertyValue("overflow")

        if (v === "auto" || v === "scroll") {
          this.overflow_parent = iter
          this.prev_parent = prev_parent!
          break
        }

        v = st.getPropertyValue("overflow-y")
        if (v === "auto" || v === "scroll") {
          this.overflow_parent = iter
          this.prev_parent = prev_parent!
          break
        }
      }

      prev_parent = iter
      iter = iter.parentElement
    }
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
    return Math.max(
      0,
      Math.min(count - 1, Math.floor(scroll_top / this.item_size))
    )
  }

  protected jump_threshold() {
    return Math.max(this.threshold, this.overflow_parent.clientHeight)
  }

  /** True when the rendered window no longer overlaps the viewport */
  protected viewportMismatch(
    region: DOMRect,
    bounds_first: { top: number; bottom: number },
    bounds_last: { top: number; bottom: number }
  ) {
    if (!this.boundsValid(bounds_first) || !this.boundsValid(bounds_last)) {
      return false
    }
    return (
      bounds_last.bottom < region.top - this.threshold ||
      bounds_first.top > region.bottom + this.threshold
    )
  }

  protected boundsValid(bounds: {
    top: number
    bottom: number
    height?: number
  }) {
    return (
      bounds.top !== Infinity &&
      bounds.bottom !== -Infinity &&
      (bounds.height == null || bounds.height > 0)
    )
  }

  /** Trailing rows fully below the scrollport (symmetric to {@link computeShelfTop}). */
  protected computeShelfBottom(rows: RowMeasure<O>[], region: DOMRect) {
    let count = 0

    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i]!
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
    this.o_padding_bottom.set(
      Math.max(0, count - this.pos_end) * this.item_size
    )
  }

  /** Full (re)estimate of both spacers. Used only on a hard reposition
   * ({@link setPosition}) or data change, where there is no anchor to preserve. */
  protected update_padding() {
    this.o_padding_top.set(this.pos_start * this.item_size)
    this.update_padding_bottom()
  }

  /** Re-render the viewport around index `n`, replacing whatever was rendered */
  setPosition(n: number) {
    const count = o.get(this.obs)?.length ?? 0
    if (count === 0 || this.overflow_parent == null) {
      o.transaction(() => {
        this.o_pos_start.set(0)
        this.o_pos_end.set(0)
      })
      this.update_padding()
      this.reconcileView(0, 0)
      return
    }

    const start = Math.max(0, Math.min(n, count - 1))
    const viewport_height = this.overflow_parent.clientHeight
    const theo_nb_items = Math.ceil(viewport_height / this.item_size + 10)
    const end = Math.min(count, start + theo_nb_items + 1)

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
    const region = this.overflow_parent.getBoundingClientRect()
    const scroll_top = this.overflow_parent.scrollTop
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
  protected preserveScrollAnchor(
    anchor: RepeatItem<O>,
    anchor_top_before: number
  ) {
    const new_top = this.getBounds(anchor).top
    // Guard against a transiently unmeasurable anchor (Infinity) poisoning the
    // spacer; a frame with no correction is harmless, a NaN spacer is not.
    if (!Number.isFinite(new_top) || !Number.isFinite(anchor_top_before)) {
      return
    }
    const shift = new_top - anchor_top_before
    if (shift !== 0) {
      this.o_padding_top.set(
        Math.max(0, o.get(this.o_padding_top) - shift)
      )
    }
  }

  protected applyViewChange(
    new_pos_start: number,
    new_pos_end: number,
    anchor: RepeatItem<O> | null,
    anchor_top_before: number | null
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
    const bounds_first = rows[0]!.bounds
    const bounds_last = rows[rows.length - 1]!.bounds

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
      const measured =
        (bounds_last.bottom - bounds_first.top) /
        (this.pos_end - this.pos_start)
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
        const missing = Math.ceil(
          (region_bottom - bounds_last.bottom) / this.item_size
        )
        new_end = this.pos_end + Math.max(1, missing)
      }
    } else {
      // Scrolling up: grow at the top, trim from the bottom.
      if (this.pos_start > 0 && bounds_first.top > region_top) {
        const missing = Math.ceil(
          (bounds_first.top - region_top) / this.item_size
        )
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

    if (
      this.debug >= 3 &&
      (new_start !== this.pos_start || new_end !== this.pos_end)
    ) {
      console.log(
        `%cwindow [${this.pos_start},${this.pos_end}) -> [${new_start},${new_end})`,
        new_start < this.pos_start || new_end > this.pos_end
          ? debug.green
          : debug.red
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
      const lst =
        (o.get(this.obs) as unknown as NonNullable<o.ObservedType<O>>) ?? []
      this.updateChildren(lst, { start, end })
    })
    return this
  }

  protected override reconcile_view() {
    // Only the bottom spacer here — the top spacer is owned by the anchor
    // correction in applyViewChange and must not be reset to an estimate.
    this.update_padding_bottom()
    if (
      this.pos_start === this._last_view_start &&
      this.pos_end === this._last_view_end
    ) {
      return
    }
    this.update_lock(() => {
      this._last_view_start = this.pos_start
      this._last_view_end = this.pos_end
      const lst =
        (o.get(this.obs) as unknown as NonNullable<o.ObservedType<O>>) ?? []
      this.updateChildren(lst)
    })
  }

  protected override updateChildrenPre(
    new_lst: NonNullable<o.ObservedType<O>>,
    old_lst: NonNullable<o.ObservedType<O>> | o.NoValue
  ) {
    // The list content changed: the windowing cache no longer reflects the DOM,
    // so force the next reconcile to run rather than dedup against a stale window.
    this._last_view_start = -1
    this._last_view_end = -1

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

  /** Insert our scroller */
  override [sym_insert](parent: Node, refchild: Node | null): void {
    if (this.renderfn == null) {
      throw new Error("VirtualScroller needs a Render function")
    }

    node_on_disconnected(this.__list, () => {
      this._observer.disconnect()
    })

    node_on_connected(this.__list, () => {
      if (this.overflow_parent == null) {
        this.findNearestParent()
        // Disable the browser's own scroll anchoring on the whole scrollport:
        // we keep content stable manually via the top spacer, and native
        // anchoring would fight that by also nudging scrollTop.
        ;(this.overflow_parent as HTMLElement).style.overflowAnchor = "none"
        node_append(this.overflow_parent, this.padder_top, this.prev_parent)
        const padder_bottom_ref =
          this.prev_parent === this.__list
            ? this.__list.end!.nextSibling
            : this.prev_parent.nextSibling
        node_append(
          this.overflow_parent,
          this.padder_bottom,
          padder_bottom_ref
        )
        this._observer.observe(this.overflow_parent)
        // Also watch the element that actually holds the rows: when a row's
        // height changes after render (images, fonts, async content) the
        // container resizes, so we re-evaluate the window and refresh padding.
        if (
          this.prev_parent instanceof Element &&
          this.prev_parent !== this.overflow_parent
        ) {
          this._observer.observe(this.prev_parent)
        }
      }

      if (this.overflow_parent == null) {
        throw new Error("virtual scroller needs to be in an overflow element")
      }

      this.setPosition(this.initial_position)

      node_add_event_listener(
        this.__list,
        this.overflow_parent,
        "scroll",
        () => {
          // We never write scrollTop anymore (anchoring is done via the top
          // spacer), so every scroll event is a genuine user scroll.
          const st = this.overflow_parent.scrollTop
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
        }
      )
    })

    node_append(parent, this.__list, refchild)
    this.__list.updateRenderable(null)

    this.observer = node_observe(
      this.__list,
      this.obs,
      (lst, old_lst) => {
        this.update_lock(() => {
          this.updateChildrenPre(
            (lst as unknown as NonNullable<o.ObservedType<O>>) ?? [],
            (old_lst as unknown as NonNullable<o.ObservedType<O>>) ?? []
          )
        })
      },
      { immediate: true }
    )

    if (this.o_view_start != null && this.o_view_end != null) {
      this.view_observer = node_observe(
        this.__list,
        o.join(this.o_view_start, this.o_view_end),
        () => {
          this.reconcile_view()
        }
      )
    }
  }
}
