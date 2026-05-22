import {
  $click,
  $connected,
  $observe,
  If,
  o,
  Repeat,
  type Attrs,
  css,
} from "elt"
import {
  apply_date_part,
  build_layout,
  calendar_month_cells,
  type DateFormatLayout,
  type WeekdayName,
  month_names,
  resolve_locale,
  weekday_labels,
  week_start_js,
} from "./date-format"
import { setup_segmented_date_input } from "./date-input"
import { Calendar, CaretLeft, CaretRight, Clock } from "./icons"
import { popup } from "./popup"
import { Select } from "./select"
import { TimePickerPanel } from "./timepicker"
import { theme } from "./theme"

const colors = theme.colors

export interface DateTimePickerAttributesBAse extends Attrs<HTMLElement> {
  week_starts_on?: o.RO<"monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday">

  /** if true, show the date selector. Default is true. */
  show_date?: o.RO<boolean>

  /** if true, show the time selector. Default is false. */
  show_time?: o.RO<boolean>

  /** if true, display 0-11 for hours and AM/PM instead of 0-23 */
  am_pm?: o.RO<boolean>

  /** if true, show the seconds selector */
  seconds?: o.RO<boolean>

  /** the date at which the popup will be set at when model still has no value. Defaults to now. */
  date_popup_default_date?: o.RO<Date>
}

export interface DatePickerNullable extends DateTimePickerAttributesBAse {
  model: o.Observable<Date | null>
  clearable: true
}

export interface DatePickerNotNullable extends DateTimePickerAttributesBAse {
  model: o.IObservable<Date | null, Date>
}

export type DatePickerAttrs = DatePickerNullable | DatePickerNotNullable

function picker_options(at: DatePickerAttrs) {
  return {
    show_date: o.tf(at.show_date, d => d ?? true),
    show_time: o.tf(at.show_time, t => t ?? false),
    am_pm: o.tf(at.am_pm, a => a ?? false),
    seconds: o.tf(at.seconds, s => s ?? false),
  }
}

