# Object Editor

The Object Editor is a graphical widget that edits a JavaScript value.

> Why: The goal is any JavaScript value. JSON-like data is the usual case, not the only case.

## Scope

**In the first version**

- Bind and edit a value with single-value widgets and multi-part layouts
- Columnar drill-down into nested composites
- Unknown mode (no schema) and schema mode
- The same widgets in every layout
- Import/export as add-on modules (interface and planned formats; details later)
- Undo/redo history
- Keyboard use of widgets directly (focus in controls; no Excel marquee yet)
- Short “preview” text on buttons that open a nested composite
- Exact search/filter rules (a search field may already appear on the toolbar)

When no schema is given, the editor still uses a **default** set of rules: it can show richer JavaScript types, but type changes stay JSON-compatible unless a schema says otherwise.

> Why: “No schema” is not “no rules”; it is the default rule set for free-form values.

**Later (not required for the first version)**

- Excel-like **marquee** (optional overlay + fake focus; see Layer 1b notes)
- Full marquee keyboard navigation and TSV multi-cell clipboard
- Multiple open trees (tabs / side-by-side panes) — see Layer 1b
- Excel import wizard beyond an empty add-on slot
- Packaging as an HTML custom element (thin wrapper over the `elt/ui` component when done)
- Array “show object fields inline” (sticky index + object fields beside it) — dropped for now; use composite previews and drill-down instead

**Gate:** Do not start implementation until the **shell / widget / DOM model** (below) is decided and written as binding rules. Product layers 2–6 may stay incomplete; the model must not.

---

## Layer 1 — Value model

The editor is always bound to an `o.Observable<unknown>` (or a tighter type when a schema narrows it). Nested parts bind to derived observables (for example `.p(key)` or an array index).

The caller always passes an observable. The editor does not wrap a plain value for them.

**Commit timing**

- **Scalar widgets** do not write the observable on every keystroke. They **commit** when editing stops (blur, Enter, or an explicit confirm in that widget).
- **Structural edits** on composites (add/remove key, reorder, type/layout change, import at this node, and so on) update the observable **immediately** when the action completes.
- Closing a popup or leaving a column does not add an extra confirm step; nested composite edits were already applied as above.

> Why: Immutable observable values make undo/redo of committed states straightforward. Undo/redo is in the first version.

### Definitions

- **scalar** — a value shown as one widget, without its own key/index list.
- **composite** — a value shown with a layout: object, `Map` (key/value pairs), `Array` (list), or `Set` (unique values).
- **unknown mode** — no schema was passed, and no schema is registered for the value’s constructor. Default rules: the user may change a value to another type; they may change a composite layout to another layout or to a scalar (with a warning if data would be lost). Type changes stay JSON-compatible (see Scope).
- **schema mode** — a schema applies to the current node (passed in, or found from the value’s constructor). Only what that schema allows is available.

Class instances with no registered schema are edited like objects: **own properties** only, same as unknown-mode objects.

### Null, undefined, missing

- `null` is a normal scalar in unknown mode (shown as non-editable `NULL`; the user replaces it by changing type).
- Explicit `undefined` as a **stored value** is **not** offered in unknown mode. In schema mode it is allowed only when the schema turns it on.
- A missing object key is not modeled as `undefined`. `undefined` is only an explicit value on a key that exists. “Key missing” stays a separate notion (no key).

### Type changes and conversion

Unless the schema forbids it, the user may change the type of the current node (scalar to scalar, scalar to composite, composite to composite, and so on). Changes that would destroy data show a warning first.

**Scalar → scalar (and similar automatic coercions)**

- Convert as best as possible.
- If conversion is impossible, use a **default** for the target type (and surface an error on the widget when useful).

**Default composite conversions** (named strategies the UI can offer):

- `object_values` — object → array via `Object.values(obj)`
- `string_indexes` — array → object with keys `"0"`, `"1"`, …
- `empty` — empty target (empty array / object / Map / Set as appropriate)
- further named strategies as needed (e.g. convert to Map)

**Composite → composite** does not always run one silent conversion. The UI asks what to do, offering the **named strategies** the target widget declares (plus schema limits), for example empty target, convert with values, convert to Map (not the default pick).

