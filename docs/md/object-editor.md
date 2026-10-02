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
import { ObjectEditorShell, array, boolean, date, number, object, string } from "elt/editor"

const profile_schema = object({
  chrome_label: "Author profile",
  properties: [
    { name: "name", type: string() },
    { name: "bio", type: string({ multiline: true }) },
    { name: "age", type: number({ min: 0, max: 130, step: 1 }) },
    { name: "active", type: boolean() },
    { name: "birthday", type: date({ date: true, nullable: true }) },
    { name: "tags", type: array({ values: string(), chrome_label: "Tags (list mode)" }) },
    {
      name: "address",
      type: object({
        chrome_label: "Postal address",
        toolbar: { search: false },
        properties: [
          { name: "street", type: string() },
          { name: "city", type: string() },
          { name: "country", type: string() },
        ],
      }),
    },
  ],
})

const o_profile = o({
  name: "Ada Lovelace",
  bio: "Wrote the first published algorithm meant to be run on a machine.",
  age: 36,
  active: true,
  birthday: new Date(1815, 11, 10) as Date | null,
  tags: ["analytical-engine", "algorithm", "notes"],
  address: { street: "12 Analytical Engine Ave", city: "London", country: "UK" },
})
const shell = new ObjectEditorShell(o_profile, { schema: profile_schema })

return shell.node
```

## Table — auto-detect

An array of uniform objects switches to table layout on its own (`mode: "auto"`). Edit cells inline; use *+ Add item* (toolbar) for a new row.

```tsx
//@inline-example
import { o } from "elt"
import { ObjectEditorShell, anything, array } from "elt/editor"

const roster_schema = array({
  chrome_label: "Team roster",
  mode: "auto",
  values: anything,
  item_default: () => ({ name: "", role: "", active: true }),
})

const o_roster = o([
  { name: "Ada Lovelace", role: "Author", active: true },
  { name: "Charles Babbage", role: "Reviewer", active: false },
  { name: "Grace Hopper", role: "Editor", active: true },
])
const shell = new ObjectEditorShell(o_roster, { schema: roster_schema })

return shell.node
```

## Table — manual columns

`mode: "table"` with an explicit `columns` list. The first row still carries a `warehouse` key in its underlying data — look for the **⚠** on the header line ("Some rows have keys not shown as columns"); hidden column data stays on the object, it is not discarded.

```tsx
//@inline-example
import { o } from "elt"
import { ObjectEditorShell, anything, array } from "elt/editor"

const ledger_schema = array({
  chrome_label: "Inventory ledger",
  mode: "table",
  columns: ["sku", "qty", "unit"],
  values: anything,
  item_default: () => ({ sku: "", qty: 0, unit: "ea" }),
})

const o_ledger = o([
  { sku: "BOOK-001", qty: 12, unit: "ea", warehouse: "A" }, // `warehouse` is not a column
  { sku: "BOOK-002", qty: 3, unit: "ea" },
  { sku: "PART-9", qty: 140, unit: "mm" },
])
const shell = new ObjectEditorShell(o_ledger, { schema: ledger_schema })

return shell.node
```

## Large table — virtual scrolling

Large tables (thousands of rows) are virtual grids (`RepeatVirtual` in an `e-grid`): only the rows near the visible part are rendered. Columns take the width of the first rows shown, then keep it while you scroll; drag a header's right edge to resize one. Here, 10,000 rows generated when the example runs:

```tsx
//@inline-example
import { o } from "elt"
import { ObjectEditorShell, anything, array } from "elt/editor"

const names = ["Ada", "Charles", "Grace", "Alan", "Edsger", "Barbara", "Donald", "Margaret"]
const statuses = ["pending", "shipped", "delivered", "returned"]

const orders_schema = array({
  chrome_label: "Orders",
  mode: "auto",
  values: anything,
  item_default: () => ({ id: 0, customer: "", status: "pending", qty: 1, paid: false }),
})

