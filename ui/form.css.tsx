import { css, type NRO } from "elt"
import { theme } from "./theme"
import { FORM_CONTROL_SELECTOR, INVALID_SELECTOR } from "./selectors"

const colors = theme.colors

/** Tight viewBox around the polyline so the mark scales up inside the box; stroke is mask alpha. */
const CHECKBOX_CHECK_MASK = encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><polyline points="40 144 96 200 224 72" fill="none" stroke="white" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"/></svg>',
)

declare module "elt" {
  interface attrs_button {
    "e-variant"?: NRO<"link" | "text" | "tint" | "inverted">
  }

  interface attrs_input {
    "e-variant"?: NRO<"tint" | "switch">
  }

  interface attrs_label {
    "e-variant"?: NRO<"toggle">
  }
}

css`
@layer components {

a {
  cursor: pointer;
  color: ${colors.tint};
  &:hover {
    text-decoration: underline;
    background-color: ${colors.tint.hover};
  }
}

label {
  &:has(:disabled) {
    color: ${colors.text.mid};
    cursor: not-allowed;
  }

  /* label wraps a widget-scale control (checkbox/toggle) but doesn't pad itself, so its radius
     can't derive from its own padding — "widget" is a deliberate override matching its sibling
     controls below (see "Borders and radius" in docs/md/ui-layout.md). */
  ${theme.css_radius("widget")}
  gap: 4px;
  cursor: pointer;
  font-size: ${theme.settings.formFontSize};

  @media (hover: hover) and (pointer: fine) {
    &:hover:not(:has(:disabled)) {
      background-color: ${colors.tint.hover};
    }
  }
}

label[e-variant="toggle"] > input[type="checkbox"] {
  display: none;
}

button, input[type="checkbox"], input[type="radio"] {
  cursor: pointer;
}

input, button, select {
  line-height: 1;
}

${FORM_CONTROL_SELECTOR} {

  line-height: 1.2;
  display: inline-block;

  :where(&, fieldset) {

    appearance: none;
    -webkit-appearance: none;
    background-color: transparent;
    color: ${colors.text};
    border: 1px solid ${colors.neutral};
    padding: ${theme.settings.spacingWidget};
    ${theme.css_radius("widget")}
    font-size: ${theme.settings.formFontSize};

    transition:
      outline ${theme.settings.durationFast} ease,
      background ${theme.settings.durationFast} ease,
      box-shadow ${theme.settings.durationFast} ease;

    @media (hover: hover) and (pointer: fine) {
      &:hover {
        background: ${colors.bg};
      }
    }

    &:focus-visible {
      box-shadow: 0 0 0 ${theme.settings.focusRingSize} ${colors.tint.mid};
    }
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
  border: 1px solid ${colors.neutral.faded};
  ${theme.css_radius("nudge-4")}
  cursor: pointer;
  position: relative;
  transition: box-shadow ${theme.settings.durationFast} ease;
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
    transform ${theme.settings.durationFast} cubic-bezier(.2, .7, .3, 1),
    opacity ${theme.settings.durationFast} ease-out,
    mask-position ${theme.settings.durationFast} ease-out;
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
  border: 1px solid ${colors.neutral.faded};
  background-color: ${colors.neutral.faded};
  transition:
    background-color ${theme.settings.durationFast} ease-out,
    border-color ${theme.settings.durationFast} ease-out,
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
  background-color: ${colors.neutral.faded};
  transition:
    transform ${theme.settings.durationFast} cubic-bezier(0.2, 0.85, 0.25, 1),
    background-color ${theme.settings.durationFast} ease;
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
  background-color: ${colors.neutral.surface("n+3")};

  &[e-variant="tint"] {
    border-color: ${colors.tint.separator};
  }
}

button, label[e-variant="toggle"] {
  transition: transform 5ms ease, background ${theme.settings.durationFast} ease, box-shadow ${theme.settings.durationFast} ease;
  transform-origin: bottom;

  @media (hover: hover) and (pointer: fine) {
    &:hover:not(:disabled) {
      background: ${colors.tint.hover};
    }
  }

  &:active:not(:disabled) {
    background: ${colors.tint.separator};
    transform: translateY(0.5px);
  }

  &:disabled {
    cursor: not-allowed;
  }
}

button[e-variant="link"] {
  border: 0;
  padding: 0;
  color: ${colors.tint};
  background: transparent;
  text-decoration: underline;

  @media (hover: hover) and (pointer: fine) {
    &:hover {
      background: transparent;
    }
  }
}

/* Bare: no border, no background, tinted, no underline — same padding rule as everything else: none, since it has no boundary. */
button[e-variant="text"] {
  border: 0;
  padding: 0;
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

/* A toggle's state is read with :has() wrapped in :where(): :has() alone counts its argument's
   specificity, which out-ranked the packed container rules (ui/layout.css.tsx) and kept the
   toggle's own border and background inside a \`packed border\` group. Wrapped, each state rule
   weighs the same as the other variant rules (\`button[e-variant="inverted"]\`). The checked fill
   survives packing like the inverted button's: both set --e-current-surface, the color packed
   paints its children with. */
button[e-variant="inverted"] {
  --e-color-bg: var(--e-light-color-tint);
  --e-current-surface: var(--e-color-bg);
  --e-color-text: var(--e-light-color-bg);
  --e-color-tint: var(--e-light-color-bg);
  --e-color-shadow-raise: rgba(255, 255, 255, 0.2);
  --e-color-shadow-drop: rgba(0, 0, 0, 0.2);
  color: var(--e-color-text);
  border-color: var(--e-color-bg);
  background-color: var(--e-color-bg);
}

button[e-variant="inverted"] {
  border-top-color: var(--e-color-shadow-raise);
  border-left-color: var(--e-color-shadow-raise);
  border-right-color: var(--e-color-shadow-drop);
  border-bottom-color: var(--e-color-shadow-drop);
}

/* A checked toggle is a choice, not an action: a tint surface jump (+3) with a full tint border, like a
   selected item, never the inverted fill of the dominant action (docs/md/ui-theme.md, Emphasis). */
label[e-variant="toggle"]:where(:has(> input:checked)) {
  --e-current-surface: ${colors.tint.surface("n+3")};
  border-color: ${colors.tint};
  background-color: var(--e-current-surface);
  color: ${colors.text};

  @media (hover: hover) and (pointer: fine) {
    &:hover:not(:disabled) {
      background: ${colors.tint.surface("n+4")};
    }
  }
}

label[e-variant="toggle"]:where(:has(> input:not(:checked))) {
  border: 1px solid ${colors.tint.mid};
  background-color: ${colors.bg};
  color: ${colors.tint.mid};
  --e-color-shadow-raise: rgba(255, 255, 255, 0.2);
  --e-color-shadow-drop: rgba(0, 0, 0, 0.2);
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

/* ── Invalid ───────────────────────────────────────────────────────────────────────────────────
   A field whose value is wrong (INVALID_SELECTOR, ui/selectors.ts): its border and focus ring take
   the error color, whatever its variant; nothing else changes, the app's message under the field
   explains. A disabled field is furniture and stays neutral: it can't be fixed while disabled. */
:is(${FORM_CONTROL_SELECTOR}, input[type="checkbox"]):where(${INVALID_SELECTOR}):not(:disabled) {
  border-color: ${colors.error};
  &:focus-visible {
    box-shadow: 0 0 0 ${theme.settings.focusRingSize} ${colors.error.mid};
  }
}

/* ── Disabled ──────────────────────────────────────────────────────────────────────────────────
   A disabled control is furniture, whatever its variant: it loses its tint for neutral, and moves
   each of its full-strength colors halfway toward the background (.mid) instead of fading with
   opacity: a transparent control would let whatever is behind it show through. Colors that are
   already faded stay as they are. Emitted last so these win over the variant rules above at equal
   specificity (docs/md/ui-theme.md, State). */
:is(button, input, select, textarea):disabled {
  color: ${colors.text.mid};
  border-color: ${colors.neutral.mid};
  cursor: not-allowed;
}

button:is([e-variant="tint"], [e-variant="text"], [e-variant="link"]):disabled,
input[e-variant="tint"]:disabled {
  color: ${colors.text.mid};
  border-color: ${colors.neutral.mid};
  &::placeholder {
    color: ${colors.text.mid};
  }
}

/* Inverted controls redefine --e-color-bg/--e-color-text locally (the tint fill becomes their
   background), so their fill is mixed from the light palette directly, like the variant itself:
   halfway between the background and neutral. */
button[e-variant="inverted"]:disabled {
  --e-disabled-fill: color-mix(in oklab, var(--e-light-color-bg) calc(100% - ${theme.settings.intensityMid}), var(--e-light-color-neutral) ${theme.settings.intensityMid});
  background-color: var(--e-disabled-fill);
  border-color: var(--e-disabled-fill);
  /* The label keeps its full color: its own background is the fill, which already moved halfway, so
     moving the label halfway too would make it the same color as the fill. */
  color: var(--e-color-text);
}

/* A disabled toggle: neutral border and label; checked, its fill becomes the neutral jump (+ 3). */
label[e-variant="toggle"]:has(> input:disabled) {
  border-color: ${colors.neutral.mid};
  color: ${colors.text.mid};
}
label[e-variant="toggle"]:has(> input:checked:disabled) {
  --e-current-surface: ${colors.neutral.surface("n+3")};
  background-color: var(--e-current-surface);
}

input[type="checkbox"]:checked:disabled,
input[type="checkbox"][e-variant="switch"]:checked:disabled {
  border-color: ${colors.neutral.mid};
}
input[type="checkbox"]:disabled::after,
input[type="checkbox"][e-variant="switch"]:checked:disabled::after {
  background-color: ${colors.neutral.mid};
}
input[type="checkbox"][e-variant="switch"]:checked:disabled {
  background-color: ${colors.neutral.faded};
}
input[type="checkbox"][e-variant="switch"]:not(:checked):disabled::after {
  background-color: ${colors.neutral.faded};
}

}`
