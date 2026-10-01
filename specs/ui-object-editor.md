# Object Editor

The Object Editor is a graphical widget that edits a JavaScript value.

> Why: The goal is any JavaScript value. JSON-like data is the usual case, not the only case.

## General instructions

Do not write `css` blocks unless absolutely necessary ; use e-flex for layouting as much as is possible, as well as default styles from elt/ui's typography. Advise when needing to create own styles.

## Scope

**In the first version**

- Bind and edit a value with single-value widgets and multi-part layouts
- Columnar drill-down into nested composites
- Unknown mode (no schema) and schema mode
- The same widgets in every layout
- Import/export as add-on modules (interface and planned formats; details later)
- Undo/redo history (root column header line; committed root snapshots)
- Keyboard use of widgets directly (focus in controls; native control keys only — Enter/blur commit; no global shortcut table yet)
- Short “preview” text on buttons that open a nested composite
- Search/filter in composite toolbars (rules in Layer 2)

When no schema is given, the editor still uses a **default** set of rules: it can show richer JavaScript types, but type changes stay JSON-compatible unless a schema says otherwise.

> Why: “No schema” is not “no rules”; it is the default rule set for free-form values.

**Later (not required for the first version)**

- Excel-like **marquee** (optional overlay + fake focus; see Layer 1b notes)
- Full marquee keyboard navigation and TSV multi-cell clipboard
- Global editor keyboard shortcut table (clear toward null, insert/delete row, Ctrl+Z bindings, …)
- Multiple open trees (tabs / side-by-side panes) — see Layer 1b
- Excel import wizard beyond an empty add-on slot
- Packaging as an HTML custom element (thin wrapper over the `elt/ui` component when done)
- Array “show object fields inline” (sticky index + object fields beside it) — dropped for now; use composite previews and drill-down instead

**Gates (do not start implementation until both are binding rules):**

1. **Shell / widget / DOM model** (Layer 1b) — mostly locked; keep it consistent with later edits. Includes the shell controls (undo/redo on the root column header line; global import/export and host slots later).
2. **Schema + widget config mock** (Layers 4–5) — typed widget configs (`kind` + args), how options reach widget instances, schema resolution, and the **default unknown schema** written out as data in the spec. Product details in Layers 2–3 and Layer 6 may stay incomplete; these two must not.

## Type definitions (source of truth)

TypeScript mocks for widgets, factories, and schema nodes live in **`editor/schema.tsx`**. The markdown spec states behavior; keep the shapes in that file and amend both when they diverge. Do not duplicate full `interface` / `type` blocks here.

A schema node **is** a widget config **is** the widget constructor: a `Factory<Options>` instance built through a combinator function (`object({...})`, `array({...})`, `either(...)`, `string()`, and so on — see `schema.tsx`). There is no separate discriminated-union data shape and no bare string `kind` used for dispatch; dispatch is by class/instance identity. `kind` is kept on each `Factory` only as a stable tag for introspection, custom-widget registration, and later JSON-Schema-subset import.

> Thoughts: `specs/object-editor.tsx` and `specs/resizable.tsx` are earlier, unrelated proofs of concept — not part of this shape, not binding.

---

## Layer 1 — Value model

The editor is always bound to an `o.Observable<unknown>` (or a tighter type when a schema narrows it). Nested parts bind to derived observables (for example `.p(key)` or an array index).

The caller always passes an observable. The editor does not wrap a plain value for them.

**Commit timing**

- **Scalar widgets** do not write the observable on every keystroke. They **commit** when editing stops (blur, Enter, or an explicit confirm in that widget).
- **Structural edits** on composites (add/remove key, reorder, type/layout change, import at this node, and so on) update the observable **immediately** when the action completes.
- **New members are transient until valid.** Inserting a new Object key, Array element, or Set member does **not** write to the observable right away — it starts as a **transient row**, rendered with the same widget as a committed row, held outside the observable. It's written in as a normal structural edit (see above) the first time it holds a value that would be accepted if committed now: a non-colliding key (Object), any value (Array — nothing to reject), a non-duplicate value (Set). Abandoning a transient row (e.g. closing/blurring it without it ever becoming valid) discards it without ever touching the observable. This is what lets a Set's default-`null` insert (Layer 3 Set) not immediately collide with a second insert's default-`null`: neither is in the Set yet, so "duplicate" only applies once one of them actually commits.
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

Unless the schema forbids it, the user may change the type of the current node (scalar to scalar, scalar to composite, composite to composite, and so on) via the type-change menu (the `...` control, Layer 4). This is **always user-initiated** — never something the editor decides to do on its own reactively (see Layer 1b "Invalid parent / external writes" and Layer 4 "Contract" for why automatic resolution must not mutate data as a side effect).

**Two checks per candidate target kind, one mechanism for scalars and composites alike:**

- **`canHandle(value)`** — is the current value already this kind, as-is? If so this kind isn't offered as a *change* (there's nothing to do).
- **`canConvert(value)`** — could this kind represent the value if the user asked to convert it here? When true, the menu offers **Convert** (runs `convert(value)`, writes the result).
- **`defaultValue()`** — always offered as a second, independent choice per candidate kind ("Reset to default"), regardless of whether `canConvert` is true. When `canConvert` is false, it's the *only* choice for that kind.

So every candidate kind in the menu shows one or two options: Convert (if `canConvert`) and Reset to default (always) — never more than that, and never fewer than one.

**Warning before applying:** composite-involving changes (composite → composite, composite → scalar, scalar → composite) always confirm before writing, since crossing that boundary risks dropping structure the target can't represent. Scalar → scalar does not need a confirmation step — `canConvert`/`convert` already only succeeds when the source is representable in the target scalar kind (Layer 4 "Contract"), so there's nothing surprising to warn about; on the rare case a scalar-to-scalar edit still can't succeed, that's a `canConvert` failure, meaning only "Reset to default" is offered in the first place.

> Why: Two small per-kind predicates (`canHandle`, `canConvert`) plus the ever-present `defaultValue()` cover every case the earlier named-strategy-registry design (`object_values`, `string_indexes`, …) was built for — see Layer 5 "Type-change targets" for the concrete table, where every edge only ever needed exactly one conversion path plus the default. A per-conversion "lossless" flag turned out not to be load-bearing either: the warn/no-warn decision above is a structural rule about which *kinds* are involved, not something computed per conversion.

### Widgets all the way down

**Composites are widgets** that embed other widgets (and usually a header line and toolbar: Layer 2). There is no separate “layout” type in the programming model — “object layout / array layout / …” is how those composite widgets present themselves.

> Why: One contract for render, bind, errors, type change, and conversion avoids a parallel Layout API. Composite widgets are just richer widgets.
> Thoughts: Keep using the word “layout” in the UI sections below for how a composite looks; the implementation type is still Widget.

### Editor shell

The **object editor** is a **shell**. It opens a widget for an **observable** (the root, or a derived observable from a parent composite). Widgets do not own the column strip or popup host; they **ask the shell** to open by dispatching `elt-object-editor-open`. The shell chooses column vs popup (schema and shell options).

The shell owns each column's frame and **header line**: the column title, the composite's label and actions, and undo/redo on the root (Layer 2 "Column header line"). Optional global import/export entry points and **slots** for the host application to insert extra controls are later.

