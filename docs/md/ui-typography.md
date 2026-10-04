---
title: Typography
section: UI
order: 2
---

# Typography

How text is styled and spaced: prose containers, text blocks, text runs, controls inside text, tables. Terms are defined in [elt/ui rules § Terms](./elt-ui-rules.md#terms).

## Prose containers and text blocks

Readable content goes in a prose container — usually `<e-prose>`, but `article`, `section`, `aside`, `main`, `blockquote`, `figure`, `details`, `li`, `dd`, `td` and `th` are prose containers too:

```tsx
<e-prose>
  <h2>Section</h2>
  <p>Body text with <a href="...">links</a>, lists, code, tables, …</p>
  <e-row>
    <button>Retry</button>
    <button e-variant="text">Dismiss</button>
  </e-row>
  <p>More text.</p>
</e-prose>
```

Two separate things are styled:

- **Appearance applies everywhere**: heading sizes, list markers, `blockquote`, `pre` and inline `code`, table cells, link colors, `mark`, `abbr`, `kbd`. An `<h3>` used as a menu title looks like an `<h3>`. These styles have zero specificity, so any class of yours overrides them. They also sit in a cascade layer below elt/ui's controls and layout attributes, which win over them: a `<pre>` or `<blockquote>` placed directly in a `packed` container looks like the container's other cells, not like a framed block.
- **Rhythm (margins) only applies inside a prose container**: a text block gets typographic margins only when it is a *direct child* of a prose container. Anywhere else — directly in a row, column or grid — a text block gets no margin, and its parent's `spacing` applies like for any other child.

So a heading used as a title inside a row or a popup needs no wrapper:

```tsx
<e-column pad="component">
  <h3>Type</h3>        {/* no margin here: the column's spacing applies */}
  <button>Number</button>
  <button>String</button>
</e-column>
```

Lists keep their own internal rhythm (the space between `li`s) wherever they sit. A `figcaption`'s distance to its `figure`, and the space under an open `details`' `summary`, are part of their own look too. A `blockquote` pads its content at the `component` step against its own background.

`e-prose` itself takes every layout attribute ([Layout § Layout attributes](./ui-layout.md#layout-attributes)) plus:

| Attribute | Effect |
| --------- | ------ |
| `table-container` | Wraps a data table: rounded, shrinks to the table's width, makes `thead` rows sticky. |

## Text runs

A prose container's direct children come in two kinds, spaced differently:

- **Text blocks** (headings, paragraphs, lists, quotes, code blocks, tables, rules, figures, details) form text runs. Their spacing is typography's: a heading has more room above than below so it binds to the paragraph it introduces, consecutive headings stay together, consecutive paragraphs share a smaller gap. These margins are relative to the font size, and `spacing` never changes them.
- **Other block-level children** (layout elements, `div`, `article`, `section`, `aside`, `main`, `nav`, `header`, `footer`, `form`, `fieldset`, `address`) get the container's `spacing` as a margin above and below. That is always the *container's* step — the ambient step, or the one its own `pad`/`spacing` sets — never a step the child sets for its own children. `pad="none"` or `spacing="none"` on the container spaces them at zero.

Inline-level children (a button, an input, a link directly in a cell or a list item) sit in a line of text and get no margin. A prose container's first and last children have no outer margin: its own padding, or its parent's spacing, sets that distance.

Where a text block meets another child, CSS margin collapsing (adjacent vertical margins merge into the larger one) keeps the larger of the two margins instead of adding them. So a widget is never closer to text than the text's own rhythm allows, and never closer than `spacing`.

Example, with paragraphs about 16px apart and `spacing="section"` (24px):

```tsx
<e-prose spacing="section">
  <h2>Title</h2>   {/* heading → paragraph: typographic gap */}
  <p>Intro.</p>    {/* paragraph → paragraph: typographic gap, unaffected by spacing */}
  <p>Details.</p>  {/* paragraph → row: larger of 16px and 24px = 24px */}
  <e-row>…</e-row> {/* row → paragraph: 24px again */}
  <p>Outro.</p>
</e-prose>
```

With `spacing="widget"` (6px) instead, both gaps around the row would be the paragraph's own 16px: the text keeps its breathing room.

## Controls in text

A text block that only accepts inline content (`h1`–`h6`, `p`, `pre`, `summary`, `legend`) holds a line of text, and only inline controls belong there: `<a>`, `<button e-variant="link">`, `<button e-variant="text">`, `<kbd>`, inline icons ([elt/ui rules § Text blocks](./elt-ui-rules.md#text-blocks)). Anything with a boundary goes in its own `e-row`/`e-column` next to the text.

A flex element placed directly inside one of those elements becomes `inline-flex` automatically, since it can only be part of that text (an icon and its label inside a paragraph, for instance). Elements that also accept blocks (`li`, `dd`, `td`, `th`, `blockquote`, …) are not affected: set `inline` there when the flex element sits in a line of text.

```tsx
<ul>
  <li>Item #1 <e-row inline packed><button>Edit</button><button>Delete</button></e-row></li>
</ul>
```

## Tables

Tables are styled everywhere: bordered cells padded at the `widget` step, header cells on a level-1 neutral surface, bold. A cell whose only child is a button, label or input loses its padding, and that child its border and radius, so the control fills the cell.

For a data table with a sticky header row, wrap it in `<e-prose table-container>`.

## Fonts

The font family defaults to IBM Plex Sans, falling back to `system-ui` (`theme.settings.fontFamily`); code uses `theme.settings.monospaceFontFamily`. Both, and the body size and line height, are [theme settings](./ui-theme.md#settings).

## Why

Prose follows established typesetting conventions so content reads well without hand-styling: a modular heading scale, headings bound to the text they introduce (more space above than below), balanced line breaks in headings, no orphaned last words in paragraphs. It deliberately sets no line-length limit: constraining width is your app's choice.

Rhythm is reserved to prose containers because margins only make sense around text that is meant to be read in sequence. A heading used as a label in a toolbar or a menu is one widget among others there, spaced by its parent like the rest.

A group of controls doesn't belong in `e-prose` because a prose container spaces its children as blocks around text, not as a row or a column: two buttons directly in `e-prose` sit on the same line of text, and a column of controls gets text margins instead of a layout step.
