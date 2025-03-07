
import { Inserter, Renderable } from "./types"

import { o } from "./observable"

import { node_add_event_listener, node_append, node_observe, node_on_connected, node_on_disconnected, node_remove } from "./dom"

import { Repeat } from "./verbs"

import { e } from "./elt"

import { sym_insert } from "./symbols"

/** The Node on which we add the observable that contains the current index */
interface RItem extends HTMLElement {
  _idx: o.Observable<number>
}

const debug = {
  red: "color: #ff3c00; font-weight: bold;",
  green: "color: #66f100; font-weight: bold;",
}

/** */
export class VirtualScroller<O extends o.RO<any[]>> implements Inserter<Element> {

  obs: o.Observable<any[]>

  configure(fn: (arg: this) => any) {
    fn(this)
    return this
  }

  /** The number of pixels after which we try to create/remove elements */
  threshold = 500

  /** The parent element that has overflow. Is usually automatically detected */
  overflow_parent: HTMLElement = null!

  o_padding_top = o(0)
  o_padding_bottom = o(0)

  oo_padding = o.merge({top: this.o_padding_top, bot: this.o_padding_bottom}).tf(st => ({
    paddingTop: `${st.top}px`,
    paddingBottom: `${st.bot}px`,
  }))

  /** The container */
  container!: HTMLElement // <e-virtual-repeat style={this.oo_padding}/> as HTMLElement

  /** Disable using a pool of items */
  allow_reuse = false

  item_size = 64

  nb_initial_items = 20

  /** The initial position we are to consider when this component is first loaded */
  initial_position = 0

  protected pos_start = 0
  protected pos_end = 0

