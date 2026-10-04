import { css, type NRO } from "elt"
import { CHECK_POINTS } from "./icons"
import { Mix, theme } from "./theme"
import { FORM_CONTROL_SELECTOR, INVALID_SELECTOR } from "./selectors"

const colors = theme.colors

/** The checkbox's check mark: the `Check` icon's polyline as a mask (its opaque stroke is what shows
 * the tint behind it), twice the icon's stroke width so it reads at checkbox size. */
const CHECKBOX_CHECK_MASK = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><polyline points="${CHECK_POINTS}" fill="none" stroke="white" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"/></svg>`,
)

/** The bevel of raised controls (the switch, the inverted button): a highlight above, a shadow below.
 * The light palette's `bg` and `text` at 20% opacity, so the light comes from the same side in both
 * schemes, and an inverted button, which redefines --e-color-bg locally, keeps it. */
const light_bg = new Mix(colors.bg.light_frozen_expr)
const light_text = new Mix(colors.text.light_frozen_expr)
const bevel_raise = light_bg.from(light_bg, "100%", 0.2)
const bevel_drop = light_text.from(light_text, "100%", 0.2)

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
  /* (0,1,1): wins over the plain \`a\` color above. */
  &:visited {
    color: ${colors.tint.faded};
  }
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
  gap: ${theme.settings.spacingNudge4};
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

/* A frame around fields: padded at the component step, its radius following its padding
   (docs/md/ui-layout.md#borders-and-radius). */
fieldset {
  width: fit-content;
  padding: ${theme.settings.spacingComponent};
  ${theme.css_radius("component")}
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
    inset 0 -1px 2px ${bevel_raise},
    inset 0 1px 2px ${bevel_drop};
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
    0 -1px 2px ${bevel_raise},
    0 1px 2px ${bevel_drop};
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
  color: var(--e-color-text);
  background-color: var(--e-color-bg);
  border-color: ${bevel_raise} ${bevel_drop} ${bevel_drop} ${bevel_raise};
}

/* A checked toggle is a choice, not an action: a tint surface jump (+3) with a full tint border, like a
   selected item, never the inverted fill of the dominant action (docs/md/ui-theme.md, Emphasis). */
label[e-variant="toggle"]:where(:has(> input:checked)) {
  --e-current-surface: ${colors.tint.selected};
  border-color: ${colors.tint};
  background-color: var(--e-current-surface);
  color: ${colors.text};

  @media (hover: hover) and (pointer: fine) {
    &:hover:not(:disabled) {
      background: ${colors.tint.selected_hover};
    }
  }
}

label[e-variant="toggle"]:where(:has(> input:not(:checked))) {
  border: 1px solid ${colors.tint.mid};
  background-color: ${colors.bg};
  color: ${colors.tint.mid};
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

/* A control alone in a table cell fills the cell: the cell drops its padding, the control its border
   and radius (the cell's own borders frame it). Here rather than in typography: it must win over the
   control rules above, and typography is a lower layer (ui/reset.css.tsx). */
:where(table) :is(th, td):has(> :is(button, label, input):first-child:last-child) {
  padding: 0;
  & :first-child {
    border: none;
    border-radius: 0;
  }
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
  --e-current-surface: ${colors.neutral.selected};
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
