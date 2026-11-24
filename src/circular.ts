import type { Renderable } from "./types"

import { o } from "./observable"

import { If, Repeat } from "./verbs"

import { VirtualWindow, type VirtualRenderFn } from "./virtual-window"

/** Size of each padder of a ring: room to scroll that no fling exhausts before it stops (the list
 * recentres once scrolling stops), below every browser's largest element size. */
const RUNWAY = 1_000_000

/** Indices start near here: positive (a row whose index is 0 has no separator before it) and far from
 * the limits of exact integers whichever way the user scrolls. */
const BASE = 2 ** 40

/** How long without a `scroll` event counts as stopped, where the browser has no `scrollend`. */
const SCROLL_IDLE_MS = 150

/** `i` modulo `n`, in `[0, n)` for a negative `i` too. */
function mod(i: number, n: number) {
  return ((i % n) + n) % n
}

/**
 * A virtual list without ends: after its last item comes its first again, whichever way the user
 * scrolls, as on a wheel of hours or minutes. It renders the rows near the visible part of its scroll
 * area, like {@link RepeatVirtual}, with the same requirements on rows (their size depends on their
 * own content only; it may change after render), vertically or with `.Horizontal()`.
 *
 * ```tsx
 * <div style="height: 200px; overflow-y: auto">
 *   <e-column>{RepeatCircular(o_hours, (o_hour, oo_index) => <div>{o_hour}</div>)}</e-column>
 * </div>
 * ```
 *
 * The same item may be rendered several times at once (when the list is shorter than the visible
 * area). The index the render function receives is the item's index in the list.
 *
 * @group Verbs
 */
export function RepeatCircular<O extends o.IReadonlyObservable<any[] | null | undefined>>(
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
  return new RepeatCircular.Repeater<O>(obs, renderfn as any)
}

export namespace RepeatCircular {
  /**
   * A ring over the list: index `i` of the window stands for item `i mod length`. Rows are keyed by
   * that index, unique per occurrence. The padders are fixed runways rather than estimates (a ring's
   * scrollbar means nothing), brought back to their full size once scrolling stops.
   */
  export class Repeater<O extends o.IReadonlyObservable<any[] | null | undefined>> extends VirtualWindow<O> {
    protected readonly verb_name = "RepeatCircular"

    /** Identifies an item across data changes (see {@link updateChildrenPre}); rows are keyed by index. */
    protected item_keyfn: ((item: any) => any) | null = null

    /** The list's length, for the index given to the render function. */
    protected oo_length = o.tf(this.obs, (lst) => lst?.length ?? 0)

    /** The next reposition starts from an empty window: the padders get their full runway. */
    protected from_empty = true

    /** Timer standing for `scrollend` where the browser has none. */
    protected idle_timer: ReturnType<typeof setTimeout> | null = null

    constructor(obs: O, renderfn?: VirtualRenderFn<O>) {
      super(obs, renderfn)
      // A ring has no first rows laid out before anything: its initial position is always scrolled to.
      this.explicit_initial = true
    }

    /** Identify items by `fn(item)` rather than by the item itself, to keep the visible rows on their
     * items when the list changes. */
    override withKeyFunction(fn: (item: NonNullable<Repeat.ItemType<O>>) => any) {
      this.item_keyfn = fn
      return this
    }

    /** A ring has no start: there is nothing to show before it. */
    override PrefixBy(_fn: unknown): never {
      throw new Error("RepeatCircular has no start or end: PrefixBy and SuffixBy don't apply")
    }

    override SuffixBy(_fn: unknown): never {
      return this.PrefixBy(_fn)
    }

    protected lower() {
      return -Infinity
    }

    protected upper() {
      return Infinity
    }

    protected override key_at(_lst: NonNullable<o.ObservedType<O>>, i: number) {
      return i
    }

    override item_at(lst: NonNullable<o.ObservedType<O>>, i: number) {
      return lst.length === 0 ? (undefined as Repeat.ItemType<O>) : lst[mod(i, lst.length)]
    }

    override data_index(i: number, length: number) {
      return length === 0 ? 0 : mod(i, length)
    }

    protected override clamp_view(length: number, start: number, end: number): Repeat.View {
      if (length === 0) return { start: 0, end: 0 }
      const s = Math.floor(start)
      return { start: s, end: Math.max(s, Math.floor(end)) }
    }

    protected override render_index(o_index: o.Observable<number>) {
      return o.expression((get) => this.data_index(get(o_index), get(this.oo_length)))
    }

    /** The key identifying item `i` of `lst` across data changes. */
    protected item_key(lst: NonNullable<o.ObservedType<O>>, i: number) {
      const item = lst[i]
      return this.item_keyfn?.(item) ?? item
    }

    /** The occurrence of item `n` (negative: from the end) nearest to what is shown, or around
     * {@link BASE} when nothing is. */
    protected target_of(n: number) {
      const len = this.length()
      if (len === 0) return null
      const wanted = mod(n, len)
      if (this.pos_end === this.pos_start) return BASE - mod(BASE, len) + wanted
      const current = this.estimateIndexFromScroll()
      let delta = mod(wanted - mod(current, len), len)
      if (delta > len / 2) delta -= len
      return current + delta
    }

