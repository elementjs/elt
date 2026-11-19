# Release 4.0 — implementation spec

Decided in a grilling session on 2026-11-18. Temporary: each part moves into `docs/md/` (and `CHANGELOG.md` / `migrating.md`) as it lands; the file is deleted once everything is done. Check items off as they land.

Order: rc.1 under `next` once sections 1–5 and 7 are done, Discovery migrated to it, then 4.0.0 once section 6 is done.

## 1. API surface (breaking)

- [x] `package.json` `exports` names each public entry point, no `*`: `.` (core), `./mutative` (docs tell apps to `import "elt/mutative"`), `./ui`, each public `./ui/<module>` (at least the ones apps import today: `icons`, `theme`, `select`, `popup`, `keymap`, `date`, `list-nav`, `textarea`; decide the rest module by module), `./editor`. `./*` (every core file) and `./editor/*` go.
- [x] Helpers shared between ui modules moved out of the public modules: `CHECK_POINTS`, `focus_when_shown`, `observe_layout` into `ui/internal.ts` (the editor imports it by relative path), `ambient_surface_mix` and `spacing_steps` into `ui/layout.css.tsx`. `stroked` and `dot` stay public, documented with `icon()` (`ui-widgets.md#icons`). `ui/index.tsx` keeps `export *`: every public module now exports only public names, so a list would repeat them.
- [ ] `editor/index.tsx` names what `elt/editor` exports (it already names most; `schema` and `shell` are `export *`). Deferred while the editor is unstable, with putting it back in `tests/exports.test.ts`.
- [x] `tests/exports.test.ts`: every value export of every entry point is named in `docs/md`. Types are left out, so are names starting with `_` or `sym_` (internal by convention, `elt-rules.md#naming`), and `elt/editor` while it is unstable. Done for it: `node_do_connected`, `node_do_disconnect`, `node_attach_shadow` (marked `@internal`) got the `_` prefix; `Reactivation` is no longer exported (callers see a `Promise`); the `node_*` helpers have a reference table in `decorators.md#writing-your-own-decorator`; `Router`, `ServiceHelper`, `ServiceHelperBase`, `ServiceResult` (`app.md`), `CSSBuilder` (`css.md`) and `EltWrapper` (`custom-elements.md`) are named in the docs.
- [x] `RouterOptions` exported from `elt`: it already was (`src/app/app.ts` re-exports it); the TODO entry was stale.
- [x] `peerDependenciesMeta`: `mutative` and `@floating-ui/dom` optional. The `elt/ui` docs say `@floating-ui/dom` is required there.
- [x] `package.json` `description` filled in.

## 2. Removals (breaking, each one gets a line in `docs/md/migrating.md`)

- [x] `$scrollable` (`src/decorators.ts`) and its docs section (`decorators.md#touch-scrolling-scrollable-deprecated`).
- [x] `$inserted` (alias of `$connected`).
- [x] `DateTimePickerAttributesBAse` (typo alias, `ui/date.tsx`).
- [x] `e-prose variant="vertical"` (typed, no CSS).
- [x] `Search` (`ui/search.tsx`): it takes no props, an app writes it more easily than it configures it. Can come back later as a real search form.
- [x] `e-widget="switch"` → `input[type=checkbox][role=switch]` carries the switch look.
- [x] `e-widget="tab"` → `role="tab"` (set by `tab_strip`, section 4). `tab-close`, `toggle`, `field` and `label` stay `e-widget` values (no matching role).
- [x] `docs/md/elt-ui-rules.md` gets the rule: style on an ARIA role only when the role and the look can't differ (a switch-looking checkbox must be announced as a switch, and the other way round). Menus stay off roles.
- [x] Editor: `breadcrumb` → `out_breadcrumb` (`editor/shell.tsx`, `docs/md/object-editor.md`). The docs say semver does not apply to `elt/editor` while it is unstable.

