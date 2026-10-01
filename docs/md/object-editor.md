---
title: Object Editor
order: 110
section: UI Recipes
---

# Object Editor

`ObjectEditorShell` (`elt/editor`) renders a generic tree/table editor over an `Observable` holding any JSON-like value: objects, arrays (list or table layout), `Set`s, `Map`s, and free-form "unknown mode" documents. Every example below is live, using the actual `elt/editor` package.

**Unstable:** `elt/editor` is under active development and its API may change without notice. Do not build on it in code that must keep working across elt upgrades.

## Layout

The editor is a row of columns, each in its own frame: the root value, then one column per value opened from it (a click on a nested object or array opens it to the right; a schema can open it in a popup instead).

- **Header line.** Every column and popup starts with one line: the key it was opened from and the value's type (`address · Object {3}`), then its `…` menu (change type, import/export), then *Undo*/*Redo* on the root column or × on the others.
- **Rows are a grid.** Each entry is a row of cells: the key (or index), the value's widget, and the row's controls (remove), each in its own column, aligned from one row to the next. A nested object or array is a cell showing a preview of its content; click it to open it.
- **Toolbar.** Right under the header line, on a neutral background: the *+ Add …* button, and a filter that keeps the rows whose key or value contains the text (*Aa* makes it case-sensitive). It stays in place while the filter shortens the rows.
- **Column widths** come from the first rows shown, then stay put while you scroll; a longer key further down is truncated with `…`. Table columns can then be resized by dragging a header's right edge.

## Schema-mode object

A `schema` describes known properties up front: scalars, a multiline string, a bounded number, a nullable date, a string array in list mode, and a nested object with its own filter opted out (`toolbar: { search: false }`).

```tsx
//@inline-example
import { o } from "elt"
import { profile_schema, profile_seed } from "../object-editor-schemas.ts"
import { ObjectEditorShell } from "elt/editor"

const o_profile = o(structuredClone(profile_seed))
const shell = new ObjectEditorShell(o_profile, { schema: profile_schema })

return shell.node
```

## Table — auto-detect

An array of uniform objects switches to table layout on its own (`mode: "auto"`). Edit cells inline; use *+ Add item* (toolbar) for a new row.

```tsx
//@inline-example
import { o } from "elt"
import { roster_schema, roster_seed } from "../object-editor-schemas.ts"
import { ObjectEditorShell } from "elt/editor"

const o_roster = o(structuredClone(roster_seed))
const shell = new ObjectEditorShell(o_roster, { schema: roster_schema })

return shell.node
```

## Table — manual columns

`mode: "table"` with an explicit `columns` list. The first row still carries a `warehouse` key in its underlying data — look for the **⚠** on the header line ("Some rows have keys not shown as columns"); hidden column data stays on the object, it is not discarded.

```tsx
//@inline-example
import { o } from "elt"
import { ledger_schema, ledger_seed } from "../object-editor-schemas.ts"
import { ObjectEditorShell } from "elt/editor"

const o_ledger = o(structuredClone(ledger_seed))
const shell = new ObjectEditorShell(o_ledger, { schema: ledger_schema })

return shell.node
```

Large tables (thousands of rows) are virtual grids (`RepeatVirtual` in an `e-grid`): only the rows near the visible part are rendered. Columns take the width of the first rows shown, then keep it while you scroll; drag a header's right edge to resize one.

## Set — unique members

Set membership list — duplicates are rejected on commit. *+ Add member* starts a transient row defaulting to `item_default`.

```tsx
//@inline-example
import { o } from "elt"
import { tags_set_schema, tags_set_seed } from "../object-editor-schemas.ts"
import { ObjectEditorShell } from "elt/editor"

const o_tags = o(new Set(tags_set_seed))
const shell = new ObjectEditorShell(o_tags, { schema: tags_set_schema })

return shell.node
```

## Map — key/value rows

Key/value rows with separate key and value widgets; the `…` cell after a key changes the key's type.

```tsx
//@inline-example
import { o } from "elt"
import { flags_map_schema, flags_map_seed } from "../object-editor-schemas.ts"
import { ObjectEditorShell } from "elt/editor"

const o_flags = o(new Map(flags_map_seed))
const shell = new ObjectEditorShell(o_flags, { schema: flags_map_schema })

return shell.node
```

## Unknown mode — no schema

Without a `schema`, the editor infers structure from the value itself: free keys, a row filter, and nested composites. This is the mode to reach for when editing arbitrary/untrusted documents.

```tsx
//@inline-example
import { o } from "elt"
import { document_seed } from "../object-editor-schemas.ts"
import { ObjectEditorShell } from "elt/editor"

const o_document = o(structuredClone(document_seed))
const shell = new ObjectEditorShell(o_document)

return shell.node
```

## RegExp catch-all keys

A schema-mode object can declare a `RegExp` property name to accept any key matching a pattern — here, `theme`/`debug` are named explicitly and anything matching `/^feature_/` is accepted too.

```tsx
//@inline-example
import { o } from "elt"
import { config_schema, config_seed } from "../object-editor-schemas.ts"
import { ObjectEditorShell } from "elt/editor"

const o_config = o(structuredClone(config_seed))
const shell = new ObjectEditorShell(o_config, { schema: config_schema })

return shell.node
```

## Writing a widget

A schema node is a `Factory`: its `render(o_value)` returns a `RenderableWidget`, whose `render()` builds the widget. The editor relies on two rules for it:

- **`render()` returns one element, and that element is the cell.** The parent places it directly in a grid row, with no wrapper, so an `<input>` reads as a flat cell framed by the grid's lines. Don't wrap your control in a container of your own.
- **A control that can't fill a cell wraps itself in one element that does.** A cell that doesn't fill its row's height and its column's width lets the grid's line color show around it ([Layout § Grids](./ui-layout.md#grids)). A checkbox keeps its own size, so the built-in `boolean()` returns `<label><input type="checkbox"></label>`: the label fills the cell, and clicking anywhere in it toggles the checkbox.

The editor only re-renders a value's widget when the value's JavaScript type changes, not on each edit: your control keeps its element (and focus) while the user types.
