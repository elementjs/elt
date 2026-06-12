import type { Appender, Renderable } from "./types"

import { o } from "./observable"

import {
  CommentHolder,
  node_add_event_listener,
  node_append,
  node_do_disconnect,
  node_observe,
  node_on_connected,
  node_on_disconnected,
} from "./dom"

import { e } from "./elt"

import { sym_insert } from "./symbols"

/** A virtual-scroll row: comment-bounded like Repeat items */
class VirtualItem extends CommentHolder {
  _idx!: o.Observable<number>
}

const debug = {
  red: "color: #ff3c00; font-weight: bold;",
  green: "color: #66f100; font-weight: bold;",
}

export function VirtualScroll<
  T,
  O extends o.IReadonlyObservable<T[] | null | undefined>
>(
  obs: O,
  renderfn?: (
    ob: O extends o.IObservable<T[] | null | undefined, T[]>
      ? o.Observable<T>
      : o.ReadonlyObservable<T>,
    n: o.ReadonlyObservable<number>
  ) => Renderable<HTMLElement>
) {
  return new VirtualScroller(obs as any, renderfn as any)
}

/** */
export class VirtualScroller<O extends o.RO<any[]>>
  implements Appender<Element>
{
  obs: o.Observable<any[]>

  configure(fn: (arg: this) => any) {
    fn(this)
    return this
  }

  /** The number of pixels after which we try to create/remove elements */
  threshold = 500

  /** The parent element that has overflow. Is usually automatically detected */
  overflow_parent: HTMLElement = null!
  /** Direct child of the overflow parent that contains this scroller (may be the container comment) */
  prev_parent: Node = null!

  o_padding_top = o(0)
  o_padding_bottom = o(0)

  padder_top = e("div", { style: { paddingTop: this.o_padding_top.tf((st) => `${st??0}px`) } })
  padder_bottom = e("div", { style: { paddingBottom: this.o_padding_bottom.tf((st) => `${st??0}px`) } })

  /** Bounds the rendered items between two comments */
  container!: CommentHolder

  /** Disable using a pool of items */
  allow_reuse = false

  item_size = 64

  nb_initial_items = 20

  /** The initial position we are to consider when this component is first loaded */
  initial_position = 0

  protected pos_start = 0
  protected pos_end = 0

  protected rendered = new Map<number, VirtualItem>()
  protected pool: VirtualItem[] = []

  protected _observer = new ResizeObserver(() => {
    // console.log("resized")
    this.eval()
  })

  scroll_direction = 0
  scroll_last_top = -1

  expect_scroll_event = false

  debug = 0

  /** If parent is not provided, we look for it recursively */
  findNearestParent() {
    let prev_parent: Node | null = this.container
    let iter: Node | null = this.container
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

  protected container_parent() {
    return this.container.parentNode!
  }

  protected ensure_container_end() {
    if (this.container.end == null && this.container.parentNode) {
      this.container.end = document.createComment(
        (this.container.textContent ?? "") + " end"
      )
      node_append(
        this.container.parentNode,
        this.container.end,
        this.container.nextSibling
      )
    }
  }

  protected first_item(): VirtualItem | null {
    const end = this.container.end
    const n = this.container.nextSibling
    if (n == null || n === end || !(n instanceof VirtualItem)) {
      return null
    }
    return n
  }

  protected last_item(): VirtualItem | null {
    const end = this.container.end
    if (end == null) {
      return null
    }
    let iter: Node | null = end.previousSibling
    while (iter != null && iter !== this.container) {
      if (iter instanceof VirtualItem) {
        return iter
      }
      iter = iter.previousSibling
    }
    return null
  }

  protected next_item(item: VirtualItem): VirtualItem | null {
    const end = this.container.end
    let iter: Node | null = item.end?.nextSibling ?? item.nextSibling
    while (iter != null && iter !== end) {
      if (iter instanceof VirtualItem) {
        return iter
      }
      iter = iter.nextSibling
    }
    return null
  }

  protected shelve_item(item: VirtualItem) {
    let fr = document.createDocumentFragment()
    item.moveTo(fr)
    node_do_disconnect(fr)
    this.pool.push(item)
  }

  protected clearRendered() {
    let item = this.first_item()
    while (item != null) {
      this.rendered.delete(item._idx.get())
      this.shelve_item(item)
      item = this.first_item()
    }
    this.pos_start = 0
    this.pos_end = 0
  }

  /** Rough index from scroll offset; item_size is only an estimate */
  protected estimateIndexFromScroll(scroll_top: number) {
    const count = this.obs.get().length
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
    return (
      bounds_last.bottom < region.top - this.threshold ||
      bounds_first.top > region.bottom + this.threshold
    )
  }

  constructor(
    obs: O,
    public renderfn?: (
      ob: O extends o.IObservable<(infer T)[] | null | undefined, (infer T)[]>
        ? o.Observable<T>
        : O extends o.ReadonlyObservable<(infer T)[] | null | undefined>
        ? o.ReadonlyObservable<T>
        : never,
      n: o.RO<number>
    ) => Renderable<HTMLElement>
  ) {
    this.obs = o(obs as any) as o.Observable<O[]>
  }

  /** Re-render the viewport around index `n`, replacing whatever was rendered */
  setPosition(n: number) {
    const count = this.obs.get().length
    if (count === 0 || this.overflow_parent == null) {
      this.clearRendered()
      return
    }

    this.clearRendered()
    this.pos_start = Math.max(n, 0)
    this.pos_end = this.pos_start
    this.o_padding_top.set(this.pos_start * this.item_size)

    const viewport_height = this.overflow_parent.clientHeight
    const theo_nb_items = Math.ceil(viewport_height / this.item_size + 10)
    const to_end = Math.min(count - 1, this.pos_start + theo_nb_items)

    for (let i = this.pos_start; i <= to_end; i++) {
      this.append()
    }

    this.eval()
  }

  protected real_eval = () => {
    // We want to know if we need to add stuff "above" or "below"

    do {
      const first = this.first_item()
      const last = this.last_item()
      if (first == null || last == null) {
        // we're probably in an eval that was called right after being mounted and before setPosition, so we ignore it.
        return
      }

      /** Bounds of the first element */
      const bounds_first = this.getBounds(first)
      /** Bounds of the bottom-most element that was rendered */
      const bounds_last = this.getBounds(last)

      const region = this.overflow_parent.getBoundingClientRect()

      if (this.viewportMismatch(region, bounds_first, bounds_last)) {
        const idx = this.estimateIndexFromScroll(
          this.overflow_parent.scrollTop
        )
        if (idx < this.pos_start || idx >= this.pos_end) {
          this.setPosition(idx)
          return
        }
      }

      if (this.pos_end !== this.pos_start) {
        const new_item_size =
          (bounds_last.bottom - bounds_first.top) /
          (this.pos_end - this.pos_start)
        const item_diff = new_item_size - this.item_size
        this.item_size = this.item_size + item_diff / 10 // try not to modify
      }

      const scrolling_upwards = this.scroll_direction < 0

      let modif = false
      if (
        !scrolling_upwards &&
        region.top - this.threshold > bounds_first.bottom
      ) {
        this.shelveTop()
        modif = true
      }

      if (
        !scrolling_upwards &&
        this.pos_end < this.obs.get().length &&
        region.bottom + this.threshold >= bounds_last.top
      ) {
        if (this.append()) {
          modif = true
        }
      }

      if (
        this.scroll_direction < 0 &&
        this.pos_start > 0 &&
        region.top - this.threshold <= bounds_first.bottom
      ) {
        if (this.prepend()) {
          modif = true
        }
      }

      if (
        this.scroll_direction < 0 &&
        region.bottom + this.threshold < bounds_last.top &&
        this.pos_end > 0
      ) {
        this.shelveBottom()
        modif = true
      }

      if (!modif) {
        break
      }
    } while (true)
  }

  protected measureTopDiff(elt: VirtualItem) {
    return this.overflow_parent.scrollTop - this.getBounds(elt).top
  }

  protected updateTop(elt: VirtualItem, top_diff: number) {
    const pad_top = this.item_size * this.pos_start
    this.o_padding_top.set(pad_top)

    let new_top = this.getBounds(elt).top
    // console.log(new_top, scroll_top_diff)
    const new_scroll_top = new_top + top_diff
    this.overflow_parent.scrollTop = new_top + top_diff
    this.scroll_last_top = new_scroll_top
  }

  protected resizeEnd() {
    const left = this.obs.get().length - this.pos_end
    // console.log(left, this.pos_end, this.obs.get().length)
    this.o_padding_bottom.set(left * this.item_size)
  }

  /** Wrapper for real_evel that limits it to animationFrames */
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

  /** measure the bounds relative to the viewport for content inside a comment holder */
  protected getBounds(r: VirtualItem) {
    let res = { top: Infinity, bottom: -Infinity, height: 0 }

    const measure = (elt: HTMLElement, pt: Element | null = null) => {
      const bbox = elt.getBoundingClientRect()
      const ptt = elt.offsetParent

      if (pt != null && ptt !== pt) {
        return
      }

      if (bbox.height) {
        res.top = Math.min(res.top, bbox.top)
        res.bottom = Math.max(res.bottom, bbox.bottom)
      }

      let iter = elt.firstElementChild
      while (iter != null) {
        measure(iter as HTMLElement, ptt ?? pt)
        iter = iter.nextElementSibling
      }
    }

    const end = r.end
    let iter = r.nextSibling
    while (iter != null && iter !== end) {
      if (iter instanceof HTMLElement) {
        measure(iter)
      }
      iter = iter.nextSibling
    }

    res.height = res.bottom - res.top
    return res
  }

  /** Shelve the topmost element */
  protected shelveTop() {
    const first = this.first_item()!
    const second = this.next_item(first)!
    const shelved_idx = first._idx.get()

    if (this.debug >= 3) {
      console.log(`%c shelve ${shelved_idx}`, debug.red)
    }

    let scroll_top_diff = this.measureTopDiff(second)
    this.expect_scroll_event = true
    this.pos_start++

    this.rendered.delete(shelved_idx)
    this.shelve_item(first)

    this.updateTop(second, scroll_top_diff)
  }

  /** Shelve a VirtualItem for later use */
  protected shelveBottom() {
    const end = this.last_item()!

    const shelved_idx = end._idx.get()
    this.pos_end = shelved_idx

    if (this.debug >= 3) {
      console.log(`%cshelve ${shelved_idx}`, debug.red)
    }

    this.rendered.delete(shelved_idx)
    this.shelve_item(end)

    this.resizeEnd()
  }

  protected prepend() {
    if (this.pos_start === 0) {
      return false
    }

    const prepend_idx = --this.pos_start
    // console.log(this.scroll_direction)
    if (this.debug >= 3) {
      console.log(`%cprepend ${prepend_idx}`, debug.green)
    }

    const old_first = this.first_item()!
    const prev_diff = this.measureTopDiff(old_first)

    const r = this.next(prepend_idx)
    this.ensure_container_end()
    r.moveTo(this.container_parent(), this.container.nextSibling)

    this.updateTop(old_first, prev_diff)
    return true
  }

  protected append() {
    if (this.pos_end > this.obs.get().length - 1) {
      return false
    }
    const idx = this.pos_end++
    if (this.debug >= 3) {
      console.log(`%cappend ${idx}`, debug.green)
    }
    const r = this.next(idx)
    this.ensure_container_end()
    r.moveTo(this.container_parent(), this.container.end)
    this.resizeEnd()
    return true
  }

  /** Create an element or get one back from the pool */
  protected next(idx: number) {
    let r = this.allow_reuse ? this.pool.pop() : null

    const fr = document.createDocumentFragment()
    if (r == null) {
      r = new VirtualItem("virtual-scroll-item " + idx)
      fr.appendChild(r)
      r._idx = o(idx)
      const ob = this.obs.p(r._idx)
      r.updateRenderable(this.renderfn!(ob as any, r._idx) as Renderable<Node>)
    }

    this.rendered.set(idx, r)
    r._idx.set(idx)
    return r
  }

  ///////////////////////////////////////////////////

  /** Insert our scroller */
  [sym_insert](parent: HTMLElement, refchild: Node | null): void {

    if (!this.container) {
      this.container = new CommentHolder("e-virtual-scroll")
    }

    node_on_disconnected(this.container, () => {
      this._observer.disconnect()
    })

    node_on_connected(this.container, () => {
      if (this.overflow_parent == null) {
        this.findNearestParent()
        this.ensure_container_end()
        node_append(this.overflow_parent, this.padder_top, this.prev_parent)
        const padder_bottom_ref =
          this.prev_parent === this.container
            ? this.container.end!.nextSibling
            : this.prev_parent.nextSibling
        node_append(this.overflow_parent, this.padder_bottom, padder_bottom_ref)
      }

      if (this.overflow_parent == null) {
        throw new Error("virtual scroller needs to be in an overflow element")
      }

      this.setPosition(0)

      node_add_event_listener(
        this.container,
        this.overflow_parent,
        "scroll",
        (ev) => {
          if (this.expect_scroll_event) {
            this.expect_scroll_event = false
            // Do not handle the event because we *know* it would be triggered
            return
          }

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

    node_observe(this.container, this.obs, (lst, old) => {
      // eval being asynchronous, we make sure to destroy
      if (
        old !== o.NoValue &&
        old.length > lst.length &&
        this.pos_end > lst.length
      ) {
        while (this.pos_end > lst.length) {
          this.shelveBottom()
        }

        if (this.pos_end < this.pos_start) {
          this.pos_end = this.pos_start
        }
        // console.log(lst, old, this.pos_end)
      }

      // Tell the scroller that we're scrolling, even though we're not, so that eval appends stuff until it can't.
      this.scroll_direction = 1
      // Do not change the position, but maybe reevaluate boundaries ?
      this.eval()
      if (this.pos_end === this.pos_start) {
        this.setPosition(0)
      }
    })

    node_append(parent, this.container, refchild)
    this.container.updateRenderable(null)
  }

  RenderEach(
    renderfn: (
      ob: O extends o.IObservable<(infer T)[] | null | undefined, (infer T)[]>
        ? o.Observable<T>
        : O extends o.ReadonlyObservable<(infer T)[] | null | undefined>
        ? o.ReadonlyObservable<T>
        : never,
      n: o.RO<number>
    ) => Renderable<HTMLElement>
  ) {
    this.renderfn = renderfn
    return this
  }
}
