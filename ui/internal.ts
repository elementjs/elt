// Helpers shared between elt/ui modules. Not public: package.json does not export this file, and
// elt/ui does not re-export it. The editor, in the same package, imports it by relative path.
import { node_is_connected, node_observe_attribute, node_on_connected, type o } from "elt"

/** The `Check` polyline, also the checkbox's check mark (ui/form.css.tsx). */
export const CHECK_POINTS = "40 144 96 200 224 72"

/**
 * Focus `el` once it's connected and shown. A popup shows its content a moment after attaching it,
 * and focus can only land on a shown element.
 *
 * Nothing happens if `el` was disconnected in the meantime: a popup closed within that frame is
 * still in the document while it fades out, and focusing it would drop focus to the body once it is
 * removed.
 */
export function focus_when_shown(el: HTMLElement) {
  node_on_connected(el, () =>
    requestAnimationFrame(() => {
      if (node_is_connected(el)) el.focus({ preventScroll: true })
    }),
  )
}

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

let overlay_name_ids = 0

/**
 * Names an overlay for assistive technology (docs/md/ui-overlays.md): `label` when given (`aria-label`),
 * else the first heading of `content`, else `fallback`, an element whose text names it (both through
 * `aria-labelledby`, the element given an `id` when it has none). Looked up once: a heading swapped
 * later doesn't rename it. Returns whether anything named it.
 */
export function name_overlay(
  overlay: Element,
  content: Element,
  label?: o.RO<string>,
  fallback?: Element | null,
): boolean {
  if (label != null) {
    node_observe_attribute(overlay, "aria-label", label)
    return true
  }
  const by = content.querySelector("h1, h2, h3, h4, h5, h6") ?? fallback
  if (by == null) return false
  by.id ||= `e-overlay-name-${++overlay_name_ids}`
  overlay.setAttribute("aria-labelledby", by.id)
  return true
}

const TABBABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable]:not([contenteditable="false"])'

/** The elements of `root` Tab reaches, in document order; a hidden one (`hidden`, `display: none`, a
 * hidden ancestor) is skipped, as Tab skips it. */
export function tab_stops(root: Element): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR)].filter((el) => el.checkVisibility())
}

/** Each open popup element: what closes it (with `undefined`), and the control that opened it. Filled by
 * `popup()`, so that code inside a popup (menu_nav) can close the one it is in. */
export const open_popups = new WeakMap<Element, { close: () => void; opener: Element | null }>()

/** The open popup `el` is in, if any: the nearest one around it. */
export function enclosing_popup(el: Element) {
  for (let iter: Element | null = el; iter != null; iter = iter.parentElement) {
    const found = open_popups.get(iter)
    if (found) return found
  }
  return null
}
