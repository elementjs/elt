/*
The icons of the editor's value types (the Change type menu), copied from phosphor's "regular" weight like
those of elt/ui (ui/icons.tsx, which also holds the helpers drawing them). A type's icon is chosen in
`type-style.ts`, not here. Calendar (dates) is elt/ui's.
*/

import { dot, icon, stroked as s } from "elt/ui/icons"

export const ArrowCounterClockwise = /** @__PURE__ */ () =>
  icon(s("polyline", "points", "24 56 24 104 72 104"), s("path", "d", "M67.59,192A88,88,0,1,0,65.77,65.77L24,104"))

export const ArrowClockwise = /** @__PURE__ */ () =>
  icon(s("polyline", "points", "184 104 232 104 232 56"), s("path", "d", "M188.4,192a88,88,0,1,1,1.83-126.23L232,104"))

export const Plus = /** @__PURE__ */ () =>
  icon(
    s("line", "x1", "40", "y1", "128", "x2", "216", "y2", "128"),
    s("line", "x1", "128", "y1", "40", "x2", "128", "y2", "216"),
  )

export const Empty = /** @__PURE__ */ () =>
  icon(s("line", "x1", "208", "y1", "40", "x2", "48", "y2", "216"), s("circle", "cx", "128", "cy", "128", "r", "88"))

export const Question = /** @__PURE__ */ () =>
  icon(
    dot("128", "180", "12"),
    s("path", "d", "M128,144v-8c17.67,0,32-12.54,32-28s-14.33-28-32-28S96,92.54,96,108v4"),
    s("circle", "cx", "128", "cy", "128", "r", "96"),
  )

export const Quotes = /** @__PURE__ */ () =>
  icon(
    s("path", "d", "M108,144H40a8,8,0,0,1-8-8V72a8,8,0,0,1,8-8h60a8,8,0,0,1,8,8v88a40,40,0,0,1-40,40"),
    s("path", "d", "M224,144H156a8,8,0,0,1-8-8V72a8,8,0,0,1,8-8h60a8,8,0,0,1,8,8v88a40,40,0,0,1-40,40"),
  )

export const Hash = /** @__PURE__ */ () =>
  icon(
    s("line", "x1", "48", "y1", "96", "x2", "224", "y2", "96"),
    s("line", "x1", "176", "y1", "40", "x2", "144", "y2", "216"),
    s("line", "x1", "112", "y1", "40", "x2", "80", "y2", "216"),
    s("line", "x1", "32", "y1", "160", "x2", "208", "y2", "160"),
  )

export const ToggleLeft = /** @__PURE__ */ () =>
  icon(
    s("rect", "x", "16", "y", "64", "width", "224", "height", "128", "rx", "64"),
    s("circle", "cx", "80", "cy", "128", "r", "32"),
  )

export const BracketsCurly = /** @__PURE__ */ () =>
  icon(
    s("path", "d", "M80,40c-64,0,0,88-64,88,64,0,0,88,64,88"),
    s("path", "d", "M176,40c64,0,0,88,64,88-64,0,0,88-64,88"),
  )

export const BracketsSquare = /** @__PURE__ */ () =>
  icon(s("polyline", "points", "80 40 40 40 40 216 80 216"), s("polyline", "points", "176 40 216 40 216 216 176 216"))

/** Phosphor's Selection: a dashed frame, a set of loose members. */
export const Selection = /** @__PURE__ */ () =>
  icon(
    s("line", "x1", "144", "y1", "40", "x2", "112", "y2", "40"),
    s("line", "x1", "112", "y1", "216", "x2", "144", "y2", "216"),
    s("path", "d", "M184,40h24a8,8,0,0,1,8,8V72"),
    s("line", "x1", "216", "y1", "144", "x2", "216", "y2", "112"),
    s("path", "d", "M184,216h24a8,8,0,0,0,8-8V184"),
    s("line", "x1", "40", "y1", "112", "x2", "40", "y2", "144"),
    s("path", "d", "M72,216H48a8,8,0,0,1-8-8V184"),
    s("path", "d", "M72,40H48a8,8,0,0,0-8,8V72"),
  )

export const ArrowsLeftRight = /** @__PURE__ */ () =>
  icon(
    s("polyline", "points", "176 144 208 176 176 208"),
    s("line", "x1", "48", "y1", "176", "x2", "208", "y2", "176"),
    s("polyline", "points", "80 112 48 80 80 48"),
    s("line", "x1", "208", "y1", "80", "x2", "48", "y2", "80"),
  )

export const Palette = /** @__PURE__ */ () =>
  icon(
    s(
      "path",
      "d",
      "M128,192a24,24,0,0,1,24-24h46.21a24,24,0,0,0,23.4-18.65A96.48,96.48,0,0,0,224,127.17c-.45-52.82-44.16-95.7-97-95.17a96,96,0,0,0-95,96c0,41.81,26.73,73.44,64,86.61A24,24,0,0,0,128,192Z",
    ),
    dot("128", "76", "12"),
    dot("84", "100", "12"),
    dot("84", "156", "12"),
    dot("172", "100", "12"),
  )

export const CaretUpDown = /** @__PURE__ */ () =>
  icon(s("polyline", "points", "80 176 128 224 176 176"), s("polyline", "points", "80 80 128 32 176 80"))

export const Cube = /** @__PURE__ */ () =>
  icon(
    s("polyline", "points", "32.7 76.92 128 129.08 223.3 76.92"),
    s(
      "path",
      "d",
      "M131.84,25l88,48.18a8,8,0,0,1,4.16,7v95.64a8,8,0,0,1-4.16,7l-88,48.18a8,8,0,0,1-7.68,0l-88-48.18a8,8,0,0,1-4.16-7V80.18a8,8,0,0,1,4.16-7l88-48.18A8,8,0,0,1,131.84,25Z",
    ),
    s("line", "x1", "128", "y1", "129.09", "x2", "128", "y2", "232"),
  )
