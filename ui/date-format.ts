/** Locale-aware segmented date/time formatting for DateTimePicker. */

export type SegmentKind = "year" | "month" | "day" | "hour" | "minute" | "second" | "dayPeriod"

export type SegmentValues = Partial<Record<SegmentKind, number>>

export interface DateFormatSegment {
  kind: SegmentKind
  start: number
  end: number
  digits: number
}

export interface DateFormatLayout {
  locale: string
  segments: DateFormatSegment[]
  literals: { index: number, char: string }[]
  length: number
}

export type WeekdayName =
  | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday"

const WEEKDAY_TO_JS: Record<WeekdayName, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
}

const REF_DATE = new Date(2000, 10, 22, 13, 45, 56)

export function resolve_locale(el: Element | null): string {
  let node: Element | null = el
  while (node != null) {
    const lang = node.getAttribute("lang")
    if (lang) return lang
    node = node.parentElement
  }
  return document.documentElement.lang || navigator.language
}

export function week_start_js(week_starts_on: WeekdayName | undefined, locale: string): number {
  if (week_starts_on != null) return WEEKDAY_TO_JS[week_starts_on]
  try {
    const loc = new Intl.Locale(locale) as Intl.Locale & { weekInfo?: { firstDay: number } }
    const first = loc.weekInfo?.firstDay
    if (first != null) return first === 7 ? 0 : first
  } catch { /* unsupported tag */ }
  return 1
}

export interface LayoutOptions {
  show_date: boolean
  show_time: boolean
  seconds: boolean
  am_pm: boolean
}

export function build_layout(locale: string, opts: LayoutOptions): DateFormatLayout {
  const fmt_opts: Intl.DateTimeFormatOptions = {}
  if (opts.show_date) {
    fmt_opts.year = "numeric"
    fmt_opts.month = "2-digit"
    fmt_opts.day = "2-digit"
  }
  if (opts.show_time) {
    fmt_opts.hour = "2-digit"
    fmt_opts.minute = "2-digit"
    if (opts.seconds) fmt_opts.second = "2-digit"
    fmt_opts.hour12 = opts.am_pm
  }

  const parts = new Intl.DateTimeFormat(locale, fmt_opts).formatToParts(REF_DATE)
  let length = 0
  const segments: DateFormatSegment[] = []
  const literals: DateFormatLayout["literals"] = []

  for (const part of parts) {
    if (part.type === "literal") {
      for (const ch of part.value) {
        literals.push({ index: length, char: ch })
        length++
      }
      continue
    }
    const kind = part.type as SegmentKind
    if (kind === "dayPeriod" && !opts.am_pm) continue
    const digits = part.value.replace(/\D/g, "").length || (kind === "year" ? 4 : 2)
    segments.push({ kind, start: length, end: length + digits, digits })
    length += digits
  }

  return { locale, segments, literals, length }
}

function pad(n: number, digits: number): string {
  return String(n).padStart(digits, "0")
}

function day_period_text(locale: string, am: boolean, digits: number): string {
  const sample = new Intl.DateTimeFormat(locale, { hour: "numeric", hour12: true })
    .formatToParts(am ? new Date(2000, 0, 1, 9, 0) : new Date(2000, 0, 1, 21, 0))
    .find(p => p.type === "dayPeriod")?.value ?? (am ? "AM" : "PM")
  return sample.slice(0, digits).padEnd(digits, " ")
}

export function rebuild_from_segments(layout: DateFormatLayout, vals: SegmentValues): string {
  const buf = new Array<string>(layout.length).fill(" ")
  for (const lit of layout.literals) buf[lit.index] = lit.char
  for (const seg of layout.segments) {
    const v = vals[seg.kind]
    if (seg.kind === "dayPeriod") {
      const text = day_period_text(layout.locale, (v ?? 0) === 0, seg.digits)
      for (let i = 0; i < seg.digits; i++) buf[seg.start + i] = text[i] ?? " "
    } else if (v != null) {
      const text = pad(clamp_segment(seg.kind, v, vals), seg.digits)
      for (let i = 0; i < seg.digits; i++) buf[seg.start + i] = text[i]!
    } else {
      for (let i = 0; i < seg.digits; i++) buf[seg.start + i] = "0"
    }
  }
  return buf.join("")
}