  protected rendered = new Map<number, RItem>()
  protected pool: RItem[] = []



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
    // Find our parent element, the one with the
    let iter: HTMLElement | null = this.container//.parentElement
    while (iter && iter !== document.body) {
      const st = getComputedStyle(iter)

      let v = st.getPropertyValue("overflow")

      if (v === "auto" || v === "scroll") {
        this.overflow_parent = iter
        break
      }

      v = st.getPropertyValue("overflow-y")
      if (v === "auto" || v === "scroll") {
        this.overflow_parent = iter
        break
      }

      iter = iter.parentElement
    }

  }

  constructor(
    obs: O,
    public renderfn?: (ob: Repeat.RoItem<O>, n: o.RO<number>) => Renderable<HTMLElement>
  ) {
    this.obs = o(obs as any)
  }

  /** Re-render the viewport by trying to set the nth element around the top of the screen */
  setPosition(n: number) {

    const count = this.obs.get().length
    if (count === 0 || this.overflow_parent == null) {
      if (this.pos_end !== this.pos_start) {
        this.pos_start = 0
        this.pos_end = 0
      }
      return
    }

    this.pos_start = Math.max(n, 0)
    this.pos_end = this.pos_start

    // let index_ritem: RItem

    // The great question : should we reuse items that are already correctly rendered ?

    //
    const viewport_height = this.overflow_parent.clientHeight

    const theo_nb_items = Math.ceil(viewport_height / this.item_size + 10)
    const to_end = Math.min(count, this.pos_start + theo_nb_items)
    // this.pos_end = to_end

    // we should probably figure out if we need to shelve ritems

    for (let i = this.pos_start; i <= to_end; i++) {
      this.append()
    }

    // Before calling eval(), we want to reposition the viewport to indeed place the item whose position we wanted to attain to the desired place.
    // Right now, we only do "top"

    // We end up calling eval() to make sure whatever we rendered actually makes sense
    this.eval()
  }

  protected real_eval = () => {
    // We want to know if we need to add stuff "above" or "below"

    do {
      const first = this.container.firstElementChild as RItem
      const last = this.container.lastElementChild as RItem
      if (first == null || last == null) {
        // we're probably in an eval that was called right after being mounted and before setPosition, so we ignore it.
        return
      }

      /** Bounds of the first element */
      const bounds_first = this.getBounds(first)
      /** Bounds of the bottom-most element that was rendered */
      const bounds_last = this.getBounds(last)

      if (this.pos_end !== this.pos_start) {
        const new_item_size = (bounds_last.bottom - bounds_first.top) / (this.pos_end - this.pos_start)
        const item_diff = new_item_size - this.item_size
        this.item_size = this.item_size + item_diff / 10 // try not to modify
      }

      const scrolling_upwards = this.scroll_direction < 0

      const region = this.overflow_parent.getBoundingClientRect()

      let modif = false
      if (!scrolling_upwards && region.top - this.threshold > bounds_first.bottom) {
        this.shelveTop()
        modif = true
      }

      if (!scrolling_upwards && this.pos_end < this.obs.get().length  && region.bottom + this.threshold >= bounds_last.top) {
        if (this.append()) {
          modif = true
        }
      }

      if (this.scroll_direction < 0 && this.pos_start > 0 && region.top - this.threshold <= bounds_first.bottom) {
        if (this.prepend()) {
          modif = true
        }
      }

      if (this.scroll_direction < 0 && region.bottom + this.threshold < bounds_last.top) {
        this.shelveBottom()
        modif = true
      }

      if (!modif) {
        break
      }
    } while (true)

  }

  protected measureTopDiff(elt: RItem) {
    return this.overflow_parent.scrollTop - this.getBounds(elt).top
  }

  protected updateTop(elt: RItem, top_diff: number) {
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

  /** measure the bounds relative to the viewport for a given element */
  protected getBounds(r: RItem) {
    let res = {top: Infinity, bottom: -Infinity, height: 0}

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

    measure(r)
    res.height = res.bottom - res.top
    // console.log(res)
    return res
  }

  /** Shelve the topmost element */
  protected shelveTop() {
    const first = this.container.firstChild as RItem
    const second = first.nextSibling as RItem
    const shelved_idx = first._idx.get()

    if (this.debug >= 3) {
      console.log(`%c shelve ${shelved_idx}`, debug.red)
    }

    let scroll_top_diff = this.measureTopDiff(second)
    this.expect_scroll_event = true
    this.pos_start++

    this.rendered.delete(shelved_idx)
    node_remove(first)
    this.pool.push(first)

    this.updateTop(second, scroll_top_diff)
  }

  /** Shelve a RItem for later use */
  protected shelveBottom() {
    const end = this.container.lastChild as RItem
    const shelved_idx = end._idx.get()
    this.pos_end = shelved_idx - 1

    if (this.debug >= 3) {
      console.log(`%cshelve ${shelved_idx}`, debug.red)
    }

    this.rendered.delete(shelved_idx)
    node_remove(end)
    this.pool.push(end)
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

    const old_first = this.container.firstChild as RItem
    const prev_diff = this.measureTopDiff(old_first)

    const r = this.next(prepend_idx)
    node_append(this.container, r, this.container.firstChild)

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
    node_append(this.container, r)
    this.resizeEnd()
    return true
  }

  /** Create an element or get one back from the pool */
  protected next(idx: number) {
    let r = this.allow_reuse ? this.pool.pop() : null

    if (r == null) {
      r = document.createElement("e-ritem") as RItem
      r._idx = o(idx)
      const ob = this.obs.p(r._idx)
      node_append(r, this.renderfn!(ob as any, r._idx))
    }

    r.setAttribute("index", ""+idx)
    this.rendered.set(idx, r)
    r._idx.set(idx)
    return r
  }

  ///////////////////////////////////////////////////

  /** Insert our scroller */
  [sym_insert](parent: HTMLElement, refchild: Node | null): void {

    if (!this.container) {
      this.container = e("e-repeat")
      node_observe(this.container, this.oo_padding, padding => {
        Object.assign(parent.style, padding)
      })
    }

    node_on_disconnected(this.container, () => {
      this._observer.disconnect()
    })

    node_on_connected(this.container, () => {

      if (this.overflow_parent == null) {
        this.findNearestParent()
      }

      if (this.overflow_parent == null) {
        throw new Error("virtual scroller needs to be in an overflow element")
      }

      this.setPosition(0)

      node_add_event_listener(this.container, this.overflow_parent, "scroll", ev => {
        if (this.expect_scroll_event) {
          this.expect_scroll_event = false
          // Do not handle the event because we *know* it would be triggered
          return
        }

        const st = this.overflow_parent.scrollTop

        if (this.scroll_last_top !== st) {
          // console.log(st, this.scroll_last_top, this.scroll_direction)
          this.scroll_direction = st - this.scroll_last_top
          this.scroll_last_top = st
        }

        this.eval()
      })
    })

    node_observe(this.container, this.obs, lst => {
      // Tell the scroller that we're scrolling, even though we're not, so that eval appends stuff until it can't.
      this.scroll_direction = 1
      // Do not change the position, but maybe reevaluate boundaries ?
      this.eval()
      if (this.pos_end === this.pos_start) {
        this.setPosition(0)
      }
    })

    if (this.container !== parent) {
      node_append(parent, this.container, refchild)
    }
  }

  RenderEach(renderfn: (ob: Repeat.RoItem<O>, n: o.RO<number>) => Renderable<HTMLElement>) {
    this.renderfn = renderfn
    return this
  }

}