Each widget declares which **named conversion strategies** it accepts as a target. The type-change UI is built from that list and the schema. Warning text when data is dropped is owned by the strategy (or a shared string table keyed by strategy id).

> Why: Named strategies keep menus predictable and easier to translate than free-form `importFrom` only.

### Widgets all the way down

**Composites are widgets** that embed other widgets (and usually a title/toolbar). There is no separate “layout” type in the programming model — “object layout / array layout / …” is how those composite widgets present themselves.

> Why: One contract for render, bind, errors, type change, and conversion avoids a parallel Layout API. Composite widgets are just richer widgets.
> Thoughts: Keep using the word “layout” in the UI sections below for how a composite looks; the implementation type is still Widget.

### Editor shell

The **object editor** is a **shell**. It opens a widget for an **observable** (the root, or a derived observable from a parent composite). Widgets do not own the column strip or popup host; they **ask the shell** to open by dispatching `elt-object-editor-open`. The shell chooses column vs popup (schema and shell options).

When the event originates inside a column that is not the rightmost, the shell **truncates** columns to the right of that column, then opens the new view. When drilling from the rightmost relevant column, it **appends** a column (unless popups are preferred).

Default presentation: a **horizontally scrollable** column container. A shell option may prefer **popups** instead of columns.

**Open request:** widgets **dispatch a DOM event** named `elt-object-editor-open` that bubbles. The event detail carries **`o_value`** (observable to open) and **`title`** (breadcrumb segment). **No separate anchor field** — popup placement uses the event’s **`currentTarget`**. The shell listens with **`$on`** on its root and calls its own `open(…)`. Widgets do not hold a shell reference.

Column hosts are children of the **shell only** (not nested under another composite’s DOM as column parents).

> Why: Real DOM + bubbling fits elt; `$on` stays idiomatic; `currentTarget` is enough to place a popup; the shell method stays the single place that mutates the column stack.

---

## Layer 1b — Shell / widget / DOM model (must settle before coding)

This section chooses how the shell and widgets sit on elt and the DOM. Until the open Questions here are answered, the spec is not ready to implement.

### Identity — observable mount, not a global path

**Locked for v1:**

1. Every mounted widget is bound to an **`o.Observable`** for its value (root: the caller’s observable; children: derived observables created by the **parent composite**).
2. **Open** asks the shell to show a widget for **`o_value`** in the event detail (schema resolved by the shell from registries + runtime type). Not a recomputed root-relative path.
3. **Column truncation** uses DOM: which **column** contains the event target / `currentTarget`, then close columns to the right, then append (or popup).

**Why not path-as-mount-key:** Set has no coordinates; Map keys may be objects; the editing surface for a Set is already a **projection**.

**Set (and similar projections):**

- Prefer a **dedicated converter / `.tf`** (object-editor-specific is fine) for Set ↔ array (and similarly Map ↔ entries if needed): stable row keys, reuse of per-element observables across updates, write-back into the Set.
- Opening a child uses the **row’s observable** from that projection, reused while the row key lives.
- VirtualScroll/Repeat **key** rules align with that converter’s element identity (object reference, or primitive unique in a Set).

Widgets need **their value observable**. They do not need a root-relative path for mounting. A **display path / title** (breadcrumb in the column header) may be derived later for humans; it is not the mount key.

> Why: Truncation is a column-stack/DOM problem; binding is an observable + converter problem.

### Invalid parent / external writes

Naïve `.p()` is unsafe when a parent value becomes non-composite (`undefined`, wrong type) after import, undo, or writes from outside the editor on the root observable.

**Rules:**

- Derived child observables used by the editor must **not throw** into the UI when the parent slot disappears; they go to a defined empty/invalid state the shell can detect.
- If a column’s `o_value` is **no longer a valid mount** for that column’s widget (parent lost, type replaced under it, projection row gone and not reusable), the shell **closes that column and every column to its right**.
- If the **root** observable becomes `null` or `undefined` (or otherwise a single scalar), the shell keeps **one** root column showing the matching scalar widget and closes all deeper columns.

> Why: Outside writers and import are first-class; the column stack must follow validity, not assume stable composites forever.

