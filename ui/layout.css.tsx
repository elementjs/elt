import { type Attrs, type NRO, css } from "elt"
import { INLINE_ONLY_TEXT_BLOCK_SELECTOR } from "./selectors"
import { ambient_surface_mix, type ColorStep, type SpacingStep, spacing_steps, theme } from "./theme"

declare module "elt" {
  /** `e-virtual-scroll` (core) takes the frame and sizing attributes of the layout elements — not
   * `pad`: sticky rows stick at a scroll area's padding edge, so the scrolled rows would show through
   * the padding above a sticky header. */
  interface EVirtualScrollAttrs
    extends Pick<
      CommonAttrs,
      | "border"
      | "surface"
      | "radius"
      | "grow"
      | "relative"
      | "self-align"
      | "self-justify"
      | "max-width"
      | "max-height"
      | "full-screen"
      | "full-width"
      | "full-height"
    > {}

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
   * `radius="none"`.
   */
  border?: NRO<boolean | BorderValues>
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
   * (`"x"`/`"y"`, the other axis clipped), plus `overscroll-behavior: contain` so a scroll that
   * reaches the end doesn't carry on to the page. It needs a bounded size to scroll. A `packed
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
   * Rule 6 (docs/md/ui-layout.md, "Why these rules"): a boundary with no spacing whose
   * children touch directly, uniformly padded. `pad` always pads the container itself, same as
   * everywhere else — it never applies to children here. To also pad every child uniformly: bare
   * `packed` reuses whatever `pad` resolves to (so `pad="X" packed` pads both the container and
   * its children at X) ; an explicit step (`packed="Y"`) pads children at Y regardless of `pad`,
   * letting the two differ (e.g. a popup's own edge inset vs. its rows' tighter click-target
   * padding).
   *
   * Without `border` on the `packed` element itself: every non-last child loses its own
   * trailing-edge border (`border-right` in a row, `border-bottom` in a column), whether or not it
   * actually has one — harmless on an unbordered child.
   *
   * Radius ownership: whenever `packed` itself has a radius in effect (its own `border`, which
   * implies radius, or an explicit `radius`), that radius is the group's true outer shape — every
   * interior seam loses its corner radii, and the first/last child's outer corners `inherit` the
   * container's radius exactly, not whatever radius that child would otherwise resolve to on its
   * own. When `packed` has neither `border` nor `radius`, none of this applies: each child keeps
   * whatever radius it resolved on its own, at every corner.
   *
   * With `border` on the `packed` element itself: `packed` draws the border, not its children — a
   * `1px` gap between children, filled by the container's own background (the same color as its
   * border), becomes the visible seam. Every child gets `border: none` and
   * `background: var(--e-current-surface)` (its own explicit background, if any, still wins).
   * See docs/md/ui-layout.md.
   *
   * On `e-grid`, these apply to its cells (an `e-grid-row`'s children rather than the row), there is
   * no trailing-edge border removal, and every cell is square except the outer corners of the first
   * and last rows — see "Grids" in docs/md/ui-layout.md.
   */
  packed?: NRO<boolean | SpacingValues>
}

/** `columns` values on `e-grid`. */
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

// e-grid-row and e-virtual-scroll take only some of the layout attributes; their attribute types
// (EGridRowAttrs, EVirtualScrollAttrs) restrict which ones, the selectors don't need to.
const _all = `:where(e-flex,e-grid,e-prose,e-column,e-row,e-grid-row,e-virtual-scroll)`
const _flex = `:where(e-flex,e-column,e-row)`
const _layouters = `:where(e-flex,e-grid,e-column,e-row,e-grid-row)`
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
const _surface_explicit = ["background", ..._color_families, ..._color_steps]
const _border_explicit = [..._color_families, ..._color_steps]

