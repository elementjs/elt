// Elements that render a border by default — shared between ui/form.css.tsx (which paints those
// borders) and ui/layout.css.tsx (whose `touching` seam dedup needs to know what already has one).
// Keep this in sync with the selector list in ui/form.css.tsx if a new native bordered control is added.
export const BORDERED_SELECTOR =
  ':is(' +
  'button:not([e-variant="link"]):not([e-variant="text"]), ' +
  'input:not([type]), input[type="text"], input[type="number"], input[type="password"], ' +
  'input[type="button"], input[type="submit"], input[type="reset"], ' +
  'input[type="date"], input[type="time"], input[type="datetime-local"], ' +
  'input[type="checkbox"], select, textarea, ' +
  'label[e-variant="toggle"], ' +
  '[border]' +
  ')'