When the event originates inside a column that is not the rightmost, the shell **truncates** columns to the right of that column, then opens the new view. When drilling from the rightmost relevant column, it **appends** a column (unless popups are preferred).

Default presentation: a **horizontally scrollable** column container. A shell option may prefer **popups** instead of columns.

**Open request:** widgets **dispatch a DOM event** named `elt-object-editor-open` that bubbles. The event detail carries **`o_value`** (observable to open) and **`title`** (breadcrumb segment). **No separate anchor field** — popup placement uses the event's **`target`** (the element the preview control called `dispatchEvent` on — the element that opened the popup, not whatever ends up handling the event). The shell listens with **`$on`** on its root and calls its own `open(…)`. Widgets do not hold a shell reference.

Column hosts are children of the **shell only** (not nested under another composite’s DOM as column parents).

> Why: Real DOM + bubbling fits elt; `$on` stays idiomatic; the shell method stays the single place that mutates the column stack. **`target`**, not `currentTarget`: the shell's `$on` listener sits on the shell root, so inside that listener `currentTarget` is always the shell root — useless as a popup anchor. `target` stays the dispatching element throughout the bubble regardless of where the listener is attached, which is exactly the preview control the popup should hang off of.

---

## Layer 1b — Shell / widget / DOM model (must settle before coding)

This section chooses how the shell and widgets sit on elt and the DOM. Until the open Questions here are answered, the spec is not ready to implement.

### Identity — observable mount, not a global path

**Locked for v1:**

1. Every mounted widget is bound to an **`o.Observable`** for its value (root: the caller’s observable; children: derived observables created by the **parent composite**).
2. **Open** asks the shell to show a widget for **`o_value`** in the event detail (schema resolved by the shell from registries + runtime type). Not a recomputed root-relative path.
3. **Column truncation:** the DOM is used only to **discover** which column contains the event target / `currentTarget`. The shell keeps an **internal ordered stack** of column hosts (Appender / `sym_insert`, with `close()` and the mounted `o_value`). On open from a non-rightmost column, the shell closes every column to the right in that stack, then appends (or popups). The DOM is not the source of truth for the stack.

**Why not path-as-mount-key:** Set has no coordinates; Map keys may be objects; the editing surface for a Set is already a **projection**.

**Set (and similar projections):**

- Prefer a **dedicated converter / `.tf`** (object-editor-specific is fine) for Set ↔ array (and similarly Map ↔ entries if needed): stable row keys, reuse of per-element observables across updates, write-back into the Set.
- Opening a child uses the **row’s observable** from that projection, reused while the row key lives.
- `RepeatVirtual`/`Repeat` **key** rules align with that converter’s element identity (see **Row / element identity** below — not array index).

**Row / element identity:** `RepeatVirtual` / per-row observables need a **stable unique key** that survives reorder and immutable writes. **Array index alone is not sufficient** (drag-reorder moves the same element to a new index) — the rules below are the exceptions to that, and each is a deliberate, documented degradation, not a silent contradiction of it.

**Three cases, in priority order:**

1. **Explicit key function.** `ArrayOptions.key` (and the equivalent, once written, for Set/Map projections) is `(item, index) => PropertyKey`. When given, that's the row key: stable across reorder and immutable writes, `RepeatVirtual` reuses the row's observable by it.
2. **Schema-mode array/set with no key function ("keyless schema").** Falls back to **index/position** as the key. Accepted, degraded behavior: dragging a row to a new position does not migrate its observable — `RepeatVirtual` treats the row now at that position as a new identity, and if a column is open on a row from that array, reordering the array **invalidates that column** the same way any other identity change does (`INVALID_MOUNT`, above) rather than following the element. This tradeoff is why case 2 is opt-out only, never the default (case 3 below).
3. **Unknown mode ("JSON mode") — no schema at all.** The default/unknown-schema array (Layer 5, `anything`) does **not** use plain index. Instead it **mutably stamps** a well-known **enumerable** symbol property onto each object element the first time it's encountered (`obj[sym_row_id] ??= next_id++`), and uses that as the key. Enumerable (not hidden) because it must survive `o.clone`'s `Object.assign`-based copy for plain objects (verified: `Object.assign` copies enumerable own symbols) and array `slice()` (element references are shared, so the stamp travels with them); the tradeoff is that the symbol shows up in `Object.getOwnPropertySymbols`, though never in `JSON.stringify` or `Object.keys`/`for...in`. This mechanism only applies to **array/set elements that are objects** — primitive elements (strings, numbers, …) can't carry a symbol and fall back to case 2's index/position behavior with the same accepted degradation.

**Array vs Set:** the mechanism is the same (key function → object-stamp → index/position, in that priority order) for both, with one difference — Set's index fallback (case 2) means **iteration-order position**, since Sets have no native index; a Set's own reorder-by-drag already goes through the shared safe-child helper the same way an array's does (see Invalid parent / external writes, above).

> Why: "Array index is not sufficient" stays true as the *default* rule (case 3, which is what unknown mode actually uses); case 2 is a narrower, explicitly-accepted opt-out for schema authors who declined to provide a key function, not a general escape hatch.

Widgets need **their value observable**. They do not need a root-relative path for mounting. A **display path / title** (breadcrumb in the column header) may be derived later for humans; it is not the mount key.

> Why: Truncation is a column-stack/DOM problem; binding is an observable + converter problem.

### Invalid parent / external writes

Naïve `.p()` is unsafe when a parent value becomes non-composite (`undefined`, wrong type) after import, undo, or writes from outside the editor on the root observable.

**The `INVALID_MOUNT` sentinel.** Every derived child observable the editor creates (a plain `.p(key)` wrapper, or a Set/Map projection row) is built through the shared **safe-child helper** below, and its `.get()` returns either the child's real value or the shared module-local sentinel `INVALID_MOUNT` (a `Symbol`, distinct from `o.NoValue` — that one means "no previous value" inside `$observe`, this one means "this slot does not currently exist on its parent"). It never throws.

**Safe-child helper (shared).** One helper, used by every composite for every kind of child access, wraps a parent observable + a key/row-id into a derived observable:

- **Object / plain `.p(key)`:** `INVALID_MOUNT` when `key` is no longer an own key of the parent value (deleted, or the parent itself stopped being a plain object).
- **Array:** `INVALID_MOUNT` when the row's key (see Row / element identity, below) no longer resolves to an index in the current array, or the parent stopped being an array.
- **Map / Set projections:** `INVALID_MOUNT` when the row's key no longer resolves to an entry/member, or the parent stopped being a `Map`/`Set`. This is the same helper the Set ↔ array and Map ↔ entries projections (above) sit on top of — there is one shared converter pattern, not one per composite.

**A mount is valid** when both hold: (a) `o_value.get() !== INVALID_MOUNT`, and (b) the mounted widget's factory still `canHandle(o_value.get())` — the second clause is what "type replaced under it" means: the slot still exists, but no longer holds a value this widget can represent.

**Rules:**

- If a column’s `o_value` is **no longer a valid mount** for that column’s widget (either clause above fails), the shell **closes that column and every column to its right**.
- If the **root** observable becomes `null` or `undefined` (or otherwise a single scalar), the shell keeps **one** root column showing the matching scalar widget and closes all deeper columns. (The root has no parent slot to go missing, so `INVALID_MOUNT` never applies to it — only clause (b), a resolved-kind change, can fire, and for the root that means re-resolving in place rather than closing.)

