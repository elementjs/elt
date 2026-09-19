import { type Attrs, type NRO, css } from "elt"
import { theme } from "./theme"

declare module "elt" {
  interface ElementMap {
    "e-grid": EFlexAttrs
    "e-flex": EFlexAttrs
    "e-box": EBoxAttrs
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
  | "stage1"
  | "stage2"
  | "stage3"
  | "stage4"

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

export interface EBoxAttrs extends CommonAttrs {
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
  "stage1",
  "stage2",
  "stage3",
  "stage4",
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

const _all = `:is(e-flex,e-grid,e-box,e-column,e-row)`
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

for (const al of align) {
  _`${_layouters}[align="${al}"] { align-items: ${al}; }`
  _`${_layouters}[justify="${al}"] { justify-content: ${al}; }`
  _`${_all}[self-justify="${al}"] { justify-self: ${al}; }`
  _`${_all}[self-align="${al}"] { align-self: ${al}; }`
}

for (const att of ["gap", "pad"]) {
  // default is component
  _`${_all}[${att}] { --e-${att}-vertical: var(--e-spacing-widget); --e-${att}-horizontal: var(--e-spacing-component) }`
  for (let i = 0, l = spaces.length; i < l; i++) {
    const sp = spaces[i]
    const less = spaces[i - 1] ?? spaces[i]
    _`${_all}[spacing="${sp}"][${att}] { --e-${att}-vertical: var(--e-spacing-${less}); --e-${att}-horizontal: var(--e-spacing-${sp});  }`
    _`${_all}[${att}="${sp}"] { --e-${att}-vertical: var(--e-spacing-${less}); --e-${att}-horizontal: var(--e-spacing-${sp}); }`
  }
}

//>> These root values should really be part of the theme, except for the --e-surface-level which is a purely functional variable
css`
@layer components {
  :root {
    --e-spacing-1: 1px;
    --e-spacing-2: 2px;
    --e-spacing-4: 4px;
    --e-spacing-widget: 8px;
    --e-spacing-component: 16px;
    --e-spacing-section: 32px;
    --e-spacing-stage1: 64px;
    --e-spacing-stage2: 128px;
    --e-spacing-stage3: 256px;
    --e-spacing-stage4: 512px;

    --e-gap-vertical: var(--e-spacing-widget);
    --e-gap-horizontal: var(--e-spacing-component);
    --e-pad-vertical: var(--e-spacing-widget);
    --e-pad-horizontal: var(--e-spacing-component);

    --e-surface-level: 0;
    --e-surface-step: 10%;
  }

  header, footer {
    ${theme.css_light_colors};
    ${theme.colors.tint.css_as_inverted};

    padding: var(--e-spacing-widget) var(--e-spacing-component);
    gap: var(--e-spacing-widget) var(--e-spacing-component);
    width: 100%;
    display: flex;
    flex-direction: row;
    align-items: baseline;

    & button {
      font-size: 1rem;
      border-color: transparent;

      &:first-child {
        margin-left: calc(-1 * var(--e-spacing-component));
      }
    }
  }
  footer {
    ${theme.colors.text.faded.css_as_inverted}
  }

  e-box { display: block; }
  e-box[inline] { display: inline-block; }

  e-flex,e-row,e-column { display: flex; flex-direction: row; flex-wrap: nowrap; align-items: baseline; }
  e-flex[column],e-column { flex-direction: column; }
  e-flex[inline] { display: inline-flex; }
  :is(e-flex,e-row)[reverse] { flex-direction: row-reverse; }
  :is(e-flex[column],e-column)[reverse] { flex-direction: column-reverse; }
  :is(e-flex,e-row,e-column)[wrap] { flex-wrap: wrap; }

  e-grid { display: grid; }
  e-grid[inline] { display: inline-grid; }

  :is(e-flex,e-grid,e-box) {
    &[max-width] { max-width: 100%; }
    &[max-height] { max-height: 100%; }
    &[full-screen] { width: 100%; height: 100%; }
    &[full-width] { width: 100%; }
    &[full-height] { height: 100%; }
  }

  :is(e-flex,e-grid,e-box)[relative] {
    position: relative;
  }

  :is(e-flex,e-grid,e-box)[grow] {
    flex-grow: 1;
    flex-basis: 0;
  }

  :is(e-flex,e-grid,e-box)[pad] {
    padding: var(--e-pad-vertical) var(--e-pad-horizontal);
  }

  :is(e-flex,e-grid)[gap] {
    gap: var(--e-gap-vertical) var(--e-gap-horizontal);
  }

  ${more.join("\n")}
}
`
