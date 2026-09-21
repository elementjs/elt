import { type Attrs, type NRO, css } from "elt"
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
  | "widget"


export type SurfaceValues =
  | boolean // true value
  | "background"
  | "increment"
  | "1" | "2" | "3" | "4" | "5" | "6" // helpers
  | "none"

export interface CommonAttrs extends Attrs<HTMLElement> {
  inline?: NRO<boolean>
  relative?: NRO<boolean>
  grow?: NRO<boolean>
  
  spacing?: NRO<true | SpacingValues | "none">
  pad?: NRO<true | SpacingValues | "none">
  surface?: NRO<boolean | SurfaceValues>
  hover?: NRO<boolean>
  /** Draw a border around the widget */
  border?: NRO<boolean | BorderValues>
  /** Mostly used with "none" as border will apply border radius */
  "border-radius"?: NRO<boolean | "none">
  
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
  typographic?: NRO<boolean>
  "table-container"?: NRO<boolean>
}

export interface EFlexAttrs extends CommonAttrs {
  wrap?: NRO<boolean>
  column?: NRO<boolean>
  reverse?: NRO<boolean>
  align?: NRO<AlignValues>
  justify?: NRO<AlignValues>
  /**
   * Rule 6 (specs/elt-ui-guidelines.md, Padding and boundaries): a boundary with no spacing whose
   * children touch directly. `pad` is redirected — it pads every direct child uniformly instead of
   * the container itself (which must stay unpadded). `"border"` additionally draws a real divider
   * on the touching seam, replacing each child's own border there rather than doubling it.
   */
  touching?: NRO<boolean | "bare" | "border">
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

const _all = `:is(e-flex,e-grid,e-block,e-column,e-row)`
const _flex = `:is(e-flex,e-column,e-row)`
const _layouters = `:is(e-flex,e-grid,e-column,e-row)`

function _(strings: TemplateStringsArray, ...values: unknown[]): void {
  let result = strings[0];
  for (let i = 0; i < values.length; i++) {
    result += String(values[i]) + strings[i + 1];
  }
  more.push(result);
}

// Surface levels: bare [surface] (boolean true) and [surface="increment"] both raise one level
// relative to whatever's ambient — the :not() list excludes the other, explicit-value cases so
// this stays the fallback for the common case, same pattern [border-radius] already uses below.
const _surface_levels = ["1", "2", "3", "4", "5", "6"] as const
const _surface_not_increment = [...["background", "none"], ..._surface_levels].map((v) => `:not([surface="${v}"])`).join("")

_`${_all}[surface]${_surface_not_increment} {
  ${theme.colors.tint.css_as_surface("increment")}
}`

_`${_all}[surface="background"] {
  ${theme.colors.tint.css_as_surface("background")}
}`

_`${_all}[surface="none"] {
  ${theme.colors.tint.css_as_surface("none")}
}`

for (const lvl of _surface_levels) {
  _`${_all}[surface="${lvl}"] {
    ${theme.colors.tint.css_as_surface(Number(lvl))}
  }`
}

// derived: radius follows this element's own vertical padding step (the tighter of the pair), not
// a separately chosen value
_`${_all}[border-radius]:not([border-radius="none"]) { border-radius: var(--e-pad-vertical, var(--e-spacing-widget-horizontal)); }`

for (const al of align) {
  _`${_layouters}[align="${al}"] { align-items: ${al}; }`
  _`${_layouters}[justify="${al}"] { justify-content: ${al}; }`
  _`${_all}[self-justify="${al}"] { justify-self: ${al}; }`
  _`${_all}[self-align="${al}"] { align-self: ${al}; }`
}

// `pad` implies `spacing` (spec: "a container with more than one child must set spacing between
// them" — a padded container is exactly such a container). `spacing` never implies `pad` — the two
// are one-directional, matching a boundary-less container that still needs to space un-merged
// children (specs/elt-ui-guidelines.md, Padding and boundaries).
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
    ${theme.css_light_colors};
    ${theme.colors.tint.css_as_inverted};

    padding: ${theme.settings.spacingComponent};
    gap: ${theme.settings.spacingComponent};
    width: 100%;
    display: flex;
    flex-direction: row;
    align-items: baseline;
  }
  footer {
    ${theme.colors.text.faded.css_as_inverted}
  }

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
    /* [touching] redirects [pad] to the children instead (below) — a touching container must
       stay unpadded itself, it's a boundary its children delegate to (rule 6). */
    &[pad]:not([touching]) {
      padding: var(--e-pad-vertical) var(--e-pad-horizontal);
    }
  }

  :is(e-flex,e-grid,e-row,e-column) {
    /* [pad]'s implied spacing and an explicit [spacing] both land in --e-spacing-* above —
       either attribute's presence is enough to read it back out as a real gap. [pad="none"] is
       excluded : it never wrote to --e-spacing-* above, so it must not read a stale/inherited
       value back out either. [touching] is also excluded : it always means no spacing at all,
       regardless of what [pad] would otherwise imply. */
    &[pad]:not([pad="none"]):not([touching]), &[spacing]:not([touching]) {
      gap: var(--e-spacing-vertical) var(--e-spacing-horizontal);
    }
  }

  ${_flex}[touching][pad]:not([pad="none"]) > * {
    padding: var(--e-pad-vertical) var(--e-pad-horizontal);
  }

  :is(e-row,e-column,e-flex)[touching="border"] > * {
    position: relative;
    z-index: 0;
  }
  :is(e-row,e-column,e-flex)[touching="border"] > :focus-visible {
    z-index: 1;
  }

  :is(e-row, e-flex:not([column]))[touching="border"] {
    & > *:not(:last-child) {
      border-right: none;
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
    }
    & > *:not(:first-child) {
      border-left: 1px solid ${theme.colors.tint.separator};
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;
    }
  }

  :is(e-column, e-flex[column])[touching="border"] {
    & > *:not(:last-child) {
      border-bottom: none;
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
    }
    & > *:not(:first-child) {
      border-top: 1px solid ${theme.colors.tint.separator};
      border-top-left-radius: 0;
      border-top-right-radius: 0;
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
