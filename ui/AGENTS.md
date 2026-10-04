# elt/ui — maintainer notes

This file is for changing the `ui/` library itself. To *use* `elt/ui`, start at [`docs/md/index.md`](../docs/md/index.md) → [`docs/md/elt-ui-rules.md`](../docs/md/elt-ui-rules.md); those rules apply to `ui/`'s own code too.

## When modifying `ui/`

- **Do not add dependencies.** `@floating-ui/dom` (popups) is the only one, as a peer dependency.
- **Icons:** copy SVG paths from the **elt-phosphor** package (e.g. from `docs/node_modules/elt-phosphor`) into `ui/icons.tsx`; never depend on it. If it isn't installed, ask the human.
- **Native HTML first.** Style native elements with CSS; add a component only when native elements can't give a consistent result.
- **Promotion threshold:** an app pattern becomes a `ui/` widget only once a second app needs it.
- **New public widgets:** match form sizing (`formFontSize`, `widget`-step padding), radius (`theme.css_radius`), focus ring and color helpers of existing controls. Add Playwright tests under `tests/` for non-visual behavior.
- **Leaving nodes are still siblings:** a node playing its exit (`$leave`) still matches `:first-child` / `:last-child` until it is removed. `ui/` accepts the brief glitch; where it shows (the packed-layout seams and corners in `layout.css.tsx` are the first candidates), the fix and its measured cost are in [`motion.md`](../docs/md/motion.md#css-that-depends-on-sibling-position).
- **Theme values only:** every padding, gap and radius in `ui/` reads a named spacing step (`theme.settings.spacing*`, `theme.css_pad`/`css_spacing`/`css_radius`); every color goes through `theme.colors.*` or a `Mix` built from them (no `rgba(...)`, no hex). Exception: a list's indent (`ul, ol { padding-inline-start: 3ch }` in `typography.css.tsx`) is a text measure, not a spacing step. A faded color or a light fill that must let the surface underneath show through is a theme color at an opacity, built with `Mix.alpha` (typography's faded text and fills in `typography.css.tsx`, the bevel in `form.css.tsx`), not `color-mix(… currentColor …, transparent)`.
- **Keep docs aligned:** when the public surface or semantics change, update [`elt-ui-rules.md`](../docs/md/elt-ui-rules.md) when a rule changes, and the `ui-*.md` topic page of the subject (how-to, tables, and its "Why" section for a change in reasoning). Code comments point to these docs, not to `specs/`.

## Entry points

[`theme.tsx`](./theme.tsx) (`Theme`, `Mix`), [`layout.css.tsx`](./layout.css.tsx) (layout attributes), [`form.css.tsx`](./form.css.tsx) (native controls), [`typography.css.tsx`](./typography.css.tsx) (text appearance, prose containers), [`selectors.ts`](./selectors.ts) (selector lists shared between those).
