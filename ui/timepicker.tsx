import { $click, $connected, css, o, type Renderable } from "elt"
import { theme } from "./theme"

/** Pixels of vertical drag per one step (up/down). */
const DRAG_PX_PER_STEP = 22

export interface ScrollColumnOpts {
  label?: Renderable
  min: number
  max: number
  loop?: boolean
  /** Increment per arrow, wheel notch, or drag step. Default 1. */
  step_size?: number
  format: (n: number) => string
  /** Current value (read on each interaction — do not cache in listeners). */
  get_value: () => number
  on_change: (n: number) => void
}

/** One scrollable numeric column with adjacent values and step buttons. */
export function ScrollColumn(opts: ScrollColumnOpts) {
  const span = () => opts.max - opts.min + 1

  const normalize = (v: number) => {
    if (opts.loop) {
      return opts.min + ((v - opts.min) % span() + span()) % span()
    }
    return Math.max(opts.min, Math.min(opts.max, v))
  }

  const inc = (delta: number) => (opts.step_size ?? 1) * delta

  const step = (delta: number) => {
    opts.on_change(normalize(opts.get_value() + inc(delta)))
  }

  const adjacent = (delta: number) => {
    const v = opts.get_value()
    if (opts.loop) {
      return normalize(v + inc(delta))
    }
    return Math.max(opts.min, Math.min(opts.max, v + inc(delta)))
  }

  return <e-box class={cls_column}>
    {$connected((node: HTMLElement) => {
      let touch_id: number | null = null
      let touch_y = 0
      let drag_accum = 0

      const on_wheel = (ev: WheelEvent) => {
        ev.preventDefault()
        step(ev.deltaY > 0 ? 1 : -1)
      }

      const apply_drag = (dy: number) => {
        drag_accum += dy
        while (drag_accum >= DRAG_PX_PER_STEP) {
          step(-1)
          drag_accum -= DRAG_PX_PER_STEP
        }
        while (drag_accum <= -DRAG_PX_PER_STEP) {
          step(1)
          drag_accum += DRAG_PX_PER_STEP
        }
      }

      node.addEventListener("wheel", on_wheel, { passive: false })
      node.addEventListener("touchstart", ev => {
        const t = ev.changedTouches[0]
        if (!t) return
        touch_id = t.identifier
        touch_y = t.clientY
        drag_accum = 0
      }, { passive: true })
      node.addEventListener("touchmove", ev => {
        if (touch_id == null) return
        const t = [...ev.changedTouches].find(x => x.identifier === touch_id)
        if (!t) return
        ev.preventDefault()
        const dy = t.clientY - touch_y
        touch_y = t.clientY
        apply_drag(dy)
      }, { passive: false })
      node.addEventListener("touchend", ev => {
        if (touch_id == null) return
        const t = [...ev.changedTouches].find(x => x.identifier === touch_id)
        if (t) touch_id = null
        drag_accum = 0
      })
      node.addEventListener("touchcancel", () => {
        touch_id = null
        drag_accum = 0
      })
    })}
    <button type="button" e-variant="text" class={cls_step}>
      {$click(() => step(-1))}
      ▲
    </button>
    <span class={cls_adj}>{opts.format(adjacent(-1))}</span>
    <span class={cls_val}>{opts.format(opts.get_value())}</span>
    <span class={cls_adj}>{opts.format(adjacent(1))}</span>
    <button type="button" e-variant="text" class={cls_step}>
      {$click(() => step(1))}
      ▼
    </button>
  </e-box> as HTMLElement
}

export interface TimePickerPanelOpts {
  locale: string
  o_date: o.Observable<Date>
  am_pm: boolean
  seconds: boolean
  minute_step?: number
  second_step?: number
  on_change: (d: Date) => void
}

function hour12(d: Date): number {
  return d.getHours() % 12 || 12
}

export function TimePickerPanel(opts: TimePickerPanelOpts) {
  const patch = (fn: (d: Date) => void) => {
    const d = new Date(opts.o_date.get())
    fn(d)
    opts.o_date.set(d)
    opts.on_change(d)
  }

  const cols: Renderable[] = []

  if (opts.am_pm) {
    cols.push(o.expression(get => {
      get(opts.o_date)
      return ScrollColumn({
        min: 0,
        max: 1,
        loop: true,
        get_value: () => (opts.o_date.get().getHours() >= 12 ? 1 : 0),
        format: v => day_period_text(opts.locale, v === 0),
        on_change: v => patch(dt => {
          const h = dt.getHours() % 12
          dt.setHours(v === 1 ? (h === 0 ? 12 : h + 12) : (h === 12 ? 0 : h))
        }),
      })
    }))
  }

  cols.push(o.expression(get => {
    get(opts.o_date)
    return ScrollColumn({
      min: opts.am_pm ? 1 : 0,
      max: opts.am_pm ? 12 : 23,
      loop: true,
      get_value: () => opts.am_pm ? hour12(opts.o_date.get()) : opts.o_date.get().getHours(),
      format: n => String(n).padStart(2, "0"),
      on_change: h => patch(dt => {
        if (opts.am_pm) {
          const pm = dt.getHours() >= 12
          if (h === 12) dt.setHours(pm ? 12 : 0)
          else dt.setHours(pm ? h + 12 : h)
        } else {
          dt.setHours(h)
        }
      }),
    })
  }))

  const minute_step = Math.max(1, Math.min(30, Math.trunc(opts.minute_step ?? 1)))
  const second_step = Math.max(1, Math.min(30, Math.trunc(opts.second_step ?? 1)))

  cols.push(o.expression(get => {
    get(opts.o_date)
    return ScrollColumn({
      min: 0,
      max: 59,
      loop: true,
      step_size: minute_step,
      get_value: () => opts.o_date.get().getMinutes(),
      format: n => String(n).padStart(2, "0"),
      on_change: m => patch(dt => dt.setMinutes(m)),
    })
  }))

  if (opts.seconds) {
    cols.push(o.expression(get => {
      get(opts.o_date)
      return ScrollColumn({
        min: 0,
        max: 59,
        loop: true,
        step_size: second_step,
        get_value: () => opts.o_date.get().getSeconds(),
        format: n => String(n).padStart(2, "0"),
        on_change: s => patch(dt => dt.setSeconds(s)),
      })
    }))
  }

  return <e-flex class={cls_panel} gap="small">{cols}</e-flex> as HTMLElement
}

function day_period_text(locale: string, am: boolean): string {
  return new Intl.DateTimeFormat(locale, { hour: "numeric", hour12: true })
    .formatToParts(am ? new Date(2000, 0, 1, 9, 0) : new Date(2000, 0, 1, 21, 0))
    .find(p => p.type === "dayPeriod")?.value ?? (am ? "AM" : "PM")
}

const cls_panel = css`.time-panel {
  display: flex;
  padding: ${theme.settings.cellPadding};
  max-height: 220px;
  overflow: hidden;
}`

const cls_column = css`.scroll-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 3.5em;
  overflow: hidden;
  touch-action: none;
  user-select: none;
}`

const cls_step = css`.scroll-step {
  font-size: 0.65em;
  line-height: 1;
  padding: 2px 6px;
}`

const cls_adj = css`.scroll-adj {
  font-size: 0.7em;
  opacity: 0.45;
  line-height: 1.2;
}`

const cls_val = css`.scroll-val {
  font-size: 1.1em;
  font-weight: 600;
  line-height: 1.4;
}`
