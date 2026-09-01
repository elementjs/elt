# Object Editor — spec TODO

Config surface gaps found in `object-editor-types.tsx` against `ui-object-editor.md`. Not binding spec text — a checklist to work through. Check items off (or delete them) as they land in both files.

## Named in prose, missing from code

These are the highest priority — the spec already promises the behavior, nothing exposes it.

- [ ] **`conversions` allow-list.** Layer 5: "a schema's `conversions` (if it restricts them) filters this list per node," by that exact name. No `Options` interface has a `conversions` field.
- [ ] **Array/Set new-item default.** Layer 3 Array & Set: "the schema provides a default value or a callback that returns the default for a new item." Missing on `ArrayOptions`/`SetOptions`.
- [ ] **Object key rules.** Layer 3/5: whether keys can be added/removed at all, and whether new key names can be typed freely vs. autocomplete-only from the known list. `ObjectOptions` only has `properties`.
- [ ] **Toolbar opt-outs.** Layer 2/5: schema hides pieces of the default toolbar (search, `...` menu, type-change) instead of starting empty. Nothing anywhere expresses this.
- [ ] **`open_as` (popup vs. column per node).** Layer 1: "The shell chooses column vs popup (schema **and shell options**)." No composite `Options` lets a schema force a node to open as a popup regardless of the shell's default.
- [ ] **Table manual `columns`.** Layer 3 Table: "A schema may set `columns` manually instead" of first-row auto-detect. `ArrayOptions.mode` covers forcing table-vs-list; no `columns` field.
- [ ] **Map key-type-change gate.** Layer 3 Map: keys "can change type via `...` **when allowed**." No allow-flag on `MapOptions`.
- [ ] **No combinator for explicit `undefined`.** Layer 1: "undefined... allowed only when the schema turns it on." `UndefinedFactory` exists but has no exported factory function (every other kind has one) — currently unreachable from the public API.
- [ ] **Masked single-line text input.** Layer 4 "Widgets for developers" names this explicitly. No `mask` field, no distinct widget. *Candidate to resolve via widget-option-forwarding below, if/once `elt/ui` has a masked-input component to forward to — not yet confirmed one exists.*
- [ ] **Toggle/on-off-buttons boolean presentation.** Same list, as an alternative to the switch. `BooleanOptions` is empty. *Candidate to resolve via widget-option-forwarding below.*

## Noticed independently, not yet named in prose either

- [ ] `NumberOptions.step` — native `<input type="number">` supports it directly; cheap. *Resolved for free by widget-option-forwarding, if adopted.*
- [ ] `NumberOptions` NaN/Infinity opt-in field — flagged in `ui-object-editor.md` as "not yet named," never came back to name it.
- [ ] `DatetimeOptions` under-exposes `elt/ui`'s `DateTimePicker` — that component takes `week_starts_on`, `am_pm`, `minute_step`, `second_step`, `seconds`; `DatetimeOptions` only has `date`/`time`/`nullable`. *Resolved for free by widget-option-forwarding, if adopted — see below.*
- [ ] `PropertyOption.name: RegExp` (pattern/catch-all properties) — code already has real merge logic for this in `ObjectFactory.extend`, but the prose spec never explains what a `RegExp` name means at runtime (matches unlisted keys? first-match-wins among several patterns? interaction with "free key names"?).
- [ ] **Scalar `canConvert`/`convert` heuristics need review.** `StringFactory`/`NumberFactory`/`BooleanFactory`/`DateFactory`'s conversion bodies (string↔number↔boolean coercions, `DateFactory`'s looser `Date.parse`-based `canConvert` vs. its strict ISO-8601 `canHandle`) were written as reasonable-seeming judgment calls while implementing the conversion-model refactor, not derived from anything Layer 1 spells out edge-by-edge. Worth a deliberate pass rather than leaving them as implicit decisions.

## Design decisions bundled into the above

- `toolbar`, `open_as`, and `conversions` are the same shape of gap — node-level config that applies to every composite kind, not one. Worth a shared `CommonNodeOptions` intersected into `ObjectOptions`/`ArrayOptions`/`MapOptions`/`SetOptions`, rather than repeating three fields four times.
- Mask and toggle-vs-switch are each a small design call: field on the existing `Options` vs. a distinct `Factory` kind vs. resolved by option-forwarding (below).

## Open design questions (in discussion, not yet decided)

- [ ] **Forward widget options from `elt/ui` almost as-is.** For leaf/scalar factories that wrap exactly one `elt/ui` component (`string`/`number`/`boolean`/`date`/`select` — not composites, which have no single component to forward to), let `Options` extend that component's own `Attrs` type directly (e.g. `DatetimeOptions extends Omit<DateTimePickerAttributesBase, "model">`) and have `render()` spread `this.options` onto it plus `model={o_value}`, instead of hand-defining a parallel, narrower config surface. Would resolve several items above for free (`NumberOptions.step`, `DatetimeOptions` under-exposure, possibly mask/toggle) as a side effect of adoption rather than one-by-one field additions. Coupling to `elt/ui`'s exact prop names is real but low-risk since it's an in-repo dependency, not a third-party one — matches AGENTS.md's DRY preference over hand-duplicating a parallel options surface. Mechanical detail: the component's own binding prop (`model`, or whatever it's called per component) must be `Omit`ted from the schema-facing `Options`, since the factory supplies it, not the schema author. Some `Options` will still carry a few factory-only fields beyond pure passthrough (e.g. `DatetimeOptions.nullable` affects `DateFactory.defaultValue()`, not just the widget).
- [x] **Form validity, feeding `o_error` from the DOM Constraint Validation API.** Design and rationale: **`specs/ui-validity.md`**. Landed as a `validity` option (`{ o_error?, extra_check? }`, both independently optional) on `$bind.string`/`number`/`date`/`boolean`/`selected_index` (`src/decorators.ts`) — not a standalone decorator, not a separate primitive function (the `setCustomValidity`/`validationMessage` pair is two lines at one call site, inlined directly in `setup_bind`). `$bind.contenteditable` excluded (no `ValidityState`). Remaining: `ui/date-input.ts` refactor to also write an `o_error`, and tests — see "Next steps" in the spec.

## Done

- [x] **Conversion model simplification.** Replaced the strategy-id + global registry mechanism (`ConversionStrategies`, `strategy_registry`, `register_strategy`/`run_strategy`) with `canHandle` / `canConvert` / `convert` / `defaultValue` directly on each `Factory`, plus `UnrepresentableFactory` as `EitherFactory.resolve`'s honest "nothing fits" fallback (never a silent `defaultValue()` write). Automatic union resolution now only ever calls `canHandle`; `canConvert`/`convert` run exclusively from the user-initiated type-change menu. Landed in `object-editor-types.tsx` and `ui-object-editor.md` (Layer 1 "Type changes and conversion", Layer 4 "Contract", Layer 5 "Type-change targets").