_`
  ${_all}[hover]:hover { background-color: ${ambient_surface_mix.surface("n+1")} }
  ${_all}[surface]${_not_values("surface", _surface_explicit)} { ${theme.css_surface(true)} }
  ${_all}[surface="background"] { ${theme.css_surface("background")} }
  ${_all}[border]${_not_values("border", _border_explicit)} { ${theme.css_border(true)} }
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
// step below overrides both, for an element that doesn't pad itself.
//
// `:where(:not(...))` rather than a bare `:not(...)`: `:not([x="none"])` on its own carries the
// specificity of [x="none"] (an attribute selector), which would outrank the plain-attribute
// [radius="${sp}"] step selectors below despite coming first in source order — silently
// preventing every named-step override from ever applying. :where() always contributes zero
// specificity, so these rules and the per-step loop stay equal-specificity and cascade purely by
// source order, as intended.
_`${_all}[border]:where(:not([radius="none"])) { ${theme.css_radius()} }`
_`${_all}[radius]:where(:not([radius="none"])) { ${theme.css_radius()} }`
_`${_all}[pad]:where(:not([pad="none"])):is([border],[radius]):where(:not([radius="none"])) { ${theme.css_radius_own_pad()} }`
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

// Spacing scale values now live in Theme (ui/theme.tsx, spacing1/2/4/Widget/Component/Section/Stage1-4)
// and are emitted through the theme class, not a literal :root — everything below only needs
// the purely functional variables that aren't theme settings.
const columns_rules = Array.from(
  { length: 12 },
  (_, i) => `e-grid[columns="${i + 1}"] { grid-template-columns: repeat(${i + 1}, minmax(0, 1fr)); }`,
).join("\n  ")

// sticky: emitted with the attribute rules (after the packed ones), so that it overrides the
// `position: relative` packed gives its cells. Its background is the current surface, opaque over
// the scrolled content; an element's own [surface] resolves --e-current-surface to itself, and a
// row of a packed bordered grid out-ranks this with the seam color.
_`
  ${_all}[sticky] { position: sticky; z-index: 1; background-color: var(--e-current-surface); }
  ${_all}[sticky]:focus-within { z-index: 2; }
  ${_all}[sticky="top"] { top: 0; }
  ${_all}[sticky="bottom"] { bottom: 0; }
`

// scroll: one-axis values clip the other axis explicitly (with one axis scrolling, a "visible"
// other axis would compute to auto anyway).
_`
  ${_all}[scroll] { overflow: auto; overscroll-behavior: contain; }
  ${_all}[scroll="x"] { overflow-x: auto; overflow-y: hidden; }
  ${_all}[scroll="y"] { overflow-x: hidden; overflow-y: auto; }
