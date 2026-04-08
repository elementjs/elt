import { css } from "elt"
import * as c from "./colors"
// input[type="file"]::file-selector-button,

export const form = css`
  button,
  input:not([type]),
  input[type="text"],
  input[type="password"],
  input[type="button"],
  input[type="submit"],
  input[type="reset"],
  textarea,
  select,
  fieldset {
    cursor: pointer;
    border: 1px solid ${c.fg(70)};
    padding: var(--e-cell-padding, 0.5em);
    border-radius: var(--e-border-radius, 5px);
    background: var(--e-color-bg);
    border-color: ${c.fg(70)};
    color: var(--e-color-fg);
    font-size: 0.75em;
    line-height: normal;

    transition:
      background 0.2s ease,
      box-shadow 0.2s ease;

    &:hover {
      background: ${c.bg(97)};
    }

    &:focus-visible {
      box-shadow: 0 0 0 3px ${c.tint(50)};
    }

    color: var(--fg);
  }

  ::placeholder {
    color: ${c.fg(90)};
  }

  button {
    user-select: none;
    /* transition: transform 1ms ease, background 1ms ease, box-shadow 1ms ease;*/
    /* box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);*/

    &.text {
      background: transparent;
      border: none;
      padding: 0;
      font-size: 0.75em;
      color: ${c.fg(100)};
    }

    &.primary {
      border: 1px solid var(--tint);
    }

    &:hover:not([disabled]) {
      background: oklch(from var(--tint) l c h / 0.01);
    }

    &:active:not([disabled]) {
      background: var(--btn-active);
      box-shadow:
        inset 0px 4px 6px rgba(0, 0, 0, 0.1),
        inset 0px -4px 6px rgba(255, 255, 255, 0.1);
      transform: scale(0.98) translateY(1px);
      transform-origin: top center;
    }

    &[disabled] {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  ::-webkit-scrollbar {
    position: absolute;
    width: calc(1rem / 2);
    height: calc(1rem / 2);
  }

  ::-webkit-scrollbar-track {
    background: ${c.tint(20)};
  }

  ::-webkit-scrollbar-thumb {
    background: ${c.tint(80)};
    /* borderRadius: calc(1rem / 4) */
  }

`
