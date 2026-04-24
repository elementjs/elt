import { css, type ClassDefinition, type NRO } from "elt"
import { theme } from "./theme"

const colors = theme.colors

declare module "elt" {

  interface attrs_button {
    class?: ClassDefinition | ClassDefinition[] | null | false | NRO<"primary" | "text">
  }
}

css`
  label {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;

    &:hover {
      background-color: ${colors.tint.light};
    }
  }

  button, input[type="checkbox"], input[type="radio"] {
    cursor: pointer;
  }

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
    border: 1px solid ${colors.text.faded};
    padding: ${theme.settings.cellPadding};
    border-radius: ${theme.settings.borderRadius};
    background: ${colors.bg};
    color: ${colors.text};
    font-size: ${theme.settings.formFontSize};
    vertical-align: baseline;

    transition:
      background 0.2s ease,
      box-shadow 0.2s ease;

    &:hover {
      background: ${colors.bg.ultra_light};
    }

    &:focus-visible {
      box-shadow: 0 0 0 3px ${colors.tint.mid};
    }
  }

  ::placeholder {
    color: ${colors.text.mid};
  }

  input[type="checkbox"] {
    appearance: none;
    width: 1em;
    height: 1em;
    border: 1px solid ${colors.text.faded};
    border-radius: 4px;
    cursor: pointer;
    position: relative;
    display: inline-block;
    transition: border-color .25s;
  }

  /* The animated SVG checkmark */
  input[type="checkbox"]::after {
    position: absolute;
    top: -0.1em;
    left: 0.2em;
    height: 100%;
    font-size: 0.75em;
    font-weight: bold;

    /* Color comes from here (can use var()) */
    color: ${colors.tint};
    content: "✔";

    /* Animation: from bottom-left, rotated */
    transform-origin: bottom left;
    transform: scale(0) rotate(-20deg);
    opacity: 0;

    transition:
      transform .25s cubic-bezier(.2, .7, .3, 1),
      opacity .25s ease-out;
  }
  /* Checked state */
  input[type="checkbox"]:checked {
    border-color: ${colors.tint};
  }

  input[type="checkbox"]:checked::after {
    transform: scale(1) rotate(0deg);
    opacity: 1;
  }

  label, button {
    user-select: none;
  }

  button {
    /* transition: transform 1ms ease, background 1ms ease, box-shadow 1ms ease;*/
    /* box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);*/

    &:hover:not([disabled]) {
      background: ${colors.tint.light};
    }

    &:active:not([disabled]) {
      background: ${colors.tint.light};
      box-shadow:
        inset 0px 4px 6px ${colors.text.from_bg(theme.settings.intensityLight, 0.4)},
        inset 0px -4px 6px ${colors.text.from_bg(theme.settings.intensityLight, 0.1)};
      transform: scale(0.99) translateY(1px);
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
    background: ${colors.tint.light};
  }

  ::-webkit-scrollbar-thumb {
    background: ${colors.tint.faded};
    /* borderRadius: calc(1rem / 4) */
  }

`



export const form_box = css`.form-box {
  & > :not(:last-child) {
    border-right: none;
    border-bottom-right-radius: 0;
    border-top-right-radius: 0;
  }
  & > :not(:first-child) {
    border-bottom-left-radius: 0;
    border-top-left-radius: 0;
  }
}`

export const form_primary = css`.form-primary {
  border-color: ${colors.tint};
  color: ${colors.tint};
}`

export const form_primary_background = css`.form-primary-background {
  background-color: ${colors.tint};
  border-color: ${colors.tint};
  color: ${colors.bg};
}`

export const button_tint = css`.button-tint {
  color: ${colors.tint};
  border: 1px solid ${colors.tint.faded};
}`
console.log("cls_button_tint", button_tint)

export const button_full = css`.button-full {
  color: ${colors.bg};
  background-color: ${colors.tint};
  border: 1px solid ${colors.tint};

  &:hover:not([disabled]) {
    background: ${colors.tint.faded};
  }
}`

export const button_text = css`.button-text {
  background: transparent;
  border: none;
  padding: 0;
  color: ${colors.text};
}`
