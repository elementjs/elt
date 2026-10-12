import { type Attrs, type NRO, css } from "elt"
import {
  CENTERED_TEXT_CONTROL_SELECTOR,
  HIDDEN_SELECTOR,
  INLINE_ONLY_TEXT_BLOCK_SELECTOR,
  MEANINGFUL_BORDER_SELECTOR,
} from "./selectors"
import {
  ambient_surface_mix,
  type ColorStep,
  type InvertedSurface,
  type SpacingStep,
  spacing_steps,
  theme,
} from "./theme"

declare module "elt" {
  interface ElementMap {
    "e-grid": EGridAttrs
    "e-grid-row": EGridRowAttrs
    "e-flex": EFlexAttrs
    "e-prose": EProseAttrs
    "e-row": EFlexAttrs
    "e-column": EFlexAttrs
  }
}

export type SpacingValues = SpacingStep

export type AlignValues =
  | "center"
  | "start"
  | "end"
  | "self-start"
  | "baseline"
  | "first baseline"
  | "last baseline"
  | "safe center"
  | "unsafe center"
  | "normal"
  | "stretch"
  | "space-evenly"
  | "space-around"
  | "space-between"

/** See `ColorStep` (ui/theme.tsx) — shared by `surface` and `border`. */
export type BorderValues = ColorStep

/** See `ColorStep` (ui/theme.tsx) — shared by `surface` and `border`. */
export type SurfaceValues =
  | boolean // true value — one level up from ambient, `neutral` family
  | "background"
  | InvertedSurface // an inverted band: the family's color becomes the background (docs/md/ui-theme.md, Inversion)
  | ColorStep

export interface CommonAttrs extends Attrs<HTMLElement> {
  inline?: NRO<boolean>
  relative?: NRO<boolean>
  grow?: NRO<boolean>

  spacing?: NRO<true | SpacingValues | "none">
  pad?: NRO<true | SpacingValues | "none">
  /**
   * Raise a new background level, one step off whatever level is already ambient. Bare `surface`
   * (no value) uses the `neutral` family; `"tint"`/`"neutral"` forces that family, still one step
   * up from ambient; `"tint-N"`/`"neutral-N"` (`N` 1-6) is that family at an absolute level,
   * ignoring what's ambient; `"background"` is absolute level 0. See "Surfaces and levels" in
   * docs/md/ui-theme.md.
   */
  surface?: NRO<boolean | SurfaceValues>
  hover?: NRO<boolean>
  /**
   * Draw a border around the element. Bare `border` (no value) is one level up (`+1`) from
   * whatever `surface` resolved to on this same element (own `[surface]` if set, else ambient),
   * keeping that surface's color family. `"tint"`/`"neutral"` forces that family, still `+1` from
   * this element's own/ambient surface level. `"tint-N"`/`"neutral-N"` is that family at an
   * absolute level, ignoring this element's `surface` value. Implies `radius` (see below) unless
   * `radius="none"`. `"none"` draws nothing (and implies no radius); on a `packed` container it
   * also says the container has no outline for its children to draw (docs/md/ui-layout.md#packed).
   */
  border?: NRO<boolean | BorderValues | "none">
  /**
   * Radius follows this element's own padding step by default (including when implied by
   * `border`); pass a named spacing step to override that (for an element that doesn't pad itself),
   * or `"none"` to opt out even when a border is present.
   */
  radius?: NRO<boolean | "none" | SpacingValues>

  "self-align"?: NRO<AlignValues>
  "self-justify"?: NRO<AlignValues>
  "max-width"?: NRO<boolean>
  "max-height"?: NRO<boolean>
  "full-screen"?: NRO<boolean>
  "full-width"?: NRO<boolean>
  "full-height"?: NRO<boolean>
  /**
   * Stick to the top or bottom edge of the nearest scroll area while its content scrolls
   * (`position: sticky`). Implies an opaque background (the current surface) and a `z-index` above
   * the scrolled content. Don't `pad` the scroll area: sticky elements stick at its padding edge.
   */
  sticky?: NRO<"top" | "bottom">
  /**
   * Make this element a scroll area: `overflow: auto` on both axes (bare `scroll`) or on one
   * (`"x"`/`"y"`, the other axis clipped). A scroll that reaches the end carries on to the
   * enclosing scroll area or the page (the browser default). It needs a bounded size to scroll. A `packed
   * border` child of a scroll area drops its own outer border: the scroll area draws the frame.
   */
  scroll?: NRO<boolean | "x" | "y">
}

export interface EProseAttrs extends CommonAttrs {
  variant?: NRO<"vertical">
  "table-container"?: NRO<boolean>
}

