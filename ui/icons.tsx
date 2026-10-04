/** Some default icons taken from phosphor icons (thank you !), but copied here to avoid dependencies */

import { css } from "elt"

export const cls_icon = css`.icon {
  & > svg {
    height: 1em;
    vertical-align: -.155em;
  }
}`

// Short names for the SVG tags and attributes the icons below use, to keep each icon on a few lines.
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

/** An icon: a `<span class="icon">` around a 256×256 `<svg>` holding `shapes`. */
function _(...shapes: SVGElement[]) {
  const sp = document.createElement("span")
  sp.classList.add(cls_icon)
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  svg.setAttribute("viewBox", "0 0 256 256")
  for (const shape of shapes) svg.appendChild(shape)
  sp.appendChild(svg)
  return sp
}

/** One stroked shape: `tag` with its own attributes given as name, value, name, value…, plus `STROKE`. */
function s(tag: string, ...attrs: string[]) {
  const e = document.createElementNS("http://www.w3.org/2000/svg", tag)
  for (let i = 0; i < attrs.length; i += 2) e.setAttribute(attrs[i], attrs[i + 1])
  for (const [name, value] of STROKE) e.setAttribute(name, value)
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

export const Check = /** @__PURE__ */ () => _(s(py, ps, CHECK_POINTS))
