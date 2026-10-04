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
| `options` | `o.RO<Iterable<T2> \| Promise<Iterable<T2>>>` | Options, or a promise of them — see [Options from a server](#options-from-a-server) |
| `convert_fn` | `(opt: T2) => T` | Map an option to the model's value type. Without it, the option is the value |
| `label_fn` | `(opt: T2, query: string) => Renderable` | Option label (default: the option as text). `query` is what the user typed in completion mode (`""` otherwise), to highlight it yourself |
| `text_fn` | `(opt: T2) => string` | The option as text, for completion (default `String(opt)`) |
| `completion` | `boolean` | Type to filter the options — see [Completion](#completion) |
| `query` | `o.Observable<string>` | Written with what the user types in completion mode |
| `disabled` | `o.RO<boolean>` | |
| `placeholder` | `o.RO<Renderable>` | Shown while no value is selected |

`Select` also takes every `button` attribute.

**Keyboard**: ArrowDown or ArrowUp on the Select opens the list, with the selected option active. In the list, Up/Down, Home/End and PageUp/PageDown move, Enter or Space picks, typing letters jumps to the next option starting with them, `Escape` closes it ([Overlays § Keyboard in menus and lists](./ui-overlays.md#keyboard-in-menus-and-lists)).

### Completion

With `completion`, a click (or ArrowDown) turns the Select into a text input holding the current option's text, all selected, with the whole list open. Typing replaces the text and keeps the options whose `text_fn` contains it, ignoring case and accents; the first match becomes active, so Enter picks it. Up/Down move through the options while focus stays in the input. `Escape`, or leaving the input, drops what was typed and shows the selected option again; the model only changes when an option is picked.

Options that are objects need a `text_fn`: with completion and no `text_fn`, `Select` throws when it's created.

```tsx
<Select
  model={o_country}
  options={countries}
  completion
  text_fn={(c) => c.name}
  label_fn={(c) => <><img src={c.flag} alt="" /> {c.name}</>}
/>
```

### Options from a server

`options` can hold a promise. While it is pending, the last options stay shown with a loading row at the end. A promise replaced by a newer one before it settles is ignored, so a late reply to an old query never overwrites a newer one. A rejected promise keeps the last options, with an error row at the end. Options from a promise are shown as they come, in their order and unfiltered — the server did the filtering — and the model holds the option itself (no `convert_fn`), so the selected value can be shown before any option has loaded.

Derive the promise from `query`. The Select doesn't know about requests; debouncing them is yours:

```tsx
const o_query = o("")
const o_fetched = o<Promise<City[]>>(fetch_cities(""))

<e-row>
  {/* One request per pause in typing, not per keystroke. */}
  {$observe(o_query, o.debounce((q: string) => o_fetched.set(fetch_cities(q)), 200), { changes_only: true })}
  <Select model={o_city} options={o_fetched} query={o_query} completion text_fn={(c) => c.name} />
</e-row>
```

## DateTimePicker

`DateTimePicker(attrs)` — a field with a calendar/time popup.

| Prop | Meaning |
| ---- | ------- |
| `model` | `o.Observable<Date \| null>` with `clearable: true` (or an observable boolean); a model that never receives `null` with `clearable` omitted or `false` |
| `show_date` / `show_time` | Show the date (default `true`) / time (default `false`) selectors. With the time only, a typed time goes on the model's day, or on `date_popup_default_date`'s day while the model is empty |
| `seconds`, `am_pm` | Seconds selector; 12-hour display |
| `minute_step`, `second_step` | Steps of the time selectors and of the arrow keys in the text field: 1 (default) to 30 |
| `week_starts_on` | `"monday"` … `"sunday"` |
| `variant` | Buttons next to the text field: `"inverted"` filled with the tint color (like `e-variant="inverted"`), `"tint"` outlined (default). `"full"` is a deprecated alias of `"inverted"` |
| `date_popup_default_date` | Date the popups open on while the model is empty (default: now) |

The text field is edited one part (segment) at a time — day, month, year, hour, minute, second, AM/PM — as in a native date input. Clicking selects the part under the pointer; Left and Right select the previous or next part. Digits typed into a part replace its value and are collected until the part is full (2 digits, 4 for the year), then the next part is selected: typing `15` into the minutes gives `15`. A first digit that no second digit could follow is complete at once: `4` in a day gives `04`, `2` in a month gives `02`. A separator (`/`, `-`, `:`, a space…) ends the part being typed and selects the next one (`1/5/2026` gives January 5 in en-US); typed right after a part that completed on its own, it does nothing, so `2026-10-03` can be typed as written. Moving to another part starts a new value. Up and Down step the part (minutes and seconds by `minute_step` / `second_step`), Backspace and Delete empty it. The model receives the date when the field loses focus, if the date is complete and valid; with `clearable`, an empty field sets it to `null`. Phone and tablet on-screen keyboards, which send their characters as text input rather than identifiable key presses, behave the same: each character goes through the rules above, and deleting empties the part as Backspace does.

## Other widgets

| Export | Signature / use |
| ------ | --------------- |
| `TimePickerPanel(opts)` | Time selection panel: `{ locale, o_date, am_pm, seconds, minute_step?, second_step?, on_change }` |
| `ScrollColumn(opts)` | One numeric column stepped by its buttons, the wheel or a touch drag: `{ label?, min, max, loop?, step_size?, format, value, on_change }`. `value` is an `o.RO<number>` the column shows; `on_change` receives the next value; `label` is shown above the column |
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
