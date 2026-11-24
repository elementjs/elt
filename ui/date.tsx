import { $click, $connected, $observe, o, Repeat, type Attrs, css } from "elt"
import {
  apply_date_part,
  build_layout,
  calendar_month_cells,
  type WeekdayName,
  month_names,
  HOUR_STEPS,
  normalize_step,
  resolve_locale,
  weekday_labels,
  week_start_js,
} from "./date-format"
import { DateInputController } from "./date-input"
import { Calendar, CaretLeft, CaretRight, Clock, X } from "./icons"
import { o_ui_labels } from "./labels"
import { popup } from "./popup"
import { Select } from "./select"
import { TimePickerPanel } from "./timepicker"
import { theme } from "./theme"

const colors = theme.colors

export interface DateTimePickerAttributesBase extends Attrs<HTMLElement> {
  week_starts_on?: o.RO<"monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday">

  /** The emphasis of the buttons next to the text field (`e-emphasis`): `"inverted"` filled with the tint color, `"tint"` outlined (default). */
  emphasis?: o.RO<"inverted" | "tint">

  /** if true, show the date selector. Default is true. */
  show_date?: o.RO<boolean>

  /** if true, show the time selector. Default is false. */
  show_time?: o.RO<boolean>

  /** if true, display 0-11 for hours and AM/PM instead of 0-23 */
  am_pm?: o.RO<boolean>

  /** the step for the hour selector, a divisor of 12 (1, 2, 3, 4, 6 or 12; another value is rounded
   * down to one). Default is 1. */
  hour_step?: o.RO<number>

  /** the step for the minute selector, a divisor of 60 up to 30 (1, 2, 3, 4, 5, 6, 10, 12, 15, 20 or 30;
   * another value is rounded down to one). Default is 1. */
  minute_step?: o.RO<number>

  /** the step for the second selector, as `minute_step`. Default is 1. */
  second_step?: o.RO<number>

  /** if true, show the seconds selector */
  seconds?: o.RO<boolean>

  /** the date at which the popup will be set at when model still has no value. Defaults to now. */
  date_popup_default_date?: o.RO<Date>

  /** If true, the date can be read and copied but not changed: the text field is read-only and its buttons go. */
  readonly?: o.RO<boolean>
}

/** The model accepts `null` : the picker may be cleared, always (`true`) or only while the observable is `true`. */
export interface DatePickerNullable extends DateTimePickerAttributesBase {
  model: o.Observable<Date | null>
  clearable: true | o.IReadonlyObservable<boolean>
}

/** The model never receives `null` : the picker is never cleared. */
export interface DatePickerNotNullable extends DateTimePickerAttributesBase {
  model: o.IObservable<Date | null, Date>
  clearable?: false
}

/**
 * Read-only for good: `readonly` is `true`, not an observable that could turn it off, so the model may be a plain
 * value or a `ReadonlyObservable`. `clearable` is accepted, for attributes shared with an editable picker, and does nothing.
 */
export interface DatePickerReadonly extends DateTimePickerAttributesBase {
  readonly: true
  model: o.RO<Date | null>
  clearable?: boolean | o.IReadonlyObservable<boolean>
}

export type DatePickerAttrs = DatePickerNullable | DatePickerNotNullable | DatePickerReadonly

function picker_options(at: DatePickerAttrs) {
  return {
    show_date: o.tf(at.show_date, (d) => d ?? true),
    show_time: o.tf(at.show_time, (t) => t ?? false),
    am_pm: o.tf(at.am_pm, (a) => a ?? false),
    seconds: o.tf(at.seconds, (s) => s ?? false),
    hour_step: o.tf(at.hour_step, (s) => normalize_step(s, HOUR_STEPS)),
    minute_step: o.tf(at.minute_step, (s) => normalize_step(s)),
    second_step: o.tf(at.second_step, (s) => normalize_step(s)),
  }
}

