/**
 * Locale-aware segmented date/time formatting for DateTimePicker.
 *
 * A fixed reference date is formatted with `Intl` so we learn segment order,
 * widths, and literal separators; the input then edits that template in place.
 */

export type SegmentKind = "year" | "month" | "day" | "hour" | "minute" | "second" | "dayPeriod"

/** Numeric value for each editable field parsed from or written to the input. */
export type SegmentValues = Partial<Record<SegmentKind, number>>

export interface DateFormatSegment {
  kind: SegmentKind
  /** Inclusive start index in the composed input string. */
  start: number
  /** Exclusive end index. */
  end: number
  /** Character width of this field in the template. */
  digits: number
}

/** Immutable description of one locale-specific datetime text mask. */
export interface DateFormatLayout {
  locale: string
  segments: DateFormatSegment[]
  /** Separator characters at fixed indices (/, space, :, etc.). */
  literals: { index: number; char: string }[]
  length: number
}

export type WeekdayName = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday"

const WEEKDAY_TO_JS: Record<WeekdayName, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
}

/** Stable sample instant so `formatToParts` yields predictable segment widths. */
const REF_DATE = new Date(2000, 10, 22, 13, 45, 56)

/** Closest BCP 47 tag: nearest `lang` on ancestors, else document or navigator. */
export function resolve_locale(el: Element | null): string {
  let node: Element | null = el
  while (node != null) {
    const lang = node.getAttribute("lang")
    if (lang) return lang
    node = node.parentElement
  }
  return document.documentElement.lang || navigator.language
}

/**
 * First day of the calendar week as `Date.getDay()` (0 = Sunday).
 * Explicit `week_starts_on` wins; otherwise `Intl.Locale.weekInfo` when available.
 */
export function week_start_js(week_starts_on: WeekdayName | undefined, locale: string): number {
  if (week_starts_on != null) return WEEKDAY_TO_JS[week_starts_on]
  try {
    const loc = new Intl.Locale(locale) as Intl.Locale & { weekInfo?: { firstDay: number } }
    const first = loc.weekInfo?.firstDay
    if (first != null) return first === 7 ? 0 : first
  } catch {
    /* unsupported tag */
  }
  return 1
}

export interface LayoutOptions {
  show_date: boolean
  show_time: boolean
  seconds: boolean
  am_pm: boolean
}

/**
 * Build the editable mask for the picker (segment bounds + literals) from `Intl`
 * for the given locale and which date/time parts are shown.
 */
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

  const parts = date_format(locale, fmt_opts).formatToParts(REF_DATE)
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

/**
 * `Intl.DateTimeFormat` instances, one per locale and options. Building one is costly (it resolves the
 * locale data), and the input asks for the same few formats on each key press.
 */
const formats = new Map<string, Intl.DateTimeFormat>()

