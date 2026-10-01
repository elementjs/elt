/**
 * @module typography
 * Typography: appearance of text elements everywhere, and prose rhythm (margins) inside prose
 * containers. Vocabulary in ui/selectors.ts.
 */

import { css } from "elt"
import { theme } from "./theme"
import "./layout.css.tsx"
import { PROSE_CONTAINER_SELECTOR, PROSE_SPACED_SELECTOR, TEXT_BLOCK_SELECTOR } from "./selectors"

css`@layer typography {
  kbd {
    font-family: ${theme.settings.monospaceFontFamily};
    font-size: 0.75em;
    padding: 0em 0.3em;
    font-weight: 500;
    /* neutral has no bg-mix strong enough to match text.faded's darkness (its lightness floor is
       tint's own, well above text's) — bare neutral is the closest achievable border tone. */
    border: 1px solid ${theme.colors.neutral};
    border-bottom-width: 2px;
    min-width: 3.25ch;
    display: inline-block;
    text-align: center;
    border-radius: ${theme.settings.borderRadius};
    /* neutral sits at a lighter luminance than text, so it takes a larger mix fraction to read at
       the same visual weight — 20% neutral instead of 10% text. */
    background: ${theme.colors.neutral.from_bg("20%")};
    color: ${theme.colors.text.faded};
  }

  :where(p, h1, h2, h3, h4, h5, h6, pre, td, th) {
    text-box: trim-both cap alphabetic;
  }

  /* ── Appearance ────────────────────────────────────────────────────────────────────────────────
     Applies everywhere, not only inside a prose container: an <h3> used as a menu title looks like
     an <h3>. Zero specificity (:where) so any component can override it. Margins are NOT set here:
     they are rhythm, which only a prose container gives (see "Rhythm" below). */

  e-prose {
    display: block;
    font-size: 1rem;
    line-height: 1.5;
    color: inherit;
  }

  /* ── Headings ──────────────────────────────────────────── */
  :where(h1, h2, h3, h4, h5, h6) {
    line-height: 1.2;
    font-weight: bolder;
    text-wrap: balance;
  }
  :where(h1) { font-size: 1.5rem; }
  :where(h2) { font-size: 1.25rem; }
  :where(h3) { font-size: 1.1rem; }
  :where(h4) { font-size: 1rem; }
  :where(h5) { font-size: 1rem; font-style: italic; }
  :where(h6) { font-size: 1rem; font-style: italic; color: color-mix(in oklab, currentColor 70%, transparent); }

  /* ── Paragraphs ────────────────────────────────────────── */
  :where(p) {
    line-height: 1.5;
    text-wrap: pretty; /* avoids orphan last words */
  }

  /* ── Blockquote ────────────────────────────────────────── */
  :where(blockquote) {
    margin-inline: 0;
    background-color: ${theme.colors.neutral.surface(1)};
    ${theme.css_pad("component")};
    /* css_pad only sets --e-pad; the padding itself must still read it. */
    padding: var(--e-pad);
    border-inline-start: 3px solid color-mix(in oklab, currentColor 35%, transparent);
    color: color-mix(in oklab, currentColor 75%, transparent);
    font-style: italic;
  }

  /* ── Lists ─────────────────────────────────────────────── */
  :where(ul, ol) {
    padding-inline-start: 3ch;
  }
  /* A list's own internal rhythm, wherever the list sits. */
  :where(ul, ol) > :where(li) {
    margin-block: 0.5em;
  }
  :where(ul) { list-style-type: disc; }
  :where(ul ul) { list-style-type: circle; }
  :where(ul ul ul) { list-style-type: square; }
  :where(ol) { list-style-type: decimal; }

  /* ── Definition list ───────────────────────────────────── */
  :where(dl) { display: grid; grid-template-columns: max-content 1fr; gap: 0.25em 1.5em; }
  :where(dt) {
    font-weight: 600;
    grid-column: 1;
    padding-block-start: 0.15em;
  }
  :where(dd) {
    grid-column: 2;
    margin: 0;
    color: color-mix(in oklab, currentColor 80%, transparent);
  }

  /* ── Code ──────────────────────────────────────────────── */
  :where(code) {
    font-family: ui-monospace, 'Cascadia Code', 'Fira Code', monospace;
    font-size: 0.875em;
    background: color-mix(in oklab, currentColor 8%, transparent);
    padding: 0.15em 0.35em;
    border-radius: 0.25em;
  }
  :where(pre) {
    overflow-x: auto;
    /* CSS forces overflow-y to auto too when only overflow-x is set to something other than
       visible (used values: "visible"/non-visible must match on both axes unless both are
       explicitly non-visible). Left implicit, that surfaces a persistent ~6px phantom vertical
       scrollbar even on content that fits — a browser measurement quirk with overflow-x:auto,
       not real overflow (confirmed: scrollHeight exceeds clientHeight by the same amount
       whether overflow-y is auto, hidden, or clip; overflow:visible on both axes has no gap at
       all). Pinning overflow-y explicitly avoids the coercion — pre has no height constraint of
       its own, so nothing here is ever actually clipped. */
    overflow-y: clip;
    padding: ${theme.settings.spacingComponent};
    background: ${theme.colors.tint.surface(1)};
    border: 1px solid ${theme.colors.tint.separator};
    /* Matches whatever radius the immediate wrapper has (e.g. docs/src/code-example.tsx's
       <e-prose border pad="none">), rather than pre's own (nonexistent) radius squaring off a
       rounded wrapper's corners from the inside. Resolves to 0 when pre's direct parent has no
       radius of its own (plain prose). */
    border-radius: inherit;
    font-size: 0.75em;
  }
  :where(pre) :where(code) {
    background: none;
    padding: 0;
    font-size: 0.875rem; /* rem, not em — avoid double shrink */
  }

  /* Horizontal rule: its look (a 1px line) is in ui/form.css.tsx; only its prose rhythm is set below. */

  /* ── Figure / caption ──────────────────────────────────── */
  :where(figure) {
    margin-inline: 0;
  }
  :where(figcaption) {
    font-size: 0.875em;
    color: color-mix(in oklab, currentColor 60%, transparent);
    text-align: center;
    font-style: italic;
  }
  /* The caption's distance to its figure is part of the figure's own look, wherever it sits. */
  :where(figure) > :where(figcaption) {
    margin-block-start: 0.5em;
  }

  /* ── Details / summary ─────────────────────────────────── */
  :where(details) {
    border: 1px solid ${theme.colors.neutral.faded};
    ${theme.css_radius("component")}
    padding: ${theme.settings.spacingComponent};
  }
  :where(summary) {
    cursor: pointer;
    line-height: 1em;
    font-weight: 600;
    user-select: none;
  }
  :where(details[open]) > :where(summary) { margin-block-end: 0.5em; }

  /* ── Inline ────────────────────────────────────────────── */
  :where(a) {
    color: ${theme.colors.tint};
    text-underline-offset: 0.2em;
    text-decoration: underline dotted;
  }
  :where(a:visited) {
    color: ${theme.colors.tint.faded};
  }
  :where(strong, b) { font-weight: bolder; }
  :where(em) { font-style: italic; }
  :where(mark) {
    background: color-mix(in oklab, var(--e-color-tint) 45%, transparent);
    color: inherit;
    padding-inline: 0.15em;
    border-radius: 0.15em;
  }
  :where(abbr[title]) {
    text-decoration: underline dotted;
    cursor: help;
  }
  :where(s) { opacity: 0.6; }

  /* ── Table ─────────────────────────────────────────────── */
  :where(table) {
    width: fit-content;
    border-collapse: separate;
    border: none;
    border-spacing: 0;

    tbody, thead, th, td, tr {
      border: none;
      vertical-align: baseline;
    }

    /* reset buttons and inputs to be the whole cell */
    & :is(th, td):has(> :is(button, label, input):first-child:last-child) {
      padding: 0;
      & :first-child {
        border: none;
        border-radius: 0;
      }
    }

    /* neutral.surface("n+3") stands in for the old text.separator (surface n+2) — one level up,
       since neutral needs a larger mix fraction than text to read at the same visual weight. */
    & > :is(thead, tr:first-child) :is(th, td) {
      border-top: 1px solid ${theme.colors.neutral.surface("n+3")};
    }

    & :is(th, td):last-child {
      border-right: 1px solid ${theme.colors.neutral.surface("n+3")};
    }

    :is(th, td) {
      border-left: 1px solid ${theme.colors.neutral.surface("n+3")};
      border-bottom: 1px solid ${theme.colors.neutral.surface("n+3")};
      padding: ${theme.settings.spacingWidget};
      text-align: start;
    }

    & th {
      ${theme.colors.neutral.css_as_surface(1)}
      font-weight: bolder;
    }
  }

  e-prose[table-container] {
    border-radius: ${theme.settings.borderRadius};
    max-width: 100%;
    width: fit-content;

    min-height: 0; /* necessary to allow shrinking */
    flex: 0 1 auto; /* shrink to fit, but don't grow ! */

    & thead tr:has(th) {
      position: sticky;
      top: 0;
    }
  }

  /* ── Rhythm ────────────────────────────────────────────────────────────────────────────────────
     Margins only apply to direct children of a prose container (docs/md/ui-typography.md, "Text
     runs"). A text block anywhere else — directly in a row, column or grid — gets no margin, and
     its parent's spacing applies instead. Everything is zero-specificity; source order decides,
     so the per-element margins below refine the base one. */

  /* A text run keeps its typographic rhythm, whatever the container's spacing. */
  :where(${PROSE_CONTAINER_SELECTOR}) > :where(${TEXT_BLOCK_SELECTOR}) {
    margin-block: 1.5em;
  }
  :where(${PROSE_CONTAINER_SELECTOR}) > :where(h1, h2, h3, h4, h5, h6) {
    margin-block: 2lh 1.5lh;
  }
  :where(${PROSE_CONTAINER_SELECTOR}) > :where(p) {
    margin-block: 1em;
  }
  :where(${PROSE_CONTAINER_SELECTOR}) > :where(hr) {
    margin-block: 2em;
  }
  /* Consecutive headings stay together. */
  :where(${PROSE_CONTAINER_SELECTOR}) > :where(h1, h2, h3, h4, h5, h6) + :where(h1, h2, h3, h4, h5, h6) {
    margin-block-start: 0.5lh !important;
  }
  :where(${PROSE_CONTAINER_SELECTOR}) > :where(h1, h2, h3, h4, h5, h6):has(+ :is(h1, h2, h3, h4, h5, h6)) {
    margin-block-end: 0 !important;
  }

  /* Block-level children that are not text blocks (rows, columns, boxes) are spaced by the
     container's ambient spacing, padded or not. Applied as margins on both sides so that, through
     margin collapsing, the gap next to a text block is the larger of the two — a text run keeps
     its typographic rhythm, and two rows get exactly the spacing between them. */
  :where(${PROSE_CONTAINER_SELECTOR}) > :where(${PROSE_SPACED_SELECTOR}) {
    /* The container's step, not the child's own: see --e-parent-spacing in ui/layout.css.tsx. */
    margin-block: var(--e-parent-spacing);
  }

  /* A prose container's own padding (or its parent's spacing) sets its outer distance; its first
     and last children never add to it. */
  :where(${PROSE_CONTAINER_SELECTOR}) > :first-child {
    margin-block-start: 0 !important;
  }
  :where(${PROSE_CONTAINER_SELECTOR}) > :last-child {
    margin-block-end: 0 !important;
  }

}`
