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
  
  spacing?: NRO<SpacingValues>
  gap?: NRO<true | SpacingValues | "none">
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

// derived: radius follows this element's own padding step, not a separately chosen value
_`${_all}[border-radius]:not([border-radius="none"]) { border-radius: var(--e-pad, var(--e-spacing-widget)); }`

for (const al of align) {
  _`${_layouters}[align="${al}"] { align-items: ${al}; }`
  _`${_layouters}[justify="${al}"] { justify-content: ${al}; }`
  _`${_all}[self-justify="${al}"] { justify-self: ${al}; }`
  _`${_all}[self-align="${al}"] { align-self: ${al}; }`
}

// Priority, lowest to highest (CSS cascade with equal specificity — later wins):
// 1. bare [gap]/[pad] (no value) fall back to `component`.
// 2. `spacing="X"` sets both gap and pad together — it has no purpose otherwise, a bare `pad`/`gap`
//    alongside it should inherit X, not the component default from (1).
// 3. `gap="X"`/`pad="X"` (an explicit step) override either side on its own, spacing or not.
//
// Every step → custom-property mapping below reads from `theme.css.pad`/`theme.css.gap`
// (ui/theme.tsx) — the single source of truth `theme.classes.pad`/`.gap` also consume for
// standalone elements, so the two can't drift apart.

// (1)
_`${_all}[gap] { ${theme.css.gap("component")} }`
_`${_all}[pad] { ${theme.css.pad("component")} }`

// (2)
for (const sp of spaces) {
  _`${_all}[spacing="${sp}"] { ${theme.css.gap(sp)} ${theme.css.pad(sp)} }`
}

// (3)
for (const sp of spaces) {
  _`${_all}[gap="${sp}"] { ${theme.css.gap(sp)} }`
  _`${_all}[pad="${sp}"] { ${theme.css.pad(sp)} }`
}

// Spacing scale values now live in Theme (ui/theme.tsx, spacing1/2/4/Widget/Component/Section/Stage1-4)
// and are emitted through the theme class, not a literal :root — everything below only needs
// the purely functional variables that aren't theme settings.
css`
@layer components {
  :root {
    ${theme.css.gap("component")}
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

    & button {
      font-size: 1rem;
      border-color: transparent;
    }
  }
  footer {
    ${theme.colors.text.faded.css_as_inverted}
  }

  e-block { display: block; }
  e-block[inline] { display: inline-block; }

  e-flex,e-row,e-column { display: flex; flex-direction: row; flex-wrap: nowrap; align-items: baseline; }
  e-flex[column],e-column { flex-direction: column; }
  ${_flex}[inline] { display: inline-flex; }
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
    &[pad], &[spacing] {
      padding: var(--e-pad);
    }
  }

  :is(e-flex,e-grid,e-row,e-column) {
    &[gap], &[spacing] {
      gap: var(--e-gap);
    }
  }

  /* [pad="none"]/[gap="none"] turn one side off on its own, most useful alongside spacing
     (which otherwise implies both) — generated last so they win the cascade. */
  ${_all}[pad="none"] {
    padding: 0;
  }

  :is(e-flex,e-grid,e-row,e-column)[gap="none"] {
    gap: 0;
  }

  ${more.join("\n")}
}
`