> Why: Outside writers and import are first-class; the column stack must follow validity, not assume stable composites forever.

**Dead-column detection (v1):** each **column** is watched with an observe tied to its mounted `o_value`, checking the two-clause validity test above. On failure, the shell **closes that column and every column to its right** (root scalar special case above). This is **stack hygiene**, not the same concern as the projection converters, which only mint/read the safe-child observables — they do not themselves close columns.

**Inline mounts (not just columns).** The same clause (b) check applies to every mount, not only columns: an Object row, Array element, or Table cell watches its own child observable the same way a column does, and reacts to invalidity or a resolved-kind change by destroying its child widget and calling the newly-resolved factory's `render()` again for the same observable (the same pattern `EitherFactory` already uses internally, Layer 4). No separate mechanism from dead-column detection — every mount owner (shell for columns, composite for its own children) runs this check on its own children.

This ordering is guaranteed, not incidental: `elt`'s observable queue schedules a value's own observers before its derived children's (`Observable.each_recursive` walks parent-first, appending each observable to the flush array before recursing into its children — `src/observable/observable.ts`), and `node_remove` synchronously calls `stopObserving()` → `removeObserver()` on every observer in the subtree it tears down, before returning. So when a composite's own observe (on its `o_value`) reacts to a child becoming invalid by calling `node_remove` on that child's mounted nodes, the child's own observer is removed from the still-pending flush **before** the queue would ever reach the child's turn in the same flush pass — the child widget never gets a chance to re-render on data its factory can no longer handle.

> Why: This depends on elt's parent-before-child flush ordering and `node_remove`'s synchronous, immediate teardown (both verified in `src/observable/observable.ts` and `src/dom.ts`) — not on any object-editor-specific scheduling trick. Any composite that follows "observe your own `o_value`, mutate DOM synchronously in the observer" gets this ordering guarantee for free.

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

Event: `elt-object-editor-open`, detail `{ o_value, title: string }` (title = breadcrumb segment for this open). Placement via `target` (see Layer 1 — Editor shell for why `target`, not `currentTarget`). Hybrid: event → shell.`open`. Preview dispatches; in-place widgets do not. Later, detail may grow optional pane/tab options without changing mount identity.

### Marquee (later — not v1)

**Dropped from v1.** Users focus widgets directly.

**Design notes for a later optional marquee** (keep for when we resume):

- Optional: some users want events on widgets only, no marquee.
- If present: an **overlay** that intercepts pointer input, keeps an in-memory primary cell + range, draws selection (overlay and/or classes fed by a readonly observable), and on F2/typing moves **real** focus into the target widget.
- `RepeatVirtual`: keyboard may move to a row not mounted yet — selection model is coordinates/keys in memory; overlay/classes apply when the row exists; scrolling may be required before focus.
- Hybrid drawing (coordinate overlay + classes on mounted cells) is likely; pure overlay-only struggles with row height variance.

### Lists

Composite body lists use **`RepeatVirtual`** (in an `<e-virtual-scroll>`, its scroll area) and `node_append`. Open events bubble to the shell. Projection converters must agree with `RepeatVirtual` key reuse.

### Approaches (locked)

| Topic          | Choice                                                                                       |
| -------------- | -------------------------------------------------------------------------------------------- |
| Open           | **C — hybrid** (`elt-object-editor-open` + shell `open`, `$on`)                              |
| Column mount   | **D — shell** mounts column/popup from `o_value`                                             |
| Cell/row mount | **E — parent** composite creates children + converters                                       |
| Mount identity | **Observable**, not path                                                                     |
| Selection v1   | No marquee; per-widget focus only                                                            |
| Widget shape   | Internal Widget classes + `elt/ui` visuals; schema registers customs as `Factory` subclasses |
| Open detail    | `{ o_value, title }` — breadcrumbs from column titles                                        |
| Schema widget  | `Factory<Options>` instance (combinator-built); `kind` is a tag, not the dispatch mechanism  |
| Column stack   | Shell-owned hosts; DOM only to locate source column                                          |
| Widget ctor    | `factory.render(o_value)` → `RenderableWidget`                                               |
| Undo           | Root snapshot ring; root header line; dead-column rules on write                             |

---

## Layer 2 — Header line, toolbar, and columns

### Opening the editor

The caller mounts the **shell** on a root observable (and optional schema; see Layer 5). The shell opens the root observable and shows that widget inside the column/popup host.

### Shell controls

The shell has no toolbar line of its own: **Undo / redo** (see Layer 5 — Undo / redo) sit at the end of the **root column's header line** (see "Column header line" below). The root column is always present and leftmost, so they stay in one predictable place without costing a line.

> Thoughts: Optional **global** import/export entry points and **host slots** (places for the library user to insert extra controls when mounting the shell) would go on the root header line too; if they don't fit there, a shell toolbar above the strip comes back. Not in v1.

### Columns / drill-down

Nested opens are requested by widgets; the shell places them (see Layer 1 — Editor shell). Default: new columns **to the right** (columnar drill-down), strip **scrolls horizontally**.

Maximum depth may be capped by a **parameter** on the editor (optional). Unlimited if unset.

When the shell/schema uses a **popup** instead of a column: the user closes it with an **X** or by focus loss. Commit rules are the same as for columns (structural edits already applied; scalar widgets commit when their editing ends).

**Popup stack semantics.** A popup is tracked in the shell's internal column-stack exactly like a column (Layer 1b): same `INVALID_MOUNT` / dead-mount watch, same closing behavior when its mount goes invalid. Opening from inside a popup can open another popup — `elt/ui`'s `popup()` (`ui/popup.tsx`) already anchors a nested popup under the nearest enclosing popup rather than a detached position: `find_parent_node` walks up from the anchor and "stops at a popup or a top layer element," so a popup opened from inside another popup is parented to it automatically. The shell's `open(...)` uses this as-is — no new originator-tracking needed in `elt/ui`, and no need to build one in the object editor either.

### Column header line

Every column and popup starts with **one header line** (never wraps), built by one shell function for both (`render_chrome` in `shell.tsx`). It is an inverted `<e-row packed="widget" border>`: its widgets touch, each padded at the widget step, separated by seams.

```
[address · Object {3}] [⚠] ………… [… menu] [Undo] [Redo]   (root)
[address · Object {3}] [⚠] ………… [… menu] [×]             (other columns, popups)
```

- The **label** merges the column's open `title` (the key or index it was opened from, Layer 1b; the root has none) with the composite's **type label**, joined by ` · `. It takes the free space and shrinks with an ellipsis; the buttons never wrap.
- The type label is by default the value’s **constructor name** and a short cardinality hint when useful (for example `Array [12]`, `Object {4}`, `Map {3}`). Schema may replace or hide it (`chrome_label`).
- Then the composite's **actions**: Table's divergence warning (Layer 3), and a `...` menu for import/export on this node (what the add-ons and schema allow) and for changing this node’s type or layout (warn if data would be lost).
- Last, Undo/Redo on the root, × elsewhere.

The composite provides its label and actions as `RenderableWidget.header` (Layer 4); the shell places them. A scalar widget has none (the line then holds only the title and the shell's buttons). The shell also keeps **breadcrumbs** for the current column stack (`o_breadcrumb`, from each column's open `title`).

