import type { Renderable } from "./types"

import { o } from "./observable"

import { If, Repeat } from "./verbs"

import { VirtualWindow, type VirtualRenderFn } from "./virtual-window"

/**
 * A {@link Repeat} that only renders the rows near the visible part of its scroll area: the nearest
 * ancestor that scrolls vertically (`overflow-y: auto`, `scroll` or `overlay`), or horizontally with
 * `.Horizontal()`. The rows above and below are replaced by two padders, `<e-virtual-padder>` elements placed right before and after the
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
  /** Virtual list window backed by {@link Repeat} view reconciliation: a list with a true start and end. */
  export class Repeater<O extends o.IReadonlyObservable<any[] | null | undefined>> extends VirtualWindow<O> {
    protected readonly verb_name = "RepeatVirtual"

    constructor(obs: O, renderfn?: VirtualRenderFn<O>) {
      super(obs, renderfn)
    }

    protected lower() {
      return 0
    }

    protected upper() {
      return this.length()
    }

    /** The index `n` counted from the end when negative, within the list. */
    protected target_of(n: number) {
      const count = this.length()
      if (count === 0) return null
      return Math.max(0, Math.min(n < 0 ? count + n : n, count - 1))
    }

    /**
     * Rough index of the row at the scroll area's start: the scroll offset, less what sits before the
     * list in the scroll content (a header, other content, another list), over the estimated row
     * size. Reads layout: call it before writing anything.
     */
    protected estimateIndexFromScroll() {
      const count = this.length()
      const area = this.scroll_area
      if (count === 0 || area == null) {
        return 0
      }
      const axis = this.axis
      const scroll = axis.scroll(area)
      // Where the list starts in the scroll content: its start padder's start, or its first row's.
      const start = this.pos_start > 0 ? axis.start(this.padder_start.getBoundingClientRect()) : this.content_start()
      const lead = start == null ? 0 : start - this.region(area).start - axis.border_start(area) + scroll
      return Math.max(0, Math.min(count - 1, Math.floor((scroll - lead) / this.item_size)))
    }

    /** The end padder is purely an estimate of the not-yet-rendered tail; changing
     * it never moves on-screen content, so it can be recomputed freely. */
    protected update_padding_end() {
      this.o_padding_end.set(Math.max(0, this.length() - this.pos_end) * this.item_size)
    }

    /** Full (re)estimate of both padders. Used only on a hard reposition
     * ({@link setPosition}) or data change, where there is no anchor to preserve. */
    protected update_padding(_old_start: number) {
      this.o_padding_start.set(this.pos_start * this.item_size)
      this.update_padding_end()
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

      this.updateChildren(new_lst, undefined, this.is_update(old_lst))
      this.update_padding(this.pos_start)

      if (new_lst.length === 0) {
        o.transaction(() => {
          this.o_pos_start.set(0)
          this.o_pos_end.set(0)
        })
        return
      }

      this.eval()
      // Nothing rendered yet (first rows, or rows again after an empty list): show the first row.
      if (this.pos_end === this.pos_start) {
        this.jump_to(this.initial_position)
      }
    }

    /** Prefix and suffix belong to the list's true start and end, not to the edges of the rendered
     * window: they only show while the first (last) item is rendered. */
    protected override insert_extras(o_count: o.RO<number>) {
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
    }
  }
}
