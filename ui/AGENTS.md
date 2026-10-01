# elt/ui — maintainer notes

This file is for changing the `ui/` library itself. To *use* `elt/ui`, start at [`docs/md/index.md`](../docs/md/index.md) → [`docs/md/elt-ui-guide.md`](../docs/md/elt-ui-guide.md); those rules apply to `ui/`'s own code too.

## When modifying `ui/`

- **Do not add dependencies.** `@floating-ui/dom` (popups) is the only one, as a peer dependency.
- **Icons:** copy SVG paths from the **elt-phosphor** package (e.g. from `docs/node_modules/elt-phosphor`) into `ui/icons.tsx`; never depend on it. If it isn't installed, ask the human.
- **Native HTML first.** Style native elements with CSS; add a component only when native elements can't give a consistent result.
- **Promotion threshold:** an app pattern becomes a `ui/` widget only once a second app needs it.
- **New public widgets:** match form sizing (`formFontSize`, `widget`-step padding), radius (`theme.css_radius`), focus ring and color helpers of existing controls. Add Playwright tests under `tests/` for non-visual behavior.
- **Theme values only:** every padding, gap and radius in `ui/` reads a named spacing step (`theme.settings.spacing*`, `theme.css_pad`/`css_spacing`/`css_radius`); every color goes through `theme.colors.*`.
- **Keep docs aligned:** when the public surface or semantics change, update [`elt-ui-guide.md`](../docs/md/elt-ui-guide.md) (rules, how-to), [`elt-ui-reference.md`](../docs/md/elt-ui-reference.md) (tables) and, for a change in reasoning, [`ui-guidelines.md`](../docs/md/ui-guidelines.md). Code comments point to these docs, not to `specs/`.

## Entry points

[`theme.tsx`](./theme.tsx) (`Theme`, `Mix`), [`layout.css.tsx`](./layout.css.tsx) (layout attributes), [`form.css.tsx`](./form.css.tsx) (native controls), [`typography.css.tsx`](./typography.css.tsx) (`e-prose`), [`selectors.ts`](./selectors.ts) (selector lists shared between those).