### Composite toolbar

Right under the header line, above its rows, a composite has a **toolbar** on a neutral surface (`RenderableWidget.toolbar`), outside the scroll area — an `<e-row packed="widget" border>` like the header line:

```
[+ Add key] [Filter rows…………] [Aa]
```

- the **add** button ("+ Add key / item / member / entry"), when the composite allows adding
- the **search** field (filters the listed rows — rules below) and its case toggle

The toolbar is not rendered when it would be empty (no adding allowed and search opted out).

> Why: Under the header, not under the rows. Filtering shortens the rows; a bar below them would jump up as the user types in it.

Schema mode **starts from the same chrome** as unknown mode. The schema **opts out** of pieces it does not want (hide or remove actions), rather than starting empty and opting in.

**Search / filter (v1):**

- Match against **keys and values** (stringified / preview text as shown for that row; not a deep recursive walk of unopened nested composites beyond what the row already displays).
- **Case sensitivity** is optional: a small toggle on the search field (VS Code–style); default case-**in**sensitive.
- **Table:** filter **rows** only (do not hide data columns).
- Empty query clears the filter (all rows visible again).

### Lists

Composite lists that can grow use **`RepeatVirtual`**, not `Repeat`, including small lists. Each list is its own `<e-virtual-scroll>` (bounded height), holding exactly one `RepeatVirtual`.

