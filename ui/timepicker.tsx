import { $click, $on, css, o, type Renderable } from "elt"
import { day_period_text, normalize_step, to_12h, to_24h, wrap } from "./date-format"
import { theme } from "./theme"

/** Pixels of vertical drag per one step (up/down). */
const DRAG_PX_PER_STEP = 22

export interface ScrollColumnOpts {
  /** Shown above the column, e.g. "h" or "min". */
  label?: Renderable
  min: number
  max: number
  loop?: boolean
  /** Increment per arrow, wheel notch, or drag step. Default 1. */
  step_size?: number
  format: (n: number) => string
  /** Current value; the column shows its changes. */
  value: o.RO<number>
  on_change: (n: number) => void
}

/**
 * One scrollable numeric column with adjacent values and step buttons. Built once: only the three
 * value texts follow `value`.
 */
export function ScrollColumn(opts: ScrollColumnOpts) {
  /** `v` brought back into min–max: around when looping, stopped at the bounds otherwise. */
  const normalize = (v: number) => (opts.loop ? wrap(v, opts.min, opts.max) : Math.max(opts.min, Math.min(opts.max, v)))

  /** The value `delta` steps away from `v`. */
  const adjacent = (v: number, delta: number) => normalize(v + (opts.step_size ?? 1) * delta)

  const step = (delta: number) => {
    opts.on_change(adjacent(o.get(opts.value), delta))
  }

  // Touch drag: one step per DRAG_PX_PER_STEP pixels, the remainder carried over to the next move.
  let touch_id: number | null = null
  let touch_y = 0
  let drag_accum = 0

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

  const format_at = (delta: number) => o.tf(opts.value, (v) => opts.format(adjacent(v, delta)))

  return (
    <e-column spacing="none">
      {/* Not passive: they cancel the page scroll while they step the value. */}
      {$on(
        "wheel",
        (ev) => {
          ev.preventDefault()
          step(ev.deltaY > 0 ? -1 : 1)
        },
        { passive: false },
      )}
      {$on(
        "touchstart",
        (ev) => {
          const t = ev.changedTouches[0]
          if (!t) return
          touch_id = t.identifier
          touch_y = t.clientY
          drag_accum = 0
        },
        { passive: true },
      )}
      {$on(
        "touchmove",
        (ev) => {
          if (touch_id == null) return
          const t = [...ev.changedTouches].find((x) => x.identifier === touch_id)
          if (!t) return
          ev.preventDefault()
          const dy = t.clientY - touch_y
          touch_y = t.clientY
          apply_drag(dy)
        },
        { passive: false },
      )}
      {$on("touchend", (ev) => {
        if (touch_id == null) return
        if ([...ev.changedTouches].some((x) => x.identifier === touch_id)) touch_id = null
        drag_accum = 0
      })}
      {$on("touchcancel", () => {
        touch_id = null
        drag_accum = 0
      })}
      {opts.label != null && <span class={cls_label}>{opts.label}</span>}
      <button type="button" e-variant="text" class={cls_step}>
        {$click(() => step(-1))}▲
      </button>
      <span class={cls_adj}>{format_at(1)}</span>
      <span class={cls_val}>{o.tf(opts.value, opts.format)}</span>
      <span class={cls_adj}>{format_at(-1)}</span>
      <button type="button" e-variant="text" class={cls_step}>
        {$click(() => step(1))}▼
      </button>
    </e-column>
  ) as HTMLElement
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

const two_digits = (n: number) => String(n).padStart(2, "0")

export function TimePickerPanel(opts: TimePickerPanelOpts) {
  const { o_date, am_pm } = opts

  /** Change a copy of the current date, then publish it. */
  const patch = (fn: (d: Date) => void) => {
    const d = new Date(o_date.get())
    fn(d)
    o_date.set(d)
    opts.on_change(d)
  }

  const cols: Renderable[] = [
    ScrollColumn({
      min: am_pm ? 1 : 0,
      max: am_pm ? 12 : 23,
      loop: true,
      value: o_date.tf((d) => (am_pm ? to_12h(d.getHours()) : d.getHours())),
      format: two_digits,
      // In 12-hour mode the hour keeps its period (AM / PM).
      on_change: (h) => patch((dt) => dt.setHours(am_pm ? to_24h(h, dt.getHours() >= 12) : h)),
    }),
    ScrollColumn({
      min: 0,
      max: 59,
      loop: true,
      step_size: normalize_step(opts.minute_step),
      value: o_date.tf((d) => d.getMinutes()),
      format: two_digits,
      on_change: (m) => patch((dt) => dt.setMinutes(m)),
    }),
  ]

  if (opts.seconds) {
    cols.push(
      ScrollColumn({
        min: 0,
        max: 59,
        loop: true,
        step_size: normalize_step(opts.second_step),
        value: o_date.tf((d) => d.getSeconds()),
        format: two_digits,
        on_change: (s) => patch((dt) => dt.setSeconds(s)),
      }),
    )
  }

  if (am_pm) {
    // 0 = AM, 1 = PM; the hour keeps its 12-hour value.
    cols.push(
      ScrollColumn({
        min: 0,
        max: 1,
        loop: true,
        value: o_date.tf((d) => (d.getHours() >= 12 ? 1 : 0)),
        format: (v) => day_period_text(opts.locale, v === 0),
        on_change: (v) => patch((dt) => dt.setHours(to_24h(dt.getHours(), v === 1))),
      }),
    )
  }

  return (
    <e-flex class={cls_panel} pad="widget">
      {cols}
    </e-flex>
  ) as HTMLElement
}

const cls_panel = css`.time-panel {
  max-height: 220px;
  overflow: hidden;
}`

const cls_label = css`.scroll-label {
  font-size: 0.7em;
  color: ${theme.colors.text.faded};
  text-align: center;
}`

const cls_step = css`.scroll-step {
  font-size: 0.65em;
  line-height: 2;
  min-width: 24px;
  text-align: center;
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
