/**
 * @module typography
 * default typography rules, only applied on e-box with e-typographic attribute.
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
    border: 1px solid ${theme.colors.text.faded};
    border-bottom-width: 2px;
    min-width: 3.25ch;
    display: inline-block;
    text-align: center;
    border-radius: ${theme.settings.borderRadius};
    background: ${theme.colors.text.ultra_light};
    color: ${theme.colors.text.faded};
  }


  e-box[typographic] {
    /* ── Base rhythm ───────────────────────────────────────── */
    display: block;
    font-size: 1rem;
    line-height: 1.7;
    color: inherit;

    /* ── Unknown children → paragraph-like ────────────────── */
    & > :not(
      p, h1, h2, h3, h4, h5, h6,
      ul, ol, li, blockquote, pre, code,
      hr, figure, figcaption, table,
      dl, dt, dd, details, summary,
      strong, em, a, abbr, mark, s
    ) {
      margin-block: 1em;
    }

    /* ── Vertical rhythm: all block children ──────────────── */
    & > * + * {
      margin-block-start: 1em;
    }

    /* ── Headings ──────────────────────────────────────────── */
    & h1, & h2, & h3, & h4, & h5, & h6 {
      line-height: 1.2;
      font-weight: 600;
      margin-block: 1.5em 0.4em;
      text-wrap: balance;
    }
    & h1 { font-size: 2rem; }
    & h2 { font-size: 1.5rem; }
    & h3 { font-size: 1.25rem; }
    & h4 { font-size: 1.1rem; }
    & h5 { font-size: 1rem;   font-style: italic; }
    & h6 { font-size: 0.9rem; font-style: italic; color: color-mix(in oklab, currentColor 70%, transparent); }

    /* ── Paragraphs ────────────────────────────────────────── */
    & p {
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
      padding-inline-start: 1.75em;
      & > li + li { margin-block-start: 0.35em; }
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
      padding: 1em 1.25em;
      background: color-mix(in oklab, currentColor 6%, transparent);
      border-radius: 0.375em;
      line-height: 1.5;

      & code {
        background: none;
        padding: 0;
        font-size: 0.875rem; /* rem, not em — avoid double shrink */
      }
    }

    /* ── Horizontal rule ───────────────────────────────────── */
    & hr {
      border: none;
      border-block-start: 1px ${theme.colors.text.mid};
      margin-block: 2em;
    }

    /* ── Table ─────────────────────────────────────────────── */
    & table {
      width: fit-content;
      border-collapse: separate;
      border: none;
      border-spacing: 0;

      tbody, thead, th, td, tr {
        border: none;
      }

      font-size: 0.8em;

      /* reset buttons and inputs to be the whole cell */
      & :is(th, td):has(> :is(button, label, input):first-child:last-child) {
        padding: 0;
        & :first-child {
          border: none;
          border-radius: 0;
        }
      }

      & > thead > tr:first-child > :is(th, td):first-child {
        border-top-left-radius: ${theme.settings.borderRadius};
      }
      & > thead > tr:first-child > :is(th, td):last-child {
        border-top-right-radius: ${theme.settings.borderRadius};
      }

      & > :is(tbody:last-child, tfoot) > tr:last-child > :is(th, td):first-child {
        border-bottom-left-radius: ${theme.settings.borderRadius};
      }
      & > :is(tbody:last-child, tfoot) > tr:last-child > :is(th, td):last-child {
        border-bottom-right-radius: ${theme.settings.borderRadius};
      }

      & > :is(thead, tr:first-child) :is(th, td) {
        border-top: 1px solid ${theme.colors.text.light};
      }

      & :is(th, td):last-child {
        border-right: 1px solid ${theme.colors.text.light};
      }

      :is(th, td) {
        border-left: 1px solid ${theme.colors.text.light};
        border-bottom: 1px solid ${theme.colors.text.light};
        padding: ${theme.settings.paddingCellVertical} ${theme.settings.paddingCellHorizontal};
        text-align: start;
      }

      & th {
        background: ${theme.colors.text.ultra_light};
        font-weight: bolder;
      }
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
      border: 1px solid ${theme.colors.text.mid};
      border-radius: 0.375em;
      padding: 0.5em 1em;

      & summary {
        cursor: pointer;
        font-weight: 600;
        padding-block: 0.25em;
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
}`
