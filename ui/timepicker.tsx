import { $click, $observe, $on, css, o, type Renderable, RepeatCircular, RepeatVirtual } from "elt"
import { day_period_text, HOUR_STEPS, normalize_step, to_24h } from "./date-format"
import { o_ui_labels } from "./labels"
import { theme } from "./theme"

/** Steps PageUp / PageDown move by. */
const PAGE_STEPS = 5

/** Rows a wheel shows: its value in the middle, two on each side. The CSS below is written for it. */
const VISIBLE_ROWS = 5

/** How long without a `scroll` event counts as stopped, where the browser has no `scrollend`. */
const SCROLL_IDLE_MS = 150

export interface ScrollColumnOpts {
  /** Shown above the column, e.g. "h" or "min". */
  label?: Renderable
  /** The column's name for assistive technology ("Hours"). */
  name?: o.RO<string>
  min: number
  max: number
  /** After the last value comes the first again, whichever way the column is scrolled. */
  loop?: boolean
  /** Distance between two values of the column, from `min`; keys step by it. Default 1. */
  step_size?: number
  format: (n: number) => string
  /** Current value; the column shows its changes. */
  value: o.RO<number>
  on_change: (n: number) => void
}

/**
 * One numeric column, drawn as a wheel: its values, from `min` by `step_size` up to `max`, scroll under
 * a centre slot, and the value in the slot is the column's. A scroll by the user (wheel, touch) picks
 * the value it stopped on; a click on a value scrolls it to the slot and picks it. With `loop`, the
 * values go around (`RepeatCircular`). A value off the step grid shows the nearest one, without
 * changing it until the user picks.
 *
 * For the keyboard and assistive technology it is a `spinbutton`, one Tab stop: Up/Down step it,
 * PageUp/PageDown by PAGE_STEPS, Home/End go to the first and last values. The rows are for the
 * pointer only, hidden from assistive technology.
 */
export function ScrollColumn(opts: ScrollColumnOpts) {
  const size = opts.step_size ?? 1
  const values: number[] = []
  for (let v = opts.min; v <= opts.max; v += size) values.push(v)
  const count = values.length

  /** The index of the value of the grid nearest to `v`: around when looping, stopped at the ends otherwise. */
  const index_of = (v: number) => {
    const i = Math.round((v - opts.min) / size)
    return opts.loop ? ((i % count) + count) % count : Math.max(0, Math.min(count - 1, i))
  }
  const oo_index = o.tf(opts.value, index_of)

  const pick = (i: number) => {
    const v = values[i] as number
    if (v !== o.get(opts.value)) opts.on_change(v)
  }
  const step = (delta: number) => {
    const i = index_of(o.get(opts.value)) + delta
    pick(opts.loop ? ((i % count) + count) % count : Math.max(0, Math.min(count - 1, i)))
  }

  /** Each rendered row's index among the values. */
  const row_index = new WeakMap<Element, o.RO<number>>()

  /** Scroll `row` into the centre slot (the start of the scroll area once its `scroll-padding` is left out). */
  const centre = (row: Element, smooth: boolean) => {
    const top = row.getBoundingClientRect().top - wheel.getBoundingClientRect().top - wheel.clientTop
    const delta = top - (Number.parseFloat(getComputedStyle(wheel).scrollPaddingTop) || 0)
    if (Math.abs(delta) >= 1) wheel.scrollBy({ top: delta, behavior: smooth ? "smooth" : "instant" })
  }

  /** Bring value `i` to the slot: the rendered row showing it nearest to the slot, or a jump to it. */
  const show = (i: number, smooth: boolean) => {
    const slot = wheel.getBoundingClientRect().top + wheel.clientHeight / 2
    let best: Element | null = null
    let best_distance = Infinity
    for (const row of wheel.querySelectorAll(`.${cls_row}`)) {
      if (o.get(row_index.get(row)) !== i) continue
      const r = row.getBoundingClientRect()
      const distance = Math.abs(r.top + r.height / 2 - slot)
      if (distance < best_distance) {
        best = row
        best_distance = distance
      }
    }
    if (best != null) centre(best, smooth)
    else list.setPosition(i)
  }

  const render_row = (o_value: o.ReadonlyObservable<number>, oo_i: o.ReadonlyObservable<number>) => {
    const row = (
      <e-row
        class={cls_row}
        role="option"
        pad="widget"
        radius="widget"
        e-interactive
        aria-selected={o.expression((get) => String(get(oo_i) === get(oo_index)))}
      >
        {$click(() => {
          pick(oo_i.get())
          centre(row, true)
        })}
        {o_value.tf(opts.format)}
      </e-row>
    ) as HTMLElement
    row_index.set(row, oo_i)
    return row
  }

  const o_values = o(values)
  const list = (opts.loop ? RepeatCircular(o_values, render_row) : RepeatVirtual(o_values, render_row))
    .Threshold(150)
    .InitialPosition(index_of(o.get(opts.value)))

  // A scroll by the user picks the value it stopped on; the column's own scrolls (to show the value,
  // or recentring the ring) don't.
  let user_scrolled = false
  let idle_timer: ReturnType<typeof setTimeout> | null = null
  const stopped = () => {
    if (!user_scrolled) return
    user_scrolled = false
    const i = list.itemAt(wheel.clientHeight / 2)
    if (i != null) pick(i)
  }
  const by_user = () => {
    user_scrolled = true
  }

  const wheel = (
    <div
      class={cls_wheel}
      role="spinbutton"
      tabindex="0"
      aria-label={opts.name}
      aria-valuemin={values[0]}
      aria-valuemax={values[count - 1]}
      aria-valuenow={opts.value}
      aria-valuetext={o.tf(opts.value, opts.format)}
    >
      {$on("keydown", (ev) => {
        if (ev.key === "ArrowUp") step(1)
        else if (ev.key === "ArrowDown") step(-1)
        else if (ev.key === "PageUp") step(PAGE_STEPS)
        else if (ev.key === "PageDown") step(-PAGE_STEPS)
        else if (ev.key === "Home") pick(0)
        // The last value of the step grid: minutes by 15 end at 45, not 59.
        else if (ev.key === "End") pick(count - 1)
        else return
        ev.preventDefault()
      })}
      {$on("wheel", by_user, { passive: true })}
      {$on("touchstart", by_user, { passive: true })}
      {$on("scrollend", stopped)}
      {"onscrollend" in window
        ? null
        : $on("scroll", () => {
            if (idle_timer != null) clearTimeout(idle_timer)
            idle_timer = setTimeout(stopped, SCROLL_IDLE_MS)
          })}
      {/* A value from elsewhere (a key, the text field, the model): shown in the slot, smoothly. */}
      {$observe(
        opts.value,
        (v) => {
          const i = index_of(v)
          if (list.itemAt(wheel.clientHeight / 2) !== i) show(i, true)
        },
        { changes_only: true },
      )}
      {/* The rows are for the pointer: the spinbutton says the value. Nothing in them takes focus. */}
      {/* biome-ignore lint/a11y/noAriaHiddenOnFocusable: a layout element, not focusable */}
      <e-column spacing="none" align="stretch" aria-hidden="true">
        {/* Without a ring, room for the first and last values to reach the slot. */}
        {!opts.loop && <div class={cls_end_room} />}
        {list}
        {!opts.loop && <div class={cls_end_room} />}
      </e-column>
    </div>
  ) as HTMLElement

  return (
    <e-column spacing="none" align="stretch">
      {opts.label != null && <span class={cls_label}>{opts.label}</span>}
      {wheel}
    </e-column>
  ) as HTMLElement
}

