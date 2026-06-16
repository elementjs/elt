import { type Attrs, type NRO, css } from "elt";
import { theme } from "./theme"

declare module "elt" {
  interface ElementMap {
    "e-grid": EFlexAttrs
    "e-flex": EFlexAttrs
    "e-box": EBoxAttrs
  }
}

export type SpacingValues = "3x-small" | "2x-small" | "x-small" | "small" | "medium" | "large" | "x-large" | "2x-large" | "3x-large" | "4x-large"

export type AlignValues = "center" | "start" | "end" | "self-start" | "baseline" | "first baseline" | "last baseline" | "safe center" | "unsafe center" | "normal" | "stretch" | "space-evenly" | "space-around" | "space-between"

export interface CommonAttrs extends Attrs<HTMLElement> {
  inline?: NRO<boolean>
  relative?: NRO<boolean>
  grow?: NRO<boolean>
  gap?: NRO<boolean | SpacingValues>
  pad?: NRO<boolean | SpacingValues>
  "hover"?: NRO<boolean>
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
  "align"?: NRO<AlignValues>
  "justify"?: NRO<AlignValues>
}

let more: string[] = []
let spaces = ["3x-small", "2x-small", "x-small", "small", "medium", "large", "x-large", "2x-large", "3x-large", "4x-large"]
let align = ["center", "start", "end", "self-start", "baseline", "first baseline", "last baseline", "safe center", "unsafe center", "normal", "stretch", "space-evenly", "space-around", "space-between"]

for (let al of align) {
  more.push(`:is(e-flex,e-grid)[align="${al}"] { align-items: ${al}; }`)
  more.push(`:is(e-flex,e-grid)[justify="${al}"] { justify-content: ${al}; }`)
  more.push(`:is(e-flex,e-grid,e-box)[self-justify="${al}"] { justify-self: ${al}; }`)
  more.push(`:is(e-flex,e-grid,e-box)[self-align="${al}"] { align-self: ${al}; }`)
}

for (let att of ["gap", "pad"]) {
  for (let i = 0, l = spaces.length; i < l; i++) {
    const sp = spaces[i]!
    const less = spaces[i - 1]! ?? spaces[i]!
    more.push(`:is(e-flex,e-grid,e-box)[${att}="${sp}"] { --e-${att}-vertical: var(--e-spacing-${less}); --e-${att}-horizontal: var(--e-spacing-${sp}); }`)
    more.push(`:is(e-flex,e-grid,e-box)[${att}="${sp}"] { --e-${att}-vertical: var(--e-spacing-${less}); --e-${att}-horizontal: var(--e-spacing-${sp}); }`)
  }
}

css`
@layer components {
  :root {
    --e-spacing-3x-small: 1px;
    --e-spacing-2x-small: 2px;
    --e-spacing-x-small: 4px;
    --e-spacing-small: 8px;
    --e-spacing-medium: 16px;
    --e-spacing-large: 32px;
    --e-spacing-x-large: 64px;
    --e-spacing-2x-large: 128px;
    --e-spacing-3x-large: 256px;
    --e-spacing-4x-large: 512px;
  }

  header {
    ${theme.css_light_colors};
    ${theme.colors.tint.css_as_background};

    padding: ${theme.settings.paddingPanelVertical} ${theme.settings.paddingPanelHorizontal};
    gap: ${theme.settings.paddingCellVertical} ${theme.settings.paddingCellHorizontal};
    width: 100%;
    display: flex;
    flex-direction: row;
    align-items: baseline;

    & button {
      font-size: 1rem;
      border-color: transparent;

      &:first-child {
        margin-left: calc(-1 * ${theme.settings.paddingCellHorizontal});
      }
    }
  }

  e-box { display: block; }
  e-box[inline] { display: inline-block; }

  e-flex { display: flex; flex-direction: row; flex-wrap: nowrap; align-items: baseline; }
  e-flex[inline] { display: inline-flex; }
  e-flex[column] { flex-direction: column; }
  e-flex[reverse] { flex-direction: row-reverse; }
  e-flex[column][reverse] { flex-direction: column-reverse; }
  e-flex[wrap] { flex-wrap: wrap !important; }

  :is(e-flex,e-grid,e-box) {
  --e-gap-vertical: var(--e-spacing-small);
  --e-gap-horizontal: var(--e-spacing-medium);
  --e-pad-vertical: var(--e-spacing-small);
  --e-pad-horizontal: var(--e-spacing-medium);
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