**Invalid-mount detection (v1):** each **column** (and each mounted cell/row observable the column cares about for validity of its open children) is watched with an observe tied to that mount. Whenever an observable is mounted into the editor stack, the shell (or column host) runs the validity check on updates. On invalid: close that column and all to its right (root scalar special case above).

### Display path, breadcrumbs, multiple trees

**v1 — single stack + breadcrumbs:** one horizontally scrolling column stack (or popups). Open event detail includes a **title** segment (e.g. parent key name, index label). The shell builds a **breadcrumb** from the stack of open columns’ titles (plus a root label). Column header shows that context; breadcrumbs are for display only, not mount keys.

**Later — multiple trees (tabs or side-by-side):** each **pane** is its own column stack. Extra open-event options (e.g. target pane / “new tab”) come later. Visual cues: tabs and/or split panes as noted previously. Mount identity stays observables.

### Widget as DOM

Widgets are **Renderable** (insert real nodes via `sym_insert` / returning nodes). The shell mounts them with **`node_append`** into a column body or popup content, and **`node_remove`** when a column is truncated or a type change replaces the widget.

**Type change:** destroy the old widget (remove its nodes) and create the new widget for the **same observable** (v1 default unless later revised).

**Shape (locked for v1):**

- **Object-editor widgets** (Object, Array, Set, Table, Null, Preview, type-change chrome, converters, open dispatch) are **internal classes** (or non-exported factories) implementing the Widget contract / Appender. They are **not** a public elt component catalog for app authors to drop in ad hoc — authors use the **shell** + **schema**.
- **Visual controls** inside them (inputs, switch, date, select, …) come from **`elt/ui`** (amend/create there as needed). Thin wrappers adapt `elt/ui` to commit-on-blur and `o_value`.
- Schema may register **custom widget classes** the same internal way; that is the extension point, not “export every cell as `<OeString/>`.”

> Why: Editor widgets carry mount/open/conversion machinery that is not “just visuals.” Public surface = shell + schema (+ optional custom Widget classes), not a grab-bag of cell components.
> Thoughts: If a rare app needs an isolated cell later, that can be a documented escape hatch — not the default API.
### Who creates child observables

**Parent composites** create derived observables for their cells/rows, using safe converters/transforms where projections need them (Set, Map, …). The shell holds the **root** and each **column**’s mounted `o_value`.

### Asking to open (DOM)

Event: `elt-object-editor-open`, detail `{ o_value, title: string }` (title = breadcrumb segment for this open). Placement via `currentTarget`. Hybrid: event → shell.`open`. Preview dispatches; in-place widgets do not. Later, detail may grow optional pane/tab options without changing mount identity.
### Marquee (later — not v1)

**Dropped from v1.** Users focus widgets directly.

**Design notes for a later optional marquee** (keep for when we resume):

- Optional: some users want events on widgets only, no marquee.
- If present: an **overlay** that intercepts pointer input, keeps an in-memory primary cell + range, draws selection (overlay and/or classes fed by a readonly observable), and on F2/typing moves **real** focus into the target widget.
- VirtualScroll: keyboard may move to a row not mounted yet — selection model is coordinates/keys in memory; overlay/classes apply when the row exists; scrolling may be required before focus.
- Hybrid drawing (coordinate overlay + classes on mounted cells) is likely; pure overlay-only struggles with row height variance.

### Lists

Composite body lists use **VirtualScroll** and `node_append`. Open events bubble to the shell. Projection converters must agree with VirtualScroll key reuse.

### Approaches (locked)

| Topic          | Choice                                                          |
| -------------- | --------------------------------------------------------------- |
| Open           | **C — hybrid** (`elt-object-editor-open` + shell `open`, `$on`) |
| Column mount   | **D — shell** mounts column/popup from `o_value`                |
| Cell/row mount | **E — parent** composite creates children + converters          |
| Mount identity | **Observable**, not path                                        |
| Selection v1   | No marquee; per-widget focus only                               |
| Widget shape   | Internal Widget classes + `elt/ui` visuals; schema registers customs |
| Open detail    | `{ o_value, title }` — breadcrumbs from column titles           |

---

## Layer 2 — Header, toolbar, and columns

### Opening the editor

The caller mounts the **shell** on a root observable (and optional schema; see Layer 5). The shell opens the root observable and shows that widget inside the column/popup host.

