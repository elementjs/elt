import { type Attrs, type NRO, css } from "elt"

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
  more.push(`
:is(e-flex,e-grid)[align="${al}"] { align-items: ${al}; }
:is(e-flex,e-grid)[justify="${al}"] { justify-content: ${al}; }
:is(e-flex,e-grid,e-box)[self-justify="${al}"] { justify-self: ${al}; }
:is(e-flex,e-grid,e-box)[self-align="${al}"] { align-self: ${al}; }
`)
}

for (let att of ["gap", "pad"]) {
  for (let i = 0, l = spaces.length; i < l; i++) {
    const sp = spaces[i]
    const less = spaces[i - 1] ?? spaces[i]
    more.push(`
:is(e-flex,e-grid,e-box)[${att}="${sp}"] { --e-${att}-vertical: var(--e-spacing-${less}); --e-${att}-horizontal: var(--e-spacing-${sp}); }
`)
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
e-box[inline] { display: inline-box; }

e-flex { display: flex; flex-direction: row; flex-wrap: nowrap; }
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
}

:is(e-flex,e-grid,e-box)[scheme="primary"] {
  border-color: var(--sl-color-primary-200);
}

:is(e-flex,e-grid,e-box)[hover]:hover {
  background-color: var(--sl-color-neutral-50);
  cursor: pointer;
}
:is(e-flex,e-grid,e-box)[hover]:active {
  background-color: var(--sl-color-neutral-100);
  cursor: pointer;
}
:is(e-flex,e-grid,e-box)[hover][scheme="primary"]:hover {
  background-color: var(--sl-color-primary-50);
}
:is(e-flex,e-grid,e-box)[hover][scheme="primary"]:active {
  background-color: var(--sl-color-primary-100);
}

:is(e-flex,e-grid,e-box)[relative] { position: relative; }
:is(e-flex,e-grid,e-box)[grow] { flex-grow: 1; flex-basis: 0; }
:is(e-flex,e-grid,e-box)[pad] { padding: var(--e-pad-vertical) var(--e-pad-horizontal); }
:is(e-flex,e-grid)[gap] { gap: var(--e-gap-vertical) var(--e-gap-horizontal); }

${more.join("")}

`
