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
  'input[type="search"], input[type="email"], input[type="url"], input[type="tel"], ' +
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

// A field whose value is wrong (docs/md/ui-forms.md#invalid-fields): the browser's own checks
// (:user-invalid — required, type, min/max, pattern, setCustomValidity — once the user has edited the
// field and left it, or tried to submit), or the app's (aria-invalid="true"). A control directly
// inside an element marked aria-invalid counts too: the Select widget, or an app's own composite
// widget, carries the attribute on its root, around its button or input.
export const INVALID_SELECTOR = ':is(:user-invalid, [aria-invalid="true"], [aria-invalid="true"] > *)'

// Children whose border carries meaning: a variant's color or a state (docs/md/ui-layout.md#packed).
// In a packed row or column without its own border, such a child keeps the border it shares with
// the next child, which gives up its own there: a checked toggle's tint edge shows on both sides
// instead of hiding behind a plain neighbour's. Two such children side by side: the first one's
// border wins. The ARIA states are listed so an app's own widgets get the same treatment by marking
// their state. Disabled children are excluded: a disabled control is furniture.
export const MEANINGFUL_BORDER_SELECTOR =
  ':is(button[e-variant="tint"], button[e-variant="inverted"], input[e-variant="tint"], ' +
  'label[e-variant="toggle"]:has(> input:checked), ' +
  '[aria-pressed="true"], [aria-selected="true"], [aria-current]:not([aria-current="false"]), ' +
  `${INVALID_SELECTOR}):not(:disabled, :has(> input:disabled))`

// Elements the reset hides (`display: none`, ui/reset.css.tsx). hidden="until-found" is left out:
// the browser keeps its box (content-visibility: hidden) so that find-in-page can reveal it, so it
// still takes up room in a layout and counts as a child (docs/md/ui-layout.md#packed).
export const HIDDEN_SELECTOR = '[hidden]:not([hidden="until-found" i])'