### Columns / drill-down

Nested opens are requested by widgets; the shell places them (see Layer 1 — Editor shell). Default: new columns **to the right** (columnar drill-down), strip **scrolls horizontally**.

Maximum depth may be capped by a **parameter** on the editor (optional). Unlimited if unset.

When the shell/schema uses a **popup** instead of a column: the user closes it with an **X** or by focus loss. Commit rules are the same as for columns (structural edits already applied; scalar widgets commit when their editing ends).

### Composite title and toolbar

Every composite widget has a sticky title row and toolbar at the top (content of the column/popup; the shell owns the outer frame). The shell shows **breadcrumbs** for the current column stack (from each column’s open `title`, see Layer 1b).

Unknown mode toolbar includes:

- a search field (filters the listed rows; exact rules in first version — specify in a later pass of this layer)
- a `...` menu for import/export on this node (what the add-ons and schema allow), and for changing this node’s type or layout (warn if data would be lost)

Schema mode **starts from the same toolbar** as unknown mode. The schema **opts out** of pieces it does not want (hide or remove actions), rather than starting empty and opting in.

### Lists

Composite lists that can grow use **VirtualScroll**, not `Repeat`, including small lists.

> Why: VirtualScroll cost is treated as negligible; one scrolling approach everywhere.

### Focus (v1)

No marquee. Pointer and keyboard go to real controls inside widgets. Opening a composite is via the preview control (click / keyboard activate).

> Thoughts: Excel-like marquee, multi-cell TSV, and optional overlay are **later** (design notes in Layer 1b).

---

## Layer 3 — Composite widgets (layouts)

Composite presentation is implemented as widgets (see Layer 1). This section names how each composite **looks and behaves**.

Default widget for a composite value:

| Value kind                          | Default composite widget                     |
| ----------------------------------- | -------------------------------------------- |
| plain object / class own properties | Object (key/value)                           |
| `Map`                               | Map (like object, keys can change type)      |
| `Array`                             | Array                                        |
| `Set`                               | Set                                          |
| array of “similar” objects          | **Table** when auto-detect or schema says so |

Other unknown types are shown as Object, unless a schema treats them as scalar (for example `Date`).

**Table vs Array:** scan the **first few** elements (see Table) for key-wise similar objects and switch to Table when they match. A schema can force Array or Table. The user can override when unknown mode (or schema) allows type/layout change.

### Object

A vertical list of key/value rows. Keys are editable strings when allowed. Values are widgets, aligned to the **baseline** of the key (a value may be taller than its key; long keys use `…` ellipsis).

Giving a key the same name as an existing key is an error (no silent overwrite).

Keys may be added or removed when unknown mode or the schema allows. If the schema lists known keys, changing a key may use a lookup list (autocomplete); the schema says whether the user may type new key names freely.

### Map

Like Object, except keys are also edited with widgets (and can change type via `...` when allowed). In unknown mode, map keys may become any type.

Map entries can be **reordered** with drag and drop (Maps keep insertion order).

### Array

Each row shows a numeric index and the element’s widget. When allowed, the user can drag indices to reorder.

New elements: same insert controls as Set (hover `+` on boundaries, keyboard shortcut) at positions the schema allows.

Nested objects use the **composite preview** and drill-down into a new column — not fields shown inline beside the index.

### Set

List presentation like Array:

- User **appends** or **inserts** entries (hover `+` on boundaries; keyboard shortcut)
- **Reorder** with drag and drop (Sets keep insertion order)
- Duplicate values are rejected

After insert/append, the new entry is **`null`**, unless the schema provides a **default value** or a **callback** that returns the default for a new item (arrays use the same rule).

### Table

For arrays of objects that share a similar set of keys: each row is one element, each column is one key.

**Auto “similar”:** scan at most the **first 5** elements; they must share the **same key set** to become a table. A schema may set columns manually instead (or force table/array).

- Adding a column adds that key on **every** row object
- Deleting a column removes that key from **every** row object
- Cell editors are the same widgets as elsewhere; a composite cell opens a column or a popup per schema

**Rows after the scanned prefix:** columns stay those of the detected (or schema) key set.