export interface EFlexAttrs extends CommonAttrs {
  wrap?: NRO<boolean>
  column?: NRO<boolean>
  reverse?: NRO<boolean>
  align?: NRO<AlignValues>
  justify?: NRO<AlignValues>
  /**
   * Rule 6 (docs/md/ui-layout.md, "Why these rules"): a boundary with no gap whose
   * children touch directly, uniformly padded. `pad` always pads the container itself, same as
   * everywhere else — it never applies to children here. To also pad every child uniformly: bare
   * `packed` reuses whatever `pad` resolves to (so `pad="X" packed` pads both the container and
   * its children at X) ; an explicit step (`packed="Y"`) pads children at Y regardless of `pad`,
   * letting the two differ (e.g. a popup's own edge inset vs. its rows' tighter click-target
   * padding). `packed="Y"` also makes Y the container's own step: a packed container's step is the
   * step of what it packs, so its radius and what its descendants inherit follow its children's
   * padding. An explicit `spacing` still wins.
   *
   * Who draws the lines between the children, and which of their own borders stay, is `seams`
   * (below); `border` on the `packed` element only draws a frame around the group, which then
   * owns every edge on its outline: the children's borders facing it are dropped. Without `border`
   * the children draw the outline with their own borders (`border="none"`: nobody does).
   *
   * Radius ownership: whenever `packed` itself has a radius in effect (its own `border`, which
   * implies radius, or an explicit `radius`), that radius is the group's true outer shape — every
   * interior seam loses its corner radii, and the corners of the group are handed down to the
   * first/last child (and, through nested packed groups, to theirs) with `inherit`, so the
   * container's radius is exactly what shows, not whatever radius that child would otherwise
   * resolve to on its own. When no packed container above has a radius, none of this applies: each
   * child keeps whatever radius it resolved on its own, at every corner.
   *
   * On `e-grid`, these apply to its cells (an `e-grid-row`'s children rather than the row), the
   * rows being the grid's children along the column axis, and every cell is square except the
   * outer corners of the first and last rows — see "Grids" in docs/md/ui-layout.md.
   *
   * An `<hr>` directly inside a `packed` flex container is a 1px divider, edge to edge, unpadded,
   * in the seam color. It is for `seams="none"`: in the other modes it adds to the seams.
   */
  packed?: NRO<boolean | SpacingValues>
  /**
   * Who draws the lines between the children of a `packed` container (inherited by the packed
   * groups inside it, which can set their own). The lines are children's borders, no gap, so every
   * line is a whole screen pixel wide:
   * - `"none"`: no lines; the children's own borders between them are removed.
   * - `"children"` (what no attribute means without a `border`): the children's own borders, never
   *   doubled (the neighbour of a child gives up
   *   the edge they share); a child whose border carries meaning (`MEANINGFUL_BORDER_SELECTOR`,
   *   or a layout element with `border`) wins the line it shares.
   * - `"default"` (what no attribute means with a `border`): the container draws a line in `seam-color` between
   *   every two children, and removes their own borders between them, except that a child whose
   *   border carries meaning keeps the lines it shares.
   * - `"forced"`: the container draws every line, in `seam-color`, whatever the children carry.
   * In every mode the children's borders on the outline are kept without `border` on the container,
   * and dropped with one (`border="none"` included).
   * A packed group nested in a packed container is one of its cells: the line around it is drawn
   * by the container, and its own `border` is ignored (unless the container is `"children"`).
   * Nesting is followed through packed containers only.
   */
  seams?: NRO<"none" | "children" | "default" | "forced">
  /** The color of the lines `seams` draws, in the values of `border` (default: the container's own `border`, else `neutral-separator`). */
  "seam-color"?: NRO<BorderValues>
}

export type GridColumns = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12

export interface EGridAttrs extends EFlexAttrs {
  /**
   * `N` equal columns: `grid-template-columns: repeat(N, minmax(0, 1fr))`. The tracks don't depend
   * on the cells' content, so column widths stay put while rows come and go (`RepeatVirtual`).
   * Any other template goes in a CSS rule, which overrides this.
   */
  columns?: NRO<GridColumns>
}

/**
 * A row of an `e-grid`: spans every column and lays its children out on the grid's own columns
 * (`grid-template-columns: subgrid`). Only meaningful as a direct child of `e-grid`.
 * A row with `surface`, `hover` or `sticky` is a boundary: its grid must be `packed`, or its cells
 * touch the row's edges (golden rule 4).
 */
export interface EGridRowAttrs extends Attrs<HTMLElement> {
  surface?: CommonAttrs["surface"]
  hover?: CommonAttrs["hover"]
  align?: NRO<AlignValues>
  sticky?: CommonAttrs["sticky"]
}

const more: string[] = []
const spaces = spacing_steps
const align: AlignValues[] = [
  "center",
  "start",
  "end",
  "self-start",
  "baseline",
  "first baseline",
  "last baseline",
  "safe center",
  "unsafe center",
  "normal",
  "stretch",
  "space-evenly",
  "space-around",
  "space-between",
]

// e-grid-row takes only some of the layout attributes; its attribute type (EGridRowAttrs) restricts
// which ones, the selectors don't need to.
const _all = `:where(e-flex,e-grid,e-prose,e-column,e-row,e-grid-row)`
const _flex = `:where(e-flex,e-column,e-row)`
const _layouters = `:where(e-flex,e-grid,e-column,e-row,e-grid-row)`
/** `[border]` that draws something: `border="none"` is the absence of a border. */
const _bordered = `[border]:where(:not([border="none"]))`
/** A container with a radius in effect: its own border (which implies one) or an explicit radius. */
const _rounded = `:is(${_bordered},[radius])`
const _sides = ["top", "right", "bottom", "left"] as const
const seam_modes = ["none", "children", "default", "forced"] as const
/** Containers that take `packed`. */
const _packed = `:where(e-flex,e-column,e-row,e-grid)`

/**
 * The cells of a packed container, with an optional extra `filter` on each. A container's cells
 * are its children, except that an `e-grid-row` is not a cell: its own children are (they sit on
 * the grid's columns). Only grids have rows, so for flex containers this is just their children.
 * `:where()` keeps both forms at the specificity of `container > *`.
 */
function _cells(container: string, filter = ""): string {
  return `${container} > :where(:not(e-grid-row))${filter}, ${container} > :where(e-grid-row) > *${filter}`
}

/**
 * First and last *displayed* child, for packed grids (rows, and cells within a row): a hidden
 * child (`display: none`, HIDDEN_SELECTOR) is skipped, so when the last row is hidden, the one before
 * it gets the outer corners (docs/md/ui-layout.md#packed). Grids already paid this cost with
 * `:first-of-type`/`:last-of-type`; packed rows and columns keep `:first-child`/`:last-child`, as
 * `:nth-last-child(1 of S)` restyles every earlier sibling when a child is added at the end. `:nth-child(1 of S)` counts only the siblings
 * matching S. Its specificity is that of a pseudo-class plus S's; S is in `:where()` so the whole
 * stays at one pseudo-class, the same as the `:first-child`/`:last-child` it replaces, and rules
 * keep cascading against each other as before. `type` restricts S to an element type (the rows of a
 * grid, counted among themselves like `:first-of-type` would).
 */
function _first(type = ""): string {
  return `:nth-child(1 of :where(${type}:not(${HIDDEN_SELECTOR})))`
}
function _last(type = ""): string {
  return `:nth-last-child(1 of :where(${type}:not(${HIDDEN_SELECTOR})))`
}

/**
 * The child right after a displayed child `prev` (`child` is the kind of child that follows, `*`
 * or `e-grid-row`): it gives up its leading edge, the one the displayed child already draws (the
 * rules below). Hidden children in between are skipped, one or two of them: CSS has no "previous
 * displayed sibling" (`~` means *some* earlier sibling, not the nearest one, and `:has()` can't
 * look backwards), so the run of hidden children is spelled out. After three or more hidden
 * children in a row, both edges show (a 2px line). The hidden `prev` itself is excluded: it draws
 * nothing, so the next child keeps its edge. All in `:where()`, at zero specificity.
 */
