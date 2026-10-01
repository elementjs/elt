// Native controls styled by ui/form.css.tsx's shared control-reset ruleset (appearance, padding,
// border, border-radius, focus ring, transitions). Deliberately includes button[e-variant="link"]/
// ["text"] — they still need the shared font-size/focus-ring/transition rules from that ruleset,
// even though a later, more specific rule then strips their border/padding back to 0; excluding
// them here would lose the focus ring and font-size, not just the border. Excludes
// input[type="checkbox"] — it still renders a border, but gets its own custom appearance
// (ui/form.css.tsx) instead of this shared treatment.
export const FORM_CONTROL_SELECTOR =
  "button, " +
  'input:not([type]), input[type="text"], input[type="number"], input[type="password"], ' +
  'input[type="button"], input[type="submit"], input[type="reset"], ' +
  'input[type="date"], input[type="time"], input[type="datetime-local"], ' +
  "textarea, select, " +
  'label[e-variant="toggle"]'

// Vocabulary (docs/md/elt-ui-rules.md, Terms):
// - a *text block* takes part in prose rhythm: it gets typographic margins when it is a direct child
//   of a prose container;
// - a *prose container* gives that rhythm to its direct children. An element may be both (a
//   <blockquote> is a text block for its parent and a prose container for its own children).
// Outside a prose container (directly in a row, column or grid), a text block gets no margin.
export const TEXT_BLOCK_SELECTOR = "h1, h2, h3, h4, h5, h6, p, ul, ol, dl, blockquote, pre, table, hr, figure, details"

export const PROSE_CONTAINER_SELECTOR =
  "e-prose, article, section, aside, main, blockquote, figure, details, li, dd, td, th"

// Block-level children of a prose container that are not text blocks (rows, columns, plain boxes).
// They are spaced from their neighbors by the container's `spacing`. A positive list rather than
// "anything that isn't a text block": inline-level children (buttons, inputs, links, spans) sit in a
// line of text, where a vertical margin would only stretch that line.
export const PROSE_SPACED_SELECTOR =
  "e-row, e-column, e-flex, e-grid, e-prose, div, article, section, aside, main, nav, header, footer, form, fieldset, address"

// Text blocks whose HTML content model is inline content only ("phrasing content", never blocks). A
// flex element placed directly inside one of them can only be part of that text, so
// ui/layout.css.tsx makes it inline-flex there. Elements that also accept blocks (li, dd, td, th,
// blockquote, …) are excluded: a flex element there may be block content.
export const INLINE_ONLY_TEXT_BLOCK_SELECTOR = "p, h1, h2, h3, h4, h5, h6, pre, summary, legend"
