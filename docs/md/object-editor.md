---
title: Object Editor
order: 110
section: UI Recipes
---

# Object Editor

`ObjectEditorShell` (`elt/editor`) renders a generic tree/table editor over an `Observable`
holding any JSON-like value: objects, arrays (list or table layout), `Set`s, `Map`s, and
free-form "unknown mode" documents. Every example below is live, using the actual `elt/editor`
package.

**Unstable:** `elt/editor` is under active development and its API may change without notice. Do not build on it in code that must keep working across elt upgrades.

## Schema-mode object

A `schema` describes known properties up front: scalars, a multiline string, a bounded number, a
nullable date, a string array in list mode, and a nested object with its own toolbar opted out.

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

An array of uniform objects switches to table layout on its own (`mode: "auto"`). Edit cells
inline; use *+ Add item* for a new row.

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

`mode: "table"` with an explicit `columns` list. The first row still carries a `warehouse` key in
its underlying data — look for the **extra keys** toolbar warning; hidden column data stays on
the object, it is not discarded.

```tsx
//@inline-example
import { o } from "elt"
import { ledger_schema, ledger_seed } from "../object-editor-schemas.ts"
import { ObjectEditorShell } from "elt/editor"

const o_ledger = o(structuredClone(ledger_seed))
const shell = new ObjectEditorShell(o_ledger, { schema: ledger_schema })

return shell.node
```

Large tables (thousands of rows) use `VirtualScroll` internally.

## Set — unique members

Set membership list — duplicates are rejected on commit. *+ Add member* starts a transient row
defaulting to `item_default`.

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

Key/value rows with separate key and value widgets.

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

Without a `schema`, the editor infers structure from the value itself: free keys, a row filter,
and nested composites. This is the mode to reach for when editing arbitrary/untrusted documents.

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

A schema-mode object can declare a `RegExp` property name to accept any key matching a pattern —
here, `theme`/`debug` are named explicitly and anything matching `/^feature_/` is accepted too.

```tsx
//@inline-example
import { o } from "elt"
import { config_schema, config_seed } from "../object-editor-schemas.ts"
import { ObjectEditorShell } from "elt/editor"

const o_config = o(structuredClone(config_seed))
const shell = new ObjectEditorShell(o_config, { schema: config_schema })

return shell.node
```