function _after(parent: string, child: string, prev: string): string {
  const shown = `:where(${prev}):where(:not(${HIDDEN_SELECTOR}))`
  const hidden = `:where(${HIDDEN_SELECTOR})`
  return [0, 1, 2].map((n) => `${parent} > ${shown} + ${`${hidden} + `.repeat(n)}${child}`).join(",\n  ")
}

/**
 * Children whose border carries meaning and wins the line they share with a neighbour (`seams`
 * `"default"` and `"children"`): the variants and states of `MEANINGFUL_BORDER_SELECTOR`, and a
 * layout element that sets its own `border` (not a packed group: the container draws the line
 * around a group).
 */
const _important = `:is(${MEANINGFUL_BORDER_SELECTOR}, :where(e-flex,e-grid,e-prose,e-column,e-row)${_bordered}:not([packed]))`

/**
 * A direction in which packed children are laid out one after the other: the children of a flex
 * row or column, the cells of a grid row, and the rows of a grid. Everything the line rules need
 * to say about their edges.
 */
interface Axis {
  /** The packed element whose children are laid out along the axis. */
  parent: string
  /** Which children, `*` or `e-grid-row`. */
  child: string
  /** Pseudo-class of the first and last child, hidden ones skipped for grids. */
  first: string
  last: string
  /** The edge facing the previous child and the one facing the next, then the two across. */
  lead: "left" | "top"
  trail: "right" | "bottom"
  cross: [string, string]
  /** Whether a `sticky="top"` child carries a copy of the line under it (see `_seam_rules`). */
  vertical: boolean
}
const _row = `:is(e-row, e-flex:not([column]))[packed]`
const _col = `:is(e-column, e-flex[column])[packed]`
const _axes: Axis[] = [
  {
    parent: _row,
    child: "*",
    first: ":first-child",
    last: ":last-child",
    lead: "left",
    trail: "right",
    cross: ["top", "bottom"],
    vertical: false,
  },
  {
    parent: _col,
    child: "*",
    first: ":first-child",
    last: ":last-child",
    lead: "top",
    trail: "bottom",
    cross: ["left", "right"],
    vertical: true,
  },
  {
    parent: "e-grid[packed] > e-grid-row",
    child: "*",
    first: _first(),
    last: _last(),
    lead: "left",
    trail: "right",
    cross: ["top", "bottom"],
    vertical: false,
  },
  {
    parent: "e-grid[packed]",
    child: "e-grid-row",
    first: _first("e-grid-row"),
    last: _last("e-grid-row"),
    lead: "top",
    trail: "bottom",
    cross: ["left", "right"],
    vertical: true,
  },
]

/**
 * The outline of the outermost packed container: who draws the edges of the children that face it.
 * Four custom properties, one per side (`--e-out-top`, `-right`, `-bottom`, `-left`), say whether
 * the children at that side draw their own border there (1) or not (0). The outermost container
 * sets them to 1, or to 0 when it has a `border` (a frame, or `border="none"`: nobody draws). A
 * packed group that is a cell of a packed container inherits them, side by side, except along the
 * axis of its container, where a side facing a sibling is not on the outline (0): the line between
 * siblings is the container's (or, in `children`, the following sibling's leading edge: 1).
 * The rules of each axis read them with style queries on the container, as `--e-seams`.
 */
function _outline_edges(a: Axis): [edge: string, only: string][] {
  return [
    [a.lead, a.first],
    [a.trail, a.last],
    [a.cross[0], ""],
    [a.cross[1], ""],
  ]
}

/**
 * Drops the children's borders on the sides of the outline that the children don't draw (the
 * `--e-out-*` of `_outline_edges`): their edges across, the first one's leading edge, the last
 * one's trailing edge.
 */
function _outline_rules(a: Axis): string {
  const cells = `${a.parent} > ${a.child}`
  return _outline_edges(a)
    .map(
      ([edge, only]) =>
        `@container style(--e-out-${edge}: 0) { ${cells}${only ? `:where(${only})` : ""} { border-${edge}: none; } }`,
    )
    .join("\n")
}

/**
 * Along an axis, the packed groups that are cells of the container: their side facing a sibling is
 * not on the outline (see `_outline_edges`). The group's `--e-out-*` are inherited otherwise.
 */
function _group_outline_rules(a: Axis): string {
  const group = `${a.parent} > ${a.child === "*" ? "[packed]" : a.child}`
  return `
  ${group}:where(:not(${a.first})) { --e-out-${a.lead}: 0; }
  ${group}:where(:not(${a.last})) { --e-out-${a.trail}: 0; }`
}

/**
 * The lines of a container whose `seams` is `none`, `default` or `forced`, along one axis. The
 * container owns every line: the children's borders between them go, then the line between
 * two children is the *leading* edge of the second one, in `--e-seam-color`. A leading edge needs
 * no look at the next sibling, and a hidden last child changes nothing for the others. The edges
 * on the outline are the children's own, unless the container's outline is not drawn by them
 * (`_outline_rules`).
 * `default` lets a child with an important border (`_important`) keep it on the edges it shares
 * with its neighbours: it draws both, and the one after it gives up its leading edge (`_after`).
 * A `sticky="top"` child also carries a copy of the line under it: the line is the next child's
 * leading edge, which scrolls away with that child, so once the sticky child is stuck the content
 * passing under it would show in its place. The copy is its own bottom edge, pulled back over the
 * next child's leading edge by a -1px margin: at rest it covers that edge exactly, in the same color,
 * and every row keeps the same height (a virtual list sizes its padders from a single row height).
 * Library internal, so not a golden rule 3 margin: its net effect on layout is zero.
 */
