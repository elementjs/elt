/** Some default icons taken from phosphor icons (thank you !), but copied here to avoid dependencies */

import { css } from "elt"

export const cls_icon = css`.icon {
  & > svg {
    height: 1em;
    vertical-align: -.155em;
  }
}`

// Short names for the SVG tags and attributes the icons below use, to keep each icon on a few lines.
const _ = icon
const s = stroked
const c = "circle"
const cx = "cx"
const cy = "cy"
const d = "d"
const h = "height"
const l = "line"
const p = "path"
const ps = "points"
const py = "polyline"
const r = "r"
const rt = "rect"
const rx = "rx"
const w = "width"
const x = "x"
const x1 = "x1"
const x2 = "x2"
const y = "y"
const y1 = "y1"
const y2 = "y2"

/** Attributes every shape of every icon shares: phosphor's "regular" weight, a 16-unit round stroke
 * in the text color, no fill, on a 256×256 view box. */
const STROKE: [string, string][] = [
  ["fill", "none"],
  ["stroke", "currentColor"],
  ["stroke-linecap", "round"],
  ["stroke-linejoin", "round"],
  ["stroke-width", "16"],
]

/** An icon: a `<span class="icon">` around a 256×256 `<svg>` holding `shapes`. Exported with `stroked` and
 * `dot`, the shapes it holds, for icons kept elsewhere (the editor's type icons) that are copied from phosphor the same way. */
export function icon(...shapes: SVGElement[]) {
  const sp = document.createElement("span")
  sp.classList.add(cls_icon)
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  svg.setAttribute("viewBox", "0 0 256 256")
  // biome-ignore lint/plugin: building a detached svg, before elt ever sees it
  for (const shape of shapes) svg.appendChild(shape)
  // biome-ignore lint/plugin: same, a detached tree
  sp.appendChild(svg)
  return sp
}

/** One stroked shape: `tag` with its own attributes given as name, value, name, value…, plus `STROKE`. */
export function stroked(tag: string, ...attrs: string[]) {
  const e = document.createElementNS("http://www.w3.org/2000/svg", tag)
  for (let i = 0; i < attrs.length; i += 2) e.setAttribute(attrs[i], attrs[i + 1])
  for (const [name, value] of STROKE) e.setAttribute(name, value)
  return e
}

/** A filled dot (phosphor draws the dots of a question mark or a palette as small filled circles). */
export function dot(cx: string, cy: string, r: string) {
  const e = document.createElementNS("http://www.w3.org/2000/svg", "circle")
  e.setAttribute("cx", cx)
  e.setAttribute("cy", cy)
  e.setAttribute("r", r)
  e.setAttribute("fill", "currentColor")
  return e
}

/** The `Check` polyline, also the checkbox's check mark (ui/form.css.tsx). */
export const CHECK_POINTS = "40 144 96 200 224 72"

export const CaretDown = /** @__PURE__ */ () => _(s(py, ps, "208 96 128 176 48 96"))

export const CaretLeft = /** @__PURE__ */ () => _(s(py, ps, "160 208 96 128 160 48"))

export const CaretRight = /** @__PURE__ */ () => _(s(py, ps, "96 48 160 128 96 208"))

export const Calendar = /** @__PURE__ */ () =>
  _(
    s(rt, x, "40", y, "40", w, "176", h, "176", rx, "8"),
    s(l, x1, "176", y1, "24", x2, "176", y2, "56"),
    s(l, x1, "80", y1, "24", x2, "80", y2, "56"),
    s(l, x1, "40", y1, "88", x2, "216", y2, "88"),
    s(py, ps, "88 128 104 120 104 184"),
    s(p, d, "M138.14,128a16,16,0,1,1,26.64,17.63L136,184h32"),
  )

export const Clock = /** @__PURE__ */ () => _(s(c, cx, "128", cy, "128", r, "96"), s(py, ps, "128 72 128 128 184 128"))