export function DateTimePicker(at: DatePickerAttrs) {
  const clearable = "clearable" in at && at.clearable === true
  const opts = picker_options(at)
  const o_locale = o("")
  let input_api: ReturnType<typeof setup_segmented_date_input> | null = null

  const oo_layout = o.expression(get => {
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

  const lock = o.exclusive_lock()

  const set_model = (d: Date | null) => {
    if (d == null && clearable) at.model.set(null)
    else if (d != null) at.model.set(d)
  }

  const get_model = () => at.model.get()

  const oo_picker_state = o.expression(get => {
    const layout = get(oo_layout)
    if (!layout) return null
    return { layout, model: get(at.model) as Date | null }
  })

  const push_model_to_input = (m: Date | null, layout: DateFormatLayout) => {
    lock(() => input_api?.apply_model(m, layout))
  }

  const open_calendar = async (anchor: HTMLElement) => {
    const locale = o_locale.get()
    if (!locale || !oo_layout.get()) return

    const week_start = week_start_js(o.get(at.week_starts_on) as WeekdayName | undefined, locale)
    const o_view = o(get_model() ?? default_popup_date())
    const months = month_names(locale)
    const o_month = o.expression(
      get => get(o_view).getMonth(),
      m => {
        const d = new Date(o_view.get())
        d.setMonth(m)
        o_view.set(d)
      }
    )
    const oo_cells = o.expression(get => calendar_month_cells(get(o_view), week_start))
    const oo_selected = o.expression(get => get(at.model))

    const year_delta = (delta: number) => {
      const d = new Date(o_view.get())
      d.setFullYear(d.getFullYear() + delta)
      o_view.set(d)
    }

    const pick_day = (cell_date: Date) => {
      const layout = oo_layout.get()
      if (!layout) return
      const base = get_model() ?? default_popup_date()
      const d = apply_date_part(
        base,
        cell_date.getFullYear(),
        cell_date.getMonth() + 1,
        cell_date.getDate()
      )
      lock(() => {
        set_model(d)
        input_api?.apply_model(d, layout)
      })
    }

    await popup(anchor, () => (
      <e-box class={cls_calendar}>
        <e-flex class={cls_toolbar} align="center" gap="small">
          <button type="button" e-variant="text">
            {$click(() => year_delta(-1))}
            {CaretLeft()}
          </button>
          <span class={cls_year}>{o_view.tf(v => String(v.getFullYear()))}</span>
          <button type="button" e-variant="text">
            {$click(() => year_delta(1))}
            {CaretRight()}
          </button>
          <Select
            model={o_month}
            options={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]}
            label_fn={i => months[i]!}
          />
        </e-flex>
        <e-grid class={cls_grid}>
          {weekday_labels(locale, week_start).map(label => <span class={cls_dow}>{label}</span>)}
          {Repeat(oo_cells, o_cell => {
            const oo_in_month = o_cell.tf(c => c.in_month)
            const oo_day_num = o_cell.tf(c => c.date.getDate())
            const oo_selected_day = o.expression(get => {
              const sel = get(oo_selected)
              const cell = get(o_cell)
              return same_day(cell.date, sel)
            })
            return <button
              type="button"
              e-variant="text"
              class={[cls_day, oo_in_month.tf(v => !v && "outside"), oo_selected_day.tf(s => s && "selected")]}
            >
              {$click(() => pick_day(o_cell.get().date))}
              {oo_day_num}
            </button>
          })}
        </e-grid>
      </e-box>
    ), { parent: anchor.parentElement!, arrow: true })
  }

  return <e-button-box>
    {$connected((box: HTMLElement) => {
      o_locale.set(resolve_locale(box))
    })}
    <input type="text" autocomplete="off" spellcheck={false}>
      {$observe(oo_picker_state, (state, _old, input) => {
        if (!state) return
        if (!input_api) {
          input_api = setup_segmented_date_input(input, {
            get_layout: () => oo_layout.get()!,
            set_model,
            clearable,
            lock,
          })
        }
        push_model_to_input(state.model, state.layout)
      })}
    </input>
    {o.tf(opts.show_time, v => v &&
      <button type="button" e-variant="tint" title="Time">
        {$click(async ev => {
          const locale = o_locale.get()
          if (!locale) return
          const o_cur = o(get_model() ?? default_popup_date())
          await popup(ev.currentTarget, () => (
            <TimePickerPanel
              locale={locale}
              o_date={o_cur}
              am_pm={o.get(opts.am_pm)}
              seconds={o.get(opts.seconds)}
              on_change={d => {
                const layout = oo_layout.get()
                if (!layout) return
                lock(() => {
                  set_model(d)
                  input_api?.apply_model(d, layout)
                })
              }}
            />
          ), { parent: ev.currentTarget.parentElement!, arrow: true })
        })}
        {Clock()}
      </button>
    )}
    {o.tf(opts.show_date, v => v &&
      <button type="button" e-variant="tint" title="Date">
        {$click(ev => { void open_calendar(ev.currentTarget) })}
        {Calendar()}
      </button>
    )}
  </e-button-box> as HTMLElement
}

function same_day(a: Date, b: Date | null): boolean {
  if (b == null) return false
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

const cls_calendar = css`.date-calendar {
  padding: ${theme.settings.cellPadding};
  min-width: 260px;
}`

const cls_toolbar = css`.date-toolbar {
  margin-bottom: 8px;
}`

const cls_year = css`.date-year {
  min-width: 3.5em;
  text-align: center;
  font-weight: 600;
}`

const cls_grid = css`.date-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  text-align: center;
  font-size: ${theme.settings.formFontSize};
}`

const cls_dow = css`.date-dow {
  font-size: 0.85em;
  color: ${colors.text.faded};
  padding: 2px 0;
}`

const cls_day = css`.date-day {
  border: none;
  padding: 4px 0;
  border-radius: 4px;
  &.outside {
    opacity: 0.35;
  }
  &.selected {
    background: ${colors.tint.light};
    color: ${colors.tint};
  }
  @media (hover: hover) and (pointer: fine) {
    &:hover {
      background: ${colors.tint.ultra_light};
    }
  }
}`