function _seam_rules(mode: "none" | "default" | "forced", a: Axis): string {
  const cells = `${a.parent} > ${a.child}`
  const important = mode === "default"
  const not_important = important ? `:where(:not(${_important}))` : ""
  const line = `border-${a.lead}: 1px solid var(--e-seam-color);`
  // A packed group among the cells is one of them: its own border is ignored.
  let css = `${cells}:where([packed]) { border: none; }\n`
  css += `${cells}${not_important}:where(:not(${a.first})) { border-${a.lead}: none; }\n`
  css += `${cells}${not_important}:where(:not(${a.last})) { border-${a.trail}: none; }\n`
  if (mode !== "none") css += `${cells}:where(:not(${a.first}))${not_important} { ${line} }\n`
  if (a.vertical && mode !== "none") {
    css += `${cells}:where([sticky="top"]):where(:not(${a.last})) { border-${a.trail}: 1px solid var(--e-seam-color); margin-${a.trail}: -1px; }\n`
  }
  if (important) css += `${_after(a.parent, a.child, _important)} { border-${a.lead}: none; }\n`
  return css + _outline_rules(a)
}

/**
 * The lines of a container whose `seams` is `children`, along one axis (the children of a flex row
 * or column; a grid's cells have no single trailing edge, so they keep every border). Each child
 * but the last gives up its trailing edge, whether or not it has one, so that neighbours share a
 * line; a child whose border carries meaning keeps it, and the child after it gives up its leading
 * edge instead. The children don't overlap to share a line: at a fractional display scale an
 * overlapped edge is antialiased and blends both colors. The edges on the outline are the
 * children's own, unless the container's outline is not drawn by them (`_outline_rules`).
 */
function _children_rules(a: Axis): string {
  const cells = `${a.parent} > ${a.child}`
  return `
  ${cells}:where(:not(${a.last})):where(:not(${_important})) { border-${a.trail}: none; }
  ${_after(a.parent, a.child, _important)} { border-${a.lead}: none; }
  ${_outline_rules(a)}`
}

function _(strings: TemplateStringsArray, ...values: unknown[]): void {
  let result = strings[0]
  for (let i = 0; i < values.length; i++) {
    result += String(values[i]) + strings[i + 1]
  }
  more.push(result)
}

// [surface]/[border] share one value type (ColorStep, ui/theme.tsx) — see docs/md/ui-theme.md.
// Every literal value below routes through theme.css_surface/css_border (mirroring [pad]/[spacing]/
// [radius] reading theme.css_pad/css_spacing/css_radius) so the attribute rules and the helpers can't
// drift apart. Explicit values are excluded from the bare/default rule via a :not() chain, rather
// than relying on source order, so bare [surface]/[border] stays the fallback regardless of
// emission order — same defensive pattern this file already used for surface before this type
// existed.
const _color_families = ["tint", "neutral"] as const
const _color_levels = ["1", "2", "3", "4", "5", "6"] as const
const _color_suffixes = [..._color_levels, "surface", "separator"] as const
const _color_steps: ColorStep[] = _color_families.flatMap((f) => _color_suffixes.map((s) => `${f}-${s}` as ColorStep))
// :where(...) around the whole :not() chain: bare :not([attr="value"]) carries the specificity
// of its argument (an attribute selector) — chained across every explicit value, that would
// easily outrank the plain [attr="value"] selectors this bare rule is meant to defer to.
// :where() contributes zero specificity regardless of what's inside it, so this bare rule and the
// per-value rules below stay equal-specificity and cascade purely by source order (same pattern
// already used for [radius], see below).
function _not_values(attr: string, values: readonly string[]): string {
  return `:where(${values.map((v) => `:not([${attr}="${v}"])`).join("")})`
}
const seam_colors: ColorStep[] = [..._color_families, ..._color_steps]
const _inverted_surfaces: InvertedSurface[] = ["invert-tint", "invert-neutral"]
const _surface_explicit = ["background", ..._inverted_surfaces, ..._color_families, ..._color_steps]
const _border_explicit = [..._color_families, ..._color_steps]

_`
  ${_all}[hover]:hover { background-color: ${ambient_surface_mix.surface("n+1")} }
  ${_all}[surface]${_not_values("surface", _surface_explicit)} { ${theme.css_surface(true)} }
  ${_all}[surface="background"] { ${theme.css_surface("background")} }
  ${_all}[border]${_not_values("border", [..._border_explicit, "none"])} { ${theme.css_border(true)} }
`

// `surface` is fill-only: it does NOT imply padding. A `surface` element that also needs padding
// must say so explicitly via `pad`/`packed`, same as any other element. An earlier version of this
// rule padded any `[surface]` without its own `[pad]` at the `component` step — removed: it made a
// color value (which surface step/family) silently change layout, and made the absence of `[pad]`
// mean different things depending on whether `surface` was present.
for (const fam of _color_families) {
  _`${_all}[surface="${fam}"] { ${theme.css_surface(fam)} }`
  _`${_all}[border="${fam}"] { ${theme.css_border(fam)} }`
}

for (const step of _color_steps) {
  _`${_all}[surface="${step}"] { ${theme.css_surface(step)} }`
  _`${_all}[border="${step}"] { ${theme.css_border(step)} }`
}

// `border` implies `radius` (any value), unless explicitly opted out with radius="none". Default
// (no named step): derives from the ambient --e-current-spacing; an element with its own [pad]
// overrides that with its own --e-pad instead — a second, later rule decides that priority by
// cascade order, not a var() fallback chain, since --e-pad inherits and is always populated (a
// var(--e-pad, fallback) chain would never reach its fallback — see docs/md/ui-layout.md). A named
for (const value of _inverted_surfaces) {
  _`${_all}[surface="${value}"] { ${theme.css_surface(value)} }`
}

// step below overrides both, for an element that doesn't pad itself.
//
// `:where(:not(...))` rather than a bare `:not(...)`: `:not([x="none"])` on its own carries the
// specificity of [x="none"] (an attribute selector), which would outrank the plain-attribute
// [radius="${sp}"] step selectors below despite coming first in source order — silently
// preventing every named-step override from ever applying. :where() always contributes zero
// specificity, so these rules and the per-step loop stay equal-specificity and cascade purely by
// source order, as intended.
_`${_all}${_bordered}:where(:not([radius="none"])) { ${theme.css_radius()} }`
_`${_all}[radius]:where(:not([radius="none"])) { ${theme.css_radius()} }`
_`${_all}[pad]:where(:not([pad="none"]))${_rounded}:where(:not([radius="none"])) { border-radius: var(--e-pad); }`
for (const sp of spaces) {
  _`${_all}[radius="${sp}"] { ${theme.css_radius(sp)} }`
}

