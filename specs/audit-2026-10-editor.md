# Code audit — October 2026: object editor (`editor/`)

The problems that the audit of 2026-10-03 found in `editor/`, split from [audit-2026-10.md](./audit-2026-10.md) (same evidence tags; the rest of the audit is there). Each problem has an id, a location, a description and a question with possible solutions.

Evidence tags:
- **[reproduced]**: a throwaway test or script showed the problem at runtime.
- **[checked]**: a second reading of the code confirmed the problem.
- **[read]**: one reading of the code found the problem. Verify it before the fix.

When a fix changes behavior, the fix adds a regression test.

## E — Object editor (`editor/`)

### E1. Map "+ Add entry" adds a default entry at once

`editor/schema.tsx:1518-1519`. **[reproduced]** `addObserver` calls its callback at once. Unlike Array and Set, the Map callbacks do not skip `old === o.NoValue`, so `try_commit_transient` inserts `keys_factory.defaultValue()`. A map `[["a", 1]]` becomes `[["a", 1], ["", 0]]` after one click. Line `:1520` then adds the id to `o_transient_ids` after the commit removed it. `if (key === INVALID_MOUNT) return` at `:1506` is dead.

> ❓ **Question**: How do we fix it?
> **a)** Skip `NoValue` as Array and Set do; remove the dead check. (See E3 for the shared helper.)
> ➡️(a) Plain bug.

### E2. Object transient row ids can be the same

`editor/schema.tsx:987`. **[reproduced]** `` `__new_${Date.now()}` ``: two adds in the same millisecond share an id and a `transient_rows` entry.

> ❓ **Question**: How do we fix it?
> **a)** Use a module counter for all kinds.
> **b)** Use `` `t-${Date.now()}-${Math.random()}` `` as the other kinds do.
> ➡️(a) A counter is unique and cheaper than random. The shared helper of E3 uses it.

### E3. Transient row logic is copied four times

`editor/schema.tsx:951-990`, `:1137-1158`, `:1380-1402`, `:1499-1521`. **[read]** Each kind (Object, Array, Set, Map) repeats the `transient_rows` map, `o_transient_ids`, `add_transient`, `try_commit_transient` and the `render_transient` lookup, with small differences. E1 and E2 come from these differences. The `render_transient` of Object (`:1028-1032`) creates missing rows again; the others return `null`. The `try_commit` of Set (`:1388`) repeats the checks of `append_set_member`.

> ❓ **Question**: How do we factor it?
> **a)** One `transient_rows<T>(make, commit)` helper used by the four kinds; Set uses the boolean result of `append_set_member` as Map does.
> **b)** Fix E1 and E2 only, keep the copies.
> ➡️(a) It removes the cause of E1 and E2.

### E4. The value slot of a new object row comes from its placeholder id

`editor/schema.tsx:1041`. **[read]** `render_value(o_key.get() || id, o_child)` reads the key once, while it is `""`. The slot is `slot_for_key("__new_…")`: a declared property or a RegExp catch-all never gives its type to the new value.

> ❓ **Question**: How do we fix it?
> **a)** `o_key.tf(key => render_value(key || id, …))`: the value editor follows the typed key.
> **b)** Resolve the slot at commit only.
> ➡️(a) The user sees the correct editor while typing. b) can change the value type after commit.

### E5. New object keys are rejected when a RegExp catch-all exists

`editor/schema.tsx:962-969`. **[read]** When a RegExp catch-all exists, a new key that matches no catch-all and no declared name is rejected, even when `free_keys` is true (default). `slot_for_key` gives such a key the type `anything`. `declared_keys` (`:931-935`) filters again what `object_row_keys` (`:869`) filters.

> ❓ **Question**: Which rule applies?
> **a)** `free_keys: true` accepts any key; a key with no match gets `anything` (as `slot_for_key` says).
> **b)** A RegExp catch-all restricts new keys to its matches and the declared names, even when `free_keys` is true; document it.
> ➡️(a) `free_keys` then means one thing. Derive the add check from `slot_for_key`.

### E6. The "auto" table/list mode of an array is decided once

`editor/schema.tsx:1120-1122`. **[read]** `use_table` reads `o_value.get()` once at mount. An array that is empty at mount stays a list after rows are added. `eval_auto_table_for_table_mode` (`:1302-1305`) says it is "used when … table branch is wired"; the branch is wired and the method is only a test hook (`tests/editor/schema.pw.ts:184`).

> ❓ **Question**: When does "auto" decide?
> **a)** Live: the mode follows the value (table when it qualifies, list otherwise).
> **b)** At mount only; document it.
> **c)** At mount, and again only when the array goes from empty to not empty.
> ➡️(c) The view does not jump while the user edits, and an empty array still gets the correct mode.

### E7. "Change type" to Map: keys from the conversion do not match the target schema

`editor/schema.tsx:1114`, `:1366`, `:1470`. **[read]** Array and Set offer `map({ keys: string(), … })`, but `MapFactory.convert(array)` makes numeric keys `[i, v]`.

> ❓ **Question**: How do we make them agree?
> **a)** Convert with `String(i)` keys.
> **b)** Offer `keys: number()` for arrays.
> ➡️(a) String keys are the most common Map shape in an editor.

### E8. `$forward_attrs` copies `node_observe_attribute`

`editor/forward-attrs.ts:16-34`. **[read]** `node_observe_attribute` (`src/dom.ts:1083`) already accepts plain values with the same true/false/null rules. The only addition is an IDL-property path. It applies only to plain values (`min={o_min}` sets the attribute, `min={3}` sets the property) and swallows errors in an empty `catch`. Also, `skip_keys(...)` makes a new `Set` on each `render()` (`:596`, `:646`, `:691`).

