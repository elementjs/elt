# Audit results — work log (seventh pass)

Temporary companion of [audit-2026-10.md](./audit-2026-10.md), merged into it and deleted when you ask for the reconciliation.

Committed before this pass: `f240aeb` (`hidden` hides every element, the `select.tsx` workaround removed), `305544a` (docs code example panels back in the packed column).

This pass (your answers on A10, U18, U25-U28) ran in three parallel agents: date field (U25, U26), `color-scheme` (U27), `packed` and hidden children (U28). All merged (uncommitted). Full run: 837 Playwright tests pass (after the test fix below); 74 bun tests pass; root and docs `tsc` clean.

### A10. Left as it is (b)

### U18. `dl` row gap: kept at `nudge-4` (a)

### U18. Prose margins: done (a)

`ui/AGENTS.md` ("Theme values only"): the exceptions, text measures rather than spacing steps, are the list indent (`3ch`) and the margins between the text blocks of a prose container (`em` / `lh`).

### U18. Where `.alpha` is used

Nine places, all in `ui/`:

| File | Rule | Value |
| --- | --- | --- |
| `typography.css.tsx` | `h6` text | `text.alpha(0.7)` |
| | `blockquote` left bar | `text.alpha(0.35)` |
| | `blockquote` text | `text.alpha(0.75)` |
| | `dd` text | `text.alpha(0.8)` |
| | `figcaption` text | `text.alpha(0.6)` |
| | inline `code` background | `text.alpha(0.08)` |
| | `mark` background | `tint.alpha(0.45)` |
| `form.css.tsx` | button bevel, light edge | `light_bg.alpha(0.2)` |
| | button bevel, dark edge | `light_text.alpha(0.2)` |

Also `Mix.from(…, alpha)` (with an alpha argument) goes through `.alpha` internally. Before the audit, the typography ones were `color-mix(currentColor …, transparent)` and the bevel was `rgba(…)`: the same see-through colors, written by hand.

> ❓ **Question**: With that list, do we keep the wording of rule 3 of `elt-ui-rules.md` and of "Color theory" in `ui-theme.md` § Why (no transparency, except shadows, deliberate effects such as the selection highlight, and `.alpha` for muted text that must follow inverted bands or a light fill over a surface)?
> **a)** Keep.
> **b)** Restrict `.alpha` to typography (the bevel becomes an opaque mix) and say so in the rule.
> ➡️(a) Typography's faded text and fills need to follow what is behind them; the bevel is a shading effect, close to a shadow, which the rule already allows.

### U25. Done

- `ui/date-input.ts`: in the AM/PM part, a letter goes through the per-character path (keyboard and on-screen keyboards). It is lower-cased with the field's locale and compared with the localized AM and PM texts (new `day_period_texts(locale)` in `date-format.ts`). When exactly one text starts with the letters typed, it is set and the next part is selected (the last part stays selected).
- Locales where one letter cannot decide: letters are collected until only one text matches; the value stays as it is meanwhile. ms: `p` alone changes nothing, `pt` gives PM, `pg` AM. ko 오전/오후, ja 午前/午後, tr ÖÖ/ÖS, si need it too (but ko and ja typing normally goes through the input method, not this path). A letter that continues neither text starts a new collection, or is ignored.
- Existing bug fixed on the way: reading the field decided PM from the first character of the PM text only. In ja, ko, tr and si an AM time read back as PM: a ja field showing 午前08:00, focused then left, set the model to 20:00. It now compares with the AM and PM texts as the field writes them.
- Tests (`tests/date.pw.ts`): ja AM survives focus and blur; en-US `p` / `a` / `P` / `A` by keyboard and by the on-screen keyboard path; `x` changes nothing; ms `pt` / `pg`; ko 오 then 후. 7 of the 9 fail on the old code (the other two check that nothing changes).

### U26. Done

`ui/date.tsx`: the `<input>` has `inputmode="numeric"` when the layout has no AM/PM part; otherwise (or before the locale is known) the attribute is removed. It follows the layout, so a live `am_pm` change updates it. Tested (24-hour en-GB, 12-hour en-US, a live `am_pm` toggle). `ui-widgets.md` describes the AM/PM letters and the number pad.

> ❓ **Question**: Found, not fixed (older): the AM/PM part is always 2 characters wide, so longer texts are cut: es-MX `a.m.` shows `a.`, ms `PTG` shows `PT`, ne `पूर्वाह्न` shows two characters. And an empty AM/PM part (`--`) reads as AM, so a 12-hour field is never "incomplete" because of it. Do we fix them?
> **a)** The AM/PM part is as wide as the longest of the two texts in the locale; an empty AM/PM part makes the field incomplete like any other empty part.
> **b)** Leave them.
> ➡️(a) A cut text is unreadable in those locales, and an empty part that silently means AM is a wrong value.

