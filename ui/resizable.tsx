import { $on, css, type Decorator, node_on_connected, node_on_disconnected } from "elt"
import { theme } from "./theme"

/** The side of the element that carries the drag handle. `"start"`/`"end"` follow the writing direction. */
export type ResizeEdge = "start" | "end" | "top" | "bottom"

export interface ResizableOptions {
  /** Side of the element the handle is on. Default `"end"`. Dragging it away from the element grows it. */
  edge?: ResizeEdge
  /** Smallest size in px. Default 48. */
  min?: number
  /** Largest size in px. Default: none. */
  max?: number
  /** Called with each new size in px while dragging. */
  on_resize?: (px: number) => void
  /**
   * Write the size on the element (`width` for the `"start"`/`"end"` edges, `height` for the others).
   * Default: `true`, unless `on_resize` is given, in which case the caller applies the size itself
   * (a grid puts it in its column template).
   */
  write?: boolean
}

const DEFAULT_MIN = 48

/**
 * Calls `fn` on the frame after each layout where `el` has a size: the moment a laid-out width can
 * be read and locked. A ResizeObserver tells when that layout happened, which also catches an
 * element laid out late (a popup not shown yet). `fn` runs on the next animation frame rather than
 * in the observer: what it writes changes sizes the browser already measured this frame (the
 * element's ancestors), whose own observers couldn't be notified until the next one, reported as a
 * "ResizeObserver loop completed with undelivered notifications" error. The frame's delay doesn't
 * show: a lock writes back the sizes the elements already have. Returns a function that stops
 * watching.
 */
export function observe_layout(el: HTMLElement, fn: () => void): () => void {
  let frame = 0
  const observer = new ResizeObserver(() => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      if (el.offsetWidth > 0) fn()
    })
  })
  observer.observe(el)
  return () => {
    observer.disconnect()
    cancelAnimationFrame(frame)
  }
}

/**
 * Makes an element resizable by dragging one of its edges: a column header, a sidebar or a
 * navigation bar in a flex row, a panel. The decorator returns the drag handle, which elt puts
 * in the element.
 *
 * Once the element has been laid out, its size is written on it (a size set by the content, `auto`
 * or a flex share becomes a fixed one) and it stops shrinking in a flex container; after that it
 * keeps that size until dragged. Only the pointer drives it: there is no keyboard resizing yet.
 */
export function $resizable(opts: ResizableOptions = {}): Decorator<HTMLElement> {
  const edge = opts.edge ?? "end"
  const horizontal = edge === "start" || edge === "end"
  const prop = horizontal ? "width" : "height"
  const min = opts.min ?? DEFAULT_MIN
  const max = opts.max ?? Number.POSITIVE_INFINITY
  const write = opts.write ?? opts.on_resize == null

  return (host) => {
    const set_size = (px: number) => {
      const size = Math.min(max, Math.max(min, px))
      if (write) host.style[prop] = `${size}px`
      opts.on_resize?.(size)
    }
    const size_now = () => host.getBoundingClientRect()[prop]

    // The handle is positioned against the element: give it a position unless it has one (a
    // sticky header keeps its own).
    let stop_observing: (() => void) | null = null
    node_on_connected(host, () => {
      if (getComputedStyle(host).position === "static") host.classList.add(cls_positioned)
      if (!write) return
      stop_observing ??= observe_layout(host, () => {
        stop_observing?.()
        // The measured size, written back: from now on the element no longer depends on its content.
        host.style[prop] = `${size_now()}px`
        host.style.flexShrink = "0"
      })
    })
    node_on_disconnected(host, () => {
      stop_observing?.()
      stop_observing = null
    })

    // A drag moves the pointer along the axis; the element grows when it moves away from it.
    let drag: { from: number; size: number; sign: number } | null = null
    const axis = (ev: PointerEvent) => (horizontal ? ev.clientX : ev.clientY)

    return (
      <span aria-hidden="true" data-resize-edge={edge} class={cls_handle}>
        {$on("pointerdown", (ev) => {
          ev.preventDefault()
          ev.stopPropagation()
          const handle = ev.currentTarget as HTMLElement
          // Capture: the move and release events come to the handle wherever the pointer goes. A
          // pointer the browser doesn't know (a synthetic event) can't be captured; the drag still works.
          try {
            handle.setPointerCapture(ev.pointerId)
          } catch {
            // synthetic event: nothing to capture
          }
          const toward_end = edge === "end" || edge === "bottom"
          const rtl = horizontal && getComputedStyle(host).direction === "rtl"
          drag = { from: axis(ev), size: size_now(), sign: toward_end !== rtl ? 1 : -1 }
          handle.toggleAttribute("data-resizing", true)
        })}
        {$on("pointermove", (ev) => {
          if (drag) set_size(drag.size + drag.sign * (axis(ev) - drag.from))
        })}
        {$on("pointerup", (ev) => end_drag(ev))}
        {$on("pointercancel", (ev) => end_drag(ev))}
      </span>
    )

    function end_drag(ev: PointerEvent) {
      drag = null
      ;(ev.currentTarget as HTMLElement).toggleAttribute("data-resizing", false)
    }
  }
}

/* The handle's host, when it had no position of its own. */
const cls_positioned = css`.resizable-positioned {
  position: relative;
}`

/* A strip along one edge of the element: wide enough to grab, wider for a finger. It shows a tint
   fill while hovered and dragged. touch-action: none keeps a touch drag from scrolling the page. */
const cls_handle = css`.resize-handle {
  position: absolute;
  z-index: 1;
  touch-action: none;
  --handle-size: 6px;
  @media (pointer: coarse) { --handle-size: 16px; }
  &[data-resize-edge="start"], &[data-resize-edge="end"] {
    top: 0;
    height: 100%;
    width: var(--handle-size);
    cursor: col-resize;
  }
  &[data-resize-edge="start"] { inset-inline-start: 0; }
  &[data-resize-edge="end"] { inset-inline-end: 0; }
  &[data-resize-edge="top"], &[data-resize-edge="bottom"] {
    left: 0;
    width: 100%;
    height: var(--handle-size);
    cursor: row-resize;
  }
  &[data-resize-edge="top"] { top: 0; }
  &[data-resize-edge="bottom"] { bottom: 0; }
  &:hover, &[data-resizing] { background: ${theme.colors.tint.mid}; }
}`
