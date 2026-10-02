# Object Editor — spec TODO

Config surface gaps found in `schema.tsx` against `ui-object-editor.md`. Not binding spec text — a checklist to work through. Check items off (or delete them) as they land in both files.

## Named in prose, missing from code

These are the highest priority — the spec already promises the behavior, nothing exposes it.

- [x] **`conversions` allow-list.** Wired in `type-change.ts` + composite toolbar; map/set/array cross-targets via `type_change_extra`.
- [x] **Array/Set new-item default.** `item_default` + transient insert rows in Array/Set list UI.
- [ ] **Object key rules.** Unknown-mode add/remove/transient commit + RegExp catch-alls landed. **Autocomplete-only rename flow still open.**
- [x] **Toolbar opt-outs.** `CommonNodeOptions.toolbar` in `composite-toolbar.tsx`.
- [ ] **`open_as` (popup vs. column per node).** Types + `ShellOptions.prefer_popups` on shell; **popup open path not wired yet.**
- [x] **Table manual `columns`.** Table mode with manual/auto columns, sticky header row, resizable columns, extra-keys warning.
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
- [ ] **Drag-and-drop reorder** (`allow_reorder`) — no DnD in editor yet. Its handle goes in a leading grid column (Layer 3 "Composite grid"), added together with the feature.
- [ ] **Propagate ADR/grill prose into `ui-object-editor.md`.**
- [ ] **WebKit: `e-virtual-scroll`'s shadow root makes every row insertion re-lay out all slotted rows.** Measured on Linux WebKit (Playwright Docker image), not Safari: inserting 2 rows + one rect read costs 0.61 ms with 37 rows and 3.36 ms with 337 rows inside `e-virtual-scroll`, against ~0.1 ms in a plain `div` or in Chromium/Firefox. Accepted for now: the shadow-root padders are kept, since they are the only placement that works the same in block, flex, grid and table containers without touching the user's DOM. Known limitation of that placement: a sticky row inside the element holding the rows can't cover the padders, so it can drop when the browser draws a scroll position the list hasn't caught up with yet (very fast scrolls, main-thread stalls).

## Quick wins (landed)

- [x] **`open_as` popup opens** — shell uses `elt/ui/popup`; stack + breadcrumb unchanged.
- [x] **Constructor registry** — `editor/registry.ts`; shell drill-in fallback; builtins registered in `schema.tsx`.
- [x] **RepeatVirtual** on all composite body lists (object keys, array/set/map rows, each with its transient rows merged into the same list; table body). `Repeat` kept only for table column iteration and the shell column strip.
- [x] **Table resizable columns** — the table is a virtual `e-grid` (sticky header row); `$column_resizable` (`editor/table-resize.ts`) on its header cells replaces the column's locked width in the grid template. `$resizable` (for a `<table>`'s `<th>`) is kept but no longer used by the editor.
- [x] **Every composite is a grid** (`editor/grid.tsx`): Object/Array/Set/Map/Table share one packed bordered `e-grid`; label / key-type / value / controls columns; widgets are the row's own cells (no wrappers); columns locked after the first layout. Spec: Layer 3 "Composite grid".
- [x] **Single header line + toolbar** — `RenderableWidget.header` (label + actions) on the column's one header line, shared by columns and popups; `toolbar` (add button, filter) right under it on a neutral surface, absent when empty. Undo/Redo on the root header line (no shell toolbar).
- [x] **Widget contract: one element per widget** — `EitherFactory` renders its branch's element directly; `boolean()` wraps its checkbox in a `label` cell; nested composites are a preview-text cell. Spec: Layer 4 "Contract".
- [x] **Focus kept while typing** — child widgets re-resolve their factory only when the value's JS type changes (`o_sticky_factory`); before, every keystroke remounted the input.
- [x] **Frame ownership instead of custom CSS** — each column, its header line and toolbar are nested `packed border` containers; columns are separate frames spaced at the component step. The editor's custom classes are down to what no layout attribute expresses (text truncation, scroll height, popup size bounds, a column's no-shrink, the cells' shared font size/line height, the controls placeholder). Found on the way: the legacy HTML `align` attribute centered the text of any `align="center"` layout element — fixed in `ui/layout.css.tsx`; `input[type=search/email/url/tel]` weren't form controls (browser font and `color: fieldtext`) — fixed in `ui/selectors.ts`.
- [x] **Multiline strings grow with their content** (`$auto_grow` from `elt/ui/textarea`).
- [x] **Unknown mode Map/Set/Date** — `ObjectFactory.canHandle` no longer claims them (they rendered as Object).
- [x] **Map key type-change menu** — `safe_map_key` + `render_type_change_menu_button` when `allow_key_type_change !== false`.
