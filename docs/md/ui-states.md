---
title: Emphasis, states and interaction
section: UI
order: 4.5
---

# Emphasis, states and interaction

How a control says how loud it is (`e-emphasis`), which widget it is (`e-widget`), that it can be pressed (`e-interactive`, `$interactive`), and what state it is in (the selected, invalid and disabled states, driven by ARIA attributes). The rules are in [elt/ui rules § Emphasis](./elt-ui-rules.md#emphasis), [§ Controls](./elt-ui-rules.md#controls) and [§ Building app-specific widgets](./elt-ui-rules.md#building-app-specific-widgets); the reasoning is in [Why](#why) at the end.

## Terms

- **Emphasis**: how loud a control is, from `link` (plain inline text) to `inverted` (the one dominant action). It is how a control picks its strength in the model of [Theme § Emphasis](./ui-theme.md#emphasis), and the attribute is `e-emphasis`.
- **Widget**: what an element is (a switch, a toggle button, a text field), as opposed to how loud it is. The attribute is `e-widget`.
- **Interactive**: an element that reacts to the pointer and the keyboard as a control does: a hover fill, a pressed fill, a pointer cursor and a focus ring. Native `button` and `a[href]` are. Any other element is when it has the `e-interactive` attribute, which [`$interactive`](#interaction) sets.
- **Selected state**: an element that stands for a choice, a pressed toggle, or the place you are. It is set with ARIA attributes, never with a class ([Selected state](#selected-state)).
- **Keyboard cursor**: in a list or a menu, the item the arrow keys are on.

The pieces are independent, and each answers one question:

| Question | Where | Values |
| -------- | ----- | ------ |
| Where is it and how big? | The layout attributes (`pad`, `spacing`, `surface`, `border`, `radius`, `hover`) | [Layout](./ui-layout.md#layout-attributes) |
| What is it? | `e-widget` | `switch`, `toggle`, `field`, `label` ([Widgets](#widgets)) |
| How loud is it? | `e-emphasis` | `link`, `bare`, *(none, the default)*, `tint`, `inverted` ([Emphasis](#emphasis)) |
| Does it react to the pointer and keys? | `e-interactive` | on or off ([Interaction](#interaction)) |
| What is it doing? | ARIA attributes | selected, invalid, disabled ([Selected state](#selected-state), [Disabled and invalid](#disabled-and-invalid)) |

Combining them needs no extra value: a `bare` button that is selected is `e-emphasis="bare"` with `aria-pressed="true"`.

## Emphasis

`e-emphasis` goes on a `button`, an `a`, a toggle `label` and, for `default` and `tint`, an `input`. Without it, a control has the `default` emphasis.

```tsx
<button>Default</button>
<button e-emphasis="tint">Accent outline</button>
<button e-emphasis="inverted">Filled accent — the one dominant action</button>
<button e-emphasis="bare">Bare</button>
<button e-emphasis="link">Link-styled</button>
```

| Emphasis | Result |
| -------- | ------ |
| *(none)* | A neutral outline |
| `tint` | A tint outline and a tint label (an input keeps its text color and tints its border and placeholder) |
| `inverted` | A fill of the tint color with a beveled edge. At most one per area ([elt/ui rules § Emphasis](./elt-ui-rules.md#emphasis), rule 2) |
| `bare` | No fill and no visible edge, but the same size as the others: it has the same padding, and a 1px transparent border, so it is as tall as a default button and a state that paints an edge or a fill changes colors and never the size |
| `link` | Plain inline text, underlined: no padding, no border, no minimum height. It sits in a line of text ([Typography § Controls in text](./ui-typography.md#controls-in-text)). A long link text wraps over several lines when it is an `<a>`; a `<button>` stays in one piece, so use an `<a>` for a link in prose |

From quietest to loudest: `link`, `bare`, default, `tint`, `inverted`. The color family is not part of the value: a destructive button is `tint` or `inverted` inside a subtree recolored with `as_tint(theme.colors.error)` ([Theme § Colors](./ui-theme.md#colors)).

An `<a>` without `e-emphasis` is plain link text: tint colored, underlined when hovered, with a softened color once visited. An `<a>` with any other emphasis is a control: it has the control's padding, border and focus ring, and no underline and no visited color, since a visited color tells browsing history, which is wrong for a navigation item or a link styled as a button. A navigation item that goes to another page is an `<a>` (the browser gives it "open in a new tab" and the other link behaviors), and the page you are on is `aria-current="page"`:

```tsx
<a href="/docs" e-emphasis="bare" aria-current={o_here.tf((here) => (here ? "page" : undefined))}>Docs</a>
```

A toggle takes an emphasis like a button: `<label e-widget="toggle" e-emphasis="bare">`.

## Widgets

`e-widget` says what an element is, as opposed to how loud it is.

| `e-widget` | On | Result |
| ---------- | -- | ------ |
| `switch` | `<input type="checkbox">` | A pill switch |
| `toggle` | `<label>` around a checkbox | The checkbox is hidden and the label is a button. It is outlined in `tint` while unchecked, and checked it is drawn in the [selected state](#selected-state). It takes an [emphasis](#emphasis) |
| `field` | Any element that is editable (a `contenteditable`, a custom field) | The look of a text input: its edge, padding, radius, height and focus ring, and the [invalid look](#disabled-and-invalid) |
| `label` | Any element | Text that names what is next to it, not a control: bold and fainter than the text around it, at the controls' size, and filled (not bold) in a `packed` container ([Forms § Labels](./ui-forms.md#labels-and-fieldsets)) |
| `tab` | `<button>` | A button that stands for a view, with a line along its bottom edge ([Tabs](#tabs)) |
| `tab-close` | `<button>` right after a `tab` | The button that closes that tab, drawn under the same line ([Tabs](#tabs)) |

Nothing gives an editable element the look of a field on its own: a rich-text editor wants its own look, so the field look is asked for.

```tsx
<div contenteditable e-widget="field" aria-label="Notes"></div>
```

## Selected state

The selected state marks an element that stands for a choice (an option, a row, a tab), a toggle that is pressed, or the place you are (the current page in a navigation, the current step). It is expressed with ARIA attributes, so the look and what assistive technology announces cannot disagree:

| Attribute | Means | Use it on |
| --------- | ----- | --------- |
| `aria-pressed="true"` | A button that stays down: an independent on/off | A toggle button (Bold in a toolbar), a button of a group that shows a choice |
| `aria-selected="true"` | This item is chosen within a set | An option, a tab, a row, a cell (the roles that accept it: not a plain `button` nor a menu item) |
| `aria-current` (any value but `"false"`) | The place you are within a set | A navigation item (`"page"`), a step (`"step"`), a day (`"date"`) |
| `aria-checked="true"` | A checked state | A custom checkbox or a checkable menu item |
| A checked checkbox in a toggle | The toggle's own state | `<label e-widget="toggle">` |

`"false"` is never selected, and neither is `"mixed"` (undecided) for `aria-pressed` and `aria-checked`. The native checkbox, radio and switch draw their state themselves and are not part of this.

The look is the same for all of them, because they all mean the same thing visually: a tint surface three levels above where the item sits (four when it is hovered or the keyboard cursor is on it), a `tint` border where the element has one, and the text keeps its color. It is a choice, never an inversion ([Theme § State](./ui-theme.md#state)). It composes with every emphasis, because it sets only the fill and the border color, never a size: a selected `bare` button is a filled item with no visible edge, and the same size as when it is not selected.

```tsx
<button e-emphasis="bare" aria-pressed="true">Example</button>
<e-row role="option" aria-selected="true" e-interactive pad="widget">Banana</e-row>
```

The border is a variable, `--e-border-color`, which every border of the library reads: the controls' and the `border` attribute's. The state, an emphasis (`tint`, `inverted`), an invalid field and a disabled control each set it, and the border takes the color of the last one that applies (the order is in [Disabled and invalid](#disabled-and-invalid)). The variable is not inherited, so a control inside a selected card keeps its own border. Setting it recolors the borders that exist and creates none. So:
- A selected `link` has no boundary to paint. It loses its underline and takes the text color: it no longer looks like a destination.
- A selected `bare` control keeps its transparent edge, which is a literal that does not read the variable. It is filled and nothing more.
- A selected `<e-grid-row>` is filled only. A row has no border of its own, and a border on it would confuse the lines between rows ([Layout § Grids](./ui-layout.md#grids)).
- A selected layout element with a `border` (a card) gets the tint border, and one without gets none.
- Selected beats a layout element's own `surface` color: the state is something that happens to the element, and shows over its static look.

In a packed row, a selected child with a visible border keeps the border it shares with its neighbor, like a `tint` or `inverted` button does ([Layout § packed](./ui-layout.md#packed)). A selected `bare` child does not: it has no line to keep.

**An app's own widget** gets all of this by setting the state, and `e-interactive` when it can be pressed. It writes no CSS for it:

```tsx
<e-row pad="widget" border aria-pressed={o_choice.tf((c) => String(c === item))}>
  {$interactive}
  {$click(() => o_choice.set(item))}
  {item.label}
</e-row>
```

A state is never a class (`.selected`, `.active`), a `data-*` attribute or an `e-emphasis` value: the rule is [elt/ui rules § Building app-specific widgets](./elt-ui-rules.md#building-app-specific-widgets).

## Interaction

Interactive elements are `button`, `a[href]`, `input` buttons, a toggle `label` and anything with `e-interactive`. They share:
- a hover fill, one surface level above the current surface, only where hovering exists (a mouse; on a touch screen it would stay after the tap);
- a pressed fill, one level past hover, with a slight downward shift;
- a pointer cursor, and the `not-allowed` cursor when [disabled](#disabled-and-invalid);
- a focus ring (`tint.mid`) drawn inside the element's edge, so nothing around it can cut it;
- no delay on a tap (`touch-action: manipulation`; the tap highlight is off for everything).

The `link` emphasis has no hover or pressed fill. The layout attribute `hover` stays what it was, a hover fill only, for an element that highlights without being pressed (a row of a read-only table): it adds no cursor, no pressed look and no focus ring. `e-interactive` is that plus the rest.

### `$interactive`

`$interactive` makes any element behave as a control. Styling is `e-interactive`'s, set by the decorator; what CSS cannot give is a button's behavior, which a `<button>` has and a `<div>` does not: a role, a place in the tab order, and keys that activate it.

```tsx
import { $click } from "elt"
import { $interactive } from "elt/ui"

<e-row pad border>
  {$interactive}
  {$click(() => open_card())}
  A card
</e-row>
```

It works as a bare decorator (`{$interactive}`), or called with options, which returns the decorator (`{$interactive({ focusable: false })}`).

| It sets | Unless |
| ------- | ------ |
| `e-interactive` | Never |
| `role="button"` | The element has a role already (an option, a menu item): it is kept |
| `tabindex="0"` | The element has a `tabindex`, or `focusable: false` |

For `role="button"`, Enter dispatches a `click` when pressed, and Space dispatches one when released (the key press itself does not scroll the page). A key pressed in a control inside the element is that control's, and nothing happens when the element is `aria-disabled="true"`. Handlers stay `$click` or `$on("click")`: `click` is the event of "activate", and the keys dispatch one, so the same handler runs for a mouse, a tap, the keyboard and assistive technology.

A native `button`, `a[href]`, `input`, `select`, `textarea` or `summary` only gets `e-interactive`: the browser already gives it the role and the keys. An element with a role of its own keeps it and its keys, which belong to whatever navigates the widget. `focusable: false` is for an element with a focus model of its own, where focus stays on a container and a key moves a cursor among the items (the options of the [Select](./ui-widgets.md#select)): it is drawn and hovered as a control, and sets `e-interactive` by itself.

Prefer a native `<button>` or `<a>` when the content allows it: a `button` can hold text and inline elements, but not other controls. `$interactive` is for what cannot be one (a card holding other controls, a row of a list).

## The keyboard cursor

The cursor is whatever the arrow keys are on in a list or a menu. There are two models, and `menu_nav` and `list_nav` ([Overlays § Keyboard in menus and lists](./ui-overlays.md#keyboard-in-menus-and-lists)) each implement one:

- **A menu whose items are all in the document** moves real focus between its items (`menu_nav`). The active item is the focused one, the others have `tabindex="-1"`, and the cursor is the browser's `:focus-visible`: a menu needs no marker of its own. The pointer makes the item under it the focused one, with no ring, since the focus came from the pointer.
- **A list that may not render all its items, or whose focus must stay in a text field** keeps focus on one element (the list, or the text field) and names the active item with `aria-activedescendant` (`list_nav`). The Select is this: its options are virtual, and its search field keeps the focus. An item with no element of its own to focus needs its own marker: `e-active`, drawn like a hovered item (and, on a selected item, one level further than the selected fill, like a hovered selected item).

```tsx
<e-row role="option" e-interactive e-active={o_active_index.tf((i) => i === index)}>…</e-row>
```

## Disabled and invalid

- **Disabled** is `disabled` on a native control, or `aria-disabled="true"` on an element that cannot be disabled (a `$interactive` row). A `<label>` around a disabled checkbox is disabled too. A disabled control is furniture, whatever its emphasis: its colors turn `neutral` and move halfway toward its background ([Theme § State](./ui-theme.md#state)), it has no hover or pressed fill, and its cursor is `not-allowed`. A disabled selected control keeps the jump, in `neutral`.
- **Invalid** is `aria-invalid="true"` or the browser's `:user-invalid`, on a field or on a composite widget's root around its field. Its border and focus ring take the `error` color, whatever its emphasis, and nothing else changes ([Forms § Invalid fields](./ui-forms.md#invalid-fields)).

When several apply, the order is: a selected control keeps its fill with an invalid one's `error` border, and a disabled control is neutral whatever else it is.

## Layers

The styles are in CSS layers, from weakest to strongest: `reset`, `base`, `theme`, `typography`, `components`, `interaction`, `state`, `utilities`, `overrides`.

| Layer | Holds |
| ----- | ----- |
| `typography` | The look of text elements, at zero specificity |
| `components` | The look of controls and layout elements at rest: their emphasis and widget |
| `interaction` | Hover, pressed, the keyboard cursor, the focus ring, the pointer cursor |
| `state` | Selected, invalid, disabled, in that order: the later one wins |

A layer beats every layer before it whatever its selectors' specificity, so a hover always wins over a control's look at rest, and a state over a hover. Inside `state` the selectors have no specificity of their own, so the order of the rules is the only thing that decides. `utilities` and `overrides` are declared and left empty, for the app.

How this meets your own CSS:
- A rule outside any layer beats every layer, `state` included. A hover color written in a plain `css` class overrides the library's selected fill. Don't style a state in a plain rule; set the ARIA attribute and let the state layer draw it.
- A layer you declare yourself is ordered by its first mention. One declared after `elt/ui` is imported is stronger than all of ours (`@layer application { … }`, [CSS § Organizing styles](./css.md#organizing-styles)). Put your overrides there.

## Why

**State is ARIA, not a class.** A `.selected` class styles one widget; the ARIA attribute styles every widget that sets it and tells assistive technology the same thing. The look and the announced state cannot drift apart, and an app's own widget gets the look without any CSS. That is why the checked toggle, the Select's options, the date picker's day and a selected button are drawn by one rule.

**One enum could not hold three questions.** The old `e-variant` was one value that mixed how loud a control is, which widget it is, and which state it is in. Every combination needed a new value (a selected bare button, a selected link, a selected inverted button…). Splitting them lets a state combine with any emphasis, and gives widgets (`switch`, `toggle`, `field`) a name that is not an appearance.

**The selected state sets the fill and one variable only.** It never sets the size, the padding or the border width, so it applies to any emphasis, and `bare` keeps a transparent border to have the same size selected or not. The border color is a variable that borders read, and not a `border-color` the state writes, so no rule has to out-rank another to win it (packed containers and the emphasis rules also write borders), and an emphasis that has no edge to color simply does not read it. The rule behind it: an element that can show a boundary in some state has it in all of them (golden rule 4 in [elt/ui rules](./elt-ui-rules.md#golden-rules)).

**Why `aria-pressed` for a day or a view switch.** `aria-selected` is valid only on the roles that are items of a set (an option, a tab, a row, a cell), not on a plain button. A button that shows a choice is `aria-pressed`. A true tab strip (`role="tablist"` and `role="tab"` with `aria-selected`) also needs arrow-key navigation among its tabs, which is why a pair of view-switch buttons is `aria-pressed`.

**Why menus move focus and the Select does not.** Real focus on the items lets the browser draw the cursor and gives assistive technology the right focused element, but it requires every item to be in the document and focus to leave whatever held it. A Select's options are virtual and its search field has to keep the focus while the arrows move through the options, so it names the active item with `aria-activedescendant`, which has no CSS selector for the item it points to: that is the one case that needs `e-active`.

**Why `click` is the event of activation.** On a native control the browser fires `click` for a mouse, a tap, Enter, Space and assistive technology alike. `$interactive` makes the keys of a `<div>` fire one too, so handlers are written once, as `$click`, and `$click` stays in core elt: it is right on a `<button>`, and only a non-native element needs the extra decorator.

**Why layers.** Hover, state and a control's look at rest compete for the same properties. Settled by specificity, each rule would have to be tuned against all the others, and would break when a rule sat in another file. A layer per kind states the precedence once.