for (const al of align) {
  _`${_layouters}[align="${al}"] { align-items: ${al}; }`
  _`${_layouters}[justify="${al}"] { justify-content: ${al}; }`
  _`${_all}[self-justify="${al}"] { justify-self: ${al}; }`
  _`${_all}[self-align="${al}"] { align-self: ${al}; }`
}

// `pad` implies `spacing` (spec: "a container with more than one child must set spacing between
// them" — a padded container is exactly such a container). `spacing` never implies `pad` — the two
// are one-directional, matching a boundary-less container that still needs to space un-merged
// children (docs/md/ui-layout.md, "Why these rules", rule 5).
//
// Priority, lowest to highest (CSS cascade with equal specificity — later wins):
// 1. bare [pad] (no value) implies `component` spacing, same as bare [spacing] falling back to it.
// 2. [pad="X"] implies spacing at the same step X.
// 3. [spacing]/[spacing="X"] sets the ambient spacing directly — an explicit spacing value always
//    wins over whatever [pad] implied, since these rules are emitted last.
//
// Every step → custom-property mapping below reads from `theme.css_pad`/`theme.css_spacing`
// (ui/theme.tsx) — the single source of truth `theme.class_pad`/`class_spacing` also consume for
// standalone elements, so the two can't drift apart.

// (1) — [pad="none"] is excluded here : it implies no spacing at all, since there's no padding
// for rule 5 to apply to (its own zero-override further below handles it). :where(...) around the
// :not(): a bare :not([pad="none"]) carries the specificity of its argument (an attribute
// selector), which would outrank the plain [pad="${sp}"] step selectors below despite coming
// first in source order — silently preventing every named-step override from ever applying
// (regression, found while implementing docs/md/ui-layout.md: [pad="section"] and friends resolved to
// the "component" default instead of their own step). :where() keeps this rule and (2) below
// equal-specificity, cascading purely by source order, as intended.
_`${_all}[pad]:where(:not([pad="none"])) { ${theme.css_pad("component")} ${theme.css_spacing("component")} }`
_`${_all}[spacing] { ${theme.css_spacing("component")} }`

// (2)
for (const sp of spaces) {
  _`${_all}[pad="${sp}"] { ${theme.css_pad(sp)} ${theme.css_spacing(sp)} }`
}

// (2b) [packed="X"] is the container's step too: a packed container takes the step of what it
// packs (its children are padded at X), not the step above it a spaced container would take. It
// adds no gap (packed never does); it sets the radius a `border` derives from the ambient step,
// so the frame's corners match the children's, and the step its descendants inherit. Between (2)
// and (3): wins over the step a [pad] implied, loses to an explicit [spacing]. An own [pad] still
// sets the radius (the [pad] radius rule above is more specific): the padded edge is what rounds.
for (const sp of spaces) {
  _`${_all}[packed="${sp}"] { ${theme.css_spacing(sp)} }`
}

// (3)
for (const sp of spaces) {
  _`${_all}[spacing="${sp}"] { ${theme.css_spacing(sp)} }`
}

// --e-parent-spacing: the step an element's *parent* spaces its children at, as seen by those
// children. Needed wherever the spacing is applied child-side (margins of a prose container's
// children, ui/typography.css.tsx) rather than as the parent's own `gap`: a child that sets its own
// [pad]/[spacing] redefines --e-spacing on itself, so `var(--e-spacing)` read on that child would
// give the child's step instead of its parent's. Set on the children (`> *`), with the same
// priority as (1)–(3) above; its ambient default lives in theme.init. Plain inheritance carries it
// through elements that don't set a step themselves.
_`${_all}[pad]:where(:not([pad="none"])) > * { --e-parent-spacing: var(--e-spacing-component); }`
_`${_all}[spacing] > * { --e-parent-spacing: var(--e-spacing-component); }`
for (const sp of spaces) {
  _`${_all}[pad="${sp}"] > * { --e-parent-spacing: var(--e-spacing-${sp}); }`
}
// [packed="X"] sets the container's step like [spacing="X"] does (2b above), so its children see it
// as their parent's spacing too. Same priority between [pad] and [spacing], mirroring (2b).
for (const sp of spaces) {
  _`${_all}[packed="${sp}"] > * { --e-parent-spacing: var(--e-spacing-${sp}); }`
}
for (const sp of spaces) {
  _`${_all}[spacing="${sp}"] > * { --e-parent-spacing: var(--e-spacing-${sp}); }`
}
// [pad="none"] (without an explicit spacing) and [spacing="none"] space nothing.
_`${_all}:is([pad="none"]:not([spacing]), [spacing="none"]) > * { --e-parent-spacing: 0px; }`

// --e-current-surface-level holds a [surface] element's own (just-raised) level — registered
// non-inherited so a descendant that isn't itself a [surface] never reads a stale ancestor value
// off it; `Mix.surface()` (ui/theme.tsx) falls back to the ambient --e-surface-level in that case.
// No `initial-value` (allowed only with the universal `"*"` syntax) — that's what makes this
// property genuinely absent (not merely 0) on non-[surface] elements, so `var(--e-current-surface-level, fallback)` reaches its fallback there.
//
// --e-current-surface-mix is the same pattern for the surface's color *family* — see
// `--e-current-surface-mix` in `Mix.css_as_surface` (ui/theme.tsx) and docs/md/ui-theme.md.
css`
@property --e-current-surface-level {
  syntax: "*";
  inherits: false;
}
`
css`
@property --e-current-surface-mix {
  syntax: "*";
  inherits: false;
}
`

// Spacing scale values now live in Theme (ui/theme.tsx, spacingNudge1/2/4/Widget/Component/Section/Stage1-4)
// and are emitted through the theme class, not a literal :root — everything below only needs
// the purely functional variables that aren't theme settings.
const columns_rules = Array.from(
  { length: 12 },
  (_, i) => `e-grid[columns="${i + 1}"] { grid-template-columns: repeat(${i + 1}, minmax(0, 1fr)); }`,
).join("\n  ")

