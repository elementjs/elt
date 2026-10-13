import { css, type NRO } from "elt"
import { CHECK_POINTS } from "./icons"
import { type Emphasis, theme } from "./theme"
import {
  CENTERED_TEXT_CONTROL_SELECTOR,
  CHECKABLE_LABEL_SELECTOR,
  FORM_CONTROL_SELECTOR,
  INSET_FOCUS_SELECTOR,
} from "./selectors"

const colors = theme.colors

/** The checkbox's check mark: the `Check` icon's polyline as a mask (its opaque stroke is what shows
 * the tint behind it), twice the icon's stroke width so it reads at checkbox size. */
const CHECKBOX_CHECK_MASK = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><polyline points="${CHECK_POINTS}" fill="none" stroke="white" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"/></svg>`,
)

declare module "elt" {
  interface attrs_button {
    /** How loud the button is (docs/md/ui-states.md#emphasis). Absent: `default`. */
    "e-emphasis"?: NRO<Emphasis>
  }

  interface attrs_a {
    /** Absent: plain link text. Any other emphasis styles the link as a control (a nav item, a button-like link). */
    "e-emphasis"?: NRO<Emphasis>
  }

  interface attrs_input {
    "e-emphasis"?: NRO<"default" | "tint">
    "e-widget"?: NRO<"switch">
  }

  interface attrs_label {
    /** A toggle takes an emphasis like a button. */
    "e-emphasis"?: NRO<Emphasis>
    "e-widget"?: NRO<"toggle">
  }

  interface Attrs<N extends Node = HTMLElement> {
    /**
     * An editable element (a `contenteditable`, a custom field) that looks like a text input: its border,
     * padding, radius, height and focus ring (docs/md/ui-states.md#widgets).
     */
    "e-widget"?: NRO<"field">
  }
}

