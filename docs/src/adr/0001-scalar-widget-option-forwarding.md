# Scalar factories forward elt/ui widget options

Leaf object-editor factories (`string`, `number`, `boolean`, `date`, `select`) wrap exactly one `elt/ui` component each. Their schema-facing `Options` extend that component's attribute type directly — omitting only the binding prop the factory supplies (e.g. `model`) and any factory-only fields (e.g. `nullable` on date) — and `render()` spreads `this.options` onto the widget.

We rejected maintaining a hand-written parallel options surface per factory. That duplicated `elt/ui` prop names, guaranteed drift (`DatetimeOptions` already under-exposed `DateTimePicker` knobs), and fought the repo's DRY rule. Coupling to in-repo `elt/ui` types is acceptable: not a third-party boundary, and breaking renames are caught by TypeScript in the same repo.
