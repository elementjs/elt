# Changes in progress

## Outputs are named `out_<name>`

Decided with the `swmap` library (`~/Code/elt-maplibre`).

- Rule : the name of an attribute typed `o.Out<T>` always starts with `out_` (`out_picked`, `out_viewport`). Underscore and not dash : a hyphenated JSX attribute name that is missing from the props type is not an error in TypeScript, so a typo would pass silently, and a hyphenated key cannot be destructured.
- Done : the rule is in `docs/md/elt-rules.md` and `docs/md/components.md`, and the examples (`Picker`) use `out_picked`.
- To do : `breadcrumb` in `editor/shell.tsx` (`o.Out<string[]>`) and its row in `docs/md/object-editor.md` break the rule. Renaming it to `out_breadcrumb` changes a public attribute of the object editor, so its users have to change too (Discovery uses the editor).
- To do : a lint rule in `lint/` that reports an `o.Out` property whose name does not start with `out_`.
