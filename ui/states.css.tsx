/**
 * @module states
 * What an element is doing, as opposed to what it is (ui/form.css.tsx) or how it is laid out
 * (ui/layout.css.tsx): interaction (hover, press, focus) and state (selected, invalid, disabled).
 * Both are written once, for every element the selectors of ui/selectors.ts match: native controls,
 * and any element of an app's own that sets the ARIA state or `e-interactive`. Documented in
 * docs/md/ui-states.md.
 *
 * They are two layers above `components` (ui/reset.css.tsx), in that order, so that, whatever the
 * specificity of a control's look at rest, hover wins over it, and a state wins over hover. Inside
 * `state`, the order of the rules is the precedence: selected, then invalid, then disabled (a disabled
 * control is furniture whatever else it is). So every selector there is wrapped in \`:where()\`: with no
 * specificity of their own, the order is all that decides.
 */

import { css, type NRO } from "elt"
import { ambient_surface_mix, theme } from "./theme"
import {
  DISABLED_SELECTOR,
  FORM_CONTROL_SELECTOR,
  INSET_FOCUS_SELECTOR,
  INTERACTIVE_SELECTOR,
  INVALID_SELECTOR,
  LINK_EMPHASIS_SELECTOR,
  SELECTED_SELECTOR,
} from "./selectors"

declare module "elt" {
  interface Attrs<N extends Node = HTMLElement> {
    /**
     * This element reacts to the pointer and the keyboard as a control does: hover and press looks, a
     * pointer cursor, a focus ring. Native buttons and links are already; `$interactive` sets it (with
     * the role, focus and keys of a button) on any other element. Set by hand only on an element with
     * a focus model of its own, such as a list option (docs/md/ui-states.md#interaction).
     */
    "e-interactive"?: NRO<boolean>
    /**
     * The item the arrow keys are on in a list whose focus stays elsewhere (`aria-activedescendant`, the
     * Select's options): drawn like a hovered one (docs/md/ui-states.md#the-keyboard-cursor).
     */
    "e-active"?: NRO<boolean>
  }
}

const colors = theme.colors

// The controls that draw the tab line (below): not a \`link\` or an \`inverted\` one.
const TAB = ':is([e-widget="tab"], [e-widget="tab-close"]):not([e-emphasis="link"], [e-emphasis="inverted"])'
// The close button of a selected tab (a link has no boundary to fill).
const TAB_CLOSE_OF_SELECTED = `[e-widget="tab"]${SELECTED_SELECTOR}:not(${LINK_EMPHASIS_SELECTOR}) + [e-widget="tab-close"]:not(${LINK_EMPHASIS_SELECTOR})`
const TAB_LINE = `inset 0 calc(-1 * ${theme.settings.focusRingSize}) 0 0 var(--e-tab-line)`

// Hover and press fills, set by the emphasis that wants others than the default (a link has none).
// Not inherited: a button inside a clickable card keeps its own, not the card's. No initial value
// (the "*" syntax allows none), so `var(--e-hover-fill, fallback)` reaches its fallback when unset.
css`
@property --e-hover-fill {
  syntax: "*";
  inherits: false;
}
`
css`
@property --e-press-fill {
  syntax: "*";
  inherits: false;
}
`

const _enabled = `:not(${DISABLED_SELECTOR})`

css`
@layer interaction {
  ${INTERACTIVE_SELECTOR} {
    cursor: pointer;
    /* No double-tap-to-zoom delay on a tap. (The tap highlight is off for everything: ui/reset.css.tsx.) */
    touch-action: manipulation;
    transition: transform 5ms ease, background ${theme.settings.durationFast} ease, box-shadow ${theme.settings.durationFast} ease;
    transform-origin: bottom;
  }

  /* Hover only where hovering exists: on a touch screen it would stay on after the tap. */
  @media (hover: hover) and (pointer: fine) {
    ${INTERACTIVE_SELECTOR}:hover${_enabled} {
      background: var(--e-hover-fill, ${colors.tint.hover});
    }
  }
  /* The keyboard cursor needs no pointer. */
  ${INTERACTIVE_SELECTOR}[e-active]${_enabled} {
    background: var(--e-hover-fill, ${colors.tint.hover});
  }

  ${INTERACTIVE_SELECTOR}:active${_enabled} {
    background: var(--e-press-fill, ${colors.tint.separator});
    transform: translateY(0.5px);
  }

  /* An element of an app's own is not a native control, so it has no ring of its own; inset like the
     buttons' (INSET_FOCUS_SELECTOR), never clipped by what is around it. */
  [e-interactive]:focus-visible {
    outline: none;
    box-shadow: inset 0 0 0 ${theme.settings.focusRingSize} ${colors.tint.mid};
  }

  ${INTERACTIVE_SELECTOR}:is(${DISABLED_SELECTOR}) {
    cursor: not-allowed;
  }
}`