- A row **missing** a column key shows an empty/`undefined`-style cell for that column (not a hidden extra structure).
- A row with **extra** keys not in the column set does **not** show those keys in the table. That data remains on the object; the user can switch to Array-of-objects (unknown mode) or open that row as an object to see everything.

> Why: Auto-detect is imperfect on purpose; unknown mode keeps an escape hatch to Array.

**Divergence (first version):** when any row has keys outside the table column set, the Table widget exposes `o_has_extra_keys: o.Observable<boolean>` (or equivalent). The toolbar shows a **small warning icon** with tooltip along the lines of “Some rows have keys not shown as columns.”

Cells for a column key that is **absent** on that row use the **undefined** widget (missing key — not `null`).

---

## Layer 4 — Widgets

The same widget code is used for a given kind of value whether it appears as an object field, an array element, a table cell, or the root. Composites are widgets too (Layer 1).

### Contract

```typescript
interface Widget {
  // Bound to the cell or root observable (parent composite or shell provided).
  constructor(o_value: o.Observable<unknown>)
  getErrorObservable(): o.ReadonlyObservable<string>
  // Inserted by the parent (Renderable).
  [sym_insert](parent: Node, ref_child?: Node): void
  // Named conversion strategies this widget accepts as target — exact API TBD.
}
```

> Thoughts: Contract still not final on conversion strategy methods. Destroy-and-recreate on type change is the v1 default. Marquee is out of v1.

Widgets that allow type change show a `...` control on hover and/or focus (scalars). Composite widgets also change type from the toolbar `...`.

In unknown mode, a keyboard shortcut will clear or replace toward `null` (for example Ctrl+Delete). Exact keys are part of the first-version shortcut list.

### Widgets in the default / unknown schema

Chosen from the runtime value (and simple pattern checks where noted). Prefer existing `elt/ui` controls when they fit; otherwise use small built-ins.

> Why: Unknown mode must work with no schema; widgets may be thin wrappers around `elt/ui`.

- `null` — `NULL` display (not edited as text; change type to replace)
- string — textarea
- number — number input (decimals allowed by default)
- boolean — switch
- string or `Date` that looks like a date/time — date / datetime / time picker (on by default; easy opt-out via schema)
- string that looks like a color (`rgba?(…)`, `#` hex) — color widget (on by default; easy opt-out via schema)
- composite (default) — **preview text** control; activating it dispatches `elt-object-editor-open` for that cell’s observable
- schema may replace that with another widget that **edits in place** and never dispatches open (example: `Date` as a date control with its own small popup, not a drill-in to `Date`’s readonly fields)

> Why: “Opens or not” is behavior (dispatch event or not), not a second widget interface.
> Thoughts: Temporal is desirable alongside `Date` when available; same widget family, schema-selectable.

Missing object/table fields use the **undefined** display widget where the schema/unknown rules allow showing absence (see Table). Explicit stored `undefined` remains schema-opt-in (Layer 1).

### Widgets for developers (not in the default unknown catalog)

Available to register or assign through a schema:

- explicit `undefined` scalar (if the schema allows)
- single-line text input (mask / one line)
- toggle / on-off buttons
- select — fixed options; optional “other”; optional fill from values already present in a table column

---

## Layer 5 — Schema (stub)

A schema limits and adjusts behavior at a node: allowed types and widgets, key rules, column vs popup, import/export, toolbar opt-outs, conversion allow-list, date/color heuristic opt-out, defaults for new array/set items, and so on.

**Default (unknown) schema** is always defined. Callers may:

- **supplement** it (merge / extend — e.g. turn off color detection, add a constructor mapping), or
- **replace** it with a fully defined schema

so both “tweak unknown” and “hand a whole schema” work without two different mental models.

Schemas **deep-merge** when extending the default (or another base) so a few properties can be overridden. Passing a **new schema object** built as a full definition **replaces** instead of merging.

A schema may also be **registered for a constructor** on a **global** registry used in unknown mode (so common types get good widgets without a per-editor schema). Callers can still pass a fully defined schema into an editor instance to override.

**v1: native schema only** (no JSON Schema import). Optional JSON Schema subset → native importer is later if ever.

Child / nested rules are a **tree of schema nodes** by value kind (not path strings).

