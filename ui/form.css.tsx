import { css, type Attrs, type NRO } from "elt";
import { theme } from "./theme";

const colors = theme.colors

/** Tight viewBox around the polyline so the mark scales up inside the box; stroke is mask alpha. */
const CHECKBOX_CHECK_MASK = encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><polyline points="40 144 96 200 224 72" fill="none" stroke="white" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"/></svg>'
)

declare module "elt" {
  interface attrs_button {
    "e-variant"?: NRO<"text" | "tint" | "full">
  }

  interface attrs_input {
    "e-variant"?: NRO<"tint" | "switch" | "toggle">
  }

}

css`
@layer components {

label {
  &:has(:disabled) {
    opacity: 0.5;
    cursor: not-allowed;
  }

  border-radius: ${theme.settings.borderRadius};
  gap: 4px;
  cursor: pointer;
  font-size: ${theme.settings.formFontSize};

  @media (hover: hover) and (pointer: fine) {
    &:hover:not(:has(:disabled)) {
      background-color: ${colors.tint.light};
      box-shadow:
        6px 3px 0 ${colors.tint.light},
        6px -3px 0 ${colors.tint.light},
        -6px 3px 0 ${colors.tint.light},
        -6px -3px 0 ${colors.tint.light};
    }
  }
}

input[type="checkbox"][e-variant="toggle"] {
  display: none;
}

button, input[type="checkbox"], input[type="radio"] {
  cursor: pointer;
}

button,
input:not([type]),
input[type="text"],
input[type="number"],
input[type="password"],
input[type="button"],
input[type="submit"],
input[type="reset"],
input[type="date"],
input[type="time"],
input[type="datetime-local"],
textarea,
select,
label:has(> input[type="checkbox"][e-variant="toggle"]),
fieldset {
  appearance: none;
  -webkit-appearance: none;
  background-color: transparent;
  color: ${colors.text};
  border: 1px solid ${colors.text.mid};
  padding: ${theme.settings.paddingCellVertical} ${theme.settings.paddingCellHorizontal};
  border-radius: ${theme.settings.borderRadius};
  font-size: ${theme.settings.formFontSize};

  transition:
    outline 0.1s ease,
    background 0.1s ease,
    box-shadow 0.1s ease;

  @media (hover: hover) and (pointer: fine) {
    &:hover {
      background: ${colors.bg.ultra_light};
    }
  }

  &:focus-visible {
    box-shadow: 0 0 0 ${theme.settings.focusRingSize} ${colors.tint.mid};
  }
}

fieldset > legend {
  color: ${colors.text.faded};
  font-size: ${theme.settings.formFontSize};
  background-color: ${colors.bg};
  padding: 0 6px;
  margin-bottom: -0.4em;
}

fieldset {
  width: fit-content;
  padding: 8px 16px;
}


input[type="date"]::-webkit-calendar-picker-indicator,
input[type="time"]::-webkit-calendar-picker-indicator,
input[type="datetime-local"]::-webkit-calendar-picker-indicator {
  @media (prefers-color-scheme: dark) {
    filter: invert(1);
  }
}

input[type="date"],
input[type="time"],
input[type="datetime-local"] {
  height: calc(${theme.settings.formFontSize} * 2 + 1px);
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
  transition: box-shadow 0.1s ease;
  top: 0.1em;
}

/* Animated check: SVG polyline as mask, tight viewBox so it fills the control */
input[type="checkbox"]::after {
  content: "";
  position: absolute;
  inset: 5%;
  background-color: ${colors.tint};
  -webkit-mask-image: url("data:image/svg+xml,${CHECKBOX_CHECK_MASK}");
  mask-image: url("data:image/svg+xml,${CHECKBOX_CHECK_MASK}");
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;

  transform-origin: bottom left;
  transform: scale(0) rotate(-20deg);
  opacity: 0;


  transition:
    transform .1s cubic-bezier(.2, .7, .3, 1),
    opacity .1s ease-out,
    mask-position .1s ease-out;
}

/* Checked state */
input[type="checkbox"]:checked {
  border-color: ${colors.tint};
}

input[type="checkbox"]:checked::after {
  transform: scale(1) rotate(0deg);
  opacity: 1;
}

/* Toggle switch (checkbox + e-variant="switch") */
input[type="checkbox"][e-variant="switch"] {
  --e-switch-width: 1.5em;
  --e-switch-height: .75em;
  --e-switch-thumb: var(--e-switch-height);
  box-sizing: border-box;
  position: relative;
  width: var(--e-switch-width);
  height: calc(var(--e-switch-height) + 2px);
  border-radius: 9999px;
  border: 1px solid ${colors.text.light};
  background-color: ${colors.text.light};
  transition:
    background-color 0.1s ease-out,
    border-color 0.1s ease-out,
  ;
  box-shadow:
    inset 0 -1px 2px rgba(255, 255, 255, 0.2),
    inset 0 1px 2px rgba(0, 0, 0, 0.2);
}

input[type="checkbox"][e-variant="switch"]:checked {
  border-color: ${colors.tint};
  background-color: ${colors.tint.mid};
}

input[type="checkbox"]:focus-visible {
  box-shadow: 0 0 0 ${theme.settings.focusRingSize} ${colors.tint.mid};
}

input[type="checkbox"][e-variant="switch"]::after {
  top: 0;
  left: 0;
  width: calc(var(--e-switch-height) - 2px);
  height: calc(var(--e-switch-height) - 2px);
  border-radius: 50%;
  -webkit-mask-image: none;
  mask-image: none;
  transform-origin: center;
  transform: translateX(2px) translateY(1px);
  opacity: 1;
  background-color: ${colors.text.mid};
  transition:
    transform 0.1s cubic-bezier(0.2, 0.85, 0.25, 1),
    background-color 0.1s ease;
  box-shadow:
    0 -1px 2px rgba(255, 255, 255, 0.2),
    0 1px 2px rgba(0, 0, 0, 0.2);
}

input[type="checkbox"][e-variant="switch"]:checked::after {
  background-color: ${colors.tint};
  transform:
    translateY(1px)
    translateX(calc(var(--e-switch-width) - var(--e-switch-height) - 1px));
}

label, button {
  user-select: none;
}

/** Horizontal divider */
hr {
  border: none;
  height: 1px;
  width: 100%;
  background-color: ${colors.text.light};

  &[e-variant="tint"] {
    border-color: ${colors.tint.light};
  }
}

button, label:has(> input[type="checkbox"][e-variant="toggle"]) {
  transition: transform 5ms ease, background 0.1s ease, box-shadow 0.1s ease;
  transform-origin: bottom;

  @media (hover: hover) and (pointer: fine) {
    &:hover:not(:disabled) {
      background: ${colors.tint.light};
    }
  }

  &:active:not(:disabled) {
    background: ${colors.tint.ultra_light};
    transform: translateY(0.5px);
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
}

button[e-variant="text"] {
  border: 0;
  color: ${colors.tint};
  background: transparent;
}

button[e-variant="tint"], input[e-variant="tint"] {
  border-color: ${colors.tint};
  &::placeholder {
    color: ${colors.tint.mid};
  }
}

button[e-variant="tint"] {
  color: ${colors.tint};
}

button[e-variant="full"], label:has(> input[type="checkbox"][e-variant="toggle"]:checked) {
  --e-color-bg: var(--e-light-color-tint);
  --e-color-text: var(--e-light-color-bg);
  --e-color-tint: var(--e-light-color-bg);
  --e-color-shadow-raise: rgba(255, 255, 255, 0.2);
  --e-color-shadow-drop: rgba(0, 0, 0, 0.2);
  color: var(--e-color-text);
  border-color: var(--e-color-bg);
  background-color: var(--e-color-bg);
}

button[e-variant="full"] {
  border-top-color: var(--e-color-shadow-raise);
  border-left-color: var(--e-color-shadow-raise);
  border-right-color: var(--e-color-shadow-drop);
  border-bottom-color: var(--e-color-shadow-drop);
}

label:has(> input[type="checkbox"][e-variant="toggle"]:not(:checked)) {
  border: 1px solid ${colors.text.mid};
  background-color: ${colors.bg};
  color: ${colors.text};
  --e-color-shadow-raise: rgba(255, 255, 255, 0.2);
  --e-color-shadow-drop: rgba(0, 0, 0, 0.2);

  box-shadow:
    inset 0px 1px 0 var(--e-color-shadow-drop),
    inset 0px -1px 0 var(--e-color-shadow-raise);
}

label:has(> input[type="checkbox"][e-variant="toggle"]:checked) {

  box-shadow:
    inset 0px -1px 0 var(--e-color-shadow-raise),
    inset 0px 1px 0 var(--e-color-shadow-drop);
}

e-button-box {
  position: relative;
  z-index: 0;
  display: flex;
  align-items: baseline;

  p > & {
    display: inline-flex;
  }

  & :is(button, input, label) {
    position: relative;
    z-index: 0;
  }

  &[e-variant="vertical"] {
    display: flex;
    flex-direction: column;
    gap: 0;

    & > :is(button, input, label):not(:last-child) {
      border-bottom: none;
      border-bottom-right-radius: 0;
      border-bottom-left-radius: 0;
    }
    & > :is(button, input, label):not(:first-child) {
      border-top-right-radius: 0;
      border-top-left-radius: 0;
    }

    & > :is(button[e-variant="on"],
    & > (button[e-variant="full"]), label):not(:first-child),
    {
      border-top-color: ${colors.tint.light};
    }
  }


  & :focus-visible {
    z-index: 1;
  }

  &:not([e-variant="vertical"]) {
    & > :is(button, input, label):not(:last-child)
    {
      border-right: none;
      border-bottom-right-radius: 0;
      border-top-right-radius: 0;
    }

    & > :is(button, input, label):not(:first-child) {
      border-bottom-left-radius: 0;
      border-top-left-radius: 0;
    }

    & > :is(button[e-variant="on"],
    & > (button[e-variant="full"]), label):not(:first-child) {
      border-left-color: ${colors.tint.ultra_light};
    }
  }
}

input[type="color"] {
  /* Size */
  width: 1em;
  height: 1em;

  /* Remove default border/background */

  background: none;
  padding: 0;
  cursor: pointer;
  border-radius: 50%; /* makes it circular */
}

input[type="color"]::-webkit-color-swatch-wrapper {
  padding: 0;
}

input[type="color"]::-webkit-color-swatch {
  border: 1px solid ${theme.colors.text};
  border-radius: 50%; /* match parent shape */
}

}`

declare module "elt" {
  interface ElementMap {
    "e-button-box": EButtonBoxAttrs
  }
}


export interface EButtonBoxAttrs extends Attrs {
  "e-variant"?: NRO<"vertical">
}
