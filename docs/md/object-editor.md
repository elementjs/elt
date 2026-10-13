---
title: Object Editor
order: 110
section: UI Recipes
---

# Object Editor

`<ObjectEditor model={o_value} />` (`elt/editor`) renders a generic tree/table editor over an `Observable` holding any JSON-like value: objects, arrays (list or table layout), `Set`s, `Map`s, and free-form "unknown mode" documents. Every example below is live, using the actual `elt/editor` package.

**Unstable:** `elt/editor` is under active development and its API may change without notice. Do not build on it in code that must keep working across elt upgrades.

## Using the component

`<ObjectEditor model={o_value} />` edits the value held by `o_value` in place: edits write into the observable, and writes made elsewhere show up in the editor. Its attributes:

| Attribute | Type | Does |
| --------- | ---- | ---- |
| `model` | `Observable<unknown>` | The edited value (required) |
| `schema` | a schema (`object(...)`, `array(...)`, `either(...)`, …) | What the value may hold. Without it, the editor works in unknown mode: any JSON-like value, with its type changeable |
| `prefer_popups` | `boolean` | Open nested values in a popup instead of a new column to the right (a schema can still choose per value) |
| `packed` | `boolean` (default `false`) | Draw each column as one framed group whose header line, toolbar and rows touch and share lines. Without it, a column has no frame: its rows are spaced by the usual elt/ui spacing. See [Packed or not](#packed-or-not) |
| `show_title`, `show_filter`, `show_add`, `show_menu` | `boolean` (default `true`) | Which parts of a column appear. See [Showing and hiding parts](#showing-and-hiding-parts) |
| `show_undo_redo` | `boolean` (default `true`) | The *Undo*/*Redo* buttons of the root column's header line |
| `undo` | `{ depth?, import_undo_depth? } \| false` | Size of the *Undo*/*Redo* history. `false` turns the history off: no buttons, no shortcut |

`class` and `style` apply to the editor's outer row, like on any element.

*Undo* and *Redo* are also on Ctrl+Z and Ctrl+Shift+Z (Cmd on macOS) while focus is inside the editor, whether or not their buttons are shown. In a text field, the keys are left to the browser, which undoes the typing in that field.

## Packed or not

The editor can be packed. By default it is not: a column has no frame and no background, and its header line, toolbar and rows are plain elt/ui rows and columns, each widget keeping its own border. The fields, the header line and the toolbar of a column are spaced as widgets are (`component` step), and the columns are spaced from one another as components are (`section` step). A row's key and its input are aligned on the baseline of their first line. This is the form look: use it to edit the fields of a record.

`packed` gives each column a frame in which the header line, the toolbar and the rows touch and are separated by thin lines. This is the look of the examples below, unless they say otherwise.

`packed` is also an option of every schema node (`object({ packed: true, … })`), and then replaces the attribute for that node. Unlike the other settings, it carries on to what the node opens: the columns and popups opened from a packed node are packed, and those opened from an unpacked one are not, until a node sets it again. A popup is always a framed panel; packed, its content is one group; unpacked, it is rows.

The grid of a table (an array of objects shown with a column per key) is always packed, whatever `packed` says: it is a spreadsheet-like control whose cells need their lines. The frame, header line and toolbar around it follow the setting.

## Showing and hiding parts

Each of these is an attribute of `<ObjectEditor>`, which sets it for every column, and an option of a schema node, which replaces it for that node only (what the node opens is not affected).

| Setting | Shows |
| ------- | ----- |
| `show_title` | The label of the header line: the key the column was opened from and the type (`address · Object {3}`). *Undo*/*Redo*, × and `…` stay |
| `show_filter` | The filter of the toolbar |
| `show_add` | The *+ Add …* button of the toolbar |
| `show_menu` | The `…` button and the right-click menus: change type, import/export, delete. Without them, the browser's own menu shows |

A part that would be empty goes away: the toolbar with neither filter nor *+ Add*, and the root's header line with no label, `…` or *Undo*/*Redo*. A schema node also has `show_import_export`, for the import/export entries of its `…` menu only.

## Layout

The editor is a row of columns (each in its own frame when [packed](#packed-or-not)): the root value, then one column per value opened from it (a click on a nested object or array opens it to the right; a schema can open it in a popup instead).

- **Header line.** Every column and popup starts with one line (unless `show_title` and the others leave it empty): the key it was opened from and the value's type (`address · Object {3}`), then its `…` button opening the column's menu (see [Menus](#menus)), then *Undo*/*Redo* on the root column or × on the others.
- **Rows are a grid.** Each entry is a row of cells: the key (or index) and the value's widget, each in its own column, aligned from one row to the next. A nested object or array is a cell showing a preview of its content; click it to open it. Removing a row or changing a value's type goes through the row's menu.
- **Toolbar.** Right under the header line, on a neutral background: the *+ Add …* button, and a filter that keeps the rows whose key or value contains the text (*Aa* makes it case-sensitive). It stays in place while the filter shortens the rows.
- **Column widths** come from the first rows shown, then stay put while you scroll; a longer key further down is truncated with `…`. Table columns can then be resized by dragging a header's right edge.

### Menus

Actions on a value are in menus rather than buttons on every row. A row's menu opens with a right click anywhere in the row, a long press on a touch screen, Ctrl+click on macOS, or the keyboard's Menu key or Shift+F10 from inside the row. A column's menu opens the same way on its header line, or with its `…` button.

A menu lists what applies to where it was opened, in sections separated by a line:

| Section | In | Holds |
| ------- | -- | ----- |
| *Edit* | A menu opened from a text field | Cut, Copy, Paste, Select all — standing in for the browser's own menu, which the editor's replaces there |
| *Key* | Map rows (unless the schema sets `allow_key_type_change: false`) | *Change type…* for the key |
| *Value* (a Table: the column's name) | Every row, and a column's header | *Change type…* for the value. In a Table, the value of the cell the menu was opened from |
| (none) | Rows and columns that can be removed | *Delete*, in red. From a column's header, it removes the value from its parent and closes the column |

*Change type…* opens a second menu listing the types the value may take: the ones its schema declares for it (the branches of an `either()`; a single declared type offers none), or, in unknown mode, null, string, number, boolean, object, array — plus Set and Map for an array, and so on. A type the value converts to is listed by name (`number`); one it can't is listed as a reset to that type's empty value (`number (reset)`). Changes that may lose structure ask first. Deleting doesn't: *Undo* brings the value back.

When there is nothing to offer (a declared key, outside a text field), the browser's own menu shows.

## Schema-mode object

A `schema` describes known properties up front: scalars, a multiline string, a bounded number, a nullable date, a string array in list mode, and a nested object with its own filter opted out (`show_filter: false`). This one is not packed, as a form is.

```tsx
//@inline-example
import { o } from "elt"
import { ObjectEditor, array, boolean, date, number, object, string } from "elt/editor"

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
        show_filter: false,
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
return <ObjectEditor model={o_profile} schema={profile_schema} />
```

## Table — auto-detect

An array of uniform objects switches to table layout on its own (`mode: "auto"`). Edit cells inline; use *+ Add item* (toolbar) for a new row.

```tsx
//@inline-example
import { o } from "elt"
import { ObjectEditor, anything, array } from "elt/editor"

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
return <ObjectEditor model={o_roster} schema={roster_schema} packed />
```

## Table — manual columns

`mode: "table"` with an explicit `columns` list. The first row still carries a `warehouse` key in its underlying data — look for the **⚠** on the header line ("Some rows have keys not shown as columns"); hidden column data stays on the object, it is not discarded.

```tsx
//@inline-example
import { o } from "elt"
import { ObjectEditor, anything, array } from "elt/editor"

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
return <ObjectEditor model={o_ledger} schema={ledger_schema} packed />
```

## Large table — virtual scrolling

Large tables (thousands of rows) are virtual grids (`RepeatVirtual` in an `e-grid`): only the rows near the visible part are rendered. Columns take the width of the first rows shown, then keep it while you scroll; drag a header's right edge to resize one. Here, 10,000 rows generated when the example runs:

```tsx
//@inline-example
import { o } from "elt"
import { ObjectEditor, anything, array } from "elt/editor"

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
return <ObjectEditor model={o_orders} schema={orders_schema} packed />
```

## Set — unique members

Set membership list — duplicates are rejected on commit. *+ Add member* starts a transient row defaulting to `item_default`.

```tsx
//@inline-example
import { o } from "elt"
import { ObjectEditor, set, string } from "elt/editor"

const tags_set_schema = set({
  chrome_label: "Unique tags",
  values: string(),
  item_default: "",
})

const o_tags = o(new Set(["algorithm", "math", "notes"]))
return <ObjectEditor model={o_tags} schema={tags_set_schema} packed />
```

## Map — key/value rows

Key/value rows with separate key and value widgets; the row's menu changes the key's type or the value's ([Menus](#menus)).

```tsx
//@inline-example
import { o } from "elt"
import { ObjectEditor, boolean, map, string } from "elt/editor"

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
return <ObjectEditor model={o_flags} schema={flags_map_schema} />
```

## Unknown mode — no schema

Without a `schema`, the editor infers structure from the value itself: free keys, a row filter, and nested composites. This is the mode to reach for when editing arbitrary/untrusted documents.

```tsx
//@inline-example
import { o } from "elt"
import { ObjectEditor } from "elt/editor"

const o_document = o({
  title: "Notes on the Analytical Engine",
  tags: ["algorithm", "math", "history"],
  meta: { revision: 3, published: true },
  stats: { views: 1284, likes: 97 },
  links: ["https://example.com/ada", "https://example.com/babbage"],
})
return <ObjectEditor model={o_document} packed />
```

## RegExp catch-all keys

A schema-mode object can declare a `RegExp` property name to accept any key matching a pattern — here, `theme`/`debug` are named explicitly and anything matching `/^feature_/` is accepted too.

```tsx
//@inline-example
import { o } from "elt"
import { ObjectEditor, boolean, object, string } from "elt/editor"

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
return <ObjectEditor model={o_config} schema={config_schema} packed />
```

## Writing a widget

A schema node is a `Factory`: its `render(o_value)` returns a `RenderableWidget`, whose `render()` builds the widget. The editor relies on two rules for it:

- **`render()` returns one element, and that element is the cell.** The parent places it directly in a grid row, with no wrapper, so an `<input>` reads as a flat cell framed by the grid's lines. Don't wrap your control in a container of your own.
- **A control that can't fill a cell wraps itself in one element that does.** A cell that doesn't fill its row's height and its column's width lets the grid's line color show around it ([Layout § Grids](./ui-layout.md#grids)). A checkbox keeps its own size, so the built-in `boolean()` returns `<label><input type="checkbox"></label>`: the label fills the cell, and clicking anywhere in it toggles the checkbox.

The editor only re-renders a value's widget when the value's JavaScript type changes, not on each edit: your control keeps its element (and focus) while the user types.
