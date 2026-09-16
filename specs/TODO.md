# Object Editor — spec TODO

Config surface gaps found in `schema.tsx` against `ui-object-editor.md`. Not binding spec text — a checklist to work through. Check items off (or delete them) as they land in both files.

## Named in prose, missing from code

These are the highest priority — the spec already promises the behavior, nothing exposes it.

- [x] **`conversions` allow-list.** Wired in `type-change.ts` + composite toolbar; map/set/array cross-targets via `type_change_extra`.
- [x] **Array/Set new-item default.** `item_default` + transient insert rows in Array/Set list UI.
- [ ] **Object key rules.** Unknown-mode add/remove/transient commit + RegExp catch-alls landed. **Autocomplete-only rename flow still open.**
- [x] **Toolbar opt-outs.** `CommonNodeOptions.toolbar` in `composite-toolbar.tsx`.
- [ ] **`open_as` (popup vs. column per node).** Types + `ShellOptions.prefer_popups` on shell; **popup open path not wired yet.**
- [x] **Table manual `columns`.** Basic table mode with manual/auto columns, sticky header, extra-keys warning (no resizable headers yet).
- [ ] **Map key-type-change gate.** Map row UI landed; **`allow_key_type_change` menu wiring still open.**
- [x] **`undef()` combinator.** Exported.
- [ ] **Masked single-line text input.** No `elt/ui` masked component confirmed yet.
- [x] **Toggle/on-off-buttons boolean presentation.** `BooleanOptions` forwards `e-variant`; default switch.

## Noticed independently, not yet named in prose either

- [x] `NumberOptions.step` — forwarded via `NumberOptions extends attrs_input` (ADR 0001).
- [x] `NumberOptions` NaN/Infinity opt-in field — **`allow_non_finite?: boolean`** (default false).
- [x] `DatetimeOptions` under-exposes `elt/ui`'s `DateTimePicker` — **`DatetimeOptions extends DateTimePickerAttributesBAse`**; factory-only `nullable`/`date`/`time` aliases remain.
- [x] `PropertyOption.name: RegExp` — runtime catch-all resolution in `ObjectFactory` (ADR 0002); amend prose in `ui-object-editor.md`.
- [x] **Scalar `canConvert`/`convert` heuristics — provisional for v1.** Accept current bodies as shipping baseline; deliberate review pass still open before calling v1 done.

## Design decisions bundled into the above

- [x] `toolbar`, `open_as`, and `conversions` — **`CommonNodeOptions`** intersected into all composite `Options` types.

## Open design questions (in discussion, not yet decided)

- [x] **Forward widget options from `elt/ui` almost as-is.** Landed for scalar factories via ADR 0001. **`select` wired**; **`color` still stubbed** (see `specs/ui-color-picker.md`).
- [x] **Form validity, feeding `o_error` from the DOM Constraint Validation API.** Landed on `$bind.*` — see `specs/ui-validity.md`.

## Done

- [x] **Conversion model simplification.** `canHandle` / `canConvert` / `convert` / `defaultValue` on each `Factory`.
- [x] **`INVALID_MOUNT` safe-child helper.** `editor/mount.ts`; object/array/map/set/table projections; shell clause (a).
- [x] **Shell undo/redo.** `editor/undo.ts` + toolbar buttons on `ObjectEditorShell`.
- [x] **Set / Map list UI (basic).** Insert/remove rows, search toolbar, composite previews on nested values.
- [x] **Array list UI.** Insert/remove, `item_default`, composite previews; table branch for uniform object rows.

## Still deferred (needs decision or larger slice)

- [ ] **Import/export add-ons** — empty menu slot only; spec question on v1 floor unresolved.
- [ ] **`ColorInput` / `color()` widget** — blocked on `specs/ui-color-picker.md`.
- [ ] **Drag-and-drop reorder** (`allow_reorder`) — no DnD in editor yet.
- [ ] **Propagate ADR/grill prose into `ui-object-editor.md`.**

## Quick wins (landed)

- [x] **`open_as` popup opens** — shell uses `elt/ui/popup`; stack + breadcrumb unchanged.
- [x] **Constructor registry** — `editor/registry.ts`; shell drill-in fallback; builtins registered in `schema.tsx`.
- [x] **VirtualScroll** on all composite body lists (object keys, array/set/map rows + transients, table body). `Repeat` kept only for table column iteration and the shell column strip.
- [x] **Table resizable columns** — `editor/table-resize.ts` (`$resizable` on data `<th>`).
- [x] **Map key type-change menu** — `safe_map_key` + `render_type_change_menu_button` when `allow_key_type_change !== false`.