export function DateTimePicker(at: DatePickerAttrs) {
  const clearable = o.tf(at.clearable, (cl) => cl === true)
  const opts = picker_options(at)
  const o_locale = o("")
  let input_ctrl: DateInputController | null = null

  const oo_emphasis = o.tf(at.emphasis, (v) => (v === "inverted" ? "inverted" : "tint"))
  // Read-only, none of the buttons: each would change the model. An observable only when an input is one.
  const unless_readonly = (show: o.RO<boolean | undefined>) =>
    o.is_observable(show) || o.is_observable(at.readonly)
      ? o.expression((get) => !!get(show) && !get(at.readonly))
      : !!show && !at.readonly
  const oo_clear_button = unless_readonly(at.clearable)
  const oo_time_button = unless_readonly(opts.show_time)
  const oo_date_button = unless_readonly(opts.show_date)

  const oo_layout = o.expression((get) => {
    const locale = get(o_locale)
    if (!locale) return null
    return build_layout(locale, {
      show_date: get(opts.show_date),
      show_time: get(opts.show_time),
      seconds: get(opts.seconds),
      am_pm: get(opts.am_pm),
    })
  })

  const default_popup_date = () => o.get(at.date_popup_default_date) ?? new Date()

  const set_model = (d: Date | null) => {
    if (o.get(at.readonly)) return
    // A model that can't be written only comes with `readonly: true`, which returned above.
    const w = at as DatePickerNullable | DatePickerNotNullable
    if (d != null) w.model.set(d)
    // `w.clearable` is only truthy in DatePickerNullable, so `w` narrows to it and set(null) type-checks
    else if (w.clearable && o.get(clearable)) w.model.set(null)
  }

  // The model as read: one type for the three kinds of models, a plain date included.
  const model: o.RO<Date | null> = at.model
  const get_model = () => o.get(model)

  // Getters: the text input reads the props' current values on each use.
  const input_ctx = {
    get_layout: () => oo_layout.get(),
    set_model,
    get_base: () => get_model() ?? default_popup_date(),
    get clearable() {
      return o.get(clearable)
    },
    get hour_step() {
      return o.get(opts.hour_step)
    },
    get minute_step() {
      return o.get(opts.minute_step)
    },
    get second_step() {
      return o.get(opts.second_step)
    },
  }

  const open_calendar = async (anchor: HTMLElement) => {
    const locale = o_locale.get()
    if (!locale || !oo_layout.get()) return

    const week_start = week_start_js(o.get(at.week_starts_on) as WeekdayName | undefined, locale)
    const o_view = o(get_model() ?? default_popup_date())
    const months = month_names(locale)
    const o_month = o.expression(
      (get) => get(o_view).getMonth(),
      (m) => {
        const d = new Date(o_view.get())
        d.setMonth(m)
        o_view.set(d)
      },
    )
    const oo_cells = o.expression((get) => calendar_month_cells(get(o_view), week_start))
    // A day button shows its number; assistive technology reads the whole date.
    const full_date = new Intl.DateTimeFormat(locale, { dateStyle: "full" })
    const today = new Date()

    const year_delta = (delta: number) => {
      const d = new Date(o_view.get())
      d.setFullYear(d.getFullYear() + delta)
      o_view.set(d)
    }

    await popup(
      anchor,
      () => (
        <e-column pad="component" surface="background" border>
          <e-flex spacing="widget" align="center">
            <button type="button" e-emphasis="bare" title={o_ui_labels.p("previous_year")}>
              {$click(() => year_delta(-1))}
              {CaretLeft()}
            </button>
            <span class={cls_year}>{o_view.tf((v) => String(v.getFullYear()))}</span>
            <button type="button" e-emphasis="bare" title={o_ui_labels.p("next_year")}>
              {$click(() => year_delta(1))}
              {CaretRight()}
            </button>
            <Select model={o_month} options={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]} label_fn={(i) => months[i]} />
          </e-flex>
          <e-grid columns={7} spacing="nudge-2" class={cls_grid}>
            {weekday_labels(locale, week_start).map((label) => (
              <span class={cls_dow}>{label}</span>
            ))}
            {Repeat(oo_cells, (o_cell) => {
              const oo_in_month = o_cell.tf((c) => c.in_month)
              const oo_day_num = o_cell.tf((c) => c.date.getDate())
              const oo_selected_day = o.expression((get) => {
                const current = get(model)
                const cell = get(o_cell)
                return same_day(cell.date, current)
              })
              return (
                <button
                  type="button"
                  e-emphasis="bare"
                  class={[cls_day, oo_in_month.tf((v) => !v && "outside")]}
                  aria-pressed={oo_selected_day.tf((s) => String(s))}
                  aria-label={o_cell.tf((c) => full_date.format(c.date))}
                  aria-current={o_cell.tf((c) => same_day(c.date, today) && "date")}
                >
                  {$click(() => {
                    const cell = o_cell.get().date
                    const base = get_model() ?? default_popup_date()
                    set_model(apply_date_part(base, cell.getFullYear(), cell.getMonth() + 1, cell.getDate()))
                  })}
                  {oo_day_num}
                </button>
              )
            })}
          </e-grid>
        </e-column>
      ),
      // Wide enough for the month grid.
      { arrow: true, min_width: 260 },
    )
  }

  return (
    <e-row packed>
      {$connected((box: HTMLElement) => {
        o_locale.set(resolve_locale(box))
      })}
      <input
        type="text"
        autocomplete="off"
        spellcheck={false}
        class={cls_date_input}
        readonly={o.tf(at.readonly, (ro) => ro || undefined)}
        aria-description={o_ui_labels.p("date_input_keys")}
      >
        {(input: HTMLInputElement) => {
          const ctrl = new DateInputController(input, input_ctx)
          input_ctrl = ctrl
          ctrl.apply_model(get_model())
        }}
        {$observe(model, (val) => {
          input_ctrl?.apply_model(val)
        })}
        {$observe(oo_layout, (layout, _, input: HTMLInputElement) => {
          // Phones show a number pad for `inputmode="numeric"`; a layout with an AM/PM part keeps the
          // default keyboard, since its letters set AM or PM. No attribute before the locale is known.
          if (layout && !layout.segments.some((s) => s.kind === "dayPeriod")) input.setAttribute("inputmode", "numeric")
          else input.removeAttribute("inputmode")
          input_ctrl?.apply_model(get_model())
        })}
      </input>
      {o.tf(
        oo_clear_button,
        (c) =>
          c && (
            <button type="button" e-emphasis={oo_emphasis} title={o_ui_labels.p("clear")}>
              {$click(() => set_model(null))}
              <X />
            </button>
          ),
      )}
      {o.tf(
        oo_time_button,
        (v) =>
          v && (
            <button type="button" e-emphasis={oo_emphasis} title={o_ui_labels.p("pick_time")}>
              {$click(async (ev) => {
                const locale = o_locale.get()
                if (!locale) return
                const o_cur = o(get_model() ?? default_popup_date())
                await popup(
                  ev.currentTarget,
                  () => (
                    <e-column surface="background" border>
                      <TimePickerPanel
                        locale={locale}
                        o_date={o_cur}
                        am_pm={o.get(opts.am_pm)}
                        seconds={o.get(opts.seconds)}
                        hour_step={o.get(opts.hour_step)}
                        minute_step={o.get(opts.minute_step)}
                        second_step={o.get(opts.second_step)}
                        on_change={(d) => set_model(d)}
                      />
                    </e-column>
                  ),
                  { arrow: true },
                )
              })}
              {Clock()}
            </button>
          ),
      )}
      {o.tf(
        oo_date_button,
        (v) =>
          v && (
            <button type="button" e-emphasis={oo_emphasis} title={o_ui_labels.p("pick_date")}>
              {$click((ev) => {
                void open_calendar(ev.currentTarget)
              })}
              {Calendar()}
            </button>
          ),
      )}
    </e-row>
  ) as HTMLElement
}

function same_day(a: Date, b: Date | null): boolean {
  if (b == null) return false
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

const cls_year = css`.date-year {
  min-width: 3.5em;
  text-align: center;
  font-weight: 600;
}`

const cls_grid = css`.date-grid {
  text-align: center;
  font-size: ${theme.settings.formFontSize};
}`

const cls_dow = css`.date-dow {
  font-size: 0.85em;
  color: ${colors.text.faded};
  line-height: 1.6em;
}`

const cls_day = css`.date-day {
  border: none;
  padding: 0;
  height: 28px;
  line-height: 28px;
  ${theme.css_radius("nudge-4")}
  width: 32px;
  /* A day of the previous or next month: its text color softened toward the background (a theme
     color, not opacity, which would also fade the selected or hovered fill behind it). */
  &.outside {
    color: ${colors.tint.faded};
  }
  /* Hover and the selected day (\`aria-selected\`) are the interaction and state layers' (ui/states.css.tsx). */
}`

const cls_date_input = css`.date-input {
  flex: 1;
  cursor: default;
}`
