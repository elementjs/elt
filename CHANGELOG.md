# Changelog

elt follows [semantic versioning](https://semver.org), except `elt/editor`, which is unstable: any release may change it.

## 4.0.0 (in release candidates)

Everything since 3.1.0. To upgrade, follow [Migrating](./docs/md/migrating.md), which gives the replacement of each breaking change (the `App` rewrite is described there, not converted step by step). The documentation is in the package (`docs/md/`) and at [elementjs.github.io/elt](https://elementjs.github.io/elt/).

### New

- **`elt/ui`**: a styling layer over native HTML and a few widgets.
  - Layout elements (`e-row`, `e-column`, `e-grid`, `e-prose`) with independent `pad`, `spacing`, `packed` and `radius`.
  - A theme built from color mixes and surface levels, with light and dark schemes; emphasis (`e-emphasis`), widgets (`e-widget`) and an ARIA-driven selected state.
  - Widgets: `Select`, `DateTimePicker`, `TimePickerPanel`, `tab_strip`, `popup`, `show_dialog`, `$keymap`, `$resizable`, `$auto_grow`, `$interactive`, icons and motion presets.
  - Keyboard and assistive technology for everything it ships: menus, lists, popups, dialogs, tabs, resize handles, time columns and the date picker. The texts its widgets read out come from `o_ui_labels`, for other languages.
- **`elt/editor`** (unstable): `ObjectEditor`, an editor for any JavaScript value, driven by a schema or by the value itself.
- **Motion**: `$enter` / `$leave`, played by verbs as their content comes and goes, with reduced motion respected.
- **Observables**: `intercept()` shapes what is written, `o.tee()` gathers several outputs, `o.Out<T>` types what a component reports to its caller, `o.expression` drops the dependencies it stopped reading.
- **App**: routes in the URL path (`mode: "path"`, with `base`, link interception and scrolling to the fragment), `show()` and `app.mount()`.
- **Drag and drop**: `$dropzone` (files from the desktop, data from other applications or a `$draggable`; nested zones; files dropped outside any zone are refused instead of opened) and `$draggable` (data by type, effects, a file given to the desktop in Chromium).
- `Select` takes `multiple`: several values in an array or a Set, shown as removable tags.
- `DateTimePicker` takes `readonly`; set to `true`, its model may be a `ReadonlyObservable` or a plain date.
- `ObjectEditor` takes `readonly`, and its composite schema nodes the option of the same name: the value is shown, and nothing in the editor changes it. Set to `true`, the model may be a `ReadonlyObservable` or a plain value, and there is no Undo history.
- `RepeatVirtual`: infinite scrolling with `.OnEndReached()` / `.OnStartReached()` (rows prepended keep the visible rows in place), horizontal lists with `.Horizontal()` (right-to-left too), and `.itemAt(px)`.
- `node_remove_range`, `node_move_range`, `without_motion` and `motion_is_enabled` are public.
- Biome plugins (`lint/`) for the rules elt code must follow, shipped with the package. `out-prefix.grit` checks every `o.Out<T>`: component attributes, decorator options and function parameters.

### Changed and removed

Breaking; all in [Migrating](./docs/md/migrating.md):

- The package exports its entry points only: `elt`, `elt/mutative`, `elt/ui` and its modules, `elt/editor`. Names starting with `_` or `sym_` are internal.
- `mutative` and `@floating-ui/dom` are optional peer dependencies, installed by the app that uses them.
- An observer's return value is ignored; read-only observables stay read-only (variance, no writable derivation); a dependency cycle throws; an observer that throws is reported as an uncaught error.
- `tf_equals`, `tf_array_has`, `tf_set_has` and `tf_map_has` take their value type from the observable they are passed to: `o_action.tf(tf_equals("merge"))` needs no `as const`, a value the observable can't hold no longer compiles, and one built apart from `.tf()` needs its type written out.
- `App` is rewritten: the namespace is flattened into top-level exports, services are classes built with `Service(…)`.
- `VirtualScroll` is `RepeatVirtual`; styles are written with the `css` tagged template.
- Removed: `$scrollable`, `$inserted`, `o.exclusive_lock`.

### Fixed

- `RepeatVirtual`'s `InitialPosition` and `setPosition` scroll to the row: they rendered the rows around it but left the scroll position where it was, and the list went back to the first row. Negative indices count from the end.
- `setup_mutation_observer` disconnects a page's nodes when the page closes: on `pagehide` (Chrome blocks `unload`, and an `unload` listener kept the page out of the back/forward cache), not when the page goes into that cache, and from `<html>`, where it used to start from the doctype and disconnect nothing.