// sticky: emitted with the attribute rules (after the packed ones), so that it overrides the
// `position: relative` packed gives its cells. Its background is the current surface, opaque over
// the scrolled content; an element's own [surface] resolves --e-current-surface to itself. Its z-index sits above the
// cells of a packed container (0, or 1 when focused, so a focus ring shows over the neighbors): a
// focused cell scrolled under a stuck row passes beneath it, ring included, as in a spreadsheet;
// content drawn over the header would be worse than a hidden ring. With focus inside, a sticky
// element goes one level up again, so its own focus ring shows over the other sticky elements.
_`
  ${_all}[sticky] { position: sticky; z-index: 2; background-color: var(--e-current-surface); }
  ${_all}[sticky]:focus-within { z-index: 3; }
  ${_all}[sticky="top"] { top: 0; }
  ${_all}[sticky="bottom"] { bottom: 0; }
`

// scroll: one-axis values clip the other axis explicitly (with one axis scrolling, a "visible"
// other axis would compute to auto anyway). No overscroll-behavior: contain here — it would also
// block the page when the area has nothing to scroll (an overflow: auto box is a scroll container
// whether or not it overflows), so the browser's default scroll chaining applies.
_`
  ${_all}[scroll] { overflow: auto; }
  ${_all}[scroll="x"] { overflow-x: auto; overflow-y: hidden; }
  ${_all}[scroll="y"] { overflow-x: hidden; overflow-y: auto; }
`
// A flex scroll area's children keep their size along the axis it scrolls on, rather than shrinking
// to fit (layout elements let their children shrink below their content: min-width/min-height 0).
// Otherwise the content never overflows, and there's nothing to scroll. A child that is itself a
// scroll area is the exception: it is what should shrink to fit, and scroll its own content (a
// virtual list's scroll area that grew to its whole content would render every row).
_`
  :is(e-column, e-flex[column])[scroll]:where(:not([scroll="x"])) > :where(:not([scroll])) { flex-shrink: 0; }
  :is(e-row, e-flex:not([column]))[scroll]:where(:not([scroll="y"])) > :where(:not([scroll])) { flex-shrink: 0; }
`