    /** The row at the visible area's start, from the rendered rows' extent: a ring has no offset
     * that designates an index. Reads layout. */
    protected estimateIndexFromScroll() {
      const area = this.scroll_area
      const content_start = this.content_start()
      if (area == null || content_start == null || this.pos_end === this.pos_start) return this.pos_start
      const offset = this.region(area).start + this.axis.border_start(area) - content_start
      return this.pos_start + Math.floor(offset / this.item_size)
    }

    protected override reposition(n: number) {
      this.from_empty = this.pos_end === this.pos_start
      super.reposition(n)
    }

    /** Both runways at full size on a first window; otherwise the start padder moves by the estimated
     * size of the rows the window moved by, so the rows land where the scroll is. */
    protected update_padding(old_start: number) {
      if (this.from_empty) {
        this.o_padding_start.set(RUNWAY)
      } else {
        this.o_padding_start.set(
          Math.max(0, o.get(this.o_padding_start) + (this.pos_start - old_start) * this.item_size),
        )
      }
      this.update_padding_end()
    }

    protected update_padding_end() {
      this.o_padding_end.set(RUNWAY)
    }

    /**
     * Once scrolling has stopped, bring the start padder back to its full runway, and the scroll with
     * it: one write, invisible, never during a fling (see the maintainer notes in virtual-window.ts).
     */
    protected recentre = () => {
      if (this.idle_timer != null) clearTimeout(this.idle_timer)
      this.idle_timer = null
      if (this.scroll_area == null || this.length() === 0) return
      const delta = RUNWAY - o.get(this.o_padding_start)
      if (Math.abs(delta) < RUNWAY / 4) return
      this.o_padding_start.set(RUNWAY)
      this.scroll_by(delta)
    }

    protected override on_scrolled() {
      if ("onscrollend" in window) return
      if (this.idle_timer != null) clearTimeout(this.idle_timer)
      this.idle_timer = setTimeout(this.recentre, SCROLL_IDLE_MS)
    }

    protected override on_connect(area: HTMLElement) {
      this.from_empty = true
      if ("onscrollend" in window) area.addEventListener("scrollend", this.recentre)
    }

    protected override on_disconnect(area: HTMLElement) {
      area.removeEventListener("scrollend", this.recentre)
      if (this.idle_timer != null) clearTimeout(this.idle_timer)
      this.idle_timer = null
    }

    /**
     * The list changed. The row pinned at the visible area's start keeps its item: its key is still
     * at the same list index, or moved by exactly as many indices as the list grew (items prepended),
     * and the window's indices shift so that `mod` lands on it. Otherwise the indices stay, and what
     * the visible rows show changes. No search through the list.
     */
    protected override updateChildrenPre(
      new_lst: NonNullable<o.ObservedType<O>>,
      old_lst: NonNullable<o.ObservedType<O>> | o.NoValue,
    ) {
      this._last_view_start = -1
      this._last_view_end = -1
      const len = new_lst.length
      const old_len = old_lst === o.NoValue ? 0 : old_lst.length
      const rendered = this.pos_end > this.pos_start

      if (len === 0) {
        o.transaction(() => {
          this.o_pos_start.set(0)
          this.o_pos_end.set(0)
        })
        this.updateChildren(new_lst, undefined, false)
        return
      }
      if (old_len === 0 || !rendered || old_lst === o.NoValue) {
        this.updateChildren(new_lst, undefined, false)
        if (!rendered) this.jump_to(this.initial_position)
        return
      }

      // The row at the visible area's start, read before anything is written, stays where it is.
      this.pin_before_change(false)
      const anchor = this.pending_pin?.anchor ?? null
      const at = anchor == null ? this.pos_start : anchor[Repeat.sym_obs].o_prop.get()

      const was = mod(at, old_len)
      const key = this.item_key(old_lst, was)
      const added = len - old_len
      const now =
        was < len && this.item_key(new_lst, was) === key
          ? was
          : added > 0 && was + added < len && this.item_key(new_lst, was + added) === key
            ? was + added
            : mod(at, len)
      const shift = now - mod(at, len)

      if (shift !== 0) {
        // The window and its rows move by `shift`: same rows, keyed and indexed anew, so the
        // reconciliation keeps them all and each shows its item again through its observable.
        o.transaction(() => {
          this.o_pos_start.set(this.pos_start + shift)
          this.o_pos_end.set(this.pos_end + shift)
          for (let item = this.first_item(); item != null; item = this.next_item(item)) {
            const obs = item[Repeat.sym_obs]
            obs.key = (obs.key as number) + shift
            obs.o_prop.set(obs.o_prop.get() + shift)
          }
        })
      }
      this.updateChildren(new_lst, undefined, false)
      this.eval()
    }

    protected override insert_extras(o_count: o.RO<number>) {
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