```typescript
/** Discriminated UI schema — native to the object editor, not JSON Schema. */
type SchemaNode =
  | SchemaScalar
  | SchemaObject
  | SchemaArray
  | SchemaSet
  | SchemaMap

interface SchemaCommon {
  /** Force or restrict widget; default = resolve from value + unknown schema. */
  widget?: string // registry id
  /** Prefer popup instead of column when this node is opened. */
  open_as?: "column" | "popup"
  /** Opt out of toolbar pieces inherited from unknown defaults. */
  toolbar?: { search?: boolean, menu?: boolean, /* … */ }
  /** Which type-change / conversion strategy ids are allowed. */
  conversions?: string[] | "none"
  /** Heuristics (date/color string detection, etc.). */
  heuristics?: { date?: boolean, color?: boolean }
}

interface SchemaScalar extends SchemaCommon {
  kind: "scalar"
  /** Allowed JS/runtime types for type change, if restricted. */
  types?: Array<"null" | "undefined" | "string" | "number" | "boolean" | "date" | string>
  allow_undefined?: boolean
  widget_options?: Record<string, unknown> // mask, select options, …
}

interface SchemaObject extends SchemaCommon {
  kind: "object"
  properties?: Record<string, SchemaNode>
  /** Schema for keys not listed in properties (unknown mode: free-form). */
  additional_properties?: SchemaNode | false
  key_editable?: boolean
  key_addable?: boolean
  key_removable?: boolean
  /** Autocomplete known keys; free typing per flags above. */
  known_keys?: string[]
}

interface SchemaArray extends SchemaCommon {
  kind: "array"
  items?: SchemaNode
  /** Default for new elements, or factory. */
  item_default?: unknown | (() => unknown)
  /** Force table vs list when items are objects; default = auto-detect. */
  presentation?: "list" | "table" | "auto"
  /** Table columns when presentation is table (otherwise auto from first rows). */
  columns?: string[]
}

interface SchemaSet extends SchemaCommon {
  kind: "set"
  items?: SchemaNode
  item_default?: unknown | (() => unknown)
}

interface SchemaMap extends SchemaCommon {
  kind: "map"
  keys?: SchemaNode
  values?: SchemaNode
  key_type_changeable?: boolean
}

/** Root schema passed to the shell, or merged onto the default unknown schema. */
interface Schema extends SchemaCommon {
  /** Root node; if omitted, kind is inferred from the root value. */
  root?: SchemaNode
}
```

> Why: Mirrors layouts we already named (object/array/set/map/scalar), encodes toolbar opt-out, open_as, conversions, item_default, table columns — without dragging JSON Schema validation semantics into the UI model.
> Question: Registry of `widget` string ids — global map only, or also per-shell map that overrides global? (Constructor registration already global for unknown mode.)

---

## Layer 6 — Import / Export

Import and export register as **add-on modules** (separate from cell widgets). Expand this section later; keep it in the spec so it is not forgotten.

When the schema allows, add-ons run on the **current node** (scalar or composite), not only on the root.

Clipboard helpers for whole-node import/export are this layer. Multi-cell TSV via marquee is **later** (with the marquee).

### Planned formats

| Format | Direction                                   | How the user gets data in/out (intent)              |
| ------ | ------------------------------------------- | --------------------------------------------------- |
| JSON   | import + export                             | file, clipboard                                     |
| CSV    | import + export                             | file, clipboard                                     |
| TSV    | import + export                             | clipboard (paste from spreadsheets); files optional |
| YAML   | import (main use)                           | file, clipboard                                     |
| Excel  | export as download; import through a wizard | file; wizard details later                          |

The add-on API must support **replace** and **merge** (and related variants), and must allow staying on the current node or resetting the column stack after import.

**Core** exposes a small interface that add-ons **use** for merge/replace and navigation after import (add-ons do not each reinvent merge). Add-ons still own format parsing/serializing.

> Thoughts: Sketch next: `id`, `label`, `canExport(node)`, `canImport(node)`, `export(node)`, `import(raw, ctx)` where `ctx` offers `replace(value)`, `merge(value)`, and navigation via shell `open` on an observable — not path strings.

---

## Packaging

First version ships as an **`elt/ui` component** only. A custom element may come later as a thin layer on top.