export function days_in_month(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function clamp_segment(kind: SegmentKind, value: number, ctx: SegmentValues): number {
  switch (kind) {
    case "year":
      return Math.max(1, Math.min(9999, Math.trunc(value)))
    case "month":
      return Math.max(1, Math.min(12, Math.trunc(value)))
    case "day": {
      const y = ctx.year
      const m = ctx.month
      const max = y != null && m != null ? days_in_month(y, m) : 31
      return Math.max(1, Math.min(max, Math.trunc(value)))
    }
    case "hour":
      return ctx.dayPeriod != null
        ? Math.max(1, Math.min(12, Math.trunc(value)))
        : Math.max(0, Math.min(23, Math.trunc(value)))
    case "minute":
    case "second":
      return Math.max(0, Math.min(59, Math.trunc(value)))
    case "dayPeriod":
      return value >= 1 ? 1 : 0
    default:
      return value
  }
}

export function parse_segments(layout: DateFormatLayout, text: string): SegmentValues {
  const vals: SegmentValues = {}
  for (const seg of layout.segments) {
    const slice = text.slice(seg.start, seg.end)
    if (seg.kind === "dayPeriod") {
      const pm_sample = day_period_text(layout.locale, false, 2).trim().toLowerCase()
      vals.dayPeriod = slice.trim().toLowerCase().startsWith(pm_sample[0] ?? "p") ? 1 : 0
      continue
    }
    const digits = slice.replace(/\D/g, "")
    if (digits.length === 0) continue
    vals[seg.kind] = clamp_segment(seg.kind, Number(digits), { ...vals, [seg.kind]: Number(digits) })
  }
  return vals
}

export function segment_at(layout: DateFormatLayout, index: number): DateFormatSegment | null {
  for (const seg of layout.segments) {
    if (index >= seg.start && index < seg.end) return seg
  }
  return null
}

export function is_literal_index(layout: DateFormatLayout, index: number): boolean {
  return layout.literals.some(l => l.index === index)
}

export function segments_complete(layout: DateFormatLayout, vals: SegmentValues): boolean {
  for (const seg of layout.segments) {
    if (vals[seg.kind] == null) return false
  }
  return true
}

export function date_to_values(d: Date, layout: DateFormatLayout): SegmentValues {
  const vals: SegmentValues = {}
  for (const seg of layout.segments) {
    switch (seg.kind) {
      case "year": vals.year = d.getFullYear(); break
      case "month": vals.month = d.getMonth() + 1; break
      case "day": vals.day = d.getDate(); break
      case "hour":
        vals.hour = layout.segments.some(s => s.kind === "dayPeriod")
          ? (d.getHours() % 12 || 12)
          : d.getHours()
        break
      case "minute": vals.minute = d.getMinutes(); break
      case "second": vals.second = d.getSeconds(); break
      case "dayPeriod": vals.dayPeriod = d.getHours() >= 12 ? 1 : 0; break
    }
  }
  return vals
}

export function values_to_date(layout: DateFormatLayout, vals: SegmentValues): Date | null {
  if (!segments_complete(layout, vals)) return null
  const y = vals.year!
  const mo = vals.month! - 1
  const da = vals.day!
  let h = vals.hour ?? 0
  const min = vals.minute ?? 0
  const sec = vals.second ?? 0
  if (vals.dayPeriod != null) {
    if (h === 12) h = vals.dayPeriod === 0 ? 0 : 12
    else if (vals.dayPeriod === 1) h = (h % 12) + 12
    else h = h % 12
  }
  const d = new Date(y, mo, da, h, min, sec)
  if (d.getFullYear() !== y || d.getMonth() !== mo || d.getDate() !== da) return null
  return d
}

export function apply_date_part(base: Date, y: number, mo: number, da: number): Date {
  return new Date(y, mo - 1, da, base.getHours(), base.getMinutes(), base.getSeconds())
}

export function apply_time_part(base: Date, vals: SegmentValues): Date {
  let h = vals.hour ?? base.getHours()
  const min = vals.minute ?? base.getMinutes()
  const sec = vals.second ?? base.getSeconds()
  if (vals.dayPeriod != null) {
    if (h === 12) h = vals.dayPeriod === 0 ? 0 : 12
    else if (vals.dayPeriod === 1) h = (h % 12) + 12
    else h = h % 12
  }
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, min, sec)
}

export function calendar_month_cells(view: Date, week_start: number): { date: Date, in_month: boolean }[] {
  const y = view.getFullYear()
  const m = view.getMonth()
  const first = new Date(y, m, 1)
  let start = first.getDay() - week_start
  if (start < 0) start += 7
  const start_date = new Date(y, m, 1 - start)
  const cells: { date: Date, in_month: boolean }[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start_date.getFullYear(), start_date.getMonth(), start_date.getDate() + i)
    cells.push({ date: d, in_month: d.getMonth() === m })
  }
  return cells
}

export function month_names(locale: string): string[] {
  return Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date(2000, i, 1))
  )
}

export function weekday_labels(locale: string, week_start: number): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const day = (week_start + i) % 7
    return new Intl.DateTimeFormat(locale, { weekday: "narrow" })
      .format(new Date(2024, 0, 7 + day))
  })
}