`
// A flex scroll area's children keep their size along the axis it scrolls on, rather than shrinking
// to fit (layout elements let their children shrink below their content: min-width/min-height 0).
// Otherwise the content never overflows, and there's nothing to scroll. A child that is itself a
// scroll area is the exception: it is what should shrink to fit, and scroll its own content (an
// e-virtual-scroll that grew to its whole content would render every row).
_`
  :is(e-column, e-flex[column])[scroll]:where(:not([scroll="x"])) > :where(:not([scroll], e-virtual-scroll)) { flex-shrink: 0; }
  :is(e-row, e-flex:not([column]))[scroll]:where(:not([scroll="y"])) > :where(:not([scroll], e-virtual-scroll)) { flex-shrink: 0; }
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
     grid's column gap (a subgrid's default). */
  e-grid-row { grid-column: 1 / -1; display: grid; grid-template-columns: subgrid; }

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
     than left to the cascade, where it used to depend on which rule came later in the sheet. */
  ${_cells(`${_packed}:where([packed]:not([pad="none"]))`, ":where(:not([pad]))")} {
    padding: var(--e-pad);
  }

  ${spaces
    .map(
      (sp) => `
  ${_cells(`${_packed}[packed="${sp}"]`, ":where(:not([pad]))")} {
    ${theme.css_pad(sp)}
    padding: var(--e-pad);
  }`,
    )
    .join("\n")}

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
     (the first child's leading edge, the last child's trailing edge) are untouched either way. */
  :is(e-row, e-flex:not([column]))[packed] > *:not(:last-child) {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }
  :is(e-row, e-flex:not([column]))[packed] > *:not(:first-child) {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }
  :is(e-column, e-flex[column])[packed] > *:not(:last-child) {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }
  :is(e-column, e-flex[column])[packed] > *:not(:first-child) {
    border-top-left-radius: 0;
    border-top-right-radius: 0;
  }

  /* packed WITHOUT its own border: each child suppresses its own trailing-edge border, whether or
     not it actually has one — a no-op on an unbordered child. No BORDERED_SELECTOR lookup, no
     :has() lookahead at a sibling: each child only ever looks at its own position. See docs/md/ui-layout.md. */
  :is(e-row, e-flex:not([column]))[packed]:not([border]) > *:not(:last-child) {
    border-right: none;
  }
  :is(e-column, e-flex[column])[packed]:not([border]) > *:not(:last-child) {
    border-bottom: none;
  }

  /* packed WITH its own border: packed draws the border, not its children — a 1px gap, filled by
     the container's own background (the same color as its border, via --e-current-border-color,
     see theme.css_border in ui/theme.tsx), becomes the visible seam. Every child gives up its own
     border and takes the current surface's background instead (its own explicit background, if
     set, still wins — this rule carries no more specificity than any plain author style). */
  ${_packed}[packed][border] {
    background-color: var(--e-current-border-color);
    gap: 1px;
  }
  ${_cells(`${_packed}[packed][border]`)} {
    border: none;
    background-color: var(--e-current-surface);
  }

  /* In a packed bordered grid, a row paints the seam color too: its cells paint the surface (its
     own [surface], if set, since that redefines --e-current-surface for them) and the 1px gaps
     between them keep showing the seams. It also makes the row opaque, which a sticky row needs.
     Out-ranks [surface]'s own background by specificity. A hovered row changes the surface its
     cells read: its own background is hidden behind them. */
  e-grid[packed][border] > e-grid-row {
    background-color: var(--e-current-border-color);
  }
  e-grid[packed][border] > e-grid-row[hover]:hover {
    --e-current-surface: ${ambient_surface_mix.surface("n+1")};
  }

  /* Frame ownership: the outermost owner draws the frame, a nested packed bordered container only
     its seams. A packed bordered child of a packed bordered parent already lost its border to the
     cell rule above; it gets its seam color back as background (the cell rule painted it with the
     surface color, hiding the seams between its own children). */
  ${_packed}[packed][border] > ${_packed}[packed][border] {
    background-color: var(--e-current-border-color);
  }
  /* A packed bordered child of a scroll area drops its outer border and radius: the scroll area
     draws the frame (with its own [border]), and clips the content to its rounded edge. */
  :is(${_all}[scroll], e-virtual-scroll) > ${_packed}[packed][border] {
    border-width: 0;
    border-radius: 0;
  }

  /* Whenever packed itself has a radius in effect — its own [border] (which implies radius) or an
     explicit [radius], whether or not it also draws its own border — that radius is the group's
     true outer shape: the first/last child's outer corners must inherit it exactly, not whatever
     radius that child would otherwise resolve to on its own (a form control's fixed "widget"
     radius, e.g. — form.css.tsx sets that unconditionally, unrelated to any ambient/container
     radius; a plain child with none of its own defaults to 0). Not all children go through the
     theme's radius system the same way, so packed — when it has asked for a radius at all — owns
     it for the whole group, rather than relying on each child to coordinate its own. When packed
     has neither [border] nor [radius], this does not apply: each child keeps whatever radius it
     resolved on its own (matching [border] ownership itself in that case — see above). The
     inherit keyword on each longhand forces that one declaration to read the parent's computed
     value, regardless of whether border-radius normally inherits (it doesn't). See docs/md/ui-layout.md. */
  :is(e-row, e-flex:not([column]))[packed]:is([border],[radius]):where(:not([radius="none"])) > *:first-child {
    border-top-left-radius: inherit;
    border-bottom-left-radius: inherit;
  }
  :is(e-row, e-flex:not([column]))[packed]:is([border],[radius]):where(:not([radius="none"])) > *:last-child {
    border-top-right-radius: inherit;
    border-bottom-right-radius: inherit;
  }
  :is(e-column, e-flex[column])[packed]:is([border],[radius]):where(:not([radius="none"])) > *:first-child {
    border-top-left-radius: inherit;
    border-top-right-radius: inherit;
  }
  :is(e-column, e-flex[column])[packed]:is([border],[radius]):where(:not([radius="none"])) > *:last-child {
    border-bottom-left-radius: inherit;
    border-bottom-right-radius: inherit;
  }

  /* Grid cells: no "leading"/"trailing" edge in two dimensions, so every cell of a packed grid
     loses its radius; only the outer corners of the first and last rows take the grid's radius back
     when it has one — through rows only: cells placed directly in the grid can't be told apart from
     interior ones without knowing the column count. The rows inherit the radius from the grid so
     that their cells can inherit it from them (inherit reads the parent). */
  ${_cells("e-grid[packed]")} {
    border-radius: 0;
  }
  e-grid[packed]:is([border],[radius]):where(:not([radius="none"])) > e-grid-row {
    &:first-of-type {
      border-top-left-radius: inherit;
      border-top-right-radius: inherit;
      & > :first-child { border-top-left-radius: inherit; }
      & > :last-child { border-top-right-radius: inherit; }
    }
    &:last-of-type {
      border-bottom-left-radius: inherit;
      border-bottom-right-radius: inherit;
      & > :first-child { border-bottom-left-radius: inherit; }
      & > :last-child { border-bottom-right-radius: inherit; }
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
