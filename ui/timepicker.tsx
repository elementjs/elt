import { $click, $connected, css, o, type Renderable } from "elt"
import { theme } from "./theme"

export interface ScrollColumnOpts {
  label?: Renderable
  min: number
  max: number
  loop?: boolean
  format: (n: number) => string
  value: number
  on_change: (n: number) => void
}

/** One scrollable numeric column with adjacent values and step buttons. */
export function ScrollColumn(opts: ScrollColumnOpts) {
  const step = (delta: number) => {
    let v = opts.value + delta
    if (opts.loop) {
      const span = opts.max - opts.min + 1
      v = opts.min + ((v - opts.min) % span + span) % span
    } else {
      v = Math.max(opts.min, Math.min(opts.max, v))
    }
    opts.on_change(v)
  }

  const prev = opts.loop
    ? opts.value <= opts.min ? opts.max : opts.value - 1
    : Math.max(opts.min, opts.value - 1)
  const next = opts.loop
    ? opts.value >= opts.max ? opts.min : opts.value + 1
    : Math.min(opts.max, opts.value + 1)

  return <e-box class={cls_column}>
    {$connected((node: HTMLElement) => {
    let touch_y = 0
    let touch_vel = 0
    let touch_id: number | null = null
    let raf = 0

    const on_wheel = (ev: WheelEvent) => {
      ev.preventDefault()
      step(ev.deltaY > 0 ? 1 : -1)
    }

    const inertia = () => {
      if (Math.abs(touch_vel) < 0.35) return
      if (touch_vel > 0) step(1)
      else step(-1)
      touch_vel *= 0.92
      raf = requestAnimationFrame(inertia)
    }

    node.addEventListener("wheel", on_wheel, { passive: false })
    node.addEventListener("touchstart", ev => {
      const t = ev.changedTouches[0]
      if (!t) return
      touch_id = t.identifier
      touch_y = t.clientY
      touch_vel = 0
      cancelAnimationFrame(raf)
    })
    node.addEventListener("touchmove", ev => {
      if (touch_id == null) return
      const t = [...ev.changedTouches].find(x => x.identifier === touch_id)
      if (!t) return
      ev.preventDefault()
      const dy = t.clientY - touch_y
      touch_y = t.clientY
      touch_vel = dy
      if (Math.abs(dy) > 18) {
        step(dy > 0 ? -1 : 1)
        touch_y = t.clientY
      }
    }, { passive: false })
    node.addEventListener("touchend", () => {
      touch_id = null
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(inertia)
    })
    })}
    <button type="button" e-variant="text" class={cls_step}>
      {$click(() => step(-1))}
      ▲
    </button>
    <span class={cls_adj}>{opts.format(prev)}</span>
    <span class={cls_val}>{opts.format(opts.value)}</span>
    <span class={cls_adj}>{opts.format(next)}</span>
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
  on_change: (d: Date) => void
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
      const d = get(opts.o_date)
      return ScrollColumn({
        min: 0,
        max: 1,
        loop: true,
        value: d.getHours() >= 12 ? 1 : 0,
        format: v => day_period_text(opts.locale, v === 0),
        on_change: v => patch(dt => {
          const h = dt.getHours() % 12
          dt.setHours(v === 1 ? (h === 0 ? 12 : h + 12) : (h === 12 ? 0 : h))
        }),
      })
    }))
  }

  cols.push(o.expression(get => {
    const d = get(opts.o_date)
    return ScrollColumn({
      min: opts.am_pm ? 1 : 0,
      max: opts.am_pm ? 12 : 23,
      loop: opts.am_pm,
      value: opts.am_pm ? (d.getHours() % 12 || 12) : d.getHours(),
      format: n => String(n).padStart(2, "0"),
      on_change: h => patch(dt => {
        if (opts.am_pm) {
          const pm = dt.getHours() >= 12
          let hour = h % 12
          if (hour === 0) hour = 12
          if (hour === 12) dt.setHours(pm ? 12 : 0)
          else dt.setHours(pm ? hour + 12 : hour)
        } else {
          dt.setHours(h)
        }
      }),
    })
  }))

  cols.push(o.expression(get => {
    const d = get(opts.o_date)
    return ScrollColumn({
      min: 0,
      max: 59,
      loop: true,
      value: d.getMinutes(),
      format: n => String(n).padStart(2, "0"),
      on_change: m => patch(dt => dt.setMinutes(m)),
    })
  }))

  if (opts.seconds) {
    cols.push(o.expression(get => {
      const d = get(opts.o_date)
      return ScrollColumn({
        min: 0,
        max: 59,
        loop: true,
        value: d.getSeconds(),
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
