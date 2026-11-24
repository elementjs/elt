// A mount helper for the RepeatVirtual / RepeatCircular tests, injected in the page with
// `page.addScriptTag({ content: VIRTUAL_MOUNT })`: a list of labelled rows in a scroll area of a fixed
// size, with rows of varying sizes (so estimates are wrong), along either axis, left-to-right or not.

export type VMountOpts = {
  /** Number of rows (labels `item-0`…). */
  count: number
  /** `RepeatCircular` instead of `RepeatVirtual`. */
  circular?: boolean
  horizontal?: boolean
  rtl?: boolean
  /** Rows all `fixed` px; otherwise 30 to 99 px, varying with the index. */
  fixed?: number
  /** Size of the visible area along the axis (default 300). */
  viewport?: number
  initial?: number
  threshold?: number
  /** The scroll area is \`display: none\` when the list connects. */
  hidden?: boolean
}

export type VMount = {
  o_lst: { get: () => string[]; set: (v: string[]) => void }
  // biome-ignore lint/suspicious/noExplicitAny: the list instance, untyped across the page boundary
  instance: any
  area: HTMLElement
  content: HTMLElement
  /** Size of the row of a label, along the axis. */
  size_of: (label: string) => number
  /** Labels of the rendered rows, in DOM order. */
  rendered: () => string[]
  /** The first row reaching into the visible area, and how far its start is from the area's start. */
  first_visible: () => { label: string; offset: number } | null
  /** How far the start of a rendered row is from the visible area's start, null if not rendered. */
  offset_of: (label: string) => number | null
  /** The last row reaching into the visible area. */
  last_visible: () => string | null
  /** Logical scroll offset (positive towards the list's end, whatever the direction). */
  scroll: () => number
  /** The largest logical scroll offset. */
  max_scroll: () => number
  /** Scroll by `delta` logical pixels, in steps no larger than `step`, letting the list follow. */
  scroll_by: (delta: number, step?: number) => Promise<void>
  tear_down: () => void
}

declare global {
  interface Window {
    __vmount: (opts: VMountOpts) => VMount
  }
}

export const VIRTUAL_MOUNT = `
  window.__vmount = function (opts) {
    const { RepeatVirtual, RepeatCircular, node_append, node_remove, o } = window.__ELT__
    const horizontal = !!opts.horizontal
    const viewport = opts.viewport || 300
    const size_of = function (label) {
      if (opts.fixed) return opts.fixed
      const i = Number(label.split("-")[1])
      return 30 + ((i * 37) % 70)
    }

    const o_lst = o(Array.from({ length: opts.count }, function (_, i) { return "item-" + i }))

    const area = document.createElement("div")
    area.style.cssText = horizontal
      ? "width: " + viewport + "px; height: 50px; overflow-x: auto; overflow-y: hidden"
      : "height: " + viewport + "px; width: 200px; overflow-y: auto"
    if (opts.rtl) area.dir = "rtl"
    if (opts.hidden) area.style.display = "none"
    const content = document.createElement("div")
    content.style.cssText = horizontal ? "display: flex; width: max-content" : "display: flex; flex-direction: column"

    const render = function (o_item) {
      const row = document.createElement("div")
      row.className = "vrow"
      row.style.cssText = "flex: none; overflow: hidden; box-sizing: border-box"
      node_append(row, o_item)
      // The size follows the label: a row reused for another item changes size, as real rows do.
      window.__ELT__.node_observe(row, o_item, function (label) {
        row.style[horizontal ? "width" : "height"] = size_of(label) + "px"
      })
      return row
    }
    let instance = (opts.circular ? RepeatCircular : RepeatVirtual)(o_lst, render)
    if (horizontal) instance = instance.Horizontal()
    if (opts.threshold != null) instance = instance.Threshold(opts.threshold)
    if (opts.initial != null) instance = instance.InitialPosition(opts.initial)

    node_append(content, instance)
    node_append(area, content)
    node_append(document.body, area)

    const start_of = function (r) { return horizontal ? (opts.rtl ? -r.right : r.left) : r.top }
    const end_of = function (r) { return horizontal ? (opts.rtl ? -r.left : r.right) : r.bottom }
    const rows = function () { return Array.from(content.querySelectorAll(".vrow")) }
    const scroll = function () {
      return horizontal ? (opts.rtl ? -area.scrollLeft : area.scrollLeft) : area.scrollTop
    }
    const set_scroll = function (v) {
      if (horizontal) area.scrollLeft = opts.rtl ? -v : v
      else area.scrollTop = v
    }
    const max_scroll = function () {
      return horizontal ? area.scrollWidth - area.clientWidth : area.scrollHeight - area.clientHeight
    }
    const region = function () {
      const r = area.getBoundingClientRect()
      return { start: start_of(r), end: end_of(r) }
    }

    return {
      o_lst: o_lst,
      instance: instance,
      area: area,
      content: content,
      size_of: size_of,
      rendered: function () { return rows().map(function (r) { return r.textContent || "" }) },
      first_visible: function () {
        const reg = region()
        for (const r of rows()) {
          const b = r.getBoundingClientRect()
          if (end_of(b) > reg.start + 0.5) return { label: r.textContent || "", offset: start_of(b) - reg.start }
        }
        return null
      },
      offset_of: function (label) {
        const row = rows().find(function (r) { return r.textContent === label })
        return row == null ? null : start_of(row.getBoundingClientRect()) - region().start
      },
      last_visible: function () {
        const reg = region()
        let last = null
        for (const r of rows()) {
          const b = r.getBoundingClientRect()
          if (start_of(b) < reg.end - 0.5) last = r.textContent || ""
        }
        return last
      },
      scroll: scroll,
      max_scroll: max_scroll,
      scroll_by: async function (delta, step) {
        step = step || 40
        let left = delta
        while (Math.abs(left) > 0.5) {
          const d = Math.sign(left) * Math.min(Math.abs(left), step)
          const before = scroll()
          set_scroll(before + d)
          area.dispatchEvent(new Event("scroll"))
          await window.__ELT__.frames(3)
          if (Math.abs(scroll() - before) < 0.5) break
          left -= d
        }
        await window.__ELT__.frames(3)
      },
      tear_down: function () { node_remove(area) },
    }
  }
`
