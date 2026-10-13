// Native controls styled by ui/form.css.tsx's shared control-reset ruleset (appearance, padding,
// border, border-radius, focus ring, transitions). Deliberately includes button[e-emphasis="link"] —
// it still needs the shared font-size/focus-ring/transition rules from that ruleset, even though a
// later, more specific rule then strips its border/padding back to 0; excluding it here would lose
// the focus ring and font-size, not just the border. An `<a>` is one only when it asks for an
// emphasis other than `link` (a nav item, a link styled as a button), and an element with
// `e-widget="field"` (an editable element that looks like a text input) is one. Excludes
// input[type="checkbox"] — it still renders a border, but gets its own custom appearance
// (ui/form.css.tsx) instead of this shared treatment.
export const FORM_CONTROL_SELECTOR =
  "button, " +
  'input:not([type]), input[type="text"], input[type="number"], input[type="password"], ' +
  'input[type="search"], input[type="email"], input[type="url"], input[type="tel"], ' +
  'input[type="button"], input[type="submit"], input[type="reset"], ' +
  'input[type="date"], input[type="time"], input[type="datetime-local"], ' +
  "textarea, select, " +
  'a[e-emphasis]:not([e-emphasis="link"]), [e-widget="field"], ' +
  'label[e-widget="toggle"]'

// Controls whose text is a line the browser centers in the room it is given (a text field's inner
// editor, a native select's value): their vertical padding is room, not padding (ui/form.css.tsx,
// "Control height"), so a click anywhere along their height reaches the text.
export const CENTERED_TEXT_CONTROL_SELECTOR =
  'input:not([type]), input[type="text"], input[type="number"], input[type="password"], ' +
  'input[type="search"], input[type="email"], input[type="url"], input[type="tel"], ' +
  'input[type="date"], input[type="time"], input[type="datetime-local"], select'

// Controls whose focus ring is drawn inside their edge (ui/form.css.tsx): buttons, textareas and
// text, number and search inputs.
export const INSET_FOCUS_SELECTOR =
  'button, textarea, input:not([type]), input[type="text"], input[type="number"], input[type="search"], ' +
  'a[e-emphasis]:not([e-emphasis="link"]), [e-interactive], [e-widget="field"]'

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

// A disabled control, or one made of a disabled one: furniture, whatever its emphasis (docs/md/ui-states.md).
// `:disabled` is the browser's (button, input, select, textarea, a disabled fieldset's controls);
// `aria-disabled` is for the elements that cannot be disabled (an `e-interactive` row); a toggle is a
// label around a disabled checkbox.
export const DISABLED_SELECTOR = ':is(:disabled, [aria-disabled="true"], label:has(> input:disabled))'

// The selected state: an element that stands for a choice, a pressed toggle, or the place you are.
// Driven by ARIA, never by a class or an emphasis value, so an app's own widgets get the look by
// setting the state (docs/md/ui-states.md): `aria-pressed` (a toggle button), `aria-selected` (an
// option, a tab, a row, a cell), `aria-current` (a nav item, a step; "false" is not current),
// `aria-checked` (a custom checkbox or menu item). "mixed" is none of them. A toggle's state is its
// checkbox's. Native checkboxes, radios and switches draw their own state and are not in it.
export const SELECTED_SELECTOR =
  ':is([aria-pressed="true"], [aria-selected="true"], [aria-current]:not([aria-current="false"]), ' +
  '[aria-checked="true"], label[e-widget="toggle"]:has(> input:checked))'

// What reacts to the pointer and the keyboard as a control does: hover and press looks, a pointer
// cursor, a focus ring. The native controls that activate, and anything marked `e-interactive` (set by
// `$interactive`, ui/interactive.ts, or by hand on an element with a focus model of its own, like a
// list option).
export const INTERACTIVE_SELECTOR =
  ':is(button, a[href], input[type="button"], input[type="submit"], input[type="reset"], ' +
  'label[e-widget="toggle"], [e-interactive])'

// An emphasis that has no boundary to fill: a link is plain inline text (an `<a>` without emphasis
// is one), so the selected state cannot paint it (docs/md/ui-states.md).
export const LINK_EMPHASIS_SELECTOR = ':is([e-emphasis="link"], a:not([e-emphasis]))'

// An emphasis with no visible edge to color: a bare control keeps its transparent one in every state,
// a link has none. Their state is a fill (or nothing), so it never owns a line shared with a
// neighbour (below).
export const BORDERLESS_EMPHASIS_SELECTOR = `:is([e-emphasis="bare"], ${LINK_EMPHASIS_SELECTOR})`

// Children whose border carries meaning: an emphasis's color or a state (docs/md/ui-layout.md#packed).
// In a packed row or column without its own border, such a child keeps the border it shares with
// the next child, which gives up its own there: a selected toggle's tint edge shows on both sides
// instead of hiding behind a plain neighbour's. Two such children side by side: the first one's
// border wins. The states are listed so an app's own widgets get the same treatment by marking
// their state. Disabled children are excluded: a disabled control is furniture.
export const MEANINGFUL_BORDER_SELECTOR =
  ':is([e-emphasis="tint"], [e-emphasis="inverted"], ' +
  `${SELECTED_SELECTOR}:not(${BORDERLESS_EMPHASIS_SELECTOR}), ${INVALID_SELECTOR}):not(${DISABLED_SELECTOR})`

// Elements the reset hides (`display: none`, ui/reset.css.tsx). hidden="until-found" is left out:
// the browser keeps its box (content-visibility: hidden) so that find-in-page can reveal it, so it
// still takes up room in a layout and counts as a child (docs/md/ui-layout.md#packed).
export const HIDDEN_SELECTOR = '[hidden]:not([hidden="until-found" i])'
