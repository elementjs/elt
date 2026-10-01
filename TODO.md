# elt — TODO

Open items carried over from specs that were folded into `docs/md/` and deleted. Object editor items live in `specs/TODO.md`.

## elt/ui

- [ ] **Multi-select readability.** Re-check the selected-row treatment once a real multi-select widget exists: "reads fine in principle" isn't guaranteed to survive five selected rows on screen.
- [ ] **Shadow tokens.** Add `shadow-cast` tokens (name favored, not locked) for overlay lift, and migrate `ui/dialog.tsx`/`ui/popup.tsx` off their hardcoded `rgba(...)` shadow/backdrop values onto them. The bevel system (`shadow-raise`/`-drop`) stays scoped to individual widgets.
- [ ] **Hardcoded fieldset paddings.** `ui/form.css.tsx` still has two scale-independent paddings (`fieldset > legend`: `0 6px`; `fieldset`: `8px 16px`).
- [ ] **Property browser column alignment.** Migrating off `<menu>` lost the icon/column alignment that `menu.tsx`'s grid/subgrid gave the property browser (`specs/object-editor.tsx`). `packed` is a flex mechanism and doesn't replace CSS grid.
- [ ] **ARIA composite widget keyboard model.** Popup rows carry `role="menu"`/`"menuitem"` or `role="listbox"`/`"option"` (`ui/select.tsx`), and the docs nav is a real `<nav aria-label="…">`. These roles formally require roving-tabindex arrow-key navigation and focus management, which isn't implemented.
- [ ] **Appear/disappear motion rule.** Write the local rule: trigger conditions, duration/easing tokens, reduced-motion handling (partly covered by `prefers_reduced_motion()` in `ui/animation.tsx`).
- [ ] **Stale-name audit.** The old-name → new-name migration (now in `docs/md/migrating.md`) only inventoried Color-axis call sites; a dedicated pass is still needed to confirm no other stale Spacing/Layout references remain.

## Found while rewriting the docs (not fixed)

- [ ] `hr[e-variant="tint"]` sets `border-color` on an `hr` whose own rule sets `border: none`, so it does nothing; `e-variant` isn't typed for `hr` either.
- [ ] `e-prose`'s `variant="vertical"` is typed but no CSS handles it.
- [ ] The `Theme` constructor's guard uses `||`, so it only throws when `bg`, `text` and `tint` are *all* missing; the docs say all three are required.
- [ ] `show_dialog` is typed as returning `Promise<Future<T>>`, but awaiting it yields `T | undefined`.
- [ ] `RouterOptions` (`src/app/url-source.ts`) isn't re-exported from `elt`, although apps pass it to `app.setupRouter`.
- [ ] `@attr` (custom elements) only works with legacy decorators; with `target: es2022` a property initializer silently shadows the decorated property. Docs tell users to use `declare` with no initializer and set defaults in `init()`.
- [ ] `docs/md/components.md` has hard-wrapped lines.
