/**
 * @module typography
 * default typography rules, applied to every e-block.
 */

import { css } from "elt"
import { theme } from "./theme"
import "./layout.css.tsx"

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

  e-block {

    /* ── Base rhythm ───────────────────────────────────────── */
    display: block;
    font-size: 1rem;
    line-height: 1.5;
    color: inherit;

    & > * {
      margin-block: 1em;
    }

    /* ── Headings ──────────────────────────────────────────── */
    & :where(h1, h2, h3, h4, h5, h6) {
      line-height: 1.2;
      font-weight: bolder;
      margin-block: 2lh 1lh;
      text-wrap: balance;
    }
    & :is(h1, h2, h3, h4, h5, h6) + :is(h1, h2, h3, h4, h5, h6) {
      margin-block-start: 0.5lh !important;
    }
    & :is(h1, h2, h3, h4, h5, h6):has(+ :is(h1, h2, h3, h4, h5, h6)) {
      margin-block-end: 0 !important;
    }
    & h1 { font-size: 2rem; }
    & h2 { font-size: 1.5rem; }
    & h3 { font-size: 1.25rem; }
    & h4 { font-size: 1.1rem; }
    & h5 { font-size: 1rem; font-style: italic; }
    & h6 { font-size: 1rem; font-style: italic; color: color-mix(in oklab, currentColor 70%, transparent); }

    /* ── Paragraphs ────────────────────────────────────────── */
    & p {
      line-height: 1.5;
      margin-block: 1em;
      text-wrap: pretty; /* avoids orphan last words */
    }

    /* ── Blockquote ────────────────────────────────────────── */
    & blockquote {
      margin-inline: 0;
      padding-inline-start: 1.1em;
      border-inline-start: 3px solid color-mix(in oklab, currentColor 35%, transparent);
      color: color-mix(in oklab, currentColor 75%, transparent);
      font-style: italic;

      & > * + * { margin-block-start: 0.75em; }
    }

    /* ── Lists ─────────────────────────────────────────────── */
    & ul, & ol {
      padding-inline-start: 3ch;
    }
    & li {
      margin-block: 0.5em;
    }
    & ul { list-style-type: disc; }
    & ul ul { list-style-type: circle; }
    & ul ul ul { list-style-type: square; }
    & ol { list-style-type: decimal; }

    /* ── Definition list ───────────────────────────────────── */
    & dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.25em 1.5em; }
    & dt {
      font-weight: 600;
      grid-column: 1;
      padding-block-start: 0.15em;
    }
    & dd {
      grid-column: 2;
      margin: 0;
      color: color-mix(in oklab, currentColor 80%, transparent);
    }

    /* ── Code ──────────────────────────────────────────────── */
    & code {
      font-family: ui-monospace, 'Cascadia Code', 'Fira Code', monospace;
      font-size: 0.875em;
      background: color-mix(in oklab, currentColor 8%, transparent);
      padding: 0.15em 0.35em;
      border-radius: 0.25em;
    }
    & pre {
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
      background: ${theme.colors.neutral.surface(1)};
      /* Matches whatever radius the immediate wrapper has (e.g. docs/src/code-example.tsx's
         <e-block border pad="none">), rather than pre's own (nonexistent) radius squaring off a
         rounded wrapper's corners from the inside — see specs/borders.md. Resolves to 0, same as
         today, when pre's direct parent has no radius of its own (plain prose). */
      border-radius: inherit;

      & code {
        background: none;
        padding: 0;
        font-size: 0.875rem; /* rem, not em — avoid double shrink */
      }
    }

    /* ── Horizontal rule ───────────────────────────────────── */
    & hr {
      border: none;
      border-block-start: 1px ${theme.colors.neutral.faded};
      margin-block: 2em;
    }

    /* ── Figure / caption ──────────────────────────────────── */
    & figure {
      margin-inline: 0;
      & figcaption {
        margin-block-start: 0.5em;
        font-size: 0.875em;
        color: color-mix(in oklab, currentColor 60%, transparent);
        text-align: center;
        font-style: italic;
      }
    }

    /* ── Details / summary ─────────────────────────────────── */
    & details {
      border: 1px solid ${theme.colors.neutral.faded};
      ${theme.css.radius("component")}
      padding: ${theme.settings.spacingComponent};

      & summary {
        cursor: pointer;
        line-height: 1em;
        font-weight: 600;
        user-select: none;
      }
      &[open] summary { margin-block-end: 0.5em; }
    }

    /* ── Inline ────────────────────────────────────────────── */
    & a {
      color: ${theme.colors.tint};
      text-underline-offset: 0.2em;
      text-decoration: underline dotted;
      &:visited {
        color: ${theme.colors.tint.faded};
      }
    }
    & :is(strong, b) { font-weight: bolder; }
    & em { font-style: italic; }
    & mark {
      background: color-mix(in oklab, var(--e-color-tint) 45%, transparent);
      color: inherit;
      padding-inline: 0.15em;
      border-radius: 0.15em;
    }
    & abbr[title] {
      text-decoration: underline dotted;
      cursor: help;
    }
    & s { opacity: 0.6; }
  }

  /* ── Table ─────────────────────────────────────────────── */
  e-block table {
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
      ${theme.colors.neutral.css.as_surface(1)}
      font-weight: bolder;
    }
  }

  e-block[table-container] {
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

  e-block {
    & > :first-child {
      margin-top: 0;
      margin-block-start: 0 !important;
    }

    & > :last-child {
      margin-bottom: 0;
      margin-block-end: 0 !important;
    }
  }


}`
