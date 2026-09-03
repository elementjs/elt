# Form Validity (elt)

`$bind`'s form-control variants (`string`, `number`, `date`, `boolean`, `selected_index`) take an optional `validity` argument wiring the DOM Constraint Validation API (`ValidityState`, `setCustomValidity`) into an `o.Observable<string | null>`, kept in sync with both native DOM events and the bound model. No separate decorator, no separate primitive function.

> Why: `ui/date-input.ts` already hand-rolls this pattern (`#refresh_validity` calling `setCustomValidity`, clearing with `""` when valid). This generalizes it. Originally scoped as a standalone `$validity` decorator plus a shared `node_apply_validity` primitive; both dropped — see "Why merged into `$bind`" below, and "Why no separate primitive function."

**Implemented**: the `validity` option on `$bind.string`/`number`/`date`/`boolean`/`selected_index` in `src/decorators.ts`.

## Scope

Covers form controls with a real `ValidityState`: `<input>`, `<textarea>`, `<select>`. `$bind.contenteditable` does not take a `validity` option — `contenteditable` elements aren't form-associated and have no `ValidityState` at all. Composite validation (the object editor's Table `o_has_extra_keys`, Object duplicate-key error) has no single control to hang a `ValidityState` off of and uses its own mechanism regardless.

## `BindValidityOptions` (`src/decorators.ts`)

```ts
export interface BindValidityOptions<T, N> {
  o_error?: o.Observable<string | null>
  extra_check?: (value: T, node: N) => string | null
}
```

Both fields are independently optional. Pass only `extra_check` to set a custom validity message without reading anything back (native `:invalid` styling, `reportValidity()`, etc. still apply on their own). Pass only `o_error` to mirror the node's existing/native validity state with no custom rule.

`setup_bind` (the shared implementation behind every `$bind.*` variant) takes this as an optional last argument. When present, on each of `setup_bind`'s existing triggers — its native event listener (`"input"` for most variants, `"change"` for `boolean`) and its `node_observe(node, obs, ...)` external→DOM sync hook — it recomputes and applies validity inline:

```ts
const value = node_get(node)
const message = validity.extra_check?.(value, node) ?? null
const el = node as unknown as ValidatableElement
el.setCustomValidity(message ?? "")
validity.o_error?.set(el.validationMessage || null)
```

No new event wiring, no `o.exclusive_lock()` needed (this path only reads `o_model`, never writes it), no separate lifecycle to manage — both triggers, and their automatic cleanup on node disconnect, already existed as part of `setup_bind`.

> Why the model hook matters, not just the native event: `setup_bind`'s external→DOM sync is a plain `node.value = ...` assignment, and programmatic `.value =` never fires `input`/`change`. Without the `node_observe` hook, validity would silently go stale on exactly those cases.

> Why `node.validationMessage` alone is enough: it's already the browser's unified answer — the custom message verbatim when `customError` is set, otherwise whichever native constraint (`required`, `pattern`, `min`/`max`, …) currently fails, otherwise `""`. No separate branch on `validity.valid` is needed. `setCustomValidity` is called unconditionally on every check: `customError` is independent of the browser's native constraint flags, so this never disturbs them. The only translation is `"" → null`, since that's `o_error`'s "no problem" value, not `validationMessage`'s.

## Why merged into `$bind`, not a separate `$validity` decorator

A standalone `$validity(o_model, o_error, extra_check?)` would need its own `node_add_event_listener(node, "input", ...)` and its own `node_observe(node, o_model, ...)` — the same two triggers `setup_bind` already registers for the same node. Two decorators independently doing the same wiring on the same element is redundant, and risks the double-registration problem `ui/date-input.ts`'s `DateInputController` already has to avoid by owning all its own listeners. Folding the option into `$bind` means one set of triggers does both jobs. It also means `extra_check` gets the already-parsed value each variant's own `node_get` produces (e.g. `$bind.number`'s `node_get` already does `Number(node.value)`) instead of a separate decorator re-deriving it.

`ui/date-input.ts`'s `DateInputController` still does not use `$bind` at all (it manages its own DOM state for segmented editing) — its own `#refresh_validity` today calls `setCustomValidity` with no `o_error` downstream at all. That's the concrete gap this closes there, once it's refactored to apply the same two-line pattern itself (see "Why no separate primitive function," below, for why that's not a shared call).

`elt/ui`'s own `Select` (`ui/select.tsx`) is in the same position as `DateInputController` for a different reason: it's a `<button>` plus a popup menu, not a native `<select>`, so it has no `ValidityState` either. Out of scope here.

## Why no separate primitive function

The `setCustomValidity` + `validationMessage` pair is two lines, used at exactly one call site (`setup_bind`'s `recheck_validity`, above). A `node_apply_validity(node, o_error, message)` wrapper was drafted and then removed: with `o_error` optional, it saved nothing over inlining — one caller, two lines, no second consumer to justify the indirection. `ui/date-input.ts`'s eventual refactor applies the same two lines directly rather than importing a shared function for it.

## Placement

The `validity` option landed directly on the existing `$bind.*` functions in `src/decorators.ts` — no new file.

`specs/resizable.tsx` still belongs in `ui/resizable.tsx` (unrelated to this decision, general-purpose decorator with no object-editor dependency, not yet moved).

## Relationship to the object editor

Pairs with `specs/TODO.md`'s "forward widget options from `elt/ui` almost as-is" item: a scalar factory forwarding native attrs (`min`, `max`, `pattern`, `required`, `step`, …) straight through to its underlying `elt/ui` component gets real validation on those for free once this reads them via `node.validity`. Where a leaf widget's `o_error` renders is a separate, still-open decision — see `specs/ui-object-editor.md` Layer 4 "Contract".

## Next steps

1. Tests: `o_error` updates on a programmatic `o_model` change, not just user input; the custom-validity write doesn't disturb native constraint flags when clearing a custom message.
2. Refactor `ui/date-input.ts`'s `#refresh_validity` to also write an `o_error` (adds support it currently lacks).
3. Move `specs/resizable.tsx` to `ui/resizable.tsx`; drop its "reference sketch only" caveat in `ui-object-editor.md` Layer 3 Table.
4. Wire the `validity` option into `schema.tsx`'s scalar factory `render()` methods, alongside option-forwarding once decided.
5. Promote from stub into `ui-object-editor.md` Layer 4 as binding prose once a real widget uses it.
