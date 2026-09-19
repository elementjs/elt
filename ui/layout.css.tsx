import { type Attrs, type NRO, css } from "elt"
import { theme } from "./theme"

declare module "elt" {
  interface ElementMap {
    "e-grid": EFlexAttrs
    "e-flex": EFlexAttrs
    "e-block": EBlockAttrs
    "e-row": EFlexAttrs
    "e-column": EFlexAttrs
  }
}

export type SpacingValues =
  | "1"
  | "2"
  | "4"
  | "widget"
  | "component"
  | "section"
  | "stage-1"
  | "stage-2"
  | "stage-3"
  | "stage-4"

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
  gap?: NRO<boolean | SpacingValues>
  pad?: NRO<boolean | SpacingValues>
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
const spaces: SpacingValues[] = [
  "1",
  "2",
  "4",
  "widget",
  "component",
  "section",
  "stage-1",
  "stage-2",
  "stage-3",
  "stage-4",
]
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

// increment surface level, display background
_`${_all}[surface]{
  --e-current-surface-level: calc(1 + var(--e-surface-level));
  --e-surface-level-swap: var(--e-current-surface-level);
  background-color: ${theme.colors.tint.from_bg("calc(var(--e-current-surface-level)*var(--e-surface-step))")};
  & > * { --e-surface-level: var(--e-surface-level-swap); }
}`

// derived: radius follows this element's own vertical padding step, not a separately chosen value
_`${_all}[border-radius]:not([border-radius="none"]) { border-radius: var(--e-pad-vertical, var(--e-spacing-widget-horizontal)); }`

for (const al of align) {
  _`${_layouters}[align="${al}"] { align-items: ${al}; }`
  _`${_layouters}[justify="${al}"] { justify-content: ${al}; }`
  _`${_all}[self-justify="${al}"] { justify-self: ${al}; }`
  _`${_all}[self-align="${al}"] { align-self: ${al}; }`
}

// The three raw px nudges (1/2/4) have no separate vertical/horizontal pair — they're symmetric.
// Every other step carries its own independent --e-spacing-<step>-vertical/-horizontal (ui/theme.tsx),
// not derived from a neighbor at generation time.
const _nudges = new Set(["1", "2", "4"])

// Priority, lowest to highest (CSS cascade with equal specificity — later wins):
// 1. bare [gap]/[pad] (no value) fall back to `component`.
// 2. `spacing="X"` sets both gap and pad together — it has no purpose otherwise, a bare `pad`/`gap`
//    alongside it should inherit X, not the component default from (1).
// 3. `gap="X"`/`pad="X"` (an explicit step) override either side on its own, spacing or not.

// (1)
for (const att of ["gap", "pad"]) {
  _`${_all}[${att}] { --e-${att}-vertical: var(--e-spacing-component-vertical); --e-${att}-horizontal: var(--e-spacing-component-horizontal) }`
}

// (2)
for (let i = 0, l = spaces.length; i < l; i++) {
  const sp = spaces[i]
  const v = _nudges.has(sp) ? `var(--e-spacing-${sp})` : `var(--e-spacing-${sp}-vertical)`
  const h = _nudges.has(sp) ? `var(--e-spacing-${sp})` : `var(--e-spacing-${sp}-horizontal)`
  _`${_all}[spacing="${sp}"] { --e-gap-vertical: ${v}; --e-gap-horizontal: ${h}; --e-pad-vertical: ${v}; --e-pad-horizontal: ${h}; }`
}

// (3)
for (const att of ["gap", "pad"]) {
  for (let i = 0, l = spaces.length; i < l; i++) {
    const sp = spaces[i]
    const v = _nudges.has(sp) ? `var(--e-spacing-${sp})` : `var(--e-spacing-${sp}-vertical)`
    const h = _nudges.has(sp) ? `var(--e-spacing-${sp})` : `var(--e-spacing-${sp}-horizontal)`
    _`${_all}[${att}="${sp}"] { --e-${att}-vertical: ${v}; --e-${att}-horizontal: ${h}; }`
  }
}

// Spacing scale values now live in Theme (ui/theme.tsx, spacing1/2/4/Widget/Component/Section/Stage1-4)
// and are emitted through the theme class, not a literal :root — everything below only needs
// the purely functional variables that aren't theme settings.
css`
@layer components {
  :root {
    --e-gap-vertical: var(--e-spacing-component-vertical);
    --e-gap-horizontal: var(--e-spacing-component-horizontal);
    --e-pad-vertical: var(--e-spacing-component-vertical);
    --e-pad-horizontal: var(--e-spacing-component-horizontal);

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
      padding: var(--e-pad-vertical) var(--e-pad-horizontal);
    }
  }

  :is(e-flex,e-grid,e-row,e-column) {
    &[gap], &[spacing] {
      gap: var(--e-gap-vertical) var(--e-gap-horizontal);
    }
  }

  ${more.join("\n")}
}
`