export interface TimePickerPanelOpts {
  locale: string
  o_date: o.Observable<Date>
  am_pm: boolean
  seconds: boolean
  hour_step?: number
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
    // In 12-hour mode the column holds the hours of a half day, 12 first (shown for 0); the hour keeps
    // its period (AM / PM).
    ScrollColumn({
      min: 0,
      max: am_pm ? 11 : 23,
      loop: true,
      step_size: normalize_step(opts.hour_step, HOUR_STEPS),
      name: o_ui_labels.p("hours"),
      value: o_date.tf((d) => (am_pm ? d.getHours() % 12 : d.getHours())),
      format: (h) => (am_pm ? two_digits(h || 12) : two_digits(h)),
      on_change: (h) => patch((dt) => dt.setHours(am_pm ? h + (dt.getHours() >= 12 ? 12 : 0) : h)),
    }),
    ScrollColumn({
      min: 0,
      max: 59,
      loop: true,
      step_size: normalize_step(opts.minute_step),
      name: o_ui_labels.p("minutes"),
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
        name: o_ui_labels.p("seconds"),
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
        name: o_ui_labels.p("am_pm"),
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
  align-items: start;
}`

/* The wheel: five rows high, the centre one the slot (\`scroll-padding\` leaves the two rows above it
   uncovered, so the row snapped to the start, and the one a jump lands on, sits in the middle). No
   scrollbar: the rows are what is scrolled. Its ring of values never reaches an end; a column that
   doesn't loop keeps the scroll from going on to the page. */
const cls_wheel = css`.time-wheel {
  --e-wheel-row: 2.25em;
  height: calc(var(--e-wheel-row) * ${VISIBLE_ROWS});
  overflow-y: auto;
  overscroll-behavior: contain;
  scroll-snap-type: y mandatory;
  scroll-padding-block: calc(var(--e-wheel-row) * ${(VISIBLE_ROWS - 1) / 2});
  scrollbar-width: none;
  &:focus-visible {
    outline: none;
    box-shadow: inset 0 0 0 ${theme.settings.focusRingSize} ${theme.colors.tint.mid};
  }
}`

/* A row of the wheel. The values off the slot are muted text (a theme color, not opacity); the one in
   the slot is selected (\`aria-selected\`, drawn by the state layer, ui/states.css.tsx). */
const cls_row = css`.time-row {
  height: var(--e-wheel-row);
  box-sizing: border-box;
  justify-content: center;
  scroll-snap-align: start;
  color: ${theme.colors.text.faded};
  &[aria-selected="true"] {
    color: inherit;
    font-weight: bold;
  }
}`

/* Before the first value and after the last of a column that doesn't loop: two rows, so that they
   reach the slot. */
const cls_end_room = css`.time-end-room {
  flex: none;
  height: calc(var(--e-wheel-row) * ${(VISIBLE_ROWS - 1) / 2});
}`

const cls_label = css`.scroll-label {
  font-size: 0.7em;
  color: ${theme.colors.text.faded};
  text-align: center;
}`
