# elt — TODO

Open items carried over from specs that were folded into `docs/md/` and deleted. Object editor items live in `specs/TODO.md`.

## elt/ui

- [ ] **Multi-select readability.** Re-check the selected-row treatment (tint surface + 3, docs/md/ui-theme.md#state) once a real multi-select widget exists: "reads fine in principle" isn't guaranteed to survive five selected rows on screen.
- [ ] **Overflow menu for bars.** A decorator that moves the actions that don't fit in a bar into a "…" menu as the window narrows (measured with a `ResizeObserver`, actions ordered by priority). Today the docs tell apps to choose the menu's actions when designing the bar (docs/md/ui-layout.md#bars).
- [ ] **Buttons shrink below their label in a narrow row.** Layout elements give every child `min-width: 0`, so a button in a row that runs out of space is squashed and its label overflows. `[e-ellipsis]` works around it in bars by taking the shrinking (`flex-shrink: 10000`); controls may want `flex-shrink: 0` in rows generally.
- [ ] **Editor bars vs. the emphasis model** (docs/md/ui-theme.md#emphasis). `editor/shell.tsx:310`: every editor's header line is tint-inverted, so nested editors stack several tint bands on one screen; a nested one should probably be a neutral surface. `editor/schema.tsx:1264`: the table header is on `tint-2`, which is furniture on tint; should be `neutral`. `editor/composite-toolbar.tsx:127`: a row with a button and a search field on a `neutral-1` band: acceptable as a secondary bar, check it once the above are settled.
- [ ] **Shadow tokens.** Add `shadow-cast` tokens (name favored, not locked) for overlay lift, and migrate `ui/dialog.tsx`/`ui/popup.tsx` off their hardcoded `rgba(...)` shadow/backdrop values onto them. The bevel system (`shadow-raise`/`-drop`) stays scoped to individual widgets.
- [ ] **Property browser column alignment.** Migrating off `<menu>` lost the icon/column alignment that `menu.tsx`'s grid/subgrid gave the property browser (`specs/object-editor.tsx`). `packed` is a flex mechanism and doesn't replace CSS grid.
- [ ] **ARIA composite widget keyboard model.** Popup rows carry `role="menu"`/`"menuitem"` or `role="listbox"`/`"option"` (`ui/select.tsx`), and the docs nav is a real `<nav aria-label="…">`. These roles formally require roving-tabindex arrow-key navigation and focus management, which isn't implemented.
- [ ] **Appear/disappear motion rule.** Write the local rule: trigger conditions, duration/easing tokens, reduced-motion handling (partly covered by `prefers_reduced_motion()` in `ui/animation.tsx`).
- [ ] **Stale-name audit.** The old-name → new-name migration (now in `docs/md/migrating.md`) only inventoried Color-axis call sites; a dedicated pass is still needed to confirm no other stale Spacing/Layout references remain.

## Hard-don't follow-ups

- [x] **`sym_closed`.** Removed: a popup or dialog closed with no result (dismissed, or cancelled by the content) resolves `undefined`; `T` defaults to `boolean` and excludes `undefined`. `Deferred` renamed `Future`.
- [ ] **Alerts.** To design: they need a container (an alert host) to be `show`n in; how `show_alert` finds it is open.
- [ ] **Layout CSS in `editor/`.** Audit against `docs/md/ui-hard-dont.md#check-before-you-write`: `cls_text_fill` still serves the filter field and the preview inside a button; `.oe-column` (`flex: none`), `.oe-popup-panel`, `.oe-grid-scroll`, `.oe-grid` (font size and line height) and the `.oe-*` menu classes were not audited yet for a layout attribute that does the same.
- [ ] **Layout CSS in `ui/`** is exempt from the check but not audited either.
- [ ] **`just check` covers `ui/`, `editor/` and `docs/src/` with the Biome plugins** (`lint/`); `src/` and `tests/` are exempt. `ui/index.tsx` (`addObserver` on `document.body`'s theme class), `ui/theme.tsx` and `ui/icons.tsx` carry a `biome-ignore` with the reason.

## Found while rewriting the docs (not fixed)

- [ ] `e-prose`'s `variant="vertical"` is typed but no CSS handles it.
- [x] `show_dialog` and `popup` return a `Future<T | undefined>`: the docs say so (`ui-overlays.md#the-future`).
- [ ] `RouterOptions` (`src/app/url-source.ts`) isn't re-exported from `elt`, although apps pass it to `app.setupRouter`.
- [ ] `@attr` (custom elements) only works with legacy decorators; with `target: es2022` a property initializer silently shadows the decorated property. Docs tell users to use `declare` with no initializer and set defaults in `init()`.
- [ ] `docs/md/components.md` has hard-wrapped lines.
