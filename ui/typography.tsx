/**
 * @module typography
 * default typography rules, only applied on e-box with e-typographic attribute.
 */

import { css } from "elt"

css`@layer typography {
  e-box[e-typographic] {
    font-family: var(--e-font-family);
    font-size: var(--e-font-size);
    line-height: var(--e-line-height);
  }
}`
