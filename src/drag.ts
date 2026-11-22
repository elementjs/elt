import type { o } from "./observable"
import { node_add_event_listener, node_on_disconnected } from "./dom"
import type { Decorator } from "./types"

/** What a drop does, as the browser shows it with the cursor and reports it to the source. */
export type DropEffect = "none" | "copy" | "move" | "link"

/** What hovers over a {@link $dropzone} that accepted it. */
export interface DropHover {
  /** `dataTransfer.types`: the kinds of data carried, `"Files"` for files. */
  types: readonly string[]
  /** One entry per carried item. During the drag only the kind and MIME type are known, never a file's name. */
  items: readonly { kind: string; type: string }[]
  /** What `accept` returned: `"none"` when the zone refuses this drag, and shows why. */
  effect: DropEffect
  /** The pointer, relative to the zone's top-left corner. */
  x: number
  y: number
}

/** Zone state while something is dragged over it. */
interface ZoneState {
  /** `dragenter` minus `dragleave` seen by the zone: entering a child fires both, the enter first. */
  depth: number
  /** `accept`'s answer for the current drag, asked once: what is carried doesn't change during a drag. */
  effect: DropEffect | false | undefined
  types: readonly string[]
  items: readonly { kind: string; type: string }[]
  hover: DropHover | null
  out_hover: o.Out<DropHover | null> | undefined
}

/** Events already handled by an inner zone: the innermost zone that accepts a drag takes it, outer zones ignore it. */
const claimed = new WeakSet<Event>()
/** Zones with a drag over them, reset when any drag ends: `dragleave` doesn't come after a drop. */
const active = new Set<ZoneState>()
const guarded = new WeakSet<Document>()

function reset(st: ZoneState) {
  st.depth = 0
  st.effect = undefined
  active.delete(st)
  set_hover(st, null)
}

function set_hover(st: ZoneState, h: DropHover | null) {
  const prev = st.hover
  if (prev === h || (prev != null && h != null && prev.x === h.x && prev.y === h.y && prev.effect === h.effect)) return
  st.hover = h
  st.out_hover?.set(h)
}

/** A native file input takes files dropped on it itself. */
function is_file_input(target: EventTarget | null) {
  return target instanceof Element && target.closest("input[type=file]") != null
}

/** Once per document: ends every zone's hover when a drag ends, and refuses files dropped outside any zone. */
function install_guard(doc: Document) {
  if (guarded.has(doc)) return
  guarded.add(doc)
  const end = () => {
    for (const st of [...active]) reset(st)
  }
  doc.addEventListener("dragend", end)
  // A drop handler not written with $dropzone, which prevented the default itself, keeps the drag.
  doc.addEventListener("dragover", (ev) => {
    if (
      ev.defaultPrevented ||
      claimed.has(ev) ||
      ev.dataTransfer == null ||
      !$dropzone.has_files(ev.dataTransfer) ||
      is_file_input(ev.target)
    )
      return
    // Accepting with no effect refuses the drop, instead of the browser opening or downloading the file.
    ev.preventDefault()
    ev.dataTransfer.dropEffect = "none"
  })
  doc.addEventListener("drop", (ev) => {
    end()
    if (
      !ev.defaultPrevented &&
      !claimed.has(ev) &&
      ev.dataTransfer != null &&
      $dropzone.has_files(ev.dataTransfer) &&
      !is_file_input(ev.target)
    )
      ev.preventDefault()
  })
}

/**
 * Makes the node a place things can be dropped on: files from the desktop, text or links from another
 * application, or what a {@link $draggable} carries.
 *
 * `accept` is asked once per drag, when it first enters the node, and can only look at the kinds of data
 * carried (`dt.types`, `dt.items`): the data itself is readable in `drop` only. `false` leaves the drag to
 * the zones around; `"none"` takes it but refuses the drop, so the zone can show why. With nested zones, the
 * innermost one that takes the drag has it. `out_hover` is written while a drag the zone took is over the
 * node, and `null` once it leaves, is dropped or is cancelled.
 *
 * The first zone of a document also makes files dropped outside of every zone refused, rather than opened
 * by the browser (a file input, or a handler that called `preventDefault` itself, still takes them).
 *
 * ```tsx
 * <div>{$dropzone({ accept: (dt) => $dropzone.has_files(dt) && "copy", drop: (dt) => load(dt.files) })}</div>
 * ```
 *
 * @group Decorators
 */
