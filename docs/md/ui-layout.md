---
title: Layout
section: UI
order: 1
---

# Layout

Layout elements, their attributes, the spacing scale, borders, `packed` groups, grids, and scroll areas. The rules these implement are in [elt/ui rules](./elt-ui-rules.md#golden-rules); the reasoning is at the end of this page, in [Why these rules](#why-these-rules).

## Layout elements

| Element | Role |
| ------- | ---- |
| `<e-row>` | Flex row. Children are baseline-aligned by default. |
| `<e-column>` | Flex column. |
| `<e-flex>` | Flex, direction set by the `column` attribute — for direction-agnostic code or a direction that changes at runtime. Otherwise use `e-row`/`e-column`. |
| `<e-grid>` | CSS grid. `columns={N}` gives N equal columns; any other template is a small `css` rule ([Grids](#grids)). |
| `<e-grid-row>` | A row of an `e-grid`: spans every column and puts its children on the grid's columns ([Grids](#grids)). Only as a direct child of `e-grid`. |
| `<e-prose>` | Block container for content you read: a prose container, spacing its text by typographic rules ([Typography](./ui-typography.md#prose-containers-and-text-blocks)). |

The `hidden` attribute hides any element, layout elements and controls included: the `elt/ui` reset makes it win over their own `display` (except `hidden="until-found"`, left to the browser).

A panel or card is just a layout element with `border` and/or `surface` — `elt/ui` has no panel component. Whether a card has a fill or only an edge is your app's decision. The overall app layout (page shell, navigation placement) is left to your app too.

```tsx
<e-column pad="component" border align="stretch">
  <e-row justify="space-between">
    <span>Title</span>
    <button e-variant="text">Close</button>
  </e-row>
  <e-prose>...</e-prose>
</e-column>
```

`<header>` and `<footer>` are styled globally as padded flex rows at the `component` step: `header` is an inverted tint band ([Theme § Inversion](./ui-theme.md#inversion)), `footer` a neutral surface one level up. Both are bars ([Bars](#bars)).

## Choosing a step

Look at the container's children, not at its position ([elt/ui rules § Choosing a step](./elt-ui-rules.md#choosing-a-step)):

| The children are… | Step | Examples |
| ----------------- | ---- | -------- |
| Parts of one widget | `widget` | An icon and its label, a field's label and its input |
| Widgets | `component` | The title and buttons of a bar, the fields and buttons of a card |
| Components, or groups of widgets | `section` | Cards in a list, the panels of a view |
| Regions of a page | `stage-1` … `stage-4` | Rare |

Spacing is inherited: a layout element without `pad`/`spacing` spaces its children at its parent's step, and with no `pad`/`spacing` anywhere above it, at `component`. That is right when its children are the same kind of thing as its parent's (a boundary-less row of cards inside a column of cards). When they are a different kind, set the step on that element, whether or not it is a boundary:

```tsx
<e-column spacing="section">              {/* children are cards → section */}
  <e-row>                                 {/* still cards → inherits section */}
    <e-column border pad="component">     {/* a card: its children are widgets → component */}
      <e-column spacing="widget">         {/* one field: label and input are parts of one widget → widget */}
        <label>Name</label>
        <input/>
      </e-column>
      <button>Save</button>
    </e-column>
    <e-column border pad="component">…</e-column>
  </e-row>
</e-column>
```

A bar is a boundary that contains widgets, so it stays at `component` even deep inside a view.

A `packed` container is the exception to "the step above its children": its children touch, so its step is the padding they carry, the step of what it packs. A row of buttons spaced apart is at `component`; the same buttons packed into a button group are at `widget`. See [packed](#packed).

## Spacing scale

Steps are named by the distance they express, not by size. Defaults, overridable through the [theme settings](./ui-theme.md#settings) (each step is also the CSS variable `--e-spacing-<step>`):

| Step | Default | Use for |
| ---- | ------- | ------- |
| `nudge-1` / `nudge-2` / `nudge-4` | 1 / 2 / 4px | Pixel-level nudges only. Never a default choice. |
| `widget` | 6px | Between the parts of one widget. Also the padding of every control. |
| `component` | 12px | Between widgets; the padding of a container of widgets (a bar, a card). The default. |
| `section` | 24px | Between components or groups of widgets: cards, panels, the sections of a view. |
| `stage-1` … `stage-4` | 36 / 60 / 96 / 156px | Between independent regions of a page. |

- The default values double up to `section` (6, 12, 24px); from `stage-1` on, each is the sum of the two before it (24 + 12 = 36, 36 + 24 = 60, …), so the large steps grow more slowly than a doubling would.
- Each step has one value, applied to both axes. An element that genuinely needs asymmetric spacing (a legend sitting on its fieldset's border) takes its numbers from the scale and composes them in its own CSS.
- Controls pad themselves with the same scale (`widget`); there is no separate control-sizing system.

## Layout attributes

Every attribute accepts a plain value or an observable.

### On every layout element

| Attribute | Values | Effect |
| --------- | ------ | ------ |
| `pad` | bare, a spacing step, `"none"` | Pads the element and sets the step its children are spaced at. Bare = `component`. `"none"` removes the padding and the spacing between children. |
| `spacing` | bare, a spacing step, `"none"` | Sets the step children are spaced at, winning over the step `pad` implied. Bare = `component`. `"none"` removes it. |
| `surface` | bare, `"tint"`, `"neutral"`, `"tint-N"`/`"neutral-N"` (N 1–6), `"background"` | Background fill and a new surface level — see [Theme § Surfaces and levels](./ui-theme.md#surfaces-and-levels). Does not pad. |
| `border` | bare, `"tint"`, `"neutral"`, `"tint-surface"`/`"neutral-surface"`, `"tint-separator"`/`"neutral-separator"`, `"tint-N"`/`"neutral-N"` | 1px border — see [Borders and radius](#borders-and-radius). Implies `radius`. |
| `radius` | bare, a spacing step, `"none"` | Corner radius. Bare = derived from the element's own padding (or the ambient step). A step forces that step's value. `"none"` opts out, also when `border` is set. |
| `hover` | boolean | Hover fill one level above the ambient surface, in the ambient surface's color family ([Theme § Surfaces and levels](./ui-theme.md#surfaces-and-levels)). |
| `grow` | boolean | `flex-grow: 1; flex-basis: 0`. |
| `inline` | boolean | `inline-flex` / `inline-grid` / `inline-block`. |
| `relative` | boolean | `position: relative`. |
| `self-align`, `self-justify` | an alignment value | `align-self` / `justify-self`. |
| `max-width`, `max-height` | boolean | `max-width: 100%` / `max-height: 100%`. |
| `full-width`, `full-height`, `full-screen` | boolean | `width: 100%` / `height: 100%` / both. |
| `scroll` | bare, `"x"`, `"y"` | Makes the element a scroll area, on both axes or on one — see [Scroll areas and sticky elements](#scroll-areas-and-sticky-elements). |
| `sticky` | `"top"`, `"bottom"` | Sticks to that edge of the nearest scroll area while its content scrolls — see [Scroll areas and sticky elements](#scroll-areas-and-sticky-elements). |

Alignment values: `center`, `start`, `end`, `self-start`, `baseline`, `first baseline`, `last baseline`, `safe center`, `unsafe center`, `normal`, `stretch`, `space-evenly`, `space-around`, `space-between`.

### On e-row, e-column, e-flex, e-grid

| Attribute | Applies to | Effect |
| --------- | ---------- | ------ |
| `align` | all four, and `e-grid-row` | `align-items`. Flex elements default to `baseline`. |
| `justify` | all four | `justify-content`. |
| `column` | `e-flex` | Column direction. |
| `reverse` | flex elements | Reverses the direction. |
| `wrap` | flex elements | `flex-wrap: wrap`. |
| `packed` | all four | Children touch — see [packed](#packed) and, for grids, [Grids](#grids). Bare, or a spacing step for the children's padding, which is also the container's own step. |
| `seams` | all four, with `packed` | Who draws the lines between the children: `none`, `children`, `default` (when absent) or `forced` — see [Lines between the children](#lines-between-the-children). |
| `seam-color` | all four, with `packed` | The color of the lines the container draws, in the values of `border`; `neutral-separator` when absent. |
| `columns` | `e-grid` | 1 to 12: that many equal columns — see [Grids](#grids). |

`e-grid-row` takes only `surface`, `hover`, `align` and `sticky`.

- These four space their children with `gap`, at the ambient step, unless they have `pad="none"`, `spacing="none"` or `packed`.
- Their children get `min-width: 0; min-height: 0`, so they can shrink below their content's size. To stop a child from overflowing on the cross axis, use `align="stretch"` on the container.
- Buttons, toggles (`label e-variant="toggle"`), checkboxes and radios never shrink in a layout element (`flex-shrink: 0`): their label or box is their content. Text inputs, `select` and `textarea` stay elastic. A `flex-shrink` of your own wins.
- Attributes specific to `e-prose` (`table-container`) and how a flex element behaves inside a line of text are in [Typography](./ui-typography.md#controls-in-text).

## Borders and radius

| `border` value | Color |
| -------------- | ----- |
| bare | `neutral.faded` — a flat, clearly visible edge, the same at any nesting depth |
| `"tint"` / `"neutral"` | `tint.mid` / `neutral.faded` — flat, not level-relative |
| `"tint-surface"` / `"neutral-surface"` | One surface level above this element's surface (its own `surface` if set, else the ambient one) — the `.hover` offset |
| `"tint-separator"` / `"neutral-separator"` | Two levels above — the `.separator` offset |
| `"tint-N"` / `"neutral-N"` (N 1–6) | Absolute level N |

- A **border** is one element's own edge; a **divider** (`<hr>`, a seam between rows) separates elements. They may resolve to the same color but are separate concepts.
- Focusable controls do not take their border from the surface levels: it comes from their variant ([Forms § Shared look](./ui-forms.md#shared-look)).
- **Radius is derived.** An element's radius equals its own padding step, so a bigger padding step gives a bigger radius. An element with `border` but no `pad` of its own uses the ambient step. `radius="component"` (any step) forces a value, for an element that doesn't pad itself. `radius="none"` opts out.
- Neither `border` nor `surface` clips overflow. A child that must match its container's rounded corners takes the container's radius instead (`packed` does this for its children; `<pre>` uses `border-radius: inherit`).

## packed

`packed` on `e-row`/`e-column`/`e-flex` (and `e-grid`, see [Grids](#grids)) implements golden rule 6: no gap, children flush against each other, forming one visually uniform group (button groups, menus, list boxes).

`packed` pads the children that don't set their own `pad`; a child with its own `pad` keeps it.

**A packed group inside a packed container is not padded again.** A packed child is a group of cells, not a cell: its own children carry the padding, so padding the group too would inset their content twice (golden rule 4). Only a `pad` set on the group itself adds padding to it, which is how a navigation column of hover-only links keeps its hover fills off the column's edge: `<e-column packed="widget" pad="widget" align="stretch">` (golden rule 4: a hover fill counts as a boundary). A site menu is a packed column of packed columns of links: only the links are padded.

| Form | Padding of children without their own `pad` |
| ---- | -------------------------------------------- |
| `packed` (bare) | Whatever the container's `pad` resolves to (the ambient pad if it has none): `pad="widget" packed` pads both the container and its children at `widget` |
| `packed="widget"` (a step) | That step, independently of the container's own `pad` |
| `pad="none"` with bare `packed` | No padding |

The container's own `pad` still pads the container itself. `packed` never adds a gap.

**Cells read at the size of controls.** A packed container is a control-sized surface: its cells take the controls' font size (`theme.settings.formFontSize`) and line height (1.25, the controls' line). Text cells then line up with the fields next to them in a stretched row, and a menu or table-like grid looks the same as the controls in it. A control, a heading or an `e-prose` cell keeps the size it sets itself (`e-prose` is a text run again, at the page's font size).

**A packed container's step is the step of what it packs**, not the step above it that a spaced container would take ([elt/ui rules § Choosing a step](./elt-ui-rules.md#choosing-a-step)). The step still matters without a gap: a bare `border` takes its radius from it, so the frame's corners match its children's, and its descendants inherit it.

- `packed="X"` makes X the container's step as well as its children's padding. An explicit `spacing` wins over it. An own `pad` still sets the container's radius, since its padded edge is what is rounded.
- **The step is inherited by nested packed groups.** A packed group inside `packed="widget"` that is itself bare `packed` pads its own cells at `widget`, not at the ambient step; it takes its step from the container around it, as any element does, and a `packed="X"` or `pad` of its own overrides that. Descendants of `packed="X"` also see X as the step their parent spaces them at (the margins a prose container gives its block children), exactly as with `spacing="X"`.
- Bare `packed` with `pad="none"` pads nothing, so nothing tells it what it packs: set the step with `spacing`. A column that only frames groups that pad themselves, such as a header row and a grid of `packed="widget"` rows, is `<e-column packed border pad="none" spacing="widget">`. Without `spacing="widget"`, it would inherit `component` and draw 12px corners around 6px ones.

- **`border` on the container draws a frame and nothing else.** The container's border and radius. The children's own borders on the frame's outline (their edges across, the first one's leading edge, the last one's trailing edge) are never drawn, whatever their variant or state: the frame owns the outline. Without `border` the group has no frame, and what happens to the outline depends on `seams` below.

### Lines between the children

`seams` says who draws the lines between the children of a `packed` container, and which of their own borders stay. A line is a border: no gap is involved, so every line is one whole screen pixel wide at any display scale. The line between two children is the leading edge (`border-left` in a row, `border-top` in a column) of the second one.

| `seams` | The line between two children | The children's own borders |
| ------- | ----------------------------- | -------------------------- |
| `none` | None. | All removed. |
| `children` | The children's own: each child but the last drops its trailing edge, so neighbours share one line and a border is never doubled. | Kept. |
| `default` (when the attribute is absent) | Drawn by the container, in `seam-color`, between every two children, even between two that have no border. | Removed, except a child whose border carries meaning (below), which keeps the lines it shares. |
| `forced` | Drawn by the container, in `seam-color`, whatever the children carry. | All removed. |

`seam-color` takes the values of `border`; `neutral-separator` is the default, two levels above the surface: lighter than a frame, which is `border`'s own color. `seam-color` only has an effect in `default` and `forced`.

- **A border that carries meaning wins the line it shares** (`children` and `default`). A child whose border shows a variant or a state keeps the edges it shares with its neighbours, and the child after it drops its leading edge, so its color shows on both sides. That covers `tint` and `inverted` buttons, a `tint` input, a checked toggle, and any child with `aria-pressed="true"`, `aria-selected="true"`, `aria-current`, `aria-invalid="true"` or `:user-invalid`. An app's own widgets get the same treatment by setting these ARIA states. A layout element that sets its own `border` (an `<e-prose border>` panel) counts too; a packed group does not (see below). A disabled child is not concerned: it is furniture. When two such children are side by side, the first one's border is the shared line. It wins only the lines it shares with a sibling, never the container's outline. A grid row has no border of its own to win with: mark a state on its cells, not on the row (a row with `aria-selected="true"` would make the next row give up its top line, and leave none).
- **Without `border` on the container**, `default`, `forced` and `none` still remove the children's borders on the outline: the children are then lines and fills with no outline. To get the outline back, add `border`, or use `children`, which leaves the children their own (a button toolbar, `<e-row packed="widget" seams="children">`).
- **The mode and the color are inherited** by the packed groups inside the container, and a group can set its own. A non-packed element in between ends the inheritance: a group in a `div` in a packed column starts from `default` again.
- **A packed group inside a packed container is one of its cells.** The line around it belongs to the container (the group's top edge when it comes after another child, say); the group's own children draw only the lines between themselves, and never an edge on the group's outline. The group's own `border` is ignored, except in a `children` container, which leaves its children their borders. This works at any depth, and a grid row is such a group. A meaningful border wins a line only between siblings: a `tint` button that is the last child of a row cannot color the line between that row and the next.
- A **sticky header** (`sticky="top"`, [Scroll areas and sticky elements](#scroll-areas-and-sticky-elements)) carries a copy of the line under it: that line is the next row's top edge, which scrolls away with that row.
- **A row or column that doesn't reach the frame needs a filler.** The last child ends where its content ends: if that is short of the container's end, the frame and the last child are not adjacent and no line fills the hole. Put an empty child that grows at the end (`<e-row grow>&nbsp;</e-row>`), or in a grid row an empty cell that spans the remaining columns.
- A line is a child's border, so a child must fill its area for the line to run its whole length: a row whose `align` doesn't stretch its cells (`start`, `center`, the default `baseline` of a flex row) draws lines as tall as each cell.
- **`<hr>`** directly inside a `packed` row or column is a divider, not a padded child: a 1px line from edge to edge (across a column, down a row), with no padding or margin, in `seam-color`. It is for `seams="none"`, where it is the only line (a menu): in the other modes it adds to the container's lines.
- **Radius**: interior lines are always square. When the container has a radius (its own `border`, or `radius`), the first and last children's outer corners take exactly the container's radius, and a packed group among them hands its corners down to its own first and last children: the outermost container with a radius owns it. When no packed container above has a radius, each child keeps its own radius at every corner.
- A focused child is drawn above its neighbors so its focus ring isn't covered. Sticky elements stay above it ([Scroll areas and sticky elements](#scroll-areas-and-sticky-elements)).
- **The outermost container draws the frame.** A `packed border` group inside a packed container loses its own border like any cell ([Lines between the children](#lines-between-the-children)). Inside a scroll area, a `packed border` child drops its outer border and radius too: the scroll area draws the frame, with its own `border` ([Scroll areas and sticky elements](#scroll-areas-and-sticky-elements)).
- Limitation: when a packed row wraps, its first and last children may end up on different lines, and the outer-corner radius then looks wrong.
- **Hidden children.** In a packed grid, a hidden row is skipped: when the last row is hidden, the one before it gets the grid's outer corners; the same goes for the cells of a row. Between the children of a packed row or column, a hidden child draws nothing and leaves no double or missing line. But a hidden *first or last* child of a packed row or column still counts as first or last: the visible child next to it does not get the container's outer corners, and keeps no trailing border. Render such a child conditionally (`If`) instead of hiding it. (Skipping it would make every insertion at the end of a long packed row or column restyle all the children before it.) A `hidden="until-found"` child counts as displayed: the browser keeps its box, empty but padded, so that find-in-page can reveal it.
- Limitation: a child whose border carries meaning, followed by three or more hidden children in a row, does not take the next displayed child's leading edge: both edges show, a 2px line. One or two hidden children in between are handled.

```tsx
<e-row packed seams="children">
  <button>Bold</button>
  <button>Italic</button>
</e-row>

<e-column packed="widget" border="tint-2" role="listbox">…rows…</e-column>

<e-column packed="widget" border seams="none" align="stretch" role="menu">
  <button role="menuitem">Cut</button>
  <button role="menuitem">Copy</button>
  <hr />
  <button role="menuitem">Delete</button>
</e-column>
```

More examples: [Forms § Button groups and menus](./ui-forms.md#button-groups-and-menus).

## Grids

`<e-grid>` is a CSS grid. `columns={N}` (1 to 12) gives it N equal columns (`repeat(N, minmax(0, 1fr))`). Their width depends on the grid's width only, never on the cells' content — which keeps them steady when rows come and go, as in a [virtual list](./verbs.md#repeatvirtual-a-long-list). Any other template (`1fr auto`, named areas, a template computed from data) goes in a small `css` rule or a `style`, which overrides `columns` ([Theme § Custom CSS](./ui-theme.md#custom-css)).

`<e-grid-row>` is a row of a grid: it spans every column, and its children sit on the grid's own columns (a CSS subgrid), so cells line up from one row to the next. It takes `surface`, `hover`, `align` and `sticky`, nothing else: its spacing comes from the grid. It only makes sense as a direct child of an `e-grid`, and rows don't nest. An `e-row` inside a grid stays an ordinary flex row in one cell.

**A table-like grid is `packed`.** As soon as its rows or cells are boundaries — a row with `surface` or `hover`, a `sticky` row (which gets an opaque background), or `border` on the grid — the cells need padding against those edges ([golden rule 4](./elt-ui-rules.md#golden-rules)), and cells padded alike with no gap between them is what `packed` does. An unpacked grid, spaced with a gap and with unpadded cells, arranges things that pad themselves (a grid of cards), or plain content inside a container that pads itself (labels and fields in a card).

`packed` on a grid works on its **cells**: the grid's children, except that a row isn't a cell — its children are.

- **Without `border`**: no gap; cells are padded like the children of any `packed` container.
- **Lines**: `seams` works as on any packed container ([Lines between the children](#lines-between-the-children)), with rows as the grid's children along the column, and a row's cells along the row. The line between two rows is the top edge of the second row; the line between two cells of a row is the left edge of the second. `children` has no lines to share in two directions: the cells keep every border. Place the cells in rows: a cell placed directly in the grid gets no line.
- **With `border`**: the grid draws the frame, and in `default` and `forced` a line in `seam-color` runs between all cells, rows included. A row with its own `surface` colors its cells and still shows its lines; a row with `hover` changes its cells' color when hovered.
- **Every row must reach the last column**, as every row or column of a framed container must reach its end: a row with fewer cells ends with an empty cell that spans the remaining columns. Cells must also fill their area for the lines to run their whole length: a row whose `align` stops its cells from stretching to the row's height (`start`, `center`) draws lines as tall as each cell. Leave rows stretching (the default), and put a fixed-size control in an element that fills the cell, such as a `label` around a checkbox.
- **Radius**: cells are square, except the outer corners of the first and last rows, which take the grid's radius when it has one. This only works with rows: a cell placed directly in the grid can't be told apart from an inner one, so a square corner cell may show past the grid's rounded border. Use rows, or `radius="none"`.

```tsx
<e-grid columns={3} packed border>
  <e-grid-row surface="tint-2"><span>Name</span><span>Kind</span><span>Size</span></e-grid-row>
  <e-grid-row hover><span>a.txt</span><span>text</span><span>3 kB</span></e-grid-row>
  <e-grid-row hover><span>b.png</span><span>image</span><span>120 kB</span></e-grid-row>
</e-grid>
```

## Scroll areas and sticky elements

`scroll` makes a layout element a scroll area: `overflow: auto` on both axes, or on one with `scroll="x"`/`scroll="y"` (the other axis is clipped). It needs a bounded size (a `height`, a `max-height`, or a parent that bounds it) to scroll at all.

- A scroll that reaches the end of a scroll area carries on to the enclosing scroll area or the page, as everywhere on the web; a scroll area that doesn't overflow lets the page scroll under the pointer. An area that must never move what's behind it (a modal's content over a scrolling page, a chat log) sets `overscroll-behavior: contain` itself — note that this also blocks the page while the area has nothing to scroll.
- The page itself doesn't bounce: the `elt/ui` reset sets `overscroll-behavior: none` on `html` and `body`. On mobile this also turns off pull-to-refresh; a page that wants it back sets `html { overscroll-behavior: auto }`.
- In a flex scroll area (`e-column scroll`, `e-row scroll="x"`, …), children keep their size along the scrolled axis instead of shrinking to fit — otherwise nothing would overflow, and nothing would scroll. A child that is itself a scroll area is the exception: it shrinks, and scrolls its own content.
- The scroll area draws the frame: a `packed border` child loses its own outer border and radius, keeps its lines, and is clipped to the scroll area's rounded edge. Put `border` on the scroll area.

`sticky="top"` / `sticky="bottom"` keeps an element on that edge of the nearest scroll area while the content scrolls under it: a table header, a totals row. It gets an opaque background (the current surface, or its own `surface`) and is drawn above the scrolled content, a focused cell included: as in a spreadsheet, a cell scrolled under a stuck header passes beneath it, focus ring and all. A sticky row of a `packed border` grid keeps its lines.

- In a packed column or grid (`default` or `forced`), a `sticky="top"` element keeps the line between it and the scrolled content while it is stuck. That line is normally the next element's top edge, which scrolls away with it, so the sticky element carries a copy as its own bottom border, pulled back over that top edge by a -1px margin. Nothing to set: layout is unchanged, and at rest the copy covers the line exactly. It uses its bottom border and margin for this, so don't set them yourself. A `sticky="bottom"` element's top edge is its own line, like any element that has one above it.

- Don't `pad` a scroll area that contains sticky elements: they stick at its padding edge, not its border, and the scrolled content shows through the padding above (or below) them.
- A virtual list ([Verbs § RepeatVirtual](./verbs.md#repeatvirtual-a-long-list)) uses the nearest scroll area around it. Don't `pad` that one either, for the same reason.

An infinite grid: a virtual list of 100 000 rows in a packed, bordered grid, with a sticky header and footer.

```tsx
//@inline-example
import { $bind, If, o, Repeat, RepeatVirtual } from "elt"

const COLUMNS = [2, 3, 4, 6] as const
const o_columns_idx = o(1)
const o_columns = o_columns_idx.tf((i) => COLUMNS[i])
const o_column_list = o_columns.tf((n) => Array.from({ length: n }, (_, i) => i + 1))
const o_border = o(true)
const o_header = o(true)
const o_footer = o(true)
const o_tinted = o(true)
const o_rows = o(Array.from({ length: 100_000 }, (_, i) => i))

return (
  <e-column align="stretch">
    <e-row wrap>
      <label>
        Columns{" "}
        <select>
          {$bind.selected_index(o_columns_idx)}
          {COLUMNS.map((n) => <option>{n}</option>)}
        </select>
      </label>
      <label><input type="checkbox">{$bind.boolean(o_border)}</input> border</label>
      <label><input type="checkbox">{$bind.boolean(o_header)}</input> sticky header</label>
      <label><input type="checkbox">{$bind.boolean(o_tinted)}</input> tinted header</label>
      <label><input type="checkbox">{$bind.boolean(o_footer)}</input> sticky footer</label>
    </e-row>
    <e-column scroll align="stretch" border style={{ height: "320px" }}>
      <e-grid columns={o_columns} packed border={o_border}>
        {If(o_header, () => (
          <e-grid-row sticky="top" surface={o_tinted.tf((t) => (t ? "tint-2" : false))}>
            {Repeat(o_column_list, (o_c) => <span>Column {o_c}</span>)}
          </e-grid-row>
        ))}
        {RepeatVirtual(o_rows, (o_i) => (
          <e-grid-row hover>
            {Repeat(o_column_list, (o_c) => <span>{o_i} · {o_c}</span>)}
          </e-grid-row>
        )).ItemSize(32)}
        {If(o_footer, () => (
          <e-grid-row sticky="bottom" surface="neutral-1">
            {Repeat(o_column_list, () => <span>{o_rows.tf((r) => r.length)} rows</span>)}
          </e-grid-row>
        ))}
      </e-grid>
    </e-column>
  </e-column>
)
```

## Bars

A bar is a row holding a title and/or controls along the edge of a view, a dialog or a card: the app's top toolbar, a title row, a footer or status bar. A button toolbar, a row of buttons inside a view, is not a bar: it has no background of its own. The binding rules are in [elt/ui rules § Bars](./elt-ui-rules.md#bars); which color a bar gets is in [Theme § Emphasis](./ui-theme.md#emphasis).

**One line.** A bar is a single row: the title, then the actions. Stacking a subtitle under the title or wrapping the actions onto a second row doubles the bar's height for little information, and makes it look different on every screen width. Only a request that explicitly asks for two lines gets them.

**When space runs short**, the title gives way, not the actions. `e-ellipsis` keeps an element's text on one line and ends it with "…" where it is cut. Directly in a row (or a `<header>`/`<footer>`), the cut element is the elastic part: it takes the free space, which puts the actions after it at the end, and it gives way first when the row runs out of room: buttons never shrink, and a text input next to it shrinks less than the title does. Put it directly in the bar: wrapped in another element, that wrapper sets the size and nothing gets cut.

```tsx
<header>
  <h2 e-ellipsis>Quarterly report — draft for the board meeting</h2>
  <button>Share</button>
  <button>{$click((ev) => more_menu(ev.currentTarget))}…</button>
</header>
```

`e-ellipsis` works on any element. An inline element (`span`, `strong`, …) outside a row is made `inline-block` so the cut can happen.

**Too many actions.** The bar must fit at the smallest window width the app supports. Keep the frequent actions in the bar and put the rarely used ones in a "…" menu built with `popup` and `menu_nav` ([Overlays § Keyboard in menus and lists](./ui-overlays.md#keyboard-in-menus-and-lists)). Which actions go in the menu is decided when the bar is designed; nothing moves them there automatically when the window narrows.

**A button toolbar** groups related buttons with no band around them: a `packed="widget" seams="children"` row, or a spaced row of such groups. Each button keeps its own border and variant, so one of them can be `tint` or `inverted`.

```tsx
<e-row>
  <e-row packed="widget" seams="children">
    <button>Bold</button>
    <button>Italic</button>
  </e-row>
  <e-row packed="widget" seams="children">
    <button>Link</button>
    <button e-variant="tint">Comment</button>
  </e-row>
</e-row>
```

## Why these rules

**Golden rule 1 — content never touches.** Content needs room to breathe. A widget's content sitting directly against another widget's, or a paragraph running straight into a control, reads as one cramped blob. Boundaries are a different matter: two bordered buttons may share an edge (rule 6), because what the eye separates is their content, which stays padded. A text run counts as one entity because its internal rhythm is already correct: typography has spaced its headings and paragraphs on purpose, and layout spacing must not disturb it.

**Golden rule 2 — whitespace creates groups.** The distance between elements is what tells the reader which ones belong together. Things of the same kind must therefore be spaced alike, and the parts of one thing must sit closer together than the things themselves — otherwise a field's label would look as related to the next field as to its own input.

The step is chosen by what a container's children are, not by nesting depth and not by boundaries. Nesting depth is an accident of how the DOM is built: a boundary-less row inside a column is just a way of arranging things, and keeps the column's spacing because its children are the same kind of thing. Boundaries are no better a signal: a bar is a boundary, yet its children are widgets like those around it, so it spaces them at `component` wherever it sits. Asking "what are these children?" gives the same answer on every screen, whoever builds it. The step is written explicitly where the kind of children changes, which keeps it visible in the code.

**Golden rule 3 — never set your own margin.** A margin is an element deciding how far it stands from neighbors it knows nothing about. The parent is the only element that sees all its children, so it alone decides their spacing. Margins set by children also stack and collapse in ways that are hard to predict, which breaks rule 2.

**Golden rule 4 — padding requires a boundary, and a boundary pads its content.** Padding is the distance between content and its own edge. Without a border or a background, there is no edge, and the padding is invisible space that behaves like a margin — with all of rule 3's problems. That is why it is forbidden, not merely discouraged. The edge of the window counts as an edge: the outermost container of a screen pads itself against it, which keeps content off the window's border. The rule also holds the other way around: an edge with content pressed against it reads as content cut off by its frame, the same cramped look rule 1 forbids between two widgets. Rule 1 alone doesn't catch it, since a border or a fill isn't another entity's content. Who provides the padding is free — the boundary itself, or its children when they are `packed` — but some element between the edge and the content has to, and only one: padding supplied twice (a packed group inside a packed container, each padding its children) would inset the content by two steps, while a plain child next to the group sits at one. Padded space that no edge or fill shows is a margin in disguise, which rule 3 forbids.

**Golden rule 5 — multiple children are spaced.** Follows from rule 1 for containers. Layout elements satisfy it by default: they space their children at the ambient step even with no attribute. `pad` implies `spacing` because a padded container is precisely a container whose children must be spaced; `spacing` doesn't imply `pad`, because a container without a boundary may need to space its children without becoming a boundary.

**Golden rule 6 — or they touch, uniformly.** The one alternative to spacing: children flush against each other, separated by lines and their own backgrounds — a button group, a menu, a list box, a dialog's header/body/footer. It only reads as one deliberate shape if the children share the same padding; a child with different padding makes the lines look accidental. Uniform is measured on the content: every cell holding content sits at the same distance from the group's edge, which is why a packed group nested in a packed container is not padded again, its own cells carry the padding. A child that sets its own `pad` inside a `packed` group keeps it, so keeping the group uniform is your call. Whether the group also pads its own edge is a separate choice, possibly at a different step, as long as the group has an edge of its own: a popup's edge inset can be larger than its rows' click-target padding. That is why `packed` takes its own step independently of `pad`.

**Spacing steps are named by meaning.** Steps say the semantic distance between what they separate — inside one widget, between widgets, between groups, between page regions — not a size. Choosing by meaning rather than by eye is what keeps two screens built by different people consistent.

**Element names.** `e-row`/`e-column` name the shape they produce; `e-flex` remains for direction-agnostic code. `e-grid` has no grid system beyond `columns`: equal columns are common enough to deserve an attribute, but any other template is specific enough to its screen that a small CSS rule says it better than a set of attributes. A grid row is `e-grid-row` rather than a special meaning of `e-row` inside a grid, so that an `e-row` can still be an ordinary cell.

**The outermost container draws the frame.** When containers that each want a border are nested (packed groups, a scroll area around a grid), drawing every border would double the lines and, in a scroll area, scroll the inner frame away with the content. So only the outermost one draws its frame; the inner ones are cells of it, and draw only the lines between their own children.

**Borders.** A bare `border` is a flat, clearly visible edge, independent of nesting, because most borders (a popup, a list box) want a plain, defined boundary wherever they are. The level-relative variants exist but are explicit (`-surface`, `-separator`), so a border never silently depends on nesting depth. `surface` is level-relative even when bare, because a surface *is* a level by definition — the asymmetry between the two attributes is deliberate.

**Radius is derived from padding** so it is never a second thing to keep consistent by hand. An element that doesn't pad itself (a packed column whose header, body and footer rows pad themselves, as in a dialog) names a step explicitly. Rounded containers never clip their children; a child touching the container's corners takes the container's radius instead, so mismatched corners can't happen in the first place.
