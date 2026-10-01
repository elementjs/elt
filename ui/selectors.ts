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

// Block-level typographic elements: inside an <e-prose>, a run of these forms one "text run" whose
// vertical rhythm is set by ui/typography.css.tsx's own margins. Every other direct child of an
// <e-prose> (rows, columns, widgets, …) is a non-typographic child, spaced by the prose's
// `spacing` instead (see "Text runs" in docs/md/ui-guidelines.md).
export const TYPOGRAPHIC_BLOCK_SELECTOR =
  "h1, h2, h3, h4, h5, h6, p, ul, ol, dl, blockquote, pre, table, hr, figure, details"
