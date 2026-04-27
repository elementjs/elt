import { type Attrs, type NRO, css, e } from "elt"

declare module "elt" {
  interface ElementMap {
    "e-grid": EFlexAttrs
    "e-flex": EFlexAttrs
    "e-box": EBoxAttrs
  }
}

export type SpacingValues = "3x-small" | "2x-small" | "x-small" | "small" | "medium" | "large" | "x-large" | "2x-large" | "3x-large" | "4x-large"

export type AlignValues = "center" | "start" | "end" | "self-start" | "baseline" | "first baseline" | "last baseline" | "safe center" | "unsafe center" | "normal" | "stretch" | "space-evenly" | "space-around" | "space-between"

export type Scheme = "neutral" | "primary"

export interface CommonAttrs extends Attrs<HTMLElement> {
  inline?: NRO<boolean>
  relative?: NRO<boolean>
  grow?: NRO<boolean>
  gap?: NRO<boolean | SpacingValues>
  pad?: NRO<boolean | SpacingValues>
  "hover"?: NRO<boolean>
  "scheme"?: NRO<Scheme>
  "self-align"?: NRO<AlignValues>
  "self-justify"?: NRO<AlignValues>
}

export interface EBoxAttrs extends CommonAttrs {

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
  css`:is(e-flex,e-grid)[align="${al}"] { align-items: ${al}; }`
  css`:is(e-flex,e-grid)[justify="${al}"] { justify-content: ${al}; }`
  css`:is(e-flex,e-grid,e-box)[self-justify="${al}"] { justify-self: ${al}; }`
  css`:is(e-flex,e-grid,e-box)[self-align="${al}"] { align-self: ${al}; }`
}

for (let att of ["gap", "pad"]) {
  for (let i = 0, l = spaces.length; i < l; i++) {
    const sp = spaces[i]!
    const less = spaces[i - 1]! ?? spaces[i]!
    css`:is(e-flex,e-grid,e-box)[${att}="${sp}"] { --e-${att}-vertical: var(--e-spacing-${less}); --e-${att}-horizontal: var(--e-spacing-${sp}); }`
    css`:is(e-flex,e-grid,e-box)[${att}="${sp}"] { --e-${att}-vertical: var(--e-spacing-${less}); --e-${att}-horizontal: var(--e-spacing-${sp}); }`
  }
}

css`
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
`
css`e-box { display: block; }`
css`e-box[inline] { display: inline-block; }`

css`e-flex { display: flex; flex-direction: row; flex-wrap: nowrap; align-items: baseline; }`
css`e-flex[inline] { display: inline-flex; }`
css`e-flex[column] { flex-direction: column; }`
css`e-flex[reverse] { flex-direction: row-reverse; }`
css`e-flex[column][reverse] { flex-direction: column-reverse; }`
css`e-flex[wrap] { flex-wrap: wrap !important; }`

css`:is(e-flex,e-grid,e-box) {
  --e-gap-vertical: var(--e-spacing-small);
  --e-gap-horizontal: var(--e-spacing-medium);
  --e-pad-vertical: var(--e-spacing-small);
  --e-pad-horizontal: var(--e-spacing-medium);
}`

css`:is(e-flex,e-grid,e-box)[relative] {
  position: relative;
}`

css`:is(e-flex,e-grid,e-box)[grow] {
  flex-grow: 1;
  flex-basis: 0;
}`

css`:is(e-flex,e-grid,e-box)[pad] {
  padding: var(--e-pad-vertical) var(--e-pad-horizontal);
}`

css`:is(e-flex,e-grid)[gap] {
  gap: var(--e-gap-vertical) var(--e-gap-horizontal); }
`
