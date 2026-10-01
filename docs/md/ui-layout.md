---
title: Layout
section: UI
order: 1
---

# Layout

Layout elements, their attributes, the spacing scale, borders, and `packed` groups. The rules these implement are in [elt/ui rules](./elt-ui-rules.md#golden-rules); the reasoning is at the end of this page, in [Why these rules](#why-these-rules).

## Layout elements

| Element | Role |
| ------- | ---- |
| `<e-row>` | Flex row. Children are baseline-aligned by default. |
| `<e-column>` | Flex column. |
| `<e-flex>` | Flex, direction set by the `column` attribute — for direction-agnostic code or a direction that changes at runtime. Otherwise use `e-row`/`e-column`. |
| `<e-grid>` | CSS grid. There is no grid "system": write `grid-template-*` in a small `css` rule ([Theme § Custom CSS](./ui-theme.md#custom-css)). |
| `<e-prose>` | Block container for content you read: a prose container, spacing its text by typographic rules ([Typography](./ui-typography.md#prose-containers-and-text-blocks)). |

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

`<header>` and `<footer>` are styled globally as padded flex rows at the `component` step: `header` is an inverted tint band ([Theme § Inversion](./ui-theme.md#inversion)), `footer` a neutral surface at level 1.

## Choosing a step

Look at the container's children, not at its position ([elt/ui rules § Choosing a step](./elt-ui-rules.md#choosing-a-step)):

| The children are… | Step | Examples |
| ----------------- | ---- | -------- |
| Parts of one widget | `widget` | An icon and its label, a field's label and its input |
| Widgets | `component` | The buttons of a toolbar, the fields and buttons of a card |
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

A toolbar is a boundary that contains widgets, so it stays at `component` even deep inside a view.

## Spacing scale

Steps are named by the distance they express, not by size. Defaults, overridable through the [theme settings](./ui-theme.md#settings) (each step is also the CSS variable `--e-spacing-<step>`):

| Step | Default | Use for |
| ---- | ------- | ------- |
| `nudge-1` / `nudge-2` / `nudge-4` | 1 / 2 / 4px | Pixel-level nudges only. Never a default choice. |
| `widget` | 6px | Between the parts of one widget. Also the padding of every control. |
| `component` | 12px | Between widgets; the padding of a container of widgets (a toolbar, a card). The default. |
| `section` | 24px | Between components or groups of widgets: cards, panels, the sections of a view. |
| `stage-1` … `stage-4` | 48 / 96 / 128 / 256px | Between independent regions of a page. |

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

Alignment values: `center`, `start`, `end`, `self-start`, `baseline`, `first baseline`, `last baseline`, `safe center`, `unsafe center`, `normal`, `stretch`, `space-evenly`, `space-around`, `space-between`.

### On e-row, e-column, e-flex, e-grid

| Attribute | Applies to | Effect |
| --------- | ---------- | ------ |
| `align` | all four | `align-items`. Flex elements default to `baseline`. |
| `justify` | all four | `justify-content`. |
| `column` | `e-flex` | Column direction. |
| `reverse` | flex elements | Reverses the direction. |
| `wrap` | flex elements | `flex-wrap: wrap`. |
| `packed` | flex elements | Children touch — see [packed](#packed). Bare, or a spacing step for the children's padding. |

- These four space their children with `gap`, at the ambient step, unless they have `pad="none"`, `spacing="none"` or `packed`.
- Their children get `min-width: 0; min-height: 0`, so they can shrink below their content's size. To stop a child from overflowing on the cross axis, use `align="stretch"` on the container.
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

`packed` on `e-row`/`e-column`/`e-flex` implements golden rule 6: no gap, children flush against each other, forming one visually uniform group (button groups, menus, list boxes).

`packed` pads the children that don't set their own `pad`; a child with its own `pad` keeps it.

| Form | Padding of children without their own `pad` |
| ---- | -------------------------------------------- |
| `packed` (bare) | Whatever the container's `pad` resolves to (the ambient pad if it has none): `pad="widget" packed` pads both the container and its children at `widget` |
| `packed="widget"` (a step) | That step, independently of the container's own `pad` |
| `pad="none"` with bare `packed` | No padding |

The container's own `pad` still pads the container itself. `packed` never adds a gap, except the 1px seam below.

- **Without `border` on the container**: each child keeps its own border (native controls already have one; `border` gives one to anything else), and every child except the last drops its trailing-edge border (`border-right` in a row, `border-bottom` in a column), so adjacent bordered children share one line. This happens whether or not the child has a border.
- **With `border` on the container**: the container draws the border. It gets a 1px gap between children and a background the same color as its border, so the gap shows as a seam. Every child gets `border: none` and the ambient surface as background (a background you set on the child yourself still wins).
- **Radius**: interior seams are always square. When the container has a radius (its own `border`, or `radius`), the first and last children's outer corners take exactly the container's radius. When it has neither, each child keeps its own radius at every corner.
- A focused child is drawn above its neighbors so its focus ring isn't covered.
- Limitation: when a packed row wraps, its first and last children may end up on different lines, and the outer-corner radius then looks wrong.

```tsx
<e-row packed>
  <button>Bold</button>
  <button>Italic</button>
</e-row>

<e-column packed="widget" border="tint-2" role="listbox">…rows…</e-column>
```

More examples: [Forms § Button groups and menus](./ui-forms.md#button-groups-and-menus).

## Why these rules

**Golden rule 1 — content never touches.** Content needs room to breathe. A widget's content sitting directly against another widget's, or a paragraph running straight into a control, reads as one cramped blob. Boundaries are a different matter: two bordered buttons may share an edge (rule 6), because what the eye separates is their content, which stays padded. A text run counts as one entity because its internal rhythm is already correct: typography has spaced its headings and paragraphs on purpose, and layout spacing must not disturb it.

**Golden rule 2 — whitespace creates groups.** The distance between elements is what tells the reader which ones belong together. Things of the same kind must therefore be spaced alike, and the parts of one thing must sit closer together than the things themselves — otherwise a field's label would look as related to the next field as to its own input.

The step is chosen by what a container's children are, not by nesting depth and not by boundaries. Nesting depth is an accident of how the DOM is built: a boundary-less row inside a column is just a way of arranging things, and keeps the column's spacing because its children are the same kind of thing. Boundaries are no better a signal: a toolbar is a boundary, yet its children are widgets like those around it, so it spaces them at `component` wherever it sits. Asking "what are these children?" gives the same answer on every screen, whoever builds it. The step is written explicitly where the kind of children changes, which keeps it visible in the code.

**Golden rule 3 — never set your own margin.** A margin is an element deciding how far it stands from neighbors it knows nothing about. The parent is the only element that sees all its children, so it alone decides their spacing. Margins set by children also stack and collapse in ways that are hard to predict, which breaks rule 2.

**Golden rule 4 — padding requires a boundary.** Padding is the distance between content and its own edge. Without a border or a background, there is no edge, and the padding is invisible space that behaves like a margin — with all of rule 3's problems. That is why it is forbidden, not merely discouraged. The edge of the window counts as an edge: the outermost container of a screen pads itself against it, which keeps content off the window's border.

**Golden rule 5 — multiple children are spaced.** Follows from rule 1 for containers. Layout elements satisfy it by default: they space their children at the ambient step even with no attribute. `pad` implies `spacing` because a padded container is precisely a container whose children must be spaced; `spacing` doesn't imply `pad`, because a container without a boundary may need to space its children without becoming a boundary.

**Golden rule 6 — or they touch, uniformly.** The one alternative to spacing: children flush against each other, separated by their own backgrounds or borders — a button group, a menu, a list box, a dialog's header/body/footer. It only reads as one deliberate shape if the children share the same padding; a child with different padding makes the seams look accidental. A child that sets its own `pad` inside a `packed` group keeps it, so keeping the group uniform is your call. Whether the group also pads its own edge is a separate choice, possibly at a different step: a popup's edge inset can be larger than its rows' click-target padding. That is why `packed` takes its own step independently of `pad`.

**Spacing steps are named by meaning.** Steps say the semantic distance between what they separate — inside one widget, between widgets, between groups, between page regions — not a size. Choosing by meaning rather than by eye is what keeps two screens built by different people consistent.

**Element names.** `e-row`/`e-column` name the shape they produce; `e-flex` remains for direction-agnostic code. `e-grid` has no grid system: a grid template is specific enough to its screen that a small CSS rule says it better than a set of attributes.

**Borders.** A bare `border` is a flat, clearly visible edge, independent of nesting, because most borders (a popup, a list box) want a plain, defined boundary wherever they are. The level-relative variants exist but are explicit (`-surface`, `-separator`), so a border never silently depends on nesting depth. `surface` is level-relative even when bare, because a surface *is* a level by definition — the asymmetry between the two attributes is deliberate.

**Radius is derived from padding** so it is never a second thing to keep consistent by hand. An element that doesn't pad itself (a dialog panel whose header, body and footer pad themselves) names a step explicitly. Rounded containers never clip their children; a child touching the container's corners takes the container's radius instead, so mismatched corners can't happen in the first place.