css`
@layer components {

/* Plain link text: tinted, underlined when hovered. Not an \`<a>\` that asks for a control's look with
   an emphasis other than \`link\` (a nav item): no underline, and a visited color would tell browsing
   history, which is wrong for it. \`:where\`: zero specificity, so an emphasis always wins. The hover
   fill and the pointer cursor are the interaction layer's (ui/states.css.tsx). */
a:where(:not([e-emphasis])) {
  color: ${colors.tint};
  &:visited {
    color: ${colors.tint.faded};
  }
  &:hover {
    text-decoration: underline;
  }
}

/* A link that asks for a control's look is no longer text with a destination: no underline. */
a[e-emphasis]:not([e-emphasis="link"]) {
  text-decoration: none;
}

label {
  &:has(:disabled) {
    color: ${colors.text.mid};
    cursor: not-allowed;
  }

  /* A label's radius can't derive from its own padding (a plain label has none) — "widget" is a
     deliberate override matching its sibling controls below (see "Borders and radius" in
     docs/md/ui-layout.md). A label around a checkbox, radio or switch pads itself like a bare control
     (FORM_CONTROL_SELECTOR), since it fills when hovered. */
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

label[e-widget="toggle"] > input[type="checkbox"] {
  display: none;
}

button, input[type="checkbox"], input[type="radio"] {
  cursor: pointer;
}

/* ── Control height ────────────────────────────────────────────────────────────────────────────
   Controls side by side must be the same height, whatever they hold (text, an icon, a number field, a
   one-line textarea), loose or packed. So the height is not left to each one's content: every
   control's content box is at least one line (1.25em), and padding and borders come on top, the same
   for all. The padding is the control's step: the widget step, or the packed container's, which
   ui/layout.css.tsx puts in --e-control-pad on its cells (declared on every control here, so a
   control that merely sits deeper in a packed cell does not inherit it).

   A text field's text is a line in an inner element of the browser's, which scrolls (its scrollbar is
   hidden). Two things go wrong when the field is taller than that line, or about as tall:
   - padding around the line is dead: a click there puts the caret at the start or the end of the
     text, not where the click is;
   - the line's glyph boxes, or rounding at a fractional zoom, make the inner element overflow by a
     fraction of a pixel; it is then scrollable, and swallows the first wheel ticks meant for the
     scroll area around the field.
   So these fields (CENTERED_TEXT_CONTROL_SELECTOR) have no vertical padding, and their line is as
   tall as the whole field would be with it: the inner element fills the height, the text is centered
   in it, and it is taller than the glyph boxes by the padding, so it has nothing to scroll. */
:where(${FORM_CONTROL_SELECTOR}, fieldset) {
  --e-control-pad: ${theme.settings.spacingWidget};
}

${FORM_CONTROL_SELECTOR} {

  line-height: 1.25;
  display: inline-block;
  /* The content box is at least one line; the borders and the padding come on top, the same for all.
     (Not border-box: a border is rounded to whole device pixels, so at a fractional zoom its width is
     not 1px, and a height that counted it as 1px would be off.) */
  box-sizing: content-box;
  min-height: 1.25em;

  :where(&, fieldset) {

    appearance: none;
    -webkit-appearance: none;
    background-color: transparent;
    color: ${colors.text};
    border: 1px solid;
    border-color: var(--e-border-color, ${colors.neutral});
    padding: var(--e-control-pad);
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

/* Inset, inside the control's own edge, for the controls that fill their cell: nothing around them can
   clip the ring (a scroll area cuts what is outside its padding box, even when nothing overflows), and
   cells that touch don't cover it. Checkboxes and switches keep the ring around them. */
:is(${INSET_FOCUS_SELECTOR}):focus-visible {
  box-shadow: inset 0 0 0 ${theme.settings.focusRingSize} ${colors.tint.mid};
}

${CENTERED_TEXT_CONTROL_SELECTOR} {
  padding-block: 0;
  min-height: calc(1.25em + 2 * var(--e-control-pad));
  /* The line is the whole height: the browser's inner editor is as tall as the line, so a click
     anywhere along the field's height lands on it (and puts the caret where the click is), and the
     text sits in the middle of the line. A shorter line (the font's own, say) would leave the padding
     room above and below it, where a click goes to the start or end of the text instead. The line is
     also at least the glyph boxes' height, so the editor has nothing to scroll. */
  line-height: calc(1.25em + 2 * var(--e-control-pad));
}

/* A date field is made of small fields of its own with their own padding, around a line of the font's
   height: it is centered in the minimum height, which alone gives it the height. */
input[type="date"],
input[type="time"],
input[type="datetime-local"] {
  line-height: normal;
}

/* A label around a checkbox, a radio or a switch lays the box and its text out in a row, centered: the
   box (1em, nudged down by the line it sits in everywhere else) would otherwise raise the line it
   shares with the text, and the label would be taller than its neighbours. The gap is the room between
   the box and the text. */
${CHECKABLE_LABEL_SELECTOR} {
  display: inline-flex;
  align-items: center;
  > input {
    top: 0;
  }
}

/* A toggle's content is inline: centered along the height it is given by the same token. */
label[e-widget="toggle"] {
  align-content: center;
}

fieldset > legend {
  color: ${colors.text.faded};
  font-size: ${theme.settings.formFontSize};
  background-color: ${colors.bg};
  padding: 0 ${theme.settings.spacingWidget};
  margin-bottom: -0.4em;
}

/* A frame around fields: padded at the component step, its radius following its padding
   (docs/md/ui-layout.md#borders-and-radius). */
fieldset {
  width: fit-content;
  padding: ${theme.settings.spacingComponent};
  ${theme.css_radius("component")}
}


::placeholder {
  color: ${colors.text.mid};
}

input[type="checkbox"] {
  appearance: none;
  width: 1em;
  height: 1em;
  border: 1px solid;
  border-color: var(--e-border-color, ${colors.neutral.faded});
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
  --e-border-color: ${colors.tint};
}

input[type="checkbox"]:checked::after {
  transform: scale(1) rotate(0deg);
  opacity: 1;
}

/* Toggle switch (checkbox + e-widget="switch") */
input[type="checkbox"][e-widget="switch"] {
  --e-switch-width: 1.5em;
  --e-switch-height: .75em;
  --e-switch-thumb: var(--e-switch-height);
  box-sizing: border-box;
  position: relative;
  width: var(--e-switch-width);
  height: calc(var(--e-switch-height) + 2px);
  border-radius: 9999px;
  border: 1px solid;
  border-color: var(--e-border-color, ${colors.neutral.faded});
  background-color: ${colors.neutral.surface(1)};
  transition:
    background-color ${theme.settings.durationFast} ease-out,
    border-color ${theme.settings.durationFast} ease-out,
  ;
  box-shadow:
    inset 0 -1px 2px ${theme.bevel_raise},
    inset 0 1px 2px ${theme.bevel_drop};
}

input[type="checkbox"][e-widget="switch"]:checked {
  --e-border-color: ${colors.tint};
  background-color: ${colors.tint.mid};
}

input[type="checkbox"]:focus-visible {
  box-shadow: 0 0 0 ${theme.settings.focusRingSize} ${colors.tint.mid};
}

input[type="checkbox"][e-widget="switch"]::after {
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
    0 -1px 2px ${theme.bevel_raise},
    0 1px 2px ${theme.bevel_drop};
}

input[type="checkbox"][e-widget="switch"]:checked::after {
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

/* An unselected toggle is outlined in tint, a choice not yet made (the selected state fills it:
   ui/states.css.tsx). */
label[e-widget="toggle"]:where(:has(> input:not(:checked))) {
  border: 1px solid;
  border-color: var(--e-border-color, ${colors.tint.mid});
  background-color: ${colors.bg};
  color: ${colors.tint.mid};
}

/* ── Emphasis ──────────────────────────────────────────────────────────────────────────────────
   How loud a control is: \`e-emphasis\` (docs/md/ui-states.md#emphasis). The levels are
   \`theme.css_emphasis\`'s; this is only where they apply. After the widgets' own rules above, at the
   same specificity, so a toggle asked to be \`bare\` is. */
:is(button, a, label, input)[e-emphasis="link"] {
  ${theme.css_emphasis("link")}
}

:is(button, a, label, input)[e-emphasis="bare"],
:where(${CHECKABLE_LABEL_SELECTOR}) {
  ${theme.css_emphasis("bare")}
}

:is(button, a, label, input)[e-emphasis="tint"] {
  ${theme.css_emphasis("tint")}
}

/* A tint input is outlined, its text is still text. */
input[e-emphasis="tint"] {
  color: ${colors.text};
  &::placeholder {
    color: ${colors.tint.mid};
  }
}

:is(button, a, label, input)[e-emphasis="inverted"] {
  ${theme.css_emphasis("inverted")}
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

}`