css`
@layer state {
  /* ── Selected ────────────────────────────────────────────────────────────────────────────────
     A choice, a pressed toggle, the place you are (SELECTED_SELECTOR): a tint surface jump, four
     levels when hovered or keyboard-active so it does not fall back to a hover fill, and a tint
     border. The border is a variable, \`--e-border-color\`, which every border of the library reads
     (controls, \`border\` attributes): setting it recolors the ones that exist and nothing else. So a
     row, which draws no border of its own, is only filled; a \`bare\` control, whose transparent edge
     is a literal, keeps it; and no rule has to out-rank another to win the color. The state composes
     with every emphasis and never changes a size. A link has no boundary to paint: it just stops
     looking like a destination. */
  :where(${SELECTED_SELECTOR}:not(${LINK_EMPHASIS_SELECTOR})) {
    ${theme.css_selected()}
    --e-border-color: ${colors.tint};
  }
  @media (hover: hover) and (pointer: fine) {
    :where(${SELECTED_SELECTOR}:not(${LINK_EMPHASIS_SELECTOR}):hover${_enabled}) {
      ${theme.css_selected(true)}
    }
  }
  :where(${SELECTED_SELECTOR}:not(${LINK_EMPHASIS_SELECTOR})[e-active]${_enabled}) {
    ${theme.css_selected(true)}
  }
  :where(${SELECTED_SELECTOR}${LINK_EMPHASIS_SELECTOR}) {
    color: ${colors.text};
    text-decoration: none;
    background: transparent;
  }

  /* ── Source of a popup ───────────────────────────────────────────────────────────────────────
     The element an open popup comes from (ui/popup.tsx sets \`e-source\`): one surface level above the
     ambient one, as a hover does, and it stays when the pointer moves into the popup. Any element, not
     only the interactive ones; \`--e-current-surface\` is what the cells of a framed grid paint. */
  :where([e-source]) {
    --e-current-surface: ${ambient_surface_mix.surface("n+1")};
    background-color: var(--e-current-surface);
  }

  /* ── Invalid ─────────────────────────────────────────────────────────────────────────────────
     A field whose value is wrong (INVALID_SELECTOR, ui/selectors.ts): its border and focus ring take
     the error color, whatever its emphasis; nothing else changes, the app's message under the field
     explains. A disabled field is furniture and stays neutral: it can't be fixed while disabled. */
  :where(:is(${FORM_CONTROL_SELECTOR}, input[type="checkbox"])${INVALID_SELECTOR}:not(:disabled)) {
    --e-border-color: ${colors.error};
    &:focus-visible {
      box-shadow: 0 0 0 ${theme.settings.focusRingSize} ${colors.error.mid};
    }
    &:is(${INSET_FOCUS_SELECTOR}):focus-visible {
      box-shadow: inset 0 0 0 ${theme.settings.focusRingSize} ${colors.error.mid};
    }
  }

  /* ── Tab ─────────────────────────────────────────────────────────────────────────────────────
     A tab (\`e-widget="tab"\`) and its close button (\`e-widget="tab-close"\`, the next sibling) draw a
     line along their bottom edge: dim at rest (the separator of the control's color family, tint for
     the \`tint\` emphasis), full \`--e-border-color\` when the tab is selected. The close button takes the
     tab's line through the sibling selector, so a closable tab reads as one. It is an inset shadow,
     not a border: it keeps the box the same size in every state, and a packed container cannot take
     it away like a border shared with a neighbor. A focused tab has the focus ring in the same
     property, so the line is the first of the two shadows: painted over the ring, which would hide it
     along the bottom edge otherwise. A \`link\` has no boundary and an \`inverted\` control is no
     choice, so neither draws a line. */
  :where(${TAB}) {
    --e-tab-line: ${colors.neutral.separator};
    box-shadow: ${TAB_LINE};
  }
  :where(${TAB}:focus-visible) {
    box-shadow: ${TAB_LINE}, inset 0 0 0 ${theme.settings.focusRingSize} ${colors.tint.mid};
  }
  :where(:is([e-widget="tab"], [e-widget="tab-close"])[e-emphasis="tint"]) {
    --e-tab-line: ${colors.tint.separator};
  }
  :where([e-widget="tab"]${SELECTED_SELECTOR}) {
    --e-tab-line: var(--e-border-color);
  }
  :where([e-widget="tab"]${SELECTED_SELECTOR} + [e-widget="tab-close"]) {
    --e-tab-line: ${colors.tint};
  }
  :where([e-widget="tab"]${SELECTED_SELECTOR}${DISABLED_SELECTOR} + [e-widget="tab-close"]) {
    --e-tab-line: ${colors.neutral.mid};
  }

  /* The close button of a selected tab is selected with it: the same fill and border, hovered one
     level further like any selected control, neutral when the tab is disabled. */
  :where(${TAB_CLOSE_OF_SELECTED}) {
    ${theme.css_selected()}
    --e-border-color: ${colors.tint};
  }
  @media (hover: hover) and (pointer: fine) {
    :where(${TAB_CLOSE_OF_SELECTED}:hover${_enabled}) {
      ${theme.css_selected(true)}
    }
  }
  :where([e-widget="tab"]${SELECTED_SELECTOR}${DISABLED_SELECTOR}:not(${LINK_EMPHASIS_SELECTOR}) + [e-widget="tab-close"]:not(${LINK_EMPHASIS_SELECTOR})) {
    --e-current-surface: ${colors.neutral.selected};
    background-color: var(--e-current-surface);
    color: ${colors.text.mid};
    --e-border-color: ${colors.neutral.mid};
  }

  /* ── Disabled ────────────────────────────────────────────────────────────────────────────────
     A disabled control is furniture, whatever its emphasis: it loses its tint for neutral, and moves
     each of its full-strength colors halfway toward the background (.mid) instead of fading with
     opacity: a transparent control would let whatever is behind it show through. Colors that are
     already faded stay as they are. Last in the layer, so it wins over every other state
     (docs/md/ui-theme.md, State). */
  :where(:is(button, input, select, textarea):disabled, [aria-disabled="true"]) {
    color: ${colors.text.mid};
    --e-border-color: ${colors.neutral.mid};
    cursor: not-allowed;
  }

  :where(input[e-emphasis="tint"]:disabled) {
    &::placeholder {
      color: ${colors.text.mid};
    }
  }

  /* Selected and disabled: the same jump, in neutral. */
  :where(${SELECTED_SELECTOR}${DISABLED_SELECTOR}:not(${LINK_EMPHASIS_SELECTOR})) {
    --e-current-surface: ${colors.neutral.selected};
    background-color: var(--e-current-surface);
    color: ${colors.text.mid};
    --e-border-color: ${colors.neutral.mid};
  }

  /* Inverted controls redefine --e-color-bg/--e-color-text locally (the tint fill becomes their
     background), so their fill is mixed from the light palette directly, like the emphasis itself:
     halfway between the background and neutral. */
  :where([e-emphasis="inverted"]${DISABLED_SELECTOR}) {
    --e-disabled-fill: color-mix(in oklab, var(--e-light-color-bg) calc(100% - ${theme.settings.intensityMid}), var(--e-light-color-neutral) ${theme.settings.intensityMid});
    background-color: var(--e-disabled-fill);
    --e-border-color: var(--e-disabled-fill);
    /* The label keeps its full color: its own background is the fill, which already moved halfway, so
       moving the label halfway too would make it the same color as the fill. */
    color: var(--e-color-text);
  }

  /* A disabled toggle: a neutral border and label, around a disabled checkbox. */
  :where(label[e-widget="toggle"]${DISABLED_SELECTOR}) {
    --e-border-color: ${colors.neutral.mid};
    color: ${colors.text.mid};
  }

  :where(input[type="checkbox"]:checked:disabled, input[type="checkbox"][e-widget="switch"]:checked:disabled) {
    --e-border-color: ${colors.neutral.mid};
  }
  :where(input[type="checkbox"]:disabled, input[type="checkbox"][e-widget="switch"]:checked:disabled)::after {
    background-color: ${colors.neutral.mid};
  }
  :where(input[type="checkbox"][e-widget="switch"]:checked:disabled) {
    background-color: ${colors.neutral.faded};
  }
  :where(input[type="checkbox"][e-widget="switch"]:not(:checked):disabled)::after {
    background-color: ${colors.neutral.faded};
  }
}`