> ❓ **Question**: How do we fix it?
> **a)** Use `node_observe_attribute` for all values; remove the property path; hoist the `skip_keys` sets to module constants.
> **b)** Keep the property path, apply it to observables too, and remove the empty `catch`.
> ➡️(a) Attributes are enough for the forwarded inputs, and one code path is used.

### E9. The shell and the undo ring never remove their observers

`editor/undo.ts:47`, `editor/shell.tsx:193`. **[read]** `RootUndoRing.attach()` and the `watch_column` of the root column add observers on `o_root`. Nothing removes them. A shell that is dropped while its `o_root` stays alive keeps its snapshots and itself in memory.

> ❓ **Question**: How do we release them?
> **a)** Tie them to the shell node lifecycle (`node_observe` / `$disconnected`), with no new API.
> **b)** Add a public `dispose()`.
> ➡️(a) It follows the elt idiom: observers live with their node.

### E10. Redundant fallback in the shell root

`editor/shell.tsx:207-219`. **[read]** Lines `:208-209` compute what `resolve_in_slot(column.declared, value)` computes (`schema.tsx:214`). When the `is_root` block runs, `schema?.canHandle(value)` is already false, so the block always sets `concrete_factory(anything, value)`.

> ❓ **Question**: How do we simplify it?
> **a)** `const r = resolve_in_slot(column.declared, value); if (r.canHandle(value) || is_root) column.o_factory.set(r); else this.close_after(idx - 1)`.
> ➡️(a) Same behavior, less code.

### E11. Popup column with a non-element source never mounts

`editor/shell.tsx:178-184`. **[read]** Both branches run the same `o_columns.set([...kept, column])`. When `presentation === "popup"` and `source` is not an `Element`, the column is added but renders only as a comment placeholder.

> ❓ **Question**: What happens in this case?
> **a)** Fall back to the inline presentation.
> **b)** Throw an error.
> ➡️(a) The user still sees the column.

### E12. Dead code in the editor

**[read]**
- `editor/undo.ts:55-60`, `:101-109`: `mark_last_import` has no caller; `push` always gets `import_tag = false`; the `import_undo_depth` option does nothing.
- `editor/table-resize.ts:15-75`, `:132-160`: `$resizable` and its helpers (`make_resizable`, `schedule_freeze`, `freeze_table_layout`, `set_column_width`, two `WeakMap`s) are exported and never used.
- `editor/schema.tsx:887-895`: the `previous_key` parameter of `commit_object_key` is never passed; its `hasOwn` check repeats the one at `:961`.
- `editor/composite-toolbar.tsx:86`: `toolbar_flags().show_type_change` is not used.

> ❓ **Question**: What do we do?
> **a)** Remove all of it; move `commit_object_key` and `remove_object_key` into `list-edit.ts` with their Map/Set/Array equivalents.
> **b)** Remove it, but keep `$resizable` for a future table feature.
> ➡️(a) Unused code costs maintenance. `specs/resizable.tsx` exists: check it before removal.

### E13. Smaller duplicates in the editor

**[read]**
- `editor/type-change.ts:11-13` and `:60-62`: `catalog()` and `unknown_type_targets()` are the same.
- `editor/schema.tsx:745`, `:750`, `:757`: `SelectFactory` makes its default `convert_fn` three times.
- `editor/schema.tsx:817-831`: two `DateTimePicker({...})` calls differ only in `clearable`.
- `editor/schema.tsx:1217-1219`: `o_has_extra` computes `table_column_keys` again instead of reading `o_columns`.
- `CompositeToolbarProps.kind` always equals `factory.kind`.
- The check `typeof x !== "object" || x === null || Array.isArray(x)` appears about 10 times (`mount.ts`, `schema.tsx`, `list-edit.ts`) next to `is_plain_object`.
- `editor/schema.tsx:827`: the cast `o_date as o.IObservable<Date | null, Date>` is probably not necessary since the fix of the draft type in `src/mutative.ts`. Remove it if `tsc` agrees.

> ❓ **Question**: What do we do?
> **a)** Factor each one.
> ➡️(a) DRY.

### E14. Small bad practices in the editor

**[read]**
- `editor/context-menu.tsx:198`, `:200`: Cut and Copy do not handle a rejection of `writeText`; Paste (`:202`) does.
- `editor/type-change.ts:73`: when `globalThis.confirm` does not exist, `ok` is `undefined` and the type change never applies.
- `editor/grid.tsx:152`: `Symbol.for(...)` registers one global symbol per transient row; registered symbols are never collected.
- `editor/composite-toolbar.tsx:23-28`: `row_matches_search` trims and lowercases the query again for each row.
- Comment `editor/schema.tsx:1700-1705` says Map/Set are not offered in unknown mode; `type_change_extra` offers them and `docs/md/object-editor.md:35` says so.
- `editor/shell.tsx:253-260`: an orphan doc comment about `render_chrome` sits above the doc comment of `header_menu`.

> ❓ **Question**: What do we do?
> **a)** Handle the clipboard rejections; treat a missing `confirm` as "yes"; use a prefixed string key instead of `Symbol.for`; normalize the query once; correct or remove the two comments.
> **b)** Same as a), but treat a missing `confirm` as "no" and log a warning.
> ➡️(a) Without `confirm` (tests, embedded environments) the action the user asked for still applies.
