import { css } from "elt"

export const cls_icon = css`.icon {
  & > svg {
    height: 1em;
    vertical-align: -.155em;
  }
  & > svg path[opacity] {
    fill: var(--e-color-fg, currentColor);
  }
}`
