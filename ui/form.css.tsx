import { css, type NRO } from "elt"
import { theme } from "./theme"

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
    "e-variant"?: NRO<"tint" | "switch">
  }
}

css`
@layer components {
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

label {
  font-size: ${theme.settings.formFontSize};
}

button,
input:not([type]),
input[type="text"],
input[type="password"],
input[type="button"],
input[type="submit"],
input[type="reset"],
input[type="date"],
input[type="time"],
input[type="datetime-local"],
textarea,
select,
fieldset {
  appearance: none;
  -webkit-appearance: none;
  background-color: ${colors.bg};
  color: ${colors.text};
  border: 1px solid ${colors.text.faded};
  padding: ${theme.settings.cellPadding};
  border-radius: ${theme.settings.borderRadius};
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
  width: 1rem;
  height: 1rem;
  border: 1px solid ${colors.text.faded};
  border-radius: 4px;
  cursor: pointer;
  position: relative;
  display: inline-block;
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
    transform .2s cubic-bezier(.2, .7, .3, 1),
    opacity .2s ease-out,
    mask-position .2s ease-out;
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
  --e-switch-width: 2em;
  --e-switch-height: 1rem;
  --e-switch-thumb: var(--e-switch-height);
  box-sizing: border-box;
  position: relative;
  width: var(--e-switch-width);
  height: calc(var(--e-switch-height) + 2px);
  vertical-align: middle;
  border-radius: 9999px;
  border: 1px solid ${colors.text.light};
  background-color: ${colors.text.light};
  transition:
    background-color 0.22s ease-out,
    border-color 0.22s ease-out,
    box-shadow 0.2s ease;
}

input[type="checkbox"][e-variant="switch"]:checked {
  border-color: ${colors.tint};
  background-color: ${colors.tint.mid};
}

input[type="checkbox"][e-variant="switch"]:focus-visible {
  box-shadow: 0 0 0 3px ${colors.tint.mid};
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
    transform 0.2s cubic-bezier(0.2, 0.85, 0.25, 1),
    background-color 0.2s ease;
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
  border-top: 1px solid ${colors.text.light};
  height: 1px;
  width: 100%;

  &[e-variant="tint"] {
    border-color: ${colors.tint.light};
  }
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
  color: ${colors.tint};
  &::placeholder {
    color: ${colors.tint.mid};
  }
}

button[e-variant="full"] {
  --e-color-bg: var(--e-light-color-tint);
  --e-color-text: var(--e-light-color-bg);
  --e-color-tint: var(--e-light-color-bg);
  color: var(--e-color-text);
  border-color: var(--e-color-bg);
  background-color: var(--e-color-bg);
}

e-box {
  & > :not(:last-child) {
    border-right: none;
    border-bottom-right-radius: 0;
    border-top-right-radius: 0;
  }
  & > :not(:first-child) {
    border-bottom-left-radius: 0;
    border-top-left-radius: 0;
  }
}
}`