export function $dropzone<N extends HTMLElement | SVGElement>(opts: $dropzone.Options<N>): Decorator<N> {
  return function $dropzone_apply(node) {
    const st: ZoneState = {
      depth: 0,
      effect: undefined,
      types: [],
      items: [],
      hover: null,
      out_hover: opts.out_hover,
    }
    if (node.ownerDocument != null) install_guard(node.ownerDocument)

    /** The zone's effect for this drag, asked to `accept` the first time. */
    const effect_of = (ev: DragEvent) => {
      if (st.effect === undefined) {
        const dt = ev.dataTransfer
        const res = dt == null ? false : opts.accept(dt, ev)
        st.effect = res
        st.types = dt == null ? [] : [...dt.types]
        st.items = dt == null ? [] : Array.from(dt.items, (it) => ({ kind: it.kind, type: it.type }))
        active.add(st)
      }
      return st.effect
    }

    node_add_event_listener(node, "dragenter", (ev) => {
      st.depth++
      effect_of(ev)
    })
    node_add_event_listener(node, "dragleave", () => {
      if (--st.depth <= 0) reset(st)
    })
    node_add_event_listener(node, "dragover", (ev) => {
      const effect = effect_of(ev)
      if (claimed.has(ev) || effect === false || ev.dataTransfer == null) {
        set_hover(st, null)
        return
      }
      claimed.add(ev)
      ev.preventDefault()
      // "none" refuses the drop, with the not-allowed cursor.
      ev.dataTransfer.dropEffect = effect
      if (st.out_hover == null) return
      const r = node.getBoundingClientRect()
      set_hover(st, { types: st.types, items: st.items, effect, x: ev.clientX - r.left, y: ev.clientY - r.top })
    })
    node_add_event_listener(node, "drop", (ev) => {
      const effect = effect_of(ev)
      reset(st)
      if (claimed.has(ev) || effect === false || ev.dataTransfer == null) return
      claimed.add(ev)
      ev.preventDefault()
      if (effect !== "none") opts.drop(ev.dataTransfer, ev)
    })
    node_on_disconnected(node, () => reset(st))
  }
}

export namespace $dropzone {
  export interface Options<N extends EventTarget> {
    /** The effect the drop will have ; `"none"` to refuse the drop while showing the hover ; `false` to leave the drag to the zones around. Asked once per drag. */
    accept(dt: DataTransfer, ev: DragEvent): DropEffect | false
    /** Called with the dropped data, readable now (`dt.files`, `dt.getData(type)`). */
    drop(dt: DataTransfer, ev: DragEvent & { currentTarget: N }): void
    /** Written with what hovers over the zone, `null` when nothing does. */
    out_hover?: o.Out<DropHover | null>
  }

  /** Whether files are carried, from the desktop or another application. */
  export function has_files(dt: DataTransfer) {
    return dt.types.includes("Files")
  }
}

/**
 * Makes the node draggable. `data` is called when the drag starts and gives the data carried, by type
 * (`"text/plain"`, `"text/uri-list"`, `"text/html"`, or a custom one an app's {@link $dropzone} looks for).
 * Text, links and HTML can be dropped in other applications too.
 *
 * `file` lets the node be dropped on the desktop or a file manager as a file. Chromium only: other browsers
 * ignore it. The URL (a `blob:` URL works) must stay valid after the drag ends, since the browser downloads
 * it after the drop.
 *
 * @group Decorators
 */
export function $draggable<N extends HTMLElement>(
  data: (ev: DragEvent) => Record<string, string>,
  opts: $draggable.Options = {},
): Decorator<N> {
  return function $draggable_apply(node) {
    node.draggable = true
    node_add_event_listener(node, "dragstart", (ev) => {
      const dt = ev.dataTransfer
      if (dt == null) return
      for (const [type, value] of Object.entries(data(ev))) dt.setData(type, value)
      const file = opts.file?.(ev)
      if (file != null) dt.setData("DownloadURL", `${file.mime}:${file.name}:${new URL(file.url, node.baseURI).href}`)
      if (opts.effect != null) dt.effectAllowed = opts.effect
      const img = opts.image?.(ev)
      if (img != null) dt.setDragImage(img.node, img.x, img.y)
    })
    const end = opts.end
    if (end != null)
      node_add_event_listener(node, "dragend", (ev) => end((ev.dataTransfer?.dropEffect ?? "none") as DropEffect, ev))
  }
}

export namespace $draggable {
  export interface Options {
    /** The effects a zone may choose. The browser refuses a drop whose effect isn't one of them. Default: any. */
    effect?: DataTransfer["effectAllowed"]
    /** The picture following the pointer, instead of the browser's picture of the node. */
    image?: (ev: DragEvent) => { node: Element; x: number; y: number } | undefined
    /** A file to give when the node is dropped outside the browser (Chromium only). */
    file?: (ev: DragEvent) => { name: string; mime: string; url: string } | undefined
    /** Called when the drag ends, with the effect of the drop: `"none"` when it was refused or cancelled. A `"move"` is for the source to carry out. */
    end?: (effect: DropEffect, ev: DragEvent) => void
  }
}