export const MagnifyingGlass = /** @__PURE__ */ () =>
  _(s(c, cx, "112", cy, "112", r, "80"), s(l, x1, "168.57", y1, "168.57", x2, "224", y2, "224"))

export const X = /** @__PURE__ */ () =>
  _(s(l, x1, "200", y1, "56", x2, "56", y2, "200"), s(l, x1, "200", y1, "200", x2, "56", y2, "56"))

export const Trash = /** @__PURE__ */ () =>
  _(
    s(l, x1, "216", y1, "56", x2, "40", y2, "56"),
    s(l, x1, "104", y1, "104", x2, "104", y2, "168"),
    s(l, x1, "152", y1, "104", x2, "152", y2, "168"),
    s(p, d, "M200,56V208a8,8,0,0,1-8,8H64a8,8,0,0,1-8-8V56"),
    s(p, d, "M168,56V40a16,16,0,0,0-16-16H104A16,16,0,0,0,88,40V56"),
  )

/** Two arrows chasing each other: a conversion (Phosphor's ArrowsClockwise). */
export const ArrowsClockwise = /** @__PURE__ */ () =>
  _(
    s(py, ps, "176 104 224 104 224 56"),
    s(p, d, "M65.8,65.8a87.9,87.9,0,0,1,124.4,0L224,104"),
    s(py, ps, "80 152 32 152 32 200"),
    s(p, d, "M190.2,190.2a87.9,87.9,0,0,1-124.4,0L32,152"),
  )

export const Check = /** @__PURE__ */ () => _(s(py, ps, CHECK_POINTS))

export const Scissors = /** @__PURE__ */ () =>
  _(
    s(c, cx, "60", cy, "76", r, "28"),
    s(c, cx, "60", cy, "180", r, "28"),
    s(l, x1, "136", y1, "128", x2, "83.11", y2, "164.19"),
    s(l, x1, "232", y1, "62.32", x2, "164.33", y2, "108.61"),
    s(l, x1, "232", y1, "193.68", x2, "83.11", y2, "91.81"),
  )

export const Copy = /** @__PURE__ */ () =>
  _(s(py, ps, "168 168 216 168 216 40 88 40 88 88"), s(rt, x, "40", y, "88", w, "128", h, "128"))

export const ClipboardText = /** @__PURE__ */ () =>
  _(
    s(l, x1, "96", y1, "152", x2, "160", y2, "152"),
    s(l, x1, "96", y1, "120", x2, "160", y2, "120"),
    s(p, d, "M160,40h40a8,8,0,0,1,8,8V216a8,8,0,0,1-8,8H56a8,8,0,0,1-8-8V48a8,8,0,0,1,8-8H96"),
    s(p, d, "M88,72V64a40,40,0,0,1,80,0v8Z"),
  )

export const SelectionAll = /** @__PURE__ */ () =>
  _(
    s(l, x1, "144", y1, "40", x2, "112", y2, "40"),
    s(l, x1, "112", y1, "216", x2, "144", y2, "216"),
    s(p, d, "M184,40h24a8,8,0,0,1,8,8V72"),
    s(l, x1, "216", y1, "144", x2, "216", y2, "112"),
    s(p, d, "M184,216h24a8,8,0,0,0,8-8V184"),
    s(l, x1, "40", y1, "112", x2, "40", y2, "144"),
    s(p, d, "M72,216H48a8,8,0,0,1-8-8V184"),
    s(p, d, "M72,40H48a8,8,0,0,0-8,8V72"),
    s(rt, x, "80", y, "80", w, "96", h, "96"),
  )

export const DownloadSimple = /** @__PURE__ */ () =>
  _(
    s(l, x1, "128", y1, "144", x2, "128", y2, "32"),
    s(py, ps, "216 144 216 208 40 208 40 144"),
    s(py, ps, "168 104 128 144 88 104"),
  )