## 3. Bugs

- [x] Nested `surface` (done: `--e-surface-level` is now one inherited `<number>`, "the level here"; a surface reads its parent's level with style queries (`PARENT_SURFACE_LEVEL_QUERIES`, `ui/theme.tsx`), since no `var()` chain can read a parent's value of a property the element redefines; the relay and `--e-current-surface-level` are gone; regression test in `tests/theme.pw.ts`, checked in Firefox too). Was: a `surface` element that is the direct child of another one paints nothing and its descendants lose their level (a cycle: the parent's `& > * { --e-surface-level: var(--e-surface-level-relay) }` reads the relay on the child, which a `surface` child redefines from its own level). Expected (docs `ui-theme.md#surfaces-and-levels`): one level above the one it sits in, as it already is with an element in between. First idea: the child computes its level from its parent's through an `inherit`-based registered property instead of reading the relay on itself. Regression test: direct child, grandchild, element in between.
- [ ] `date.tsx:311` comment says `aria-selected`, code uses `aria-pressed`: settled by section 6 (grid → `aria-selected`).

## 4. elt/ui keyboard and ARIA (before rc.1)

The library sets the ARIA; apps don't have to know it.

- [x] `popup()` (also: an `opener` option, the control announced as opening it, `null` for a combobox; a content that isn't a menu/listbox/tree/grid makes a `dialog` named by `label`, its first heading, else the anchor's text; focus moved by the pointer doesn't close it, only Tab, so menus can be crossed on the way to a submenu): sets `aria-expanded` on its opener while open. Moves focus into its content (first focusable element, else the popup itself); Tab leaving it closes it. An option turns both off (tooltips).
- [x] `menu_nav` (the opener's `aria-haspopup` is set by `popup()`, from the content's role; Tab closing comes from `popup()`; the editor's own ArrowRight handler is gone): sets `role="menu"`, and `aria-haspopup="menu"` on the opener. Tab closes the menu. ArrowRight/ArrowLeft open/close a submenu (the docs describe submenus).
- [x] Tabs (done as `tab_strip(o_selected)` in `ui/tabs.tsx`, returning the decorators `strip`, `tab(value)` and `panel`; arrows select at once; Delete clicks the close button; the panel is a Tab stop; tests `tests/tabs.pw.ts`): `role="tab"` replaces `e-widget="tab"` (the look follows the role, the selected look `aria-selected`, not `aria-pressed`); `tablist`/`tab`/`tabpanel` roles, `aria-selected`, arrow keys and Home/End between tabs. Shape to design (a decorator on the strip, like `menu_nav`, is the first idea).
- [x] `$resizable` (10px per arrow, 50px with Shift; named by `o_ui_labels.resize`): the handle becomes a focusable `role="separator"` with `aria-orientation`, `aria-valuenow`/`min`/`max`; arrow keys resize, Home/End go to the limits.
- [x] `ScrollColumn` (the ▲/▼ buttons are named "Decrease"/"Increase" and have no Tab stop, instead of hidden: a focusable element can't be `aria-hidden`): `role="spinbutton"` named by its unit, `aria-valuenow`/`valuetext`/`min`/`max`; Up/Down, PageUp/PageDown, Home/End. The ▲/▼ buttons stay for the pointer, hidden from screen readers. `TimePickerPanel` passes the unit names.
- [x] `show_dialog`: `DialogOptions.label?: o.RO<string>` sets `aria-label`; without it, the first `h1`–`h6` of the content (given an `id` if it has none) names it through `aria-labelledby`; neither: `console.warn`. The heading is looked up once, at opening. Docs: `ui-overlays.md#show_dialog`, examples get a heading.
- [x] Labels table (done as `o_ui_labels` in `ui/labels.ts`, exported from `elt/ui`: an observable, so a language change reaches the widgets on screen; docs `ui-widgets.md#texts-of-the-widgets`): the library's own button texts (year arrows, time steps, Clear, …) come from a table with English defaults that the app can override (on the theme or a locale object: to decide while implementing, next to the date picker's existing `locale`).
- [x] Icons: `aria-hidden` on the svg (on the icon's span). A lint rule in `lint/` reports an icon-only button with no `aria-label`/`title`.
- [x] Select (named from its `<label>` or the `aria-label`/`aria-labelledby` given to it; Tab out closing comes from `popup()`): `aria-controls`, a name on the listbox, a way to pass `aria-label`/`aria-labelledby`, Tab closes the list; completion: Alt+ArrowUp closes.
- [x] DateTimePicker buttons (named from `o_ui_labels`; the field's description is `aria-description`): `aria-haspopup="dialog"`, `aria-expanded` (from `popup()`). Date text field: can be named; its description says Up/Down step the segment.
- [x] Calendar and time popups (cheap part; the popup is named by its button): focus moves in (from `popup()`), `role="dialog"` with a name, each day named with its full date, `aria-current="date"`, named year buttons.

## 5. Tests, CI

- [x] `playwright.config.ts`: Chromium, Firefox and WebKit projects. `just test` runs Chromium; `just test-all` runs all three (WebKit through Docker on this machine, as `just test-webkit` does).
- [x] One full run in the three browsers before rc.1; fix what fails. Done 2026-11-18: Chromium and Firefox 1811 pass, WebKit 902 pass (skips: browser-specific tests). Fixed in elt: a frozen editor table stretched to its container in Firefox (`width: max-content`), a docs example's error showed no message in Firefox, a focused node moved by a verb lost its focus in WebKit (no `moveBefore`: focus and caret given back). Fixed in the tests: console text rebuilt from the logged values, Firefox's scroll-linked hint ignored, a clipboard of the page's own, touch screen (`hasTouch`; skipped on WebKit), drags kept inside the window, rows given an area, the display-scale test Chromium-only, a font-independent length check.
- [ ] GitHub Actions: `just check` and `just test` (three browsers) on pushes and pull requests.

## 6. Before 4.0.0

- [ ] Calendar: the full date picker grid pattern (`grid`/`gridcell`, `aria-selected`; arrows by day/week, PageUp/PageDown by month, Shift for the year, Home/End for the week).

## 7. Release

- [ ] `CHANGELOG.md`, shipped in the package (`files`): starts at 4.0, sums up what changed since 3.x, points to `docs/md/migrating.md`.
- [ ] Docs site on GitHub Pages at `elementjs.github.io/elt/`:
  - `DOCS_BASE` (default `/`) picks the base path: `bun build --public-path`, the router's `base` (through a macro returning `process.env.DOCS_BASE ?? "/"`), the links `urlFor()` writes in `docs/src/macro.ts`.
  - `docs/build.ts`: `Bun.build` with `publicPath`, then one copy of `index.html` per route (`<route>/index.html`, from the route list the macro writes), `404.html`, `.nojekyll`. `just build-docs` runs it with `DOCS_BASE=/elt/`; `check-compile` uses it without.
  - A workflow deploys it with `actions/deploy-pages` on `v*` tags, plus a manual trigger.
- [ ] npm publishing stays manual.

## 8. Housekeeping

- [ ] Merge `specs/audit-2026-10-results.md` into the audit spec and delete the audit specs.
- [ ] `specs/ui-validity.md`: check nothing is missing from `decorators.md`, delete.
- [ ] `specs/changes.md`: the `out_*` lint rule; delete once done.
- [ ] `TODO.md`: drop the stale entries (the `packed`/`label` failures pass now; `ui/animation.tsx`, `menu.tsx`, `specs/object-editor.tsx` no longer exist), the ones this spec covers, and run the stale-name audit.
- [ ] `typedoc.json` removed (typedoc isn't installed).
- [ ] `docs/md/components.md` unwrapped.
