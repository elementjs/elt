// Native controls styled by ui/form.css.tsx's shared control-reset ruleset (appearance, padding,
// border, border-radius, focus ring, transitions). Deliberately includes button[e-variant="link"]/
// ["text"] — they still need the shared font-size/focus-ring/transition rules from that ruleset,
// even though a later, more specific rule then strips their border/padding back to 0; excluding
// them here would lose the focus ring and font-size, not just the border. Excludes
// input[type="checkbox"] — it still renders a border, but gets its own custom appearance
// (ui/form.css.tsx) instead of this shared treatment.
export const FORM_CONTROL_SELECTOR =
  'button, ' +
  'input:not([type]), input[type="text"], input[type="number"], input[type="password"], ' +
  'input[type="button"], input[type="submit"], input[type="reset"], ' +
  'input[type="date"], input[type="time"], input[type="datetime-local"], ' +
  'textarea, select, ' +
  'label[e-variant="toggle"]'