/** The shared `Intl.DateTimeFormat` for `locale` and `opts`; `opts` is keyed by its JSON, so pass literals in a stable key order. */
function date_format(locale: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}\n${JSON.stringify(opts)}`
  let fmt = formats.get(key)
  if (fmt == null) {
    fmt = new Intl.DateTimeFormat(locale, opts)
    formats.set(key, fmt)
  }
  return fmt
}

/** Localized AM/PM (or equivalent), e.g. "AM" / "PM" in English. */
export function day_period_text(locale: string, am: boolean): string {
  return (
    date_format(locale, { hour: "numeric", hour12: true })
      .formatToParts(am ? new Date(2000, 0, 1, 9, 0) : new Date(2000, 0, 1, 21, 0))
      .find((p) => p.type === "dayPeriod")?.value ?? (am ? "AM" : "PM")
  )
}

/**
 * The AM and PM texts of `locale` (in that order), trimmed and lower-cased for that locale: what typed
 * letters are compared with. Their first characters can be the same: `오전` / `오후` (ko), `午前` / `午後` (ja),
 * `ÖÖ` / `ÖS` (tr), and one text can start the other: `PG` / `PTG` (ms).
 */
export function day_period_texts(locale: string): [string, string] {
  return [
    day_period_text(locale, true).trim().toLocaleLowerCase(locale),
    day_period_text(locale, false).trim().toLocaleLowerCase(locale),
  ]
}

/**
 * The AM/PM part of the input text (`slice`, `digits` wide) as 0 (AM) or 1 (PM). The texts the mask writes
 * (cut to the segment width) are recognized whole, so that two texts starting alike (`오전` / `오후`) are told
 * apart; any other text (pasted, or the `--` of an empty part) is PM when it starts like the PM text, else AM.
 */
function parse_day_period(locale: string, slice: string, digits: number): number {
  const text = slice.trim().toLocaleLowerCase(locale)
  const [am, pm] = day_period_texts(locale).map((t) => t.slice(0, digits).trim())
  if (text === pm) return 1
  if (text === am) return 0
  return text.startsWith(pm[0] ?? "p") ? 1 : 0
}

/** {@link day_period_text} trimmed or padded to the segment width from the mask. */
function day_period_segment(locale: string, am: boolean, digits: number): string {
  return day_period_text(locale, am).slice(0, digits).padEnd(digits, " ")
}

/**
 * 12-hour clock to 24-hour: `h` is 1–12 (12 is midnight in the morning, noon in the afternoon).
 * `% 12` also leaves a 0–23 hour's period part alone, so a 24-hour value gets the period given.
 */
export function to_24h(h: number, pm: boolean): number {
  return (h % 12) + (pm ? 12 : 0)
}

/** 24-hour clock to 12-hour: 0 and 12 show as 12. */
export function to_12h(h: number): number {
  return h % 12 || 12
}

/** `v` brought back into `min`–`max` by going around, e.g. `wrap(62, 0, 59)` is 2 and `wrap(-1, 0, 59)` is 59. */
export function wrap(v: number, min: number, max: number): number {
  const span = max - min + 1
  return min + ((((v - min) % span) + span) % span)
}

/**
 * A minute or second step as given by the user: a whole number from 1 to 30. Above 30 a column of
 * 0–59 would hold fewer than two values.
 */
export function normalize_step(step: number | undefined): number {
  return Math.max(1, Math.min(30, Math.trunc(step ?? 1)))
}

/** Full mask with `-` in every segment — shown when there is no model value. */
export function format_unavailable(layout: DateFormatLayout): string {
  return rebuild_from_segments(layout, {})
}

/**
 * Compose the input string: literals fixed, known segments clamped and padded,
 * missing segments as `-` (placeholder, not zero).
 */
export function rebuild_from_segments(layout: DateFormatLayout, vals: SegmentValues): string {
  const buf = new Array<string>(layout.length).fill(" ")
  for (const lit of layout.literals) buf[lit.index] = lit.char
  for (const seg of layout.segments) {
    const v = vals[seg.kind]
    if (seg.kind === "dayPeriod") {
      if (v == null) {
        for (let i = 0; i < seg.digits; i++) buf[seg.start + i] = "-"
      } else {
        const text = day_period_segment(layout.locale, v === 0, seg.digits)
        for (let i = 0; i < seg.digits; i++) buf[seg.start + i] = text[i] ?? " "
      }
    } else if (v != null) {
      const text = pad(clamp_segment(seg.kind, v, vals), seg.digits)
      for (let i = 0; i < seg.digits; i++) buf[seg.start + i] = text[i]
    } else {
      for (let i = 0; i < seg.digits; i++) buf[seg.start + i] = "-"
    }
  }
  return buf.join("")
}

/** Day count for `month` (1–12); used to clamp the day segment. */
export function days_in_month(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/**
 * Keep a single segment within sensible bounds while typing.
 * Day max depends on year/month when known; otherwise 1–31.
 */
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

/** Read segment numbers from the current input text; `-` and empty slices are skipped. */
export function parse_segments(layout: DateFormatLayout, text: string): SegmentValues {
  const vals: SegmentValues = {}
  for (const seg of layout.segments) {
    const slice = text.slice(seg.start, seg.end)
    if (seg.kind === "dayPeriod") {
      vals.dayPeriod = parse_day_period(layout.locale, slice, seg.digits)
      continue
    }
    const digits = slice.replace(/[^0-9]/g, "")
    // A `-` placeholder has no digits: the segment has no value yet.
    if (digits.length === 0) continue
    vals[seg.kind] = clamp_segment(seg.kind, Number(digits), { ...vals, [seg.kind]: Number(digits) })
  }
  return vals
}

/** Which segment contains the caret (for select-all-on-click and arrow keys). */
export function segment_at(layout: DateFormatLayout, index: number): DateFormatSegment | null {
  for (const seg of layout.segments) {
    if (index >= seg.start && index < seg.end) return seg
  }
  return null
}

function distance_to_segment(index: number, seg: DateFormatSegment): number {
  const last = seg.end - 1
  if (index < seg.start) return seg.start - index
  if (index > last) return index - last
  return 0
}

/**
 * Segment to edit for a caret position — same as {@link segment_at}, or the nearest
 * segment when the index is on a literal or a gap between parts.
 */
export function segment_at_caret(layout: DateFormatLayout, index: number): DateFormatSegment | null {
  const hit = segment_at(layout, index)
  if (hit) return hit

  if (is_literal_index(layout, index)) {
    const before = layout.segments.findLast((s) => s.end === index)
    if (before) return before
    const after = layout.segments.find((s) => s.start === index)
    if (after) return after
  }

  let best: DateFormatSegment | null = null
  let best_dist = Infinity
  for (const seg of layout.segments) {
    const dist = distance_to_segment(index, seg)
    if (dist < best_dist) {
      best_dist = dist
      best = seg
      continue
    }
    if (dist === best_dist && best && seg.start > best.start) {
      best = seg
    }
  }
  return best
}

/** True if `index` is a locale separator — typing should jump over it. */
export function is_literal_index(layout: DateFormatLayout, index: number): boolean {
  return layout.literals.some((l) => l.index === index)
}

/** Every segment has a value — required before building a `Date` from the input. */
export function segments_complete(layout: DateFormatLayout, vals: SegmentValues): boolean {
  for (const seg of layout.segments) {
    if (vals[seg.kind] == null) return false
  }
  return true
}

/** Split a `Date` into segment numbers matching the current layout. */
export function date_to_values(d: Date, layout: DateFormatLayout): SegmentValues {
  const vals: SegmentValues = {}
  for (const seg of layout.segments) {
    switch (seg.kind) {
      case "year":
        vals.year = d.getFullYear()
        break
      case "month":
        vals.month = d.getMonth() + 1
        break
      case "day":
        vals.day = d.getDate()
        break
      case "hour":
        vals.hour = layout.segments.some((s) => s.kind === "dayPeriod") ? to_12h(d.getHours()) : d.getHours()
        break
      case "minute":
        vals.minute = d.getMinutes()
        break
      case "second":
        vals.second = d.getSeconds()
        break
      case "dayPeriod":
        vals.dayPeriod = d.getHours() >= 12 ? 1 : 0
        break
    }
  }
  return vals
}

/**
 * Build a local `Date` from parsed segments; `null` if incomplete or calendar-invalid
 * (e.g. 31 February). Applies 12h + dayPeriod rules when present.
 * A time-only layout has no calendar date: the time goes on the day of `base`.
 * Time fields the layout doesn't show are 0 (midnight on a date-only layout, `:00` without seconds).
 */
export function values_to_date(layout: DateFormatLayout, vals: SegmentValues, base: Date): Date | null {
  if (!segments_complete(layout, vals)) return null
  const { year: y, month, day: da } = vals
  // A complete layout has all three date segments or none (build_layout asks Intl for all or none).
  if (y == null || month == null || da == null) {
    return apply_time_part(new Date(base.getFullYear(), base.getMonth(), base.getDate()), vals)
  }
  const mo = month - 1
  const d = apply_time_part(new Date(y, mo, da), vals)
  if (d.getFullYear() !== y || d.getMonth() !== mo || d.getDate() !== da) return null
  return d
}

/** Calendar day pick: replace Y-M-D, keep time-of-day from `base`. */
export function apply_date_part(base: Date, y: number, mo: number, da: number): Date {
  return new Date(y, mo - 1, da, base.getHours(), base.getMinutes(), base.getSeconds())
}

/** Replace the clock fields given in `vals` on the same calendar day as `base`; the others keep `base`'s. */
export function apply_time_part(base: Date, vals: SegmentValues): Date {
  const h = vals.hour ?? base.getHours()
  return new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    vals.dayPeriod != null ? to_24h(h, vals.dayPeriod === 1) : h,
    vals.minute ?? base.getMinutes(),
    vals.second ?? base.getSeconds(),
  )
}

/** Six rows × seven columns for the month popup; includes leading/trailing outside days. */
export function calendar_month_cells(view: Date, week_start: number): { date: Date; in_month: boolean }[] {
  const y = view.getFullYear()
  const m = view.getMonth()
  const first = new Date(y, m, 1)
  let start = first.getDay() - week_start
  if (start < 0) start += 7
  const start_date = new Date(y, m, 1 - start)
  const cells: { date: Date; in_month: boolean }[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start_date.getFullYear(), start_date.getMonth(), start_date.getDate() + i)
    cells.push({ date: d, in_month: d.getMonth() === m })
  }
  return cells
}

/** Month labels for the calendar toolbar select (index 0 = January). */
export function month_names(locale: string): string[] {
  const fmt = date_format(locale, { month: "long" })
  return Array.from({ length: 12 }, (_, i) => fmt.format(new Date(2000, i, 1)))
}

/** Narrow weekday headers, ordered from `week_start`. */
export function weekday_labels(locale: string, week_start: number): string[] {
  const fmt = date_format(locale, { weekday: "narrow" })
  // 7 January 2024 is a Sunday (day 0).
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 7 + ((week_start + i) % 7))))
}
