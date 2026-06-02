import { css } from "elt"
import { theme } from "./theme"

css`nav {

  display: flex;
  align-items: baseline;
  padding: ${theme.settings.paddingPanelVertical} ${theme.settings.paddingPanelHorizontal};
  gap: 8px;

  & button {
    font-size: 1rem;
    border: none;

    &:first-child {
      margin-left: calc(-1 * ${theme.settings.paddingCellHorizontal});
    }
  }
}`
