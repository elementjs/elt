import { type Attrs, type NRO, css } from "elt"
import { BORDERED_SELECTOR } from "./selectors"
import { type SpacingStep, spacing_steps, theme } from "./theme"

declare module "elt" {
  interface ElementMap {
    "e-grid": EFlexAttrs
    "e-flex": EFlexAttrs
    "e-block": EBlockAttrs
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

export type BorderValues =
  | "tint"
  | "n+1" | "n+2" | "n+3" | "n+4" | "n+5" | "n+6" // relative surface-level separators; see _border_relative_levels below


export type SurfaceValues =
  | boolean // true value
  | "background"
  | "n+1" | "n+2" // relative helpers — the only offsets [surface] precompiles; see ui/theme.tsx for arbitrary n+K
  | "1" | "2" | "3" | "4" | "5" | "6" // absolute helpers

export interface CommonAttrs extends Attrs<HTMLElement> {
  inline?: NRO<boolean>
  relative?: NRO<boolean>
  grow?: NRO<boolean>
  
  spacing?: NRO<true | SpacingValues | "none">
  pad?: NRO<true | SpacingValues | "none">
  surface?: NRO<boolean | SurfaceValues>
  hover?: NRO<boolean>
  /**
   * Draw a border around the element. Bare `border` is a clear boundary at `text.mid`; `"tint"`
   * uses `tint.mid` instead; `"n+K"` is a divider/separator at that surface level relative to
   * whatever's ambient. Implies `border-radius` (see below) unless `border-radius="none"`.
   */
  border?: NRO<boolean | BorderValues>
  /**
   * Radius follows this element's own vertical padding step by default (including when implied by
   * `border`); pass a named spacing step to override that (for an element that doesn't pad itself),
   * or `"none"` to opt out even when a border is present.
   */
  "border-radius"?: NRO<boolean | "none" | SpacingValues>
  