> ❓ **Question**: Found, not fixed (older): digits in other scripts (ar-EG `٠٨`, fa, hi…) are not accepted when typed (not checked: whether the field shows its own digits in that script). Do we accept them?
> **a)** Yes: map any Unicode decimal digit to its value (`\p{Nd}`) in the per-character path.
> **b)** No.
> ➡️(a) A user whose keyboard types those digits can then fill the field.

### U27. Done

- `ui/theme.tsx` `scheme_class()`: `color-scheme: light`, `dark`, or `light dark` (the default class).
- `ui/form.css.tsx`: the rule that inverted the date / time picker icon under `@media (prefers-color-scheme: dark)` is removed. It was an older workaround for the same problem, and it followed the system, not the forced theme: forced dark under a light system gave a black icon on a dark field; forced light under a dark system, a white icon on a white field. Now the icon is right in all four cases.
- `docs/src/code-example.tsx` `tokenColorClass`: one `color: light-dark(light, dark)` per class, no scheme-class selectors. A forced-light area inside a dark one now gets the light code colors (before, the dark ones). `light-dark()` needs Chrome 123, Firefox 120, Safari 17.5.
- `docs/md/ui-theme.md` (Setup, and the `class_*_scheme` row): each scheme class sets `color-scheme`, so scrollbars, native control parts, system colors and `light-dark()` follow the scheme, also in a subtree with its own scheme class.

Measured on a page of controls, 11 computed colors per element, system light / dark × forced default / light / dark, before and after: elt/ui's own rules still win everywhere (body, inputs, textareas, buttons, the restyled checkbox, links, code, kbd, mark, fieldset, placeholder). Changed, in a dark scheme only, the native parts elt/ui does not style: radio, range and progress (drawn dark), the color input's border, the selected option of a multi-line select, the file input's button. The light scheme is pixel-identical, apart from the date / time icons. Scrollbars: the `* { scrollbar-color }` rule of the reset already colors them inside a scheme class (pixel-identical); `color-scheme` only reaches scrollbars outside one (`<html>`, iframe documents).

> 🔎 **Assumption**: U27. An iframe in a dark scheme whose document does not paint its own background now shows a light backdrop (the browser paints an opaque one when the iframe's scheme differs from its document's). Before, such a document showed black text on the dark page (unreadable). The docs' full examples paint their own background; not checked with a screenshot.

Tests: new `tests/color-scheme.pw.ts`, 12 tests: body `color-scheme` per forced theme and `Canvas` under forced dark (fail on the old code); a forced date field is pixel-identical under both system schemes (fails with the old invert rule); a code token's color in the four cases (pass on the old code too); nested light-in-dark (fails on the old code) and dark-in-light.

### U28. Done without the costly part (your answer: option b)

- Kept from the agent's patch:
  - `ui/selectors.ts`: `HIDDEN_SELECTOR = '[hidden]:not([hidden="until-found" i])'`, used by the reset and by `packed`.
  - Bug fixed: a hidden child with a meaningful border (a tint button) still made the next child drop its leading edge, so no line showed between its neighbors. A meaningful child counts only when displayed; 0, 1 or 2 hidden children between it and the next displayed child are handled (3 or more: a 2px line).
  - Packed grids: hidden first / last rows, and hidden first / last cells of a row, are skipped (`:nth-child(1 of …)` instead of `:first-of-type` / `:first-child`). Measured cost for a 50-row grid: 2.7 → 3.4 ms per insertion at either end (grids already paid for `:first-of-type` / `:last-of-type`).
- Discarded: packed rows and columns keep `:first-child` / `:last-child`. A hidden first or last child still counts; `ui-layout.md` § packed says so (use `If`), and why (each insertion at the end of a long packed row or column would restyle all the children before it).
- Tests (`tests/packed.pw.ts`, "packed and hidden children"): hidden middle child of a row and a column, with and without `border`; the hidden meaningful child; a meaningful child followed by 1 or 2 hidden ones; the packed grid with hidden first / last rows and a hidden last cell; `until-found`.
- The patch file is deleted.

### A test that depended on the padding of a field

`editor/grid.tsx` (`packed="widget"` → `packed="nudge-4"`) and `editor/shell.tsx` (`seamless` on the header row) changed on disk on 5 October at 09:11 (yours; left uncommitted). With them, `tests/editor/context-menu.pw.ts` "Edit: Copy, Cut and Paste…" failed: it right-clicked the field 6px from its left edge to put the caret before the text, and that was the field's padding (6px); with `nudge-4` the padding is 4px, the click landed after the first character, and the paste gave `" AdaLovelace"`. The test now computes the click's x from the field's own border, padding and font (`measureText` of the text before the wanted character), so a change of padding or font size does not move it. It passes with and without your edits. (`data-testid` would not help: the field was already found by its row; what moved was the position inside its text.)

### Small fix: `hidden="Until-Found"`

The reset rule matched `until-found` case-sensitively; the browser's own rule does not. Now `[hidden]:not([hidden="until-found" i])`. `tests/reset.pw.ts` checks `Until-Found` too.
