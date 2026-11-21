---
title: Migrating
section: Start
order: 4
---

# Migrating

How to convert code written against older versions of elt, against elt-shoelace or the legacy elt-ui, or against earlier names of `elt/ui`. Once converted, the code follows the [elt rules](./elt-rules.md) and the [elt/ui rules](./elt-ui-rules.md) like any other.

## Older elt

- **Styles written with osun**: `style({ camelCase: value })` becomes [`` css`.class { regular-css: value }` ``](./css.md#the-css-tagged-template), one rule per call. Name the variables holding class names `cls_*`, delete classes nobody uses, and drop `-webkit-` (and other) prefixes no supported browser needs. Group a large sheet in a named layer (`@layer application { … }`).
- **`.join()` / `.merge()` used to compute a value**: rewrite as [`o.expression`](./observables.md#oexpression-deriving-from-several-sources). Keep `o.merge` / `o.join` only where a bundled object or tuple observable is the point.
- **For those that had `VirtualScroll` / `VirtualScroller`**: it is now [`RepeatVirtual`](./verbs.md#repeatvirtual-a-long-list). It still uses the nearest ancestor that scrolls vertically (`overflow-y: auto`, `scroll` or `overlay`), at any depth, but never the page itself: give the list a scroll area with a bounded height (with `elt/ui`, a layout element with `scroll`). Its padders are now `<e-virtual-padder>` elements right before and after the rows, in the element holding them, rather than around the element that held the list. `.configure((v) => { v.item_size = 40; v.threshold = 300; v.initial_position = 10 })` becomes `.ItemSize(40).Threshold(300).InitialPosition(10)`; `overflow_parent`/`prev_parent`/`nb_initial_items` are gone.
- **`$scrollable` was removed in 4.0.** On a layout element, replace it with the `scroll` attribute (`<e-column scroll>`, see [Layout § Scroll areas and sticky elements](./ui-layout.md#scroll-areas-and-sticky-elements)); `$scrollable` only set `overflow: auto` inline, so `elt/ui` didn't treat the element as a scroll area and let its children shrink to its height, which lost their bottom padding at the end of the scroll. Without `elt/ui`, use `overflow: auto` on the scroll area and `overscroll-behavior: none` on `html, body` (add `overscroll-behavior: contain` on an area whose scroll must never carry on to the page). The one behaviour lost is the blocking of touch gestures (pinch-zoom, …) on everything that doesn't scroll.
- **`$inserted` was removed in 4.0**: it was an alias of [`$connected`](./decorators.md#lifecycle-connected-disconnected), which replaces it as is.

- **Import from `elt` and `elt/mutative` only (4.0).** A core file imported by its path (`elt/dom`, `elt/verbs`, …) no longer resolves: the package exports only its entry points. Everything those files offered is exported by `elt`.
- **Internal names (4.0).** Names `elt` exports starting with `_` or `sym_` are internal ([elt rules § Naming](./elt-rules.md#naming)). `node_do_connected`, `node_do_disconnect` and `node_attach_shadow` became `_node_do_connected`, `_node_do_disconnect` and `_node_attach_shadow`: insert and remove with `node_append` / `node_remove` (or a verb), attach a shadow root with `$shadow`. `Reactivation` is no longer exported: `ActivationResult.reactivation` is a `Promise<ActivationResult>`.
- **An observer's return value is ignored (4.0).** An observer callback (`$observe`, `node_observe`) used to write what it returned back into the observable it watched (an expression-bodied arrow did it without meaning to), and to await a returned promise and write its value later. Write explicitly with `.set()` where that write was wanted.
- **`o.exclusive_lock` was removed (4.0).** Nothing needs it: `$bind`, `@attr` and the date input no longer echo their own writes, and `o.transaction` groups writes.
- **Read-only means read-only (4.0).** `Observable<A>` is invariant in `A` and `ReadonlyObservable<A>` covariant, so TypeScript now refuses some assignments it used to allow (an `Observable<string>` where an `Observable<string | null>` is expected: type the observable with the wider type). `.tf(fn, revert)` is removed: pass a converter, `.tf({ transform: fn, revert })`, which only a writable `Observable` takes; a `ReadonlyObservable` can no longer derive a writable observable (a converter, a writable `.p()` / `.key()`). Writing to a derived observable built without a setter throws, where a one-way `o.expression` used to write `undefined` into its sources.
- **Transformers take the observable's type (4.0).** `tf_equals`, `tf_array_has`, `tf_set_has` and `tf_map_has` get their value type from the observable they are passed to. Drop the `as const` and type arguments written to make them fit (`o_action.tf(tf_equals("merge" as const))` becomes `o_action.tf(tf_equals("merge"))`). One built apart from `.tf()` and passed later needs its type: `const is_merge = tf_equals<Action>("merge")`.
- **A dependency cycle throws (4.0).** Making an observable depend on one that depends on it (directly, through a proxy or `changeTarget`) throws, instead of hanging the page.
- **An observer that throws is reported as an uncaught error (4.0)** (`reportError`), where it used to be `console.error`-ed; the other observers still run.
- **App (4.0).** The `App` namespace is gone: its types and classes (`RouteDef`, `Route`, `Router`, …) are exported by `elt` directly, and a service is a class built with `Service(…)` and its `@view` methods, as described in [App](./app.md). This guide has no step-by-step conversion of a 3.x app yet. The router can also read routes from the URL path (`mode: "path"`), besides the fragment.
- **Peer dependencies are optional (4.0).** `mutative` and `@floating-ui/dom` are no longer installed for you: an app that imports `elt/mutative` installs `mutative`, one that uses `elt/ui` installs `@floating-ui/dom`.

## elt-shoelace and the legacy elt-ui

- Most widgets kept their names or have a same-named equivalent in `elt/ui`.
- **Color semantics changed.** The old libraries used Material-style steps (50 muted → 600 full → 900 near text). `elt/ui` expresses colors as mixes from background or text, and names them by role:
  - `theme.colors.tint` ≈ the old "600" accent
  - `.hover` / `.separator` ≈ the very muted fills and dividers (old 50–100), relative to the surface they sit on
  - `.faded` / `.mid` ≈ borders and muted chrome
  - `.ink` ≈ near-text emphasis
- Replace fixed steps with these roles, or with an explicit `.from_bg(...)` / `.from_text(...)` when no role fits. The roles are described in [Theme and colors](./ui-theme.md#colors).

## Earlier elt/ui names

| Old | New |
| --- | --- |
| `e-box`, `e-block` | `e-prose` |
| `<e-button-box>`, `<menu>` button rows | `<e-row packed>` / `<e-column packed>` |
| `Color` class | `Mix` |
| `.as_inverted`, `.as_tint` (classes), `.classes.as_*`, `.css.as_*` | `.class_as_inverted`, `.class_as_tint`, `.css_as_inverted`, `.css_as_tint` |
| `.surface(n)` used as a class, `.classes.as_surface(n)`, `.css.as_surface(n)` | `.class_as_surface(n)`, `.css_as_surface(n)` — `.surface(n)` is now the bare color value |
| `theme.css.<name>(…)` / `theme.classes.<name>(…)` | `theme.css_<name>(…)` / `theme.class_<name>(…)` |
| `theme.class_light` / `class_dark` / `class_dynamic` | `theme.class_light_scheme` / `class_dark_scheme` / `class_dynamic_scheme` |
| `theme.settings.paddingPanel*` | `theme.settings.spacingComponent` |
| `theme.settings.paddingCell*` | `theme.settings.spacingWidget` |
| `theme.settings.spacing<Step>Vertical` / `…Horizontal` | `theme.settings.spacing<Step>` (one value for both axes) |
| `--e-pad-vertical` / `--e-pad-horizontal`, `--e-spacing-vertical` / `--e-spacing-horizontal` | `--e-pad`, `--e-spacing` |
| `surface="1"`…`"6"`, `border="n+1"`…`"n+6"` | `surface="tint-1"`…, `border="tint-1"`… (or the `neutral-` forms) |
| `DateTimePickerAttributesBAse` (removed in 4.0) | `DateTimePickerAttributesBase` |
| `<e-prose variant="vertical">` (removed in 4.0, it had no effect) | `<e-prose>` |
| `Search()` (removed in 4.0) | Write the row: `<e-row packed><input type="search" aria-label="Search"/><button aria-label="Search">{MagnifyingGlass()}</button></e-row>`, inside a `<form role="search">` when Enter should submit |

### Variants, state classes and activity markers

`e-variant` was split by what it said: how loud a control is (`e-emphasis`), which widget an element is (`e-widget`), and what state it is in (ARIA attributes). Terms: [States and interaction § Terms](./ui-states.md#terms).

| Old | New |
| --- | --- |
| `e-variant="text"` | `e-emphasis="bare"` (it now has the padding and a transparent 1px border of other controls; `e-emphasis="link"` is the unpadded, inline one) |
| `e-variant="tint"`, `"inverted"`, `"link"` | `e-emphasis="tint"`, `"inverted"`, `"link"` |
| `e-variant="switch"`, then `e-widget="switch"` (until 4.0), on a checkbox | `role="switch"` |
| `e-variant="toggle"` on a label | `e-widget="toggle"` (a checked toggle is in the selected state; it takes an `e-emphasis`) |
| An `inverted` button used to show the current choice | Buttons of one emphasis with `aria-pressed="true"` on the chosen one; for tabs, `tab_strip` (below) |
| `e-widget="tab"` (until 4.0), with `aria-pressed` | `tab_strip(o_selected)` (`elt/ui/tabs`): its `tab(value)` decorator sets `role="tab"`, which carries the look, and `aria-selected` ([States § Tabs](./ui-states.md#tabs)) |
| A class such as `.selected` or `.active` styled by the app for a chosen item | The matching ARIA attribute |
| `data-active` on the item the keys are on | A menu from `menu_nav`: nothing, the item is focused. A `list_nav` list: `e-active` |
| `variant` prop of `DateTimePicker` (`"full"` included) | `emphasis` (`"inverted"` or `"tint"`); `"full"` is removed |
| A clickable `div`/`e-row` with only `$click` | `{$interactive}` next to the `$click`, so it has a role, a tab stop, Enter and Space, and the hover and press looks ([Interaction](./ui-states.md#interaction)) |

The `hover` layout attribute is unchanged (a visual hover fill only).

### `.light` and `.ultra_light`

They were **removed, not renamed**: they named a lightness, and the replacement depends on the role the color played. Pick by role:

| Role at the call site | Replacement |
| --------------------- | ----------- |
| `:hover` background | `.hover` |
| A container's edge or a divider, on a non-focusable element | `.separator` |
| Table header, toolbar or title-row band | Depends on how much attention it needs ([Theme § Emphasis](./ui-theme.md#emphasis)): `surface` (neutral, one level up) for a status bar or a table header, `neutral.class_as_inverted` for an important one, `tint.class_as_inverted` (or `<header>`) for the app's top toolbar or a dialog's title row; a row of buttons gets no band (`<e-row packed="widget">`). Never `text.faded` |
| A focusable control's border | The control's own emphasis color (usually bare `neutral`, as `ui/form.css.tsx` does) |
| A static fill that is not a surface background, or anything with no semantic role (shadow, scrollbar track) | An explicit `.from_bg("10%")` / `.from_bg("20%")` |

## elt/ui 4.0: entry points and behavior

- **Entry points.** `elt/ui` and its widget modules (`elt/ui/select`, `/date`, `/timepicker`, `/textarea`, `/spinner`, `/tabs`, `/icons`, `/popup`, `/dialog`, `/keymap`, `/theme`, `/list-nav`, `/resizable`, `/interactive`, `/motion`) are the only paths. The stylesheets, `selectors`, `date-format`, `date-input` and `search` no longer resolve. `CHECK_POINTS`, `ambient_surface_mix`, `spacing_steps`, `focus_when_shown` and `observe_layout` are no longer exported.
- **Popups take focus.** A popup moves focus into itself once shown, and Tab on its last element closes it ([Overlays § popup](./ui-overlays.md#popup)). A popup that must leave focus where it is (a list completing your own text field, a tooltip) passes `focus: false`.
- **Popups say what they are.** The anchor element gets `aria-expanded`, and `aria-haspopup` unless it has one; a content that isn't a menu, a list, a tree or a grid makes the popup a `dialog` named by its first heading, else by the anchor's text, else by the `label` option. Pass `opener: null` when the anchor isn't the control that opens it (a combobox's input says it itself). `menu_nav` gives its element `role="menu"` when it has none.
- **Dialogs need a name.** `show_dialog` names the dialog by its first heading, or the `label` option, and warns in the console when it has neither.
- **Icons are hidden from assistive technology.** A button with only an icon needs `aria-label`, `aria-labelledby` or `title`; the Biome plugin `lint/icon-button-name.grit` finds them.
- **Tabs have their roles and keys.** `tab_strip` gives a strip of the app's own buttons `role="tablist"`/`"tab"`/`"tabpanel"`, `aria-selected`, one Tab stop and the arrow keys; `e-widget="tab"` is gone ([States § Tabs](./ui-states.md#tabs)).
- **Resize handles are Tab stops.** Each `$resizable` handle is a focusable separator, moved by the arrow keys.
- **Texts.** The names elt/ui gives its own buttons and handles come from `o_ui_labels` (English by default): set them for another language ([Widgets § Texts of the widgets](./ui-widgets.md#texts-of-the-widgets)).

## Object editor

- `elt/editor` is its only path: `elt/editor/<file>` no longer resolves.
- `breadcrumb` (an `o.Out<string[]>` attribute of `ObjectEditor`) is now `out_breadcrumb`, like every attribute a component writes ([Components § Reactive attributes](./components.md#reactive-attributes)).
