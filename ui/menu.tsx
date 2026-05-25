import { css } from "elt"
import { theme } from "./theme"

css`menu {
  display: flex;
  flex-direction: column;
  grid-template-columns: [left] 32px [content] 1fr [right] 32px;
  gap: 0;
  padding: 8px;

  /* Icons on buttons and links that appear at the start create a space */
  & > :is(button, a) > span:first-child:has(:is(svg:first-child, img:first-child)) {
    width: 1em;
    margin-right: 8px;
  }

  & > :is(h1, h2, h3, h4, h5, h6) {
    margin: 0;
    padding: 0;
    font-size: 1rem;
    font-weight: 600;
    color: ${theme.colors.text.mid};
    text-wrap: balance;
  }

  & > hr {
    margin-top: 4px;
    margin-bottom: 4px;
  }

  :is(h1, h2, h3, h4, h5, h6, a, button) {
    padding: 4px 8px 4px 8px;
  }

  & > li > button, & > button, & > a, & > li > a {
    border: none;
    text-align: start;
    border-radius: 2px;
  }
}`
