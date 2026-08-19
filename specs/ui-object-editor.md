# Object Editor

The Object Editor is a graphical widget made to edit arbitrary javascript value.

It has the following features :

- Import of serialized data in TextAreas : .csv, tsv (for spreadsheet app interoperability,) and plain JSON
- Export to the clipboard in various format (csv/tsv/JSON)
- A key/value interface for Objects
- A table column/row interface for Arrays of key-wise similar-looking data
- A plain value edition interface
- Customizable widgets and interface

## General things

VirtualScroll should be involved instead of Repeat for all layouts

**Definitions** :
`scalar` : A single value, that is represented by a _single_ widget
`composite` : Any value that is a composite of key/value pairs (objects or Map), or a list of either unique values (Set) or sequential (Array)
`unknown mode` : When no schema is specified, this is pretty much the "default schema". In unknown mode, any value can change to any type, and any layout (composite type) to any other layout type, or to scalar.

## UI / Layout

The object editor is called at a minimum on an `unknown` object as its sole argument. It may also be given a schema. At the very root level, visually, it is just takes up space where it may draw either a Scalar Widget or a Layouting Node for a `composite`.

All composite layouts feature a sticky title/toolbar. In `unknown` mode, it features a search input that filters the displayed elements, and a `...` button allowing to take actions, such as exporting / importing data at the level of the current node, according to what the registered plugins allow, or changing the type of the current node and thus its layout, potentially destructing data after having been warned.

### Object Layout

A vertical list of key / value pairs, where keys are editable strings and values are widgets, aligned to their baseline.

It is an error to give a key the value of an already present key.

### Map Layout

Unlike the object layout, the keys are also `...` editable to change their type. In unknown mode, it can be changed to anything.

### Table Layout

For arrays of same objects, a table layout can be brought up.

## Schema

A schema governs what is possible to do for the UI at a given state. The component can be instanciated by giving it an observable with a corresponding schema to apply to, or a schema may be registered to a particular constructor, which would then be applied to a particular type.

```typescript
interface Schema {
  allows: [""];
}
```

## Import/Export

They register as plugins. We shall expand on them later.

When allowed by the schema, they can be used to import or export data directly at the scalar level or at the layout level.

- Excel : export as a locally created downloadable file, import through a wizard (that can do lots of things)
- CSV : copy/paste + files
- TSV : (for copy/paste with excel) + files (?)
- Plain JSON : files/copy-paste
- Yaml : import, mostly, file and paste

## Simple values vs Composite values : Columnar layout

Composite values are Objects and Arrays, but also Maps and Sets. Unknown other types are treated as Object, unless the schema decides to treat them differently (like Date objects by default that are treated as Scalars with a single widget)

In object mode, keys and values are by default on the same line, in a column. Keys are editable. Values have their widgets aligned to the baseline of the key. In array mode, instead of keys, numeric index is put : it is dragabble among other indexes to reorder them.

By default, composite recursion adds as many columns as desired.

Schemas allow specialization of a lot of the behaviour, such as for instance to open a popup with the value instead of adding a new column.

## Changing Types and Widgets

Unless forbidden by a schema, values can change types.

In their implementation, widgets must have an `init(from_value: unknown)` method ; it is called when they're instanciated.

Most of the time in simple value widgets, a `...` will appear to allow this change in the cell that appears on hover and/or on focus into it. Key/Value / Table / Array editors will also have a `...` in their header to allow for such dramatic change as well.

Keyboard shortcuts will exist to do the changes (like ctrl + delete to create a `NULL`.)

## Widget

```typescript
interface Widget {
  constructor(o_value: o.Observable<unknown>) // The observable can be a derived observable coming from a composite
  getErrorObservable(): o.ReadonlyObservable<string>
  [sym_insert](parent: Node, ref_child?: Node) // Renderable interface
}

## Available widgets

**In unknown mode**
> Note: they may not be

- Plain NULL has the `NULL` value (not editable, just NULL)
- Text Area (from string)
- Number Input (from number,) allows decimal by default
- Switch (from boolean)
- Date / Datetime / Time picker (from string if matching ISO Date regexp or Date)
- Array/Object forwarder that when selected create a new column to the right. (Maybe there could be a "teaser" with the very first values in the forwarder button ?)
- Color : recognizes a few formatters like /rgba?\(...\)$|#\d{6,8}/
- Object/Array/Map/Set/Other Composite previsualisator : Those display a preview of their underlying value. When selected, they open a column to the right with their contents.

**Only available with schemas**

- Plain Undefined is like NULL (not in unknown )
- Text Input : when using masking / only one line
- Toggle / On-Off buttons
- Select : can be with a list of supplied values that may or may not allow other values, or in the case of object table have a way of scanning already existing ones.

## Plain Value edition / Widgets

Whether in key/value, table or plain value edition, edition widgets for a given type are the same code.

When there is no schema or we are in pure JSON mode,

## Key/Value edition

Available for plain objects, but also on objects that extend arbitrary classes - by default on their "own" properties.

It lists vertically the keys on the left and the values on their right.
Keys and values must remain top-baseline aligned, even though values _can_ be taller than the keys.

Keys can be edited, removed and added, only if the schema allows for it.
If the schema specifies known keys, keys can be changed through a lookup-select, which depending on the schema may or may not allow entering new keys.

Trying to rename a key to an already existing one should not be allowed.

## Array edition

Array display the index of the current element and right next to it the edition widget.

It should be possible to have an Array edit the key-values inline of object items ; in which case, we would keep the index to the left with position: sticky, while exploding the key/values just like in key/value mode to the right. This means that

## Table edition

## Object Schema

Schemas can be supplied to the object editor to

- restrict the shape of the object being created.
- customize the widgets used for given value

## Search

In key/value and table mode, there can be a search bar.

## HTML Custom-Element ?

Should we export it as one ??
```