  "self-align"?: NRO<AlignValues>
  "self-justify"?: NRO<AlignValues>
  "max-width"?: NRO<boolean>
  "max-height"?: NRO<boolean>
  "full-screen"?: NRO<boolean>
  "full-width"?: NRO<boolean>
  "full-height"?: NRO<boolean>
}

export interface EBlockAttrs extends CommonAttrs {
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
   * Rule 6 (specs/elt-ui-guidelines.md, Golden rules): a boundary with no spacing whose
   * children touch directly, uniformly padded. `pad` always pads the container itself, same as
   * everywhere else — it never applies to children here. To also pad every child uniformly: bare
   * `touching` reuses whatever `pad` resolves to (so `pad="X" touching` pads both the container and
   * its children at X) ; an explicit step (`touching="Y"`) pads children at Y regardless of `pad`,
   * letting the two differ (e.g. a popup's own edge inset vs. its rows' tighter click-target
   * padding). `touching` never draws a border itself — border rendering is entirely each child's
   * own concern. When two touching children both carry their own border on the shared seam, the
   * later one (in DOM order) wins: its leading edge stays, the earlier child's trailing edge there
   * is suppressed, collapsing the seam into a single line instead of doubling it. When only one of
   * the two carries a border there, it already shows through with no suppression needed. Interior
   * touching seams always have their corner radii zeroed, regardless of whether either child has a
   * border there, so a touching group of rounded children still reads as one shape.
   */
  touching?: NRO<boolean | SpacingValues>
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

const _all = `:where(e-flex,e-grid,e-block,e-column,e-row)`
const _flex = `:where(e-flex,e-column,e-row)`
const _layouters = `:where(e-flex,e-grid,e-column,e-row)`

function _(strings: TemplateStringsArray, ...values: unknown[]): void {
  let result = strings[0];
  for (let i = 0; i < values.length; i++) {
    result += String(values[i]) + strings[i + 1];
  }
  more.push(result);
}

// Surface levels: bare [surface] (boolean true) and [surface="n+1"] both raise one level relative
// to whatever's ambient — the default case. [surface="n+2"] is the other named relative offset
// (border/divider level) ; CSS attribute selectors can only match exact strings, not a pattern, so
// only these two relative offsets are precompiled here — any other n+K goes through
// theme.colors.<color>.classes.as_surface(n)/.css.as_surface(n) (ui/theme.tsx) instead, which
// synthesize their CSS per call and so accept an arbitrary offset. The :not() list excludes every
// other explicit-value case so bare/[surface] stays the fallback, same pattern [border-radius]
// already uses below.
const _surface_levels = ["1", "2", "3", "4", "5", "6"] as const
const _surface_not_default = [...["background", "n+2"], ..._surface_levels].map((v) => `:not([surface="${v}"])`).join("")

_`
  ${_all}[surface] { overflow: hidden; }
  ${_all}[border] { border: 1px solid ${theme.colors.text.mid}; overflow: hidden; }
  ${_all}[border="tint"] { border: 1px solid ${theme.colors.tint.mid}; }
  ${_all}[hover]:hover { background-color: ${theme.colors.tint.surface("n+1")} }
  ${_all}[surface]${_surface_not_default} { ${theme.colors.tint.css.as_surface("n+1")} }
  ${_all}[surface="n+2"] { ${theme.colors.tint.css.as_surface("n+2")} }
  ${_all}[surface="background"] { ${theme.colors.tint.css.as_surface("background")} }
`

for (const lvl of _surface_levels) {
  _`${_all}[surface="${lvl}"] {
    ${theme.colors.tint.css.as_surface(Number(lvl))}
  }`
}

// [border="n+K"] — a divider/separator at that surface level relative to whatever's ambient,
// matching [surface]'s own relative-offset mechanism (Mix.surface, ui/theme.tsx).
const _border_relative_levels = ["1", "2", "3", "4", "5", "6"] as const
for (const lvl of _border_relative_levels) {
  _`${_all}[border="n+${lvl}"] { border: 1px solid ${theme.colors.tint.surface(`n+${lvl}`)}; }`
}

// `border` implies `border-radius` (any value, including a divider's), unless explicitly opted
// out with border-radius="none". Default (no named step): derives from this element's own vertical
// padding step. A named step below overrides that — for an element that doesn't pad itself.
//
// `:where(:not(...))` rather than a bare `:not(...)`: `:not([x="none"])` on its own carries the
// specificity of [x="none"] (an attribute selector), which would outrank the plain-attribute
// [border-radius="${sp}"] step selectors below despite coming first in source order — silently
// preventing every named-step override from ever applying. :where() always contributes zero
// specificity, so these two rules and the per-step loop stay equal-specificity and cascade
// purely by source order, as intended.
_`${_all}[border]:where(:not([border-radius="none"])) { ${theme.css.border_radius()} }`
_`${_all}[border-radius]:where(:not([border-radius="none"])) { ${theme.css.border_radius()} }`
for (const sp of spaces) {
  _`${_all}[border-radius="${sp}"] { ${theme.css.border_radius(sp)} }`
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
// children (specs/elt-ui-guidelines.md, Golden rules, rule 5).
//
// Priority, lowest to highest (CSS cascade with equal specificity — later wins):
// 1. bare [pad] (no value) implies `component` spacing, same as bare [spacing] falling back to it.
// 2. [pad="X"] implies spacing at the same step X.
// 3. [spacing]/[spacing="X"] sets the ambient spacing directly — an explicit spacing value always
//    wins over whatever [pad] implied, since these rules are emitted last.
//
// Every step → custom-property mapping below reads from `theme.css.pad`/`theme.css.spacing`
// (ui/theme.tsx) — the single source of truth `theme.classes.pad`/`.spacing` also consume for
// standalone elements, so the two can't drift apart.

// (1) — [pad="none"] is excluded here : it implies no spacing at all, since there's no padding
// for rule 5 to apply to (its own zero-override further below handles it).
_`${_all}[pad]:not([pad="none"]) { ${theme.css.pad("component")} ${theme.css.spacing("component")} }`
_`${_all}[spacing] { ${theme.css.spacing("component")} }`

// (2)
for (const sp of spaces) {
  _`${_all}[pad="${sp}"] { ${theme.css.pad(sp)} ${theme.css.spacing(sp)} }`
}

// (3)
for (const sp of spaces) {
  _`${_all}[spacing="${sp}"] { ${theme.css.spacing(sp)} }`
}

// --e-current-surface-level holds a [surface] element's own (just-raised) level — registered
// non-inherited so a descendant that isn't itself a [surface] never reads a stale ancestor value
// off it; `Mix.surface()` (ui/theme.tsx) falls back to the ambient --e-surface-level in that case.
// No `initial-value` (allowed only with the universal `"*"` syntax) — that's what makes this
// property genuinely absent (not merely 0) on non-[surface] elements, so `var(--e-current-surface-level, fallback)` reaches its fallback there.
css`
@property --e-current-surface-level {
  syntax: "*";
  inherits: false;
}
`

// Spacing scale values now live in Theme (ui/theme.tsx, spacing1/2/4/Widget/Component/Section/Stage1-4)
// and are emitted through the theme class, not a literal :root — everything below only needs
// the purely functional variables that aren't theme settings.
css`
@layer components {
  :root {
    ${theme.css.spacing("component")}
    ${theme.css.pad("component")}

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
  header { ${theme.colors.tint.css.as_inverted}; }
  footer { ${theme.colors.text.css.as_surface(0.5)} }

  e-block { display: block; }
  e-block[inline] { display: inline-block; }

  e-flex,e-row,e-column { display: flex; flex-direction: row; flex-wrap: nowrap; align-items: baseline; }
  e-flex[column],e-column { flex-direction: column; }
  ${_flex}[inline] { display: inline-flex; }
  /* A block-level flex container isn't valid content directly inside a <p> — auto-switch to
     inline-flex there rather than requiring every call site to remember [inline] itself. */
  p > ${_flex} { display: inline-flex; }
  :is(e-flex,e-row)[reverse] { flex-direction: row-reverse; }
  :is(e-flex[column],e-column)[reverse] { flex-direction: column-reverse; }
  :is(e-flex,e-row,e-column)[wrap] { flex-wrap: wrap; }

  e-grid { display: grid; }
  e-grid[inline] { display: inline-grid; }

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
    /* [pad] always pads the element itself, [touching] or not — see the [touching] rules below
       for how a touching container's children get padded too. */
    &[pad] {
      padding: var(--e-pad-vertical) var(--e-pad-horizontal);
    }
  }

  :is(e-flex,e-grid,e-row,e-column) {
    &:not([pad="none"]):not([touching]), &[spacing]:not([touching]) {
      gap: var(--e-spacing-vertical) var(--e-spacing-horizontal);
    }
  }

  ${_flex}:where([touching]:not([pad="none"])) > * {
    padding: var(--e-pad-vertical) var(--e-pad-horizontal);
  }

  ${spaces.map(sp => `
  ${_flex}[touching="${sp}"] > * {
    ${theme.css.pad(sp)}
    padding: var(--e-pad-vertical) var(--e-pad-horizontal);
  }`).join("\n")}

  /* A focused child's ring must draw over its touching neighbor rather than being covered by it. */
  :is(e-row,e-column,e-flex)[touching] > * {
    position: relative;
    z-index: 0;
  }
  :is(e-row,e-column,e-flex)[touching] > :focus-visible {
    z-index: 1;
  }

  /* Interior touching seams always lose their corner radii, whether or not either side has a
     border there, so a touching group of rounded children still reads as one shape. */
  :is(e-row, e-flex:not([column]))[touching] > *:not(:last-child) {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }
  :is(e-row, e-flex:not([column]))[touching] > *:not(:first-child) {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }
  :is(e-column, e-flex[column])[touching] > *:not(:last-child) {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }
  :is(e-column, e-flex[column])[touching] > *:not(:first-child) {
    border-top-left-radius: 0;
    border-top-right-radius: 0;
  }

  /* When both sides of a seam are bordered, the later child (in DOM order) wins: its leading edge
     stays, the earlier child's trailing edge there is suppressed. When only one side is bordered,
     it already shows through — no rule needed, it just falls out of the box model. */
  :is(e-row, e-flex:not([column]))[touching] > ${BORDERED_SELECTOR}:has(+ ${BORDERED_SELECTOR}) {
    border-right: none;
  }
  :is(e-column, e-flex[column])[touching] > ${BORDERED_SELECTOR}:has(+ ${BORDERED_SELECTOR}) {
    border-bottom: none;
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