css`
@layer components {
  /* The ambient spacing/pad defaults (component step) live in theme.init, on the theme class, not
     here: they read --e-spacing-*, which only the theme class defines, so on :root they would
     resolve to nothing and that empty value is what every descendant would inherit. */
  :root {
    --e-surface-level: 0;
    --e-surface-step: 10%;
  }

  header, footer {
    padding: ${theme.settings.spacingComponent};
    gap: ${theme.settings.spacingComponent};
    width: 100%;
    display: flex;
    flex-direction: row;
    align-items: baseline;
  }
  header { ${theme.colors.tint.css_as_inverted}; }
  footer { ${theme.colors.neutral.css_as_surface(1)} }

  e-prose { display: block; }
  e-prose[inline] { display: inline-block; }
  /* A data table's wrapper (docs/md/ui-typography.md). Its fixed radius out-ranks the one a bare
     [border] derives (more specific). */
  e-prose[table-container] {
    border-radius: ${theme.settings.borderRadius};
    max-width: 100%;
    width: fit-content;

    min-height: 0; /* necessary to allow shrinking */
    flex: 0 1 auto; /* shrink to fit, but don't grow ! */

    & thead tr:has(th) {
      position: sticky;
      top: 0;
    }
  }

  e-flex,e-row,e-column { display: flex; flex-direction: row; flex-wrap: nowrap; align-items: baseline; }
  e-flex[column],e-column { flex-direction: column; }
  ${_flex}[inline] { display: inline-flex; }
  /* A block-level flex container isn't valid content directly inside a text block that only accepts
     inline content (a <p>, a heading, …) — auto-switch to inline-flex there rather than requiring
     every call site to remember [inline] itself. */
  :is(${INLINE_ONLY_TEXT_BLOCK_SELECTOR}) > ${_flex} { display: inline-flex; }
  :is(e-flex,e-row)[reverse] { flex-direction: row-reverse; }
  :is(e-flex[column],e-column)[reverse] { flex-direction: column-reverse; }
  :is(e-flex,e-row,e-column)[wrap] { flex-wrap: wrap; }
  /* Browsers still apply the legacy HTML \`align\` attribute as a style hint on any element, custom
     ones included: \`align="center"\` would also set \`text-align: center\`, inherited by every text
     inside. Here \`align\` only means \`align-items\`; any stylesheet rule beats a hint, so this one
     restores normal inheritance. */
  ${_layouters}[align] { text-align: inherit; }

  e-grid { display: grid; }
  e-grid[inline] { display: inline-grid; }
  ${columns_rules}

  /* A grid row spans every column and puts its children on the grid's own columns; it inherits the
     grid's column gap (a subgrid's default), and its \`align\`, since the grid's \`align\` is about
     its cells, which sit in the rows (an \`align\` on the row itself wins). */
  e-grid-row { grid-column: 1 / -1; display: grid; grid-template-columns: subgrid; align-items: inherit; }

  /* A flex item's automatic minimum size along the flex container's MAIN axis defaults to its
     content's min-content size (not 0) unless overridden — a flex row/column otherwise refuses to
     shrink a child below its own unbreakable content (a long word, a wide image) even when told to
     (flex-shrink), pushing that content past the container instead of letting the child's own
     overflow handle it. This resets that floor to 0 so a child can always shrink to the space it's
     given; one that must never shrink below its own content keeps other ways to say so (an explicit
     width, flex-shrink: 0). This does not, on its own, constrain the CROSS axis of a non-"stretch"
     item (e-column/e-row/e-flex's own default is align-items: baseline) — that axis needs an
     explicit align="stretch"/align-items: stretch on the container instead, or the item can still
     grow past it via max-content sizing (see docs/md/ui-layout.md, the <pre> width investigation). */
  ${_layouters} > * {
    min-width: 0;
    min-height: 0;
  }

  /* Controls that are a fixed size by nature (a button's label, a checkbox) never shrink in a layout
     element: with the \`min-width: 0\` above they would otherwise be squashed below their content
     when the row runs out of room, their label overflowing. Text inputs, \`select\` and \`textarea\`
     stay elastic: they have no content to protect. Zero specificity, so a \`flex-shrink\` of your own
     wins. */
  ${_layouters} > :where(button, input[type="checkbox"], input[type="radio"], label[e-variant="toggle"]) {
    flex-shrink: 0;
  }

  ${_all} {
    &[max-width] { max-width: 100%; }
    &[max-height] { max-height: 100%; }
    &[full-screen] { width: 100%; height: 100%; }
    &[full-width] { width: 100%; }
    &[full-height] { height: 100%; }
  }

  ${_all}[relative] {
    position: relative;
  }

  ${_all}[grow] {
    flex-grow: 1;
    flex-basis: 0;
  }

  ${_all} {
    /* [pad] always pads the element itself, [packed] or not — see the [packed] rules below
       for how a packed container's children get padded too. */
    &[pad] {
      padding: var(--e-pad);
    }
  }

  /* :where() keeps this default at the specificity of a type selector, so [spacing="none"] (below)
     overrides it — the :not()/attribute chain used to out-rank it, leaving its gap in place. */
  :is(e-flex,e-grid,e-row,e-column):where(:not([pad="none"]):not([packed]), [spacing]:not([packed])) {
    gap: var(--e-spacing);
  }

  /* packed pads the children that don't set their own [pad]; a child with its own [pad] keeps it.
     Expressed as an exclusion (:not([pad]), wrapped in :where so it adds no specificity) rather
     than left to the cascade, where it used to depend on which rule came later in the sheet.
     A child that is itself [packed] is a group, not a cell: its own cells carry the padding, so
     padding it too would inset their content twice (golden rule 4: one padding between a boundary
     and its content). It only keeps a padding it asks for with its own [pad]. */
  ${_cells(`${_packed}:where([packed]:not([pad="none"]))`, ":where(:not([pad]):not([packed]))")} {
    padding: var(--e-pad);
    --e-control-pad: var(--e-pad);
  }

  ${spaces
    .map(
      (sp) => `
  /* The step goes to every cell, packed groups included: a group doesn't pad itself, but its own
     bare [packed] reads --e-pad, so it must inherit the step from here rather than from the
     container's own --e-pad. */
  ${_cells(`${_packed}[packed="${sp}"]`, ":where(:not([pad]))")} {
    ${theme.css_pad(sp)}
  }
  ${_cells(`${_packed}[packed="${sp}"]`, ":where(:not([pad]):not([packed]))")} {
    padding: var(--e-pad);
    --e-control-pad: var(--e-pad);
  }`,
    )
    .join("\n")}

  /* A cell that is a text field or a select keeps its vertical padding as room (ui/form.css.tsx,
     "Control height"): the control's min-height still includes it, through --e-control-pad. The
     :is() out-weighs the padding rules above. */
  ${_cells(`${_packed}[packed]`, `:where(:not([pad]):not([packed])):is(${CENTERED_TEXT_CONTROL_SELECTOR})`)} {
    padding-block: 0;
  }

  /* A focused child's ring must draw over its packed neighbor rather than being covered by it. */
  ${_cells(`${_packed}[packed]`)} {
    position: relative;
    z-index: 0;
  }
  ${_cells(`${_packed}[packed]`, ":focus-visible")} {
    z-index: 1;
  }

  /* Interior packed seams always lose their corner radii, whether or not either side has a
     border there, so a packed group of rounded children still reads as one shape. Outer corners
     (the first child's leading edge, the last child's trailing edge) are untouched either way.
     A hidden first or last child still counts here: skipping it (_first/_last) makes adding a child
     at the end of a long packed row or column restyle every earlier sibling (docs/md/ui-layout.md#packed). */
  ${_row} > *:not(:last-child) {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }
  ${_row} > *:not(:first-child) {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }
  ${_col} > *:not(:last-child) {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }
  ${_col} > *:not(:first-child) {
    border-top-left-radius: 0;
    border-top-right-radius: 0;
  }

  /* The lines between the children of a packed container, and the borders of the children that
     stay (docs/md/ui-layout.md#packed). Three custom properties say how, set on every packed
     container and read by its children with style queries (@container style(...)), so the rules
     below don't need to know how deep a group is nested:
     - --e-seams: the mode, [seams] (absent: "default" with a [border], else "children");
     - --e-seam-color: the color of the lines drawn by the container, [seam-color] (absent: the
       color of its [border], else neutral-separator);
     - --e-packed-radius: 1 when a packed container above, or this one, has a radius in effect (the
       outermost one owns it, see the corner rules below).
     A packed container resets them (the first rule), except when it is itself a cell of a packed
     container, whose values it inherits (the second rule: a non-packed element in between breaks
     the chain). An attribute out-ranks both, and is emitted after them. */
  ${_packed}[packed] {
    ${theme.css_seam_color()}
    --e-seams: children;
    --e-packed-radius: 0;
  }
  /* A frame asks for lines between the children, in its own color; without one the children draw
     what they have (children). A cell that is a packed group inherits both from the container
     instead (the rule below). An attribute out-ranks these, and is emitted after them. */
  ${_packed}[packed]${_bordered} {
    --e-seams: default;
  }
  ${_packed}[packed][border]${_not_values("border", [..._border_explicit, "none"])} { ${theme.css_seam_color(true)} }
  ${[..._color_families, ..._color_steps].map((c) => `${_packed}[packed][border="${c}"] { ${theme.css_seam_color(c)} }`).join("\n  ")}
  ${_cells(`${_packed}[packed]`, "[packed]")} {
    --e-seams: inherit;
    --e-seam-color: inherit;
    --e-packed-radius: inherit;
  }
  ${_packed}[packed]${_rounded}:where(:not([radius="none"])) { --e-packed-radius: 1; }

  /* The outline of the outermost packed container: does it draw it with its children's borders
     (--e-out-*: 1 per side) or not (0), see _outline_edges. Without [border] the children draw it; any
     [border] (a frame, or "none") says they don't. A cell that is a packed group inherits the
     sides, then drops the ones facing a sibling; in a "children" container the side facing the
     previous sibling stays, since the line between two children is the leading edge of the second. */
  ${_packed}[packed] {
    ${_sides.map((e) => `--e-out-${e}: 1;`).join(" ")}
  }
  ${_packed}[packed][border] {
    ${_sides.map((e) => `--e-out-${e}: 0;`).join(" ")}
  }
  ${_cells(`${_packed}[packed]`, "[packed]")} {
    ${_sides.map((e) => `--e-out-${e}: inherit;`).join(" ")}
  }
  ${_axes.map(_group_outline_rules).join("")}
  @container style(--e-seams: children) {
    ${_axes
      .slice(0, 2)
      .map((a) => `${a.parent} > [packed]:where(:not(${a.first})) { --e-out-${a.lead}: 1; }`)
      .join("\n")}
  }
  ${_packed}[packed][radius="none"] { --e-packed-radius: 0; }
  ${seam_modes.map((m) => `${_packed}[packed][seams="${m}"] { --e-seams: ${m}; }`).join("\n  ")}
  ${seam_colors.map((c) => `${_packed}[packed][seam-color="${c}"] { ${theme.css_seam_color(c)} }`).join("\n  ")}

  /* In a frame, the children sit on the current surface, like the frame's inside: a text button has
     no fill of its own and an unchecked toggle has one, and they must not differ. A child's own
     explicit background, or the fill of a variant or a state (they set --e-current-surface, form.css.tsx),
     still wins. */
  ${_cells(`${_packed}[packed]${_bordered}`)} {
    background-color: var(--e-current-surface);
  }

  /* In a framed grid, a hovered row changes the surface its cells read: the cells paint it over the
     row's own hover background. */
  e-grid[packed]${_bordered} > e-grid-row[hover]:hover {
    --e-current-surface: ${ambient_surface_mix.surface("n+1")};
  }

  /* The lines themselves, mode by mode. The children are those of a flex row or column, the cells
     of a grid row, and the rows of a grid (ui/layout.css.tsx, _axes). */
  @container style(--e-seams: none) {
    ${_axes.map((a) => _seam_rules("none", a)).join("\n")}
  }
  @container style(--e-seams: default) {
    ${_axes.map((a) => _seam_rules("default", a)).join("\n")}
  }
  @container style(--e-seams: forced) {
    ${_axes.map((a) => _seam_rules("forced", a)).join("\n")}
  }
  @container style(--e-seams: children) {
    ${_axes.slice(0, 2).map(_children_rules).join("\n")}
  }

  /* An <hr> directly in a packed flex container is a divider between its children, not a padded
     child: no padding or margin (the packed padding rule above would otherwise thicken it), a 1px
     line edge to edge — across a column, down a row. */
  ${_col} > hr {
    padding: 0;
    margin: 0;
    height: 1px;
    width: auto;
    align-self: stretch;
  }
  ${_row} > hr {
    padding: 0;
    margin: 0;
    width: 1px;
    height: auto;
    align-self: stretch;
  }
  /* The divider is a line of the group, in the color of its lines. */
  :is(e-column, e-flex[column], e-row, e-flex:not([column]))[packed] > hr {
    background-color: var(--e-seam-color);
  }

  /* A packed bordered child of a scroll area drops its outer border and radius: the scroll area
     draws the frame (with its own [border]), and clips the content to its rounded edge. */
  ${_all}[scroll] > ${_packed}[packed]${_bordered} {
    border-width: 0;
    border-radius: 0;
  }

  /* Whenever a packed container has a radius in effect — its own [border] (which implies radius) or
     an explicit [radius], whether or not it also draws its own border — that radius is the group's
     true outer shape: the first/last child's outer corners must inherit it exactly, not whatever
     radius that child would otherwise resolve to on its own (a form control's fixed "widget"
     radius, e.g. — form.css.tsx sets that unconditionally, unrelated to any ambient/container
     radius; a plain child with none of its own defaults to 0). A packed group inside it hands the
     corners further down to its own first/last children, the same way: --e-packed-radius is
     inherited by nested groups. When no packed container above has a radius, this does not apply:
     each child keeps whatever radius it resolved on its own. The inherit keyword on each longhand
     forces that one declaration to read the parent's computed value, regardless of whether
     border-radius normally inherits (it doesn't). See docs/md/ui-layout.md. */
  @container style(--e-packed-radius: 1) {
    ${_row} > *:first-child {
      border-top-left-radius: inherit;
      border-bottom-left-radius: inherit;
    }
    ${_row} > *:last-child {
      border-top-right-radius: inherit;
      border-bottom-right-radius: inherit;
    }
    ${_col} > *:first-child {
      border-top-left-radius: inherit;
      border-top-right-radius: inherit;
    }
    ${_col} > *:last-child {
      border-bottom-left-radius: inherit;
      border-bottom-right-radius: inherit;
    }
  }

  /* Grid cells: no "leading"/"trailing" edge in two dimensions, so every cell of a packed grid
     loses its radius; only the outer corners of the first and last rows take the grid's radius back
     when it has one — through rows only: cells placed directly in the grid can't be told apart from
     interior ones without knowing the column count. The rows inherit the radius from the grid so
     that their cells can inherit it from them (inherit reads the parent). */
  ${_cells("e-grid[packed]")} {
    border-radius: 0;
  }
  e-grid[packed]${_rounded}:where(:not([radius="none"])) > e-grid-row {
    &${_first("e-grid-row")} {
      border-top-left-radius: inherit;
      border-top-right-radius: inherit;
      & > ${_first()} { border-top-left-radius: inherit; }
      & > ${_last()} { border-top-right-radius: inherit; }
    }
    &${_last("e-grid-row")} {
      border-bottom-left-radius: inherit;
      border-bottom-right-radius: inherit;
      & > ${_first()} { border-bottom-left-radius: inherit; }
      & > ${_last()} { border-bottom-right-radius: inherit; }
    }
  }

  /* [pad="none"]/[spacing="none"] turn one side off on its own — [pad="none"] implies no spacing
     at all (there's no padding for rule 5 to apply to), and [spacing="none"] overrides whatever
     [pad] implied. Generated last so they win the cascade. */
  ${_all}[pad="none"] {
    padding: 0;
  }

  :is(e-flex,e-grid,e-row,e-column)[spacing="none"] {
    gap: 0;
  }

  ${more.join("\n")}
}
`

// A packed container is a control-sized surface: its cells (button groups, menus, list boxes,
// table-like grids) read at the size of the controls they hold. Text cells take the controls' font
// size and line height (ui/form.css.tsx), so the first lines of a text cell and of a field line up
// in a row that stretches its cells. Its own layer, below "typography" and "components": a heading
// or a prose container (`e-prose` goes back to the size of a text run) and the controls set their
// own size and keep it, whatever the specificity.
css`
@layer base {
  :where(${_cells(`${_packed}[packed]`)}) {
    font-size: ${theme.settings.formFontSize};
    line-height: 1.25;
  }
}
`
