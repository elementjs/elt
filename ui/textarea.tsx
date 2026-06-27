import {
  $connected,
  $disconnected,
  node_observe,
  o,
  type attrs_textarea,
  type NRO,
  type Renderable,
} from "elt"

declare module "elt" {
  interface attrs_textarea {
    auto?: true
    "max-lines"?: NRO<number>
    "min-lines"?: NRO<number>
  }
}

export type TextAreaAttrs = attrs_textarea

function line_height_px(ta: HTMLTextAreaElement) {
  const st = getComputedStyle(ta)
  const lh = parseFloat(st.lineHeight)
  if (Number.isFinite(lh)) return lh
  // "normal" — approximate from font-size for clamp math.
  return (parseFloat(st.fontSize) || 16) * 1.2
}

function box_vertical_extra(ta: HTMLTextAreaElement) {
  const st = getComputedStyle(ta)
  return (
    (parseFloat(st.paddingTop) || 0) +
    (parseFloat(st.paddingBottom) || 0) +
    (parseFloat(st.borderTopWidth) || 0) +
    (parseFloat(st.borderBottomWidth) || 0)
  )
}

/** Fit block size to content, clamped to [min_lines, max_lines]. */
function resize_to_content(
  ta: HTMLTextAreaElement,
  min_lines: number,
  max_lines: number
) {
  const min_l = Math.max(1, min_lines)
  let max_l = Number.isFinite(max_lines) ? max_lines : Number.MAX_SAFE_INTEGER

  const lh = line_height_px(ta)
  const extra = box_vertical_extra(ta)
  const min_h = min_l * lh + extra
  const max_h = max_l * lh + extra

  // Collapse before measuring so scrollHeight reflects wrapped content, not the previous height.
  ta.style.height = "0px"
  const needed = ta.scrollHeight
  const height = Math.min(max_h, Math.max(min_h, needed))

  ta.style.height = `${height}px`
  // Only scroll internally once a max height is in effect and content exceeds it.
  ta.style.overflowY =
    Number.isFinite(max_lines) && needed > max_h + 0.5 ? "auto" : "hidden"
}

/** Wire listeners; returns teardown. `resize` is invoked on every path that can change line count. */
function setup_auto_grow(ta: HTMLTextAreaElement, resize: () => void) {
  // $bind and other code assign .value without firing "input".
  const native_value = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value"
  )!
  Object.defineProperty(ta, "value", {
    ...native_value,
    set(v: string) {
      native_value.set!.call(this, v)
      resize()
    },
  })

  ta.addEventListener("input", resize)

  // Reflow when the control's box changes (font metrics, padding, width → wrapping).
  const ro = new ResizeObserver(() => resize())
  ro.observe(ta)

  // Parent layout changes can alter width without changing the textarea's border box first.
  window.addEventListener("resize", resize, { passive: true })

  resize()

  return () => {
    ta.removeEventListener("input", resize)
    window.removeEventListener("resize", resize)
    ro.disconnect()
    delete (ta as { value?: string }).value
    Object.defineProperty(ta, "value", native_value)
  }
}

export function $auto_grow(opts?: {max?: o.RO<number>, min?: o.RO<number>}): Renderable<HTMLTextAreaElement> {
  return (ta: HTMLTextAreaElement) => {
    const oo_min_lines = o(opts?.min ?? 1)
    const oo_max_lines = o(opts?.max ?? Number.MAX_SAFE_INTEGER)
    let teardown: (() => void) | null = null

    const resize = () => {
      const min = oo_min_lines.get()
      const max = oo_max_lines.get()
      resize_to_content(ta, min, max)
    }

    node_observe(ta, o.join(oo_min_lines, oo_max_lines), () => {
      resize
    })

    return [
      $connected(ta => {
        ta.style.overflowY = "hidden"
        ta.style.resize = "none"
        teardown = setup_auto_grow(ta, resize)
      }),
      $disconnected(() => {
        teardown?.()
        teardown = null
      }),
    ]
  }
}
