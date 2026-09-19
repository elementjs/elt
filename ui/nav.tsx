import { css } from "elt"

css`nav {

  display: flex;
  align-items: baseline;
  padding: var(--e-spacing-widget) var(--e-spacing-component);
  gap: 8px;

  & button {
    font-size: 1rem;
    border: none;

    &:first-child {
      margin-left: calc(-1 * var(--e-spacing-component));
    }
  }
}`
