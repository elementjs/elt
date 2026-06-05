import { css } from "elt"
import { theme } from "./theme"

css`menu {
  display: flex;
  flex-direction: column;
  grid-template-columns: [left] 32px [content] 1fr [right] 32px;
  gap: 0;
  padding: 8px;

  & > :is(h1, h2, h3, h4, h5, h6) {
    margin: 0;
    padding: 0;
    font-size: 1em;
    font-weight: bold;
    color: ${theme.colors.text.faded};
    text-wrap: balance;
  }

  /* Icons on buttons and links that appear at the start create a space */
  & > :is(button, a, label) > span:first-child:has(:is(svg:first-child, img:first-child)) {
    width: 1em;
    margin-right: 8px;
  }

  & > h2 {
    font-size: 0.925em;
  }
  & > h3 {
    font-size: 0.875em;
  }
  & > h4 {
    font-size: 0.8em;
  }
  & > h5 {
    font-size: 0.75em;
  }

  & > hr {
    margin-top: 4px;
    margin-bottom: 4px;
  }

  :is(h1, h2, h3, h4, h5, h6, a, button, label, e-box, e-flex, e-button-box) {
    padding: 4px 8px 4px 8px;
  }

  & > li > :is(button, a, label), & > :is(button, a, label) {
    border: none;
    text-align: start;
  }
}`
