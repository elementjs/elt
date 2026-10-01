---
title: Widgets
section: UI
order: 5
---

# Widgets

The few widgets native HTML can't provide, and how to build your own. Import from `"elt/ui"`, or from a subpath (`"elt/ui/select"`) to pull in only that widget.

| Widget | Import | Use when |
| ------ | ------ | -------- |
| [`Select`](#select) | `elt/ui/select` | Choosing a value that isn't just a string, custom option labels, long lists (virtualized) |
| [`DateTimePicker`](#datetimepicker) | `elt/ui/date` | Date, time or date-time, optionally clearable |
| [`TimePickerPanel`, `ScrollColumn`](#other-widgets) | `elt/ui/timepicker` | Building your own time picking UI |
| [`$auto_grow`](#other-widgets) | `elt/ui/textarea` | A `<textarea>` that grows with its content |
| [`Search`](#other-widgets) | `elt/ui/search` | A text field with a search button |
| [`Spinner`](#other-widgets) | `elt/ui/spinner` | Loading indicator |
| [Icons](#icons) | `elt/ui/icons` | Small SVG icons |
| `popup`, `show_dialog` | `elt/ui/popup`, `elt/ui/dialog` | Overlays — see [Overlays](./ui-overlays.md#choosing-an-overlay) |
| `$keymap`, `keymap_used` | `elt/ui/keymap` | Keyboard shortcuts and key sequences, scoped to an element or to `document` — see [Keymap](./ui-keymap.md#api) |
| Object editor | `elt/editor` | **Unstable** — see [Object Editor](./object-editor.md) |

## Select

`Select<T, T2 = T>(attrs)` — a button that opens a virtualized option list in a popup.

```tsx
import { Select } from "elt/ui/select"
import { o } from "elt"

const o_choice = o("a")
<Select model={o_choice} options={["a", "b", "c"]} placeholder="Pick…" />
```

| Prop | Type | Meaning |
| ---- | ---- | ------- |
| `model` | `o.Observable<T>` | Selected value |
| `options` | `o.RO<Iterable<T2>>` | Options |
| `convert_fn` | `(opt: T2) => T` | Map an option to the model's value type |
| `label_fn` | `(opt: T2) => Renderable` | Option label (default: the option itself) |
| `disabled` | `o.RO<boolean>` | |
| `placeholder` | `o.RO<Renderable>` | Shown while no value matches |

`Select` also takes every `button` attribute.

## DateTimePicker

`DateTimePicker(attrs)` — a field with a calendar/time popup.

| Prop | Meaning |
| ---- | ------- |
| `model` | `o.Observable<Date \| null>` with `clearable: true` (or an observable boolean); a model that never receives `null` with `clearable` omitted or `false` |
| `show_date` / `show_time` | Show the date (default `true`) / time (default `false`) selectors |
| `seconds`, `am_pm` | Seconds selector; 12-hour display |
| `minute_step`, `second_step` | Selector steps (default 1) |
| `week_starts_on` | `"monday"` … `"sunday"` |
| `variant` | `"full"` / `"tint"` |
| `date_popup_default_date` | Date the popup opens on while the model is empty (default: now) |

## Other widgets

| Export | Signature / use |
| ------ | --------------- |
| `TimePickerPanel(opts)` | Time selection panel: `{ locale, o_date, am_pm, seconds, minute_step?, second_step?, on_change }` |
| `ScrollColumn(opts)` | One scrollable numeric column: `{ label?, min, max, loop?, step_size?, format, get_value, on_change }` |
| `$auto_grow(opts?)` | Decorator for `<textarea>`: grows with its content between `min` and `max` lines (`o.RO<number>`) |
| `Search()` | A packed row: a text input and a search button. Takes no props. |
| `Spinner(attrs)` | SVG loading indicator |

## Icons

`CaretDown`, `CaretLeft`, `CaretRight`, `Calendar`, `Clock`, `MagnifyingGlass`, `X`, `Check` — SVG icons sharing the class `cls_icon`.

## Building app-specific widgets

1. Start from native HTML, layout elements and theme colors.
2. When styling repeats, extract a function component in your app ([Components § One-arg vs two-arg](./components.md#one-arg-vs-two-arg)).
3. Match control sizing: `theme.settings.formFontSize`, `widget`-step padding, the control's radius from `theme.css_radius("widget")`.
4. Reactive props take `o.RO<T>` / `o.Observable<T>`, like the built-in widgets; bind native fields inside with [`$bind`](./decorators.md#binding-form-controls-bind).

## Why

Native HTML comes first: `elt/ui` styles what the browser already provides, and adds a widget only where native HTML can't do the job (a select with arbitrary values and virtualized options, a date-time picker with a nullable model). A component is worth building in your app once its styling repeats; complex widgets follow the same rule.