- **Transient rows share the list.** A composite's entries and its transient rows (Layer 1 "Commit timing") are **one** `RepeatVirtual` over the entries followed by the transient rows, each row rendering as an entry or a transient row (`render_composite_grid` in `editor/grid.tsx`). Not two lists: a scroll area holds a single `RepeatVirtual`, and the transient rows must sit after the list's true end, not after the rows currently rendered. A newly added transient row is rendered immediately (no frame delay), so "+ Add" can focus/fill it right away.
- **Row-local state is lost when a row scrolls out of the rendered window.** Anything that must survive (a transient row's key/value, …) lives in observables held by the composite, outside the row (as `transient_rows` does).

> Why: `RepeatVirtual` cost is treated as negligible; one scrolling approach everywhere.

### Focus (v1)

No marquee. Pointer and keyboard go to real controls inside widgets. Opening a composite is via the preview control (click / keyboard activate). Native control keys apply (for example Enter / blur to commit). No global editor shortcut table in v1 (see Scope — Later).

> Thoughts: Excel-like marquee, multi-cell TSV, and optional overlay are **later** (design notes in Layer 1b).

**Accessibility scope (v1):** full keyboard mapping (drag-reorder equivalents, ARIA roles for the column strip / breadcrumbs / sticky table header) is deferred to the same later phase as the marquee and global shortcut table (Scope — Later) — consistent with the marquee itself needing real keyboard navigation to be worth building. v1 relies on native focusable-control semantics only (tab order, native `input`/`button`/`select` roles); no object-editor-specific ARIA layer yet.

> Question: Where does focus go when the column/popup holding it is truncated (drilled from a column to its left), closed by dead-mount detection (Layer 1b), or its widget is destroyed and recreated by a type change? Still open — falls to `<body>` by default without a rule.

---

## Layer 3 — Composite widgets (layouts)

Composite presentation is implemented as widgets (see Layer 1). This section names how each composite **looks and behaves**.

### Composite grid (all composites)

Every composite — Object, Map, Array, Set, Table — is a **grid**, not a list of rows: an `<e-virtual-scroll>` holding one `<e-grid packed="widget" border>`, one `<e-grid-row>` per entry, the body rows rendered by `RepeatVirtual` (`render_composite_grid`, `editor/grid.tsx`).

**Each column is one frame, seams inside it.** The columns are separate components: a row of them spaced at the component step, in a horizontal scroll area (the columns sit in an inner row: a scroll area would otherwise draw the frame of a `packed border` child itself and take the column's away). Each column is a `<e-column packed border>` — header line, toolbar, rows — so `elt/ui`'s frame ownership draws its frame once and every inner line as a seam: the header line and the toolbar (`packed="widget" border`) draw only the lines between their widgets, the grid (inside its scroll area) the lines between cells. A `packed border` container's own background is the seam color, so its cells must fill it: a column's rows area takes the column's free height.

- **Widgets are cells.** A child widget's element is placed directly in the row as one cell (Layer 4 contract): no wrapper between the row and an `<input>`. In a packed bordered grid, cells lose their own border and take the surface as background, so an input reads as a flat cell framed by the seams; its focus ring draws over its neighbors.
- **Columns** (in order, each present only when the composite uses it):

  | Column | Holds | Composites |
  | ------ | ----- | ---------- |
  | drag handle | reorder handle | Array, Set, Map — only once drag-reorder exists (Layer 3 Array/Set/Map) |
  | label | key / index / `#` | Object (key, or a key input on a transient row), Array (index, `+` on a transient row), Map (the key's own widget), Table (`#`) |
  | key type | the key's `...` type-change menu, as its own cell | Map, when `allow_key_type_change !== false` |
  | value(s) | the value's widget, or the composite preview | all; Table has one per data column |
  | controls | the row's controls (remove `−`, discard on a transient row) | whenever the composite can remove or add rows |

- **Controls stack.** The controls cell holds a fixed slot per control the composite can show; a row without a given control keeps an invisible placeholder of the same size. Every row's cell is then as wide, and the controls line up from one row to the next.
- **Cells stretch** to the full row height (the grid default): a cell shorter than its row would leave the seam color showing under it. Every cell has the same padding (`packed="widget"`, the form controls' own), font size and line height, so the **first lines** of all cells line up — also next to a multi-line `textarea`.
- **A widget that can't fill a cell wraps itself** in one element that does (Layer 4): a checkbox/switch is wrapped in a `<label>`, which also makes the whole cell toggle it.
- **Nested composites** are a full-cell button showing the value's **preview text** (`value_preview_text`, the same text the filter matches) followed by `›`; clicking it opens the value (Layer 1b).

**Column widths — first layout, then locked.** Rows come and go as the grid scrolls (`RepeatVirtual`); a column sized by its content would change width with them, and make the view jump. So:

- The grid first lays out as its content wants, each column from an initial template: the label column `fit-content(16em)` (its content, capped: longer keys get `…`), fixed-content columns (controls, key type, `#`) `max-content`, the last value column `auto`.
- On the frame after the grid first has a size and a body row (a `ResizeObserver` on the grid; the lock waits for the next frame, since writing sizes inside the observer would raise the browser's "ResizeObserver loop" error), each column is **locked** to the width it got (the grid's computed `grid-template-columns`: one read for all columns). The last value column keeps that width as a minimum and also takes the width left over (`minmax(<px>, 1fr)`), so the grid always fills its column.
- Once locked, the grid's own width no longer comes from its cells (`contain: inline-size` plus a `min-width` of the locked columns): a long preview scrolling in can't widen the column it sits in.
- Only the rows rendered in that first layout count: a longer key further down is truncated with `…`. A grid with no rows yet, or not displayed yet (a popup before it shows), locks on its first layout that has both.
- A column that appears later (a new table column) is locked the same way on the next layout. Nothing unlocks a column within a mount: reopening the value (a new mount) lays it out again.

Default widget for a composite value:

| Value kind                          | Default composite widget                     |
| ----------------------------------- | -------------------------------------------- |
| plain object / class own properties | Object (key/value)                           |
| `Map`                               | Map (like object, keys can change type)      |
| `Array`                             | Array                                        |
| `Set`                               | Set                                          |
| array of “similar” objects          | **Table** when auto-detect or schema says so |

Other unknown types are shown as Object, unless a schema treats them as scalar (for example `Date`).

**Table vs Array:** auto-detect uses the **first-row** rule (see Table). A schema can force Array or Table. The user can override when unknown mode (or schema) allows type/layout change.

### Object

Key/value rows of the composite grid (above). Keys are editable strings when allowed. Values are widgets whose first line lines up with the key's (a value may be taller than its key; long keys use `…` ellipsis).

Giving a key the same name as an existing key is an error (no silent overwrite).

Keys may be added or removed when unknown mode or the schema allows. If the schema lists known keys, changing a key may use a lookup list (autocomplete); the schema says whether the user may type new key names freely. A newly added key/value pair is **transient** until its key is non-colliding (Layer 1 "Commit timing") — typing a name that collides with an existing key does not error immediately, it just doesn't commit until changed.

**Row order:** schema mode uses `ObjectOptions.properties` array order; unknown mode sorts keys with `String`'s default comparator. A newly added key is always appended at the bottom, regardless of sort order — reopening the node (fresh mount) re-sorts and the key settles into its sorted position at that point, not immediately on add.

### Map

Like Object, except keys are also edited with widgets (and can change type via `...` when allowed). In unknown mode, map keys may become any type.

Map entries can be **reordered** with drag and drop (Maps keep insertion order).

**Duplicate keys:** same rule as Object — a key edit that collides with an existing entry (`map.has(new_key)`) is rejected, no silent overwrite. An open column on the entry being renamed survives the rename itself (a Map key edit is a delete-old + insert-new against the same underlying entry the column is bound to, not two independent structural edits) but is closed by the existing `INVALID_MOUNT` mechanism (Layer 1b) if the rename is instead rejected mid-edit and the row reverts — no new rule needed, the safe-child helper's Map clause already covers "row's key no longer resolves to an entry."

### Array

Each row shows a numeric index and the element’s widget. When allowed, the user can drag indices to reorder.

New elements: same insert controls as Set (hover `+` on boundaries; keyboard bindings later) at positions the schema allows.

Nested objects use the **composite preview** and drill-down into a new column — not fields shown inline beside the index.

### Set

List presentation like Array:

- User **appends** or **inserts** entries (hover `+` on boundaries; keyboard bindings later)
- **Reorder** with drag and drop (Sets keep insertion order)
- Duplicate values are rejected

After insert/append, the new entry is **`null`**, unless the schema provides a **default value** or a **callback** that returns the default for a new item (arrays use the same rule). New entries are **transient** until they'd be a valid commit (Layer 1 "Commit timing") — this is what keeps a second `+` click usable even while a first transient `null` row is still uncommitted: neither is in the Set yet, so they don't collide with each other, only (once one commits) with what's actually stored.

### Table

For arrays of objects that look tabular: each row is one element, each data column is one key from the column set.

**Auto-detect (first-row):**

- The array must be non-empty. The **first** element must be a non-null plain object (not an array).
- Column set = `Object.keys` of the first row (that key order).
- Scan at most the **first 10** elements: every sampled element must be a non-null plain object and must own **every** key of the first row (`Object.hasOwn`). Extra keys on sampled rows do **not** fail detection.
- Empty array, non-object first element, or a failed sample → Array (list), not Table.
- A schema may set `columns` manually instead (or force table/array via `presentation`).

**Layout (v1):** the composite grid (above), with:

- A leading **`#` index column** always shows the row index (same role as the index in Array mode). It is not a data key and is not resizable.
- **Column widths never change while scrolling**: every column follows the composite grid's "first layout, then locked" rule; the last data column also fills what's left.
- Data column headers are **resizable** (drag handle on the header cell's right edge): `$column_resizable` (`editor/table-resize.ts`) reports the new width, which replaces that column's locked width.
- When the locked columns are wider than the column body, the scroll area scrolls horizontally.
- The **header row is sticky** (`<e-grid-row sticky="top">`, before the `RepeatVirtual`), so it stays visible while the body scrolls vertically.
- The filter matches a row on any of its shown cells. "+ Add item" (toolbar) appends `item_default` directly: a table row is an object with every column, already valid, so it has no transient state.

> Thoughts: A text `<input>`'s own width comes from its `size` (20 characters by default), not its value, so text columns all start about as wide; only columns of narrower widgets (switches) or wider headers differ. Setting each input's `size` from its initial value would size them by content — not done in v1.

**Editing:**

- Adding a column adds that key on **every** row object
- Deleting a column removes that key from **every** row object
- Cell editors are the same widgets as elsewhere; a composite cell opens a column or a popup per schema

**Rows after the scanned prefix:** columns stay those of the detected (or schema) key set.

- A row **missing** a column key shows an empty/`undefined`-style cell for that column (not a hidden extra structure).
- A row with **extra** keys not in the column set does **not** show those keys in the table. That data remains on the object; the user can switch to Array-of-objects (unknown mode) or open that row as an object to see everything.

> Why: Auto-detect is imperfect on purpose; unknown mode keeps an escape hatch to Array. First-row columns match the common “uniform records” case without requiring every row’s key set to be identical up front.

**Divergence (first version):** when any row has keys outside the table column set, the Table widget shows a **small warning icon** (`⚠`) among its header-line actions, with the tooltip “Some rows have keys not shown as columns.”

Cells for a column key that is **absent** on that row use the **undefined** widget (missing key — not `null`).

---

## Layer 4 — Widgets

The same widget code is used for a given kind of value whether it appears as an object field, an array element, a table cell, or the root. Composites are widgets too (Layer 1).

### Widget config (schema-facing)

Schemas do **not** name widgets by bare string id. A schema node is a **`Factory<Options>`** instance, built through a combinator function (`object({...})`, `array({...})`, `string()`, `either(...)`, …) rather than assembled as a discriminated data literal. `Options` is the kind-specific argument bag (select options, masks, …), carried on the instance as `.options`. The `Factory` classes and combinators are maintained in `editor/schema.tsx`.

> Why: A `Factory` instance already IS the node, the config, and (via `render`) the construction step — see “Schema vs widget definition” below for why this collapses what used to be two parallel vocabularies (`SchemaNode` vs `WidgetConfig`).

Each `Factory` carries a **`kind`** string (e.g. `"object"`, `"array"`, `"string"`), but `kind` is a tag for introspection, custom-widget registration, and a later JSON-Schema-subset importer — **not** the dispatch mechanism. Dispatch is by the factory instance/class itself: `factory.render(o_value)` mounts it, `factory.canHandle(value)` / `factory.canConvert(value)` drive matching and conversion (below).

**`select` options typing:** mirrors `elt/ui`'s own `Select<T, T2 = T>` (`ui/select.tsx`) rather than a fixed primitive union — `SelectOptions<T, T2 = T>` carries `options: T2[]`, optional `convert_fn?: (opt: T2) => T` / `label_fn?: (opt: T2) => Renderable`, same shape `elt/ui`'s `Select` already takes. "Optional other" and "fill from table column values" (Layer 4 "Widgets for developers") are object-editor-level composition on top of that — not new `elt/ui` surface (see the `elt/ui` control inventory below).

### Contract

See `Factory` / `RenderableWidget` in `editor/schema.tsx`. A `Factory<Options>` exposes:

- **`render(o_value)`** — mounts a `RenderableWidget` bound to that observable. This is the widget constructor step; there is no separate `new Widget(o_value, config)` — the factory instance already holds the config.

**A widget renders one element, and that element is its cell.** `RenderableWidget.render()` returns a single element; the parent composite places it as-is, as a grid cell (Layer 3 "Composite grid"). No wrapper earns its place by default: `EitherFactory` renders its current branch's element directly. A widget whose control can't fill a cell (a checkbox keeps its own size) wraps it in one element that does — that wrapper is the exception, and it belongs to the widget, not to the parent. A composite's own chrome comes as `header` (label + actions, placed on the column's header line, Layer 2) and `toolbar` (placed under the header line; `null` when empty); scalar widgets have neither.

**Re-rendering follows the value's type, not its value.** The parent re-resolves a child's factory only when the value's JS type changes (`is_same_type`), not on every edit: typing changes the value on every keystroke, and re-resolving then would remount the control under the cursor (losing focus) or switch a union's branch mid-typing (a string leaving a color's pattern). `concrete_factory(factory, value)` unwraps `forward()` / `either()` to the factory that actually renders the value, so a composite reached through a union still renders as a composite (preview, or a column with its own header line and toolbar).
- **`canHandle(value): boolean`** — **suitability**: can this factory represent `value` as-is? Drives union branch matching and unknown-mode auto-pick. Read-only — never mutates.
- **`canConvert(value): boolean`** — **convertibility**: could this factory represent `value` if the user explicitly asked to convert it here (Layer 1 "Type changes and conversion")? Kept separate from `canHandle`: a value can be inconvertible-but-already-suitable, or convertible-but-not-suitable-as-is. Only ever consulted from the user-initiated type-change menu, never from automatic union resolution (below).
- **`convert(value): unknown`** — performs the conversion `canConvert` checked. Only ever called after a passing `canConvert` check for the same value; calling it otherwise is a caller bug (the base implementation throws rather than guessing).
- **`defaultValue()`** — target default when converting or inserting; also the type-change menu's always-available "reset to default" choice, independent of whether `canConvert` succeeded.
- **`extend(partial)`** — type-safe partial override (see Layer 5 “deep-merge” replacement below).

**Union resolution never converts.** `EitherFactory` (the runtime behind `either(...)`) exposes a `resolve(value): Factory<unknown>` used for automatic, reactive re-rendering whenever the mounted value changes (including from undo, import, or an outside writer — Layer 1b): it picks the first branch whose `canHandle(value)` is true, and falls back to **`unrepresentable_factory`** — a read-only placeholder widget ("this value's type isn't supported here") — when nothing matches. `resolve` never calls `canConvert`/`convert` and never writes to the observable; automatic resolution answering "which widget can *already* show this" must not have side effects, the same principle `INVALID_MOUNT` (Layer 1b) already enforces for missing slots. `unrepresentable_factory` is not named `Unknown*` to avoid colliding with this spec's separate "unknown mode" (no-schema) vocabulary.

Conversion only happens from the **explicit type-change menu**: for each candidate branch, offer "Convert" when `canConvert(current_value)` (runs `convert`, writes) and always also offer "Reset to default" (runs `defaultValue()`, writes) — see Layer 1 for the full menu-building rule and the warning-before-applying rule.

`RenderableWidget` (what `render()` returns) carries the render output and an **`o_error`** observable — per-mount state, distinct from the factory. Composite widgets aggregate their children's `o_error` into a warning surfaced among their header-line actions (same place as Table's divergence warning, Layer 3).

> Why: Per-mount state must live on the `RenderableWidget` (or the closure inside `render()`), never on the `Factory` instance — one factory (e.g. an array's `values` factory) is shared across every row/cell that uses it, so instance fields would leak state between them.

**Error rendering is the calling composite's responsibility**, not a fixed spec rule — the composite mounting a child widget decides where that child's `o_error` shows (inline, icon + tooltip, aggregated into a warning among its header-line actions per the Table divergence precedent above), since it already owns the layout the child sits in. v1 doesn't enumerate every source that can set a widget's `o_error` beyond the two already named (Layer 3 Object duplicate key, Layer 1 failed best-effort coercion) — each composite/widget owns its own validation and may set it for whatever it checks.

> Thoughts: Destroy-and-recreate on type change is the v1 default (remove the old widget's nodes, call `new_factory.render(o_value)`). Marquee is out of v1.

Widgets that allow type change show a `...` control on hover and/or focus (scalars). Composite widgets also change type from the `...` on their header line.

Global editor keyboard shortcuts (clear toward `null`, insert/delete row, …) are **not** in v1 — see Scope Later. Native control behavior (Enter / blur commit, activate preview) remains.

### Widgets in the default / unknown schema

Chosen from the runtime value (and simple pattern checks where noted). Prefer existing `elt/ui` controls when they fit; otherwise use small built-ins.

> Why: Unknown mode must work with no schema; widgets may be thin wrappers around `elt/ui`.

**`elt/ui` control inventory (checked against current source):**

| Widget kind | `elt/ui` surface | Notes |
| --- | --- | --- |
| string (single-line) | plain `<input type="text">` | No dedicated component; none needed. |
| string (multiline) | `ui/textarea.tsx` (`$auto_grow`) | Existing auto-resize helper — reuse directly. |
| number | plain `<input type="number">` | No dedicated component; none needed. |
| boolean / switch | `<input type="checkbox" e-variant="switch">` | Styling already in `ui/form.css.tsx`; no new component, just the attribute. |
| date / datetime / time | `ui/date.tsx` (`DateTimePicker`) + `ui/timepicker.tsx` (`TimePickerPanel`, `ScrollColumn`) | Already full-featured (am/pm, seconds, step, week-start) — reuse directly. |
| color | **new** — `elt/ui` color control needed | Native `<input type="color">` isn't stylable enough for a consistent cross-browser look. Scope, shape, and naming are being worked out separately in **`specs/ui-color-picker.md`** — this row will point at whatever component that spec settles on. |
| select | `ui/select.tsx` (`Select<T, T2>`) | Existing, non-native, generic — reuse directly (see "select options typing," above). |
| popup anchoring | `ui/popup.tsx` (`popup()`) | Already handles nested popups (see Layer 2 "Popup stack semantics"). |

**One new `elt/ui` component is needed for v1's default widget catalog: a color control** (see table) — under active discussion, see `specs/ui-color-picker.md`. Everything else maps to an existing `elt/ui` piece or a plain native input, so this is the only new-library-surface item to flag per AGENTS.md.

- `null` — `NULL` display (not edited as text; change type to replace)
> Note: this does not need an elt/ui widget
- string — textarea

**Commit key for the string widget:** blur always commits (per Layer 1). Enter commits when `multiline` is off (plain `<input>`); when `multiline` is on (`<textarea>`), Enter inserts a newline as normal and **Ctrl+Enter** commits instead.

- number — number input (decimals allowed by default)

**`NaN` / `Infinity`:** excluded from the default (unknown-mode) number widget, consistent with Scope's "stays JSON-compatible" rule — the default `NumberFactory` treats them as out of range the same way it would any other invalid input (Layer 1 "scalar → scalar" fallback: use the default for the target type). A schema can opt back in by allowing them explicitly (a `NumberOptions` field, not yet named — add when the number widget is actually built).

- boolean — switch
- string or `Date` that looks like a date/time — date / datetime / time picker (on by default; easy opt-out via schema)

**Date/time heuristic predicate:** `value instanceof Date`, or a string matching ISO 8601 date/date-time shapes only — `/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/` (date, or date+time with optional seconds/fraction/offset). Deliberately tighter than plain `Date.parse(...)` success (which also matches incidental strings like `"January"` or `"5"`) — this still covers `JSON.stringify(new Date())` round-trips, the case unknown mode actually needs to handle well. A schema can widen this per-node via `DatetimeOptions` if a looser heuristic is ever wanted.

- string that looks like a color (`rgba?(…)`, `#` hex) — color widget (on by default; easy opt-out via schema)
- composite (default) — **preview text** control; activating it dispatches `elt-object-editor-open` for that cell’s observable
- schema may replace that with another widget that **edits in place** and never dispatches open (example: `Date` as a date control with its own small popup, not a drill-in to `Date`’s readonly fields)

> Why: “Opens or not” is behavior (dispatch event or not), not a second widget interface.
> Thoughts: Temporal is desirable alongside `Date` when available; same widget family, schema-selectable.

Missing object/table fields use the **undefined** display widget where the schema/unknown rules allow showing absence (see Table). Explicit stored `undefined` remains schema-opt-in (Layer 1).

### Widgets for developers (not in the default unknown catalog)

Available to register or assign through a schema (a `Factory` instance):

- explicit `undefined` scalar (if the schema allows)
- single-line text input (mask / one line)
- toggle / on-off buttons
- select — fixed options; optional “other”; optional fill from values already present in a table column

### Preview text (`kind: "preview"`)

Default label is a **string** (enough for the button and `title` tooltip in v1):

- Plain **object / array:** stringify the first one or two entries (key/value or index/value), then `…` if more remain.
- Other prototypes / class instances: **constructor name**, then the same first-property snippet when useful.
- **Map / Set:** same idea on the projected entries/values.
- Optional escape hatch: if the value defines an object-editor **`[sym_preview]()`** (returns `string` or `Renderable`), use that instead. Symbol stays object-editor-local unless a second consumer needs it later.

### Schema vs widget definition (overlap) — resolved

`SchemaNode` and `WidgetConfig` are **one type**: the `Factory<Options>` instance (Layer 4 “Widget config”, above). There is no separate node tree that repeats a `kind` discriminator and then optionally points at a `widget?: WidgetConfig` — nesting (`properties` on `ObjectOptions`, `values` on `ArrayOptions`, `options` on `EitherOptions`) lives directly on each factory's `options`, and a composite factory's children are themselves `Factory` instances.

Union resolution (`either(...)`) walks its branch factories in order and picks the first whose `canHandle(value)` is true (automatic resolution, Layer 4 "Contract") — no discriminant field needed for v1; add one later only if `canHandle` order proves ambiguous in practice. Type-change offers other branches' factories (schema mode, `either`) or the full default-schema catalog (unknown mode), each showing Convert when `canConvert` is true (plus the always-available Reset to default) — see Layer 4 "Contract" for the menu-building rule. Self-referencing schemas (a node that contains itself, e.g. the default unknown schema) use `forward(() => node)`, a lazily-resolving `Factory` wrapper — see `schema.tsx`.

There is deliberately no registry mapping a `kind` **string** to a factory implementation: instantiating a factory (`object({...})`) already gives you the implementation. A string-keyed registry would only matter for a hypothetical serialized-schema format (JSON Schema import, Layer 5), which is explicitly not v1.

---

## Layer 5 — Schema

A schema limits and adjusts behavior at a node: allowed types and widgets, key rules, column vs popup, import/export, toolbar opt-outs, conversion allow-list, date/color heuristic opt-out, defaults for new array/set items, and so on.

**Shapes:** `Factory` and its subclasses (`ObjectFactory`, `ArrayFactory`, `EitherFactory`, …) live in **`editor/schema.tsx`**, per Layer 4. A schema **is** a `Factory` instance — there is no separate `SchemaNode` / `SchemaUnion` type. Prose below is binding for behavior; amend the types file when the shape changes.

**Default (unknown) schema** is always defined **as concrete data** (a real `Factory` tree, not only described in prose) — see `anything` in `schema.tsx`. Callers may:

- **supplement** it (`anything.extend({...})` — e.g. turn off color detection by omitting `color()` from a rebuilt `either(...)`, or add a constructor mapping), or
- **replace** it with a fully defined schema (a whole new `Factory` tree)

so both “tweak unknown” and “hand a whole schema” work without two different mental models.

Schemas **extend** — via each `Factory`'s `.extend(partial)` method — when building on the default (or another base), so a few properties can be overridden. `Factory.extend` defaults to a shallow merge of `.options`; composite kinds override it to merge more precisely (`ObjectFactory.extend` merges `properties` **by name** rather than replacing the whole list — see `schema.tsx`). Passing a **new `Factory` tree** built from scratch **replaces** instead of extending.

> Why: `.extend()` replaces “generic deep-merge” as the merge mechanism because factories are class instances (methods, closures), not plain data — a generic recursive merge can't touch encapsulated state. Type-safety and per-kind merge behavior (e.g. object property lists merging by key) both come for free once merge is a method on the kind, not a generic algorithm.

A schema may also be **registered for a constructor** on a **global** registry used in unknown mode (so common types get good widgets without a per-editor schema) — e.g. mapping `Date` to `date({...})`. Callers can still pass a fully defined schema into an editor instance to override.

There is no separate "widget registry" (`kind` → factory) beyond the constructor registry above: resolving a widget for a value under a schema node just means calling that node's own `canHandle` / `render`, or (unknown mode) walking the default schema's `either(...)` branches.

**v1: native schema only** (no JSON Schema import). Optional JSON Schema subset → native importer is later if ever.

Child / nested rules sit directly on each composite factory's `options` (`ObjectOptions.properties`, `ArrayOptions.values`, `EitherOptions.options` for a union's alternatives) — a **tree of `Factory` instances**, not path strings. An `either(...)` picks its active branch from the runtime value via each alternative's **`canHandle`**, in order (Layer 4).

> Why: Mirrors layouts we already named (object/array/set/map/scalar/union), encodes toolbar opt-out, open_as, conversions, item_default, table columns — without dragging JSON Schema validation semantics into the UI model. Widget choice is the `Factory` instance itself, not a bare string id. See also Layer 4 — Schema vs widget definition.

### Default unknown schema (mock — required before coding)

The default schema is written as concrete data: `anything` in `editor/schema.tsx`, an `either(...)` of `object()`, `array()`, `map()`, `set()`, `color()`, `date()`, `boolean()`, `number()`, `string()`, and `null_factory`, in that order (heuristic kinds — color, date — listed before the plain scalars they'd otherwise be caught by, since `canHandle` picks the first match; composites before scalars; `map()`/`set()` only match an existing `Map`/`Set` value — see "map() / set() factories," below, for why they're not offered as unknown-mode type-change *targets* despite being recognized here).

**`map()` / `set()` factories:** shaped like `ArrayFactory`, following Layer 3's Map/Set behavior:

- `SetOptions`: `{ values: Factory<unknown>, key?: (item, index) => PropertyKey, allow_insert?, allow_delete?, allow_reorder? }` — same fields as `ArrayOptions` minus `mode` (Set has no Table presentation). Elements ARE the key for Set-membership purposes (`Set.has`, Layer 3), independent of the row-identity `key` function used for `RepeatVirtual` (Layer 1b) — the two are unrelated: `key` picks a stable row id for the widget/observable, uniqueness is checked against actual value equality via `Set.has`.
- `MapOptions`: `{ keys: Factory<unknown>, values: Factory<unknown>, allow_insert?, allow_delete?, allow_reorder? }` — `keys` is a separate factory from `values` (Layer 3 Map: "keys are also edited with widgets"), used to render/validate the key-side widget of each row. No `key` field: a Map entry's own key already is a stable row identity (Layer 1b "Row / element identity" already notes "Map keys can work when the key is the identity").

Heuristic opt-out (disabling the date/color pattern checks per node) doesn't need a new `Options` field: since `either(...)` branches are just factories in an array, opting out is rebuilding the union without `color()`/`date()` in it (already how `.extend()`-based supplementing works, per "Default (unknown) schema," above) — no separate toggle needed.

### Resolution

Given: optional root/schema arg, constructor registry, runtime value (and parent factory when descending).

1. If the caller passed a schema, use it (a `Factory` instance) for the root; otherwise start from `anything`.
2. For the value at a node: if the current factory is an `either(...)`, pick the first branch whose `canHandle(value)` is true (first-match order; no discriminant field in v1).
3. If no factory was passed for this value and it's not under `properties` / `values` of a parent (i.e. we're re-resolving from scratch, as unknown mode does at every level), consult the constructor registry for `value.constructor` before falling back to `anything`.
4. Descending into a composite's children uses that composite's own nested factories (`ObjectOptions.properties[].type`, `ArrayOptions.values`) — never a fresh top-level resolution, so a schema passed at the root fully determines its descendants; only genuinely untyped/unconstrained spots (e.g. `array({ values: anything })`) re-enter unknown-mode resolution.
5. Array vs Table: `ArrayOptions.mode` (`"auto"` runs the first-row heuristic, `"table"` / `"list"` force it) — see `ArrayFactory.render` / `eval_auto_table`.
6. The resolved factory's `render(o_value)` mounts the widget; there is no separate "preview vs in-place" resolution step — that's just which `Factory` was picked (e.g. a `Date`-mapped `date()` factory renders in place, while `object()`'s default composite rendering is a preview + drill-in per Layer 4).

**Widget registry scope:** global + per-shell override. The constructor registry is global by default (mapping `Date` → `date({...})`, etc.); a shell instance may pass its own overrides that take precedence for that instance only, without needing a fully custom root schema — same precedent as instance-schema-overrides-global already established above.

### Type-change targets (unknown mode)

**Unknown-mode type-change targets:** `null`, `string`, `number`, `boolean`, `object`, `array` — the JSON-compatible subset (Scope). `Map`/`Set` are offered as targets only when the current node's schema explicitly allows them (Layer 1); they're never offered in pure unknown mode.

**`canConvert`/`convert` per edge** (every edge also always offers "Reset to default" via `defaultValue()`, independent of whether `canConvert` succeeds — Layer 4 "Contract"):

| Source → target | `convert(value)` |
| --- | --- |
| object → array | `Object.values(obj)` |
| array → object | keys `"0"`, `"1"`, … |
| Map → object | `Object.fromEntries(map.entries())` |
| Set → object | same as array → object, applied to `[...set]` |
| array / Map / Set → array | `[...map.values()]` / `[...set]` (array is already `canHandle`, not offered as a target of itself) |
| object / array / Map / Set → Map (schema opt-in) | `new Map(Object.entries(obj))` / `new Map(arr.entries())` |
| array / object → Set (schema opt-in) | `new Set(arr)` / `new Set(Object.values(obj))` — dedupes |
| any composite → scalar | *(`canConvert` false)* — inherently lossy, "Reset to default" only (Layer 1's warning-before-applying rule) |
| any scalar → composite | *(`canConvert` false)* — nothing to preserve, "Reset to default" only |

A schema's `conversions` (if it restricts them) filters which of these `canConvert` checks are honored per node; `defaultValue()` remains the fallback (and, for composite → scalar / scalar → composite, the only option) regardless.

### Undo / redo (v1)

Commit timing (Layer 1) defines _when_ a new value is written. The shell keeps a history of **committed root snapshots** (immutable values already held by the root observable).

- **Depth** `n` is **configurable** (sensible default in the 30–50 range).
- **Undo** moves back in the stack; **redo** moves forward.
- Any **new** commit after undo **truncates** the redo side.
- Controls live on the **root column header line** (Layer 2). Global Ctrl+Z / Ctrl+Shift+Z bindings wait with the shortcut table (Scope — Later); the buttons are enough for v1.
- After undo/redo writes the root, **dead-column detection** (Layer 1b) closes columns that are no longer valid mounts — no separate undo rule.

> Why: Observables already traffic in immutable values; snapshotting the root is the straightforward history model.

**Import snapshots get a smaller cap.** A commit that replaces the whole root (an import, Layer 6) is tagged as such in the ring. A separate, smaller depth `import_undo_depth` (configurable, sensible default well under the regular `n` — e.g. 5) applies to these: once more than `import_undo_depth` import-tagged entries exist in the ring, the oldest ones are dropped (and everything strictly older than the dropped entry, since undo needs a contiguous history) even though the regular `n`-deep cap hasn't been reached. Ordinary (non-import) commits are unaffected and still count against `n` as before.

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
> Question: v1 floor for import/export — empty `...` slot only; JSON clipboard replace on the current node; or strike import/export from v1 Scope until the add-on interface is written?
> Thoughts: Lean JSON clipboard replace on the current node, behind the `ctx.replace/merge` sketch above — exercises the add-on seam and the staleness question below with the cheapest possible format. "Empty slot only" tests nothing.
> Question: Once an add-on's `import()` resolves asynchronously, its target node (the observable `ctx` was built for) may have been truncated, undone, or had its parent replaced in the meantime. Must `ctx.replace(value)` / `ctx.merge(value)` re-validate the target is still a valid mount (Layer 1b's `INVALID_MOUNT` check) before writing, and no-op otherwise?

### Table / spreadsheet import (not v1)

When importing CSV/TSV (and similar) into an object-array or Table node, prefer **map by header**: if the paste/file has a header row, match columns to object keys by header name. When the current node is already a Table (or has a known column set), allow import **without** the user re-specifying columns — map by header when headers are present, otherwise by position into the existing column order.

> Why: Spreadsheet round-trips are the main table import path; header mapping avoids brittle positional-only merges. Deferred so Layer 6 stays a slot in v1.

---

## Packaging

First version ships as an **`elt/ui` component** only. A custom element may come later as a thin layer on top.