const o_orders = o(
  Array.from({ length: 10_000 }, (_, i) => ({
    id: i + 1,
    customer: `${names[i % names.length]} #${Math.floor(i / names.length) + 1}`,
    status: statuses[(i * 7) % statuses.length],
    qty: ((i * 37) % 50) + 1,
    paid: i % 3 !== 0,
  })),
)
const shell = new ObjectEditorShell(o_orders, { schema: orders_schema })

return shell.node
```

## Set — unique members

Set membership list — duplicates are rejected on commit. *+ Add member* starts a transient row defaulting to `item_default`.

```tsx
//@inline-example
import { o } from "elt"
import { ObjectEditorShell, set, string } from "elt/editor"

const tags_set_schema = set({
  chrome_label: "Unique tags",
  values: string(),
  item_default: "",
})

const o_tags = o(new Set(["algorithm", "math", "notes"]))
const shell = new ObjectEditorShell(o_tags, { schema: tags_set_schema })

return shell.node
```

## Map — key/value rows

Key/value rows with separate key and value widgets; the `…` cell after a key changes the key's type.

```tsx
//@inline-example
import { o } from "elt"
import { ObjectEditorShell, boolean, map, string } from "elt/editor"

const flags_map_schema = map({
  chrome_label: "Feature flags",
  keys: string(),
  values: boolean(),
})

const o_flags = o(
  new Map([
    ["search", true],
    ["editor", true],
    ["beta_ui", false],
  ]),
)
const shell = new ObjectEditorShell(o_flags, { schema: flags_map_schema })

return shell.node
```

## Unknown mode — no schema

Without a `schema`, the editor infers structure from the value itself: free keys, a row filter, and nested composites. This is the mode to reach for when editing arbitrary/untrusted documents.

```tsx
//@inline-example
import { o } from "elt"
import { ObjectEditorShell } from "elt/editor"

const o_document = o({
  title: "Notes on the Analytical Engine",
  tags: ["algorithm", "math", "history"],
  meta: { revision: 3, published: true },
  stats: { views: 1284, likes: 97 },
  links: ["https://example.com/ada", "https://example.com/babbage"],
})
const shell = new ObjectEditorShell(o_document)

return shell.node
```

## RegExp catch-all keys

A schema-mode object can declare a `RegExp` property name to accept any key matching a pattern — here, `theme`/`debug` are named explicitly and anything matching `/^feature_/` is accepted too.

```tsx
//@inline-example
import { o } from "elt"
import { ObjectEditorShell, boolean, object, string } from "elt/editor"

const config_schema = object({
  chrome_label: "Runtime config",
  free_keys: true,
  properties: [
    { name: "theme", type: string() },
    { name: "debug", type: boolean() },
    { name: /^feature_/, type: boolean() },
  ],
})

const o_config = o({
  theme: "dark",
  debug: false,
  feature_search: true,
  feature_editor: true,
})
const shell = new ObjectEditorShell(o_config, { schema: config_schema })

return shell.node
```

## Writing a widget

A schema node is a `Factory`: its `render(o_value)` returns a `RenderableWidget`, whose `render()` builds the widget. The editor relies on two rules for it:

- **`render()` returns one element, and that element is the cell.** The parent places it directly in a grid row, with no wrapper, so an `<input>` reads as a flat cell framed by the grid's lines. Don't wrap your control in a container of your own.
- **A control that can't fill a cell wraps itself in one element that does.** A cell that doesn't fill its row's height and its column's width lets the grid's line color show around it ([Layout § Grids](./ui-layout.md#grids)). A checkbox keeps its own size, so the built-in `boolean()` returns `<label><input type="checkbox"></label>`: the label fills the cell, and clicking anywhere in it toggles the checkbox.

The editor only re-renders a value's widget when the value's JavaScript type changes, not on each edit: your control keeps its element (and focus) while the user types.
