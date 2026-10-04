import {
  type DateFormatLayout,
  type DateFormatSegment,
  type SegmentKind,
  clamp_segment,
  date_to_values,
  normalize_step,
  parse_segments,
  format_unavailable,
  rebuild_from_segments,
  segment_at_caret,
  segments_complete,
  values_to_date,
  wrap,
} from "./date-format"

/**
 * What the input reads from its picker. The controller reads each property when it needs it, so
 * the picker may define them as getters over its observable props (they then apply live).
 */
export interface DateInputControllerCtx {
  get_layout: () => DateFormatLayout | null
  set_model: (d: Date | null) => void
  /** The date a time-only input puts its time on: the model, or the picker's default date when it is empty. */
  get_base: () => Date
  readonly clearable: boolean
  lock: (fn: () => void) => void
  readonly minute_step?: number
  readonly second_step?: number
}

/** A segment's value after one arrow step (`delta` is 1 or -1): minutes and seconds go around, the others stop at their bounds. */
function bump_segment(kind: SegmentKind, cur: number, delta: number, ctx: DateInputControllerCtx): number {
  if (kind === "minute") return wrap(cur + normalize_step(ctx.minute_step) * delta, 0, 59)
  if (kind === "second") return wrap(cur + normalize_step(ctx.second_step) * delta, 0, 59)
  return clamp_segment(kind, cur + delta, { [kind]: cur + delta })
}

/**
 * `KeyboardEvent.key` of the key presses that don't end the digits being typed: the keys that only modify
 * another one, and the presses whose character isn't known yet. On-screen keyboards (Android) send
 * `Unidentified` for most keys and input methods send `Process`; the character itself then arrives as a
 * `beforeinput` event.
 */
const KEYS_KEEPING_TYPING = new Set([
  "Shift",
  "Control",
  "Alt",
  "AltGraph",
  "Meta",
  "CapsLock",
  "Unidentified",
  "Process",
])

/**
 * No value at all: a blank text or the bare mask (`-` in every segment). A `-` elsewhere is not enough,
 * since some locales separate the date parts with it (`2000-11-22` in en-CA, `22-11-2000` in nl).
 */
function is_empty(layout: DateFormatLayout, text: string): boolean {
  return text.trim() === "" || text === format_unavailable(layout)
}

/** Segmented date/time text input: display, edit, validate, sync with an observable model. */
export class DateInputController {
  #editing = false

  /**
   * The digits typed so far into one segment, as native date inputs do: they are collected until the
   * segment is full (or can't take another digit), then the next segment is selected. Any other way
   * of moving (click, arrows, Backspace, a separator key, focus or blur) starts a new collection, so
   * typing into a segment that already has a value replaces it rather than editing one character.
   */
  #typed: { seg: DateFormatSegment; digits: string } | null = null

  /** The last key completed a segment and selected the next one: a separator typed now is skipped. */
  #auto_advanced = false

  /** Any action other than a digit or a separator: the next digit starts a new collection. */
  #end_typing() {
    this.#typed = null
    this.#auto_advanced = false
  }

  constructor(
    private input: HTMLInputElement,
    private ctx: DateInputControllerCtx,
  ) {
    this.#attach_listeners()
  }

  /** Push observable model value into the input (skipped while the user is editing). */
  apply_model(m: Date | null) {
    const layout = this.ctx.get_layout()
    if (!layout) return
    if (this.#editing) return
    if (m == null) {
      this.#write_text(format_unavailable(layout))
      return
    }
    this.#write_text(rebuild_from_segments(layout, date_to_values(m, layout)))
  }

  /** Parse the input and write a complete value back to the model. */
  commit_to_model() {
    const layout = this.ctx.get_layout()
    if (!layout) return
    const text = this.input.value
    this.ctx.lock(() => {
      if (this.ctx.clearable && is_empty(layout, text)) {
        this.ctx.set_model(null)
        this.#refresh_validity(text)
        return
      }
      const vals = parse_segments(layout, text)
      const d = values_to_date(layout, vals, this.ctx.get_base())
      if (d != null) this.ctx.set_model(d)
      this.#write_text(rebuild_from_segments(layout, vals))
    })
  }

  #refresh_validity(text: string) {
    const layout = this.ctx.get_layout()
    if (!layout) return
    const vals = parse_segments(layout, text)
    const complete = segments_complete(layout, vals)
    if (!complete && !(this.ctx.clearable && is_empty(layout, text))) {
      this.input.setCustomValidity("Incomplete date")
    } else if (complete && values_to_date(layout, vals, this.ctx.get_base()) == null) {
      this.input.setCustomValidity("Invalid date")
    } else {
      this.input.setCustomValidity("")
    }
  }

  /** Setting `value` from code fires no `input` / `beforeinput` event: the listeners below don't see these writes. */
  #write_text(text: string, sel?: [number, number]) {
    this.input.value = text
    this.#refresh_validity(text)
    if (sel) this.input.setSelectionRange(sel[0], sel[1])
  }

  #select_segment(seg: { start: number; end: number } | null) {
    if (!seg) return
    this.input.setSelectionRange(seg.start, seg.end)
  }

  #clamp_text(text: string): string {
    const layout = this.ctx.get_layout()
    if (!layout) return text
    const vals = parse_segments(layout, text)
    for (const seg of layout.segments) {
      const v = vals[seg.kind]
      if (v != null) vals[seg.kind] = clamp_segment(seg.kind, v, vals)
    }
    return rebuild_from_segments(layout, vals)
  }

  #attach_listeners() {
    this.input.addEventListener("focus", () => {
      this.#editing = true
      this.#end_typing()
    })
    this.input.addEventListener("blur", () => {
      this.#editing = false
      this.#end_typing()
      this.commit_to_model()
    })

    this.input.addEventListener("click", () => {
      const layout = this.ctx.get_layout()
      if (!layout) return
      this.#end_typing()
      requestAnimationFrame(() => this.#select_segment(segment_at_caret(layout, this.input.selectionStart ?? 0)))
    })

    this.input.addEventListener("keydown", (ev) => this.#on_keydown(ev))
    this.input.addEventListener("beforeinput", (ev) => this.#on_beforeinput(ev as InputEvent))
    this.input.addEventListener("input", () => this.#on_input())
  }

  #on_keydown(ev: KeyboardEvent) {
    const layout = this.ctx.get_layout()
    if (!layout) return
    const start = this.input.selectionStart ?? 0
    const seg = segment_at_caret(layout, start)

    // A digit or a separator is handled here and cancelled, so no `beforeinput` follows for it. A
    // character this doesn't handle (a letter, a digit outside the digit segments) reaches
    // #on_beforeinput, which finds it unhandled again and only cancels it: each character is handled once.
    if (ev.key.length === 1 && this.#type_char(layout, ev.key)) {
      ev.preventDefault()
      return
    }

    // Every other key that edits or moves ends the digit collection. A modifier alone does not: some
    // keyboard layouts (French AZERTY) type digits with Shift held. Nor does a key not identified yet.
    if (!KEYS_KEEPING_TYPING.has(ev.key)) this.#end_typing()

    if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") {
      ev.preventDefault()
      const segs = layout.segments
      const idx = seg ? segs.indexOf(seg) : -1
      const next =
        ev.key === "ArrowLeft"
          ? (segs[Math.max(0, idx - 1)] ?? segs[0])
          : (segs[Math.min(segs.length - 1, idx + 1)] ?? segs[segs.length - 1])
      if (next) this.#select_segment(next)
      return
    }

    if (ev.key === "ArrowUp" || ev.key === "ArrowDown") {
      if (!seg) return
      ev.preventDefault()
      const vals = parse_segments(layout, this.input.value)
      const cur = vals[seg.kind] ?? 0
      const delta = ev.key === "ArrowUp" ? 1 : -1
      vals[seg.kind] = bump_segment(seg.kind, cur, delta, this.ctx)
      for (const s of layout.segments) {
        const v = vals[s.kind]
        if (v != null) vals[s.kind] = clamp_segment(s.kind, v, vals)
      }
      this.#write_text(rebuild_from_segments(layout, vals), [seg.start, seg.end])
      return
    }

    if ((ev.key === "Backspace" || ev.key === "Delete") && this.#clear_segment(layout, seg)) ev.preventDefault()
  }

  /** Empty `seg` (Backspace / Delete) and keep it selected. False when the caret is in no segment. */
  #clear_segment(layout: DateFormatLayout, seg: DateFormatSegment | null): boolean {
    if (!seg) return false
    const vals = parse_segments(layout, this.input.value)
    delete vals[seg.kind]
    this.#write_text(rebuild_from_segments(layout, vals), [seg.start, seg.end])
    return true
  }

  /**
   * One typed character, from a key press or from text inserted by an on-screen keyboard: a digit goes to
   * the segment at the caret, a separator selects the next segment. False for any other character (and for
   * a digit outside the digit segments), which ends the digits being typed.
   */
  #type_char(layout: DateFormatLayout, ch: string): boolean {
    const seg = segment_at_caret(layout, this.input.selectionStart ?? 0)
    if (/^\d$/.test(ch)) {
      if (seg && seg.kind !== "dayPeriod") {
        this.#type_digit(layout, seg, ch)
        return true
      }
    } else if (layout.literals.some((l) => l.char === ch)) {
      this.#type_separator(layout, seg)
      return true
    }
    this.#end_typing()
    return false
  }

  /**
   * One digit typed into `seg`: added to the digits collected for it (or the first of a new collection),
   * the segment shows their value, and the next segment is selected once this one is complete: its width
   * is reached (2 digits, 4 for the year), or one more digit could only go past its maximum (`4` in a day
   * of month, `2` in a month, `3` in a 24-hour hour, `6` in a minute).
   */
  #type_digit(layout: DateFormatLayout, seg: DateFormatSegment, digit: string) {
    const digits = this.#typed?.seg === seg ? this.#typed.digits + digit : digit
    const vals = parse_segments(layout, this.input.value)
    const value = Number(digits)
    vals[seg.kind] = clamp_segment(seg.kind, value, vals)
    // The segment's maximum given the other segments (days in the typed month, 12 with AM/PM).
    const max = clamp_segment(seg.kind, 10 ** seg.digits - 1, vals)
    const complete = digits.length >= seg.digits || value * 10 > max
    const idx = layout.segments.indexOf(seg)
    // The last segment stays selected: a further digit starts a new collection in it.
    const next = complete ? (layout.segments[idx + 1] ?? seg) : seg
    this.#typed = complete ? null : { seg, digits }
    this.#auto_advanced = next !== seg
    this.#write_text(rebuild_from_segments(layout, vals), [next.start, next.end])
  }

  /**
   * A separator key (`/`, `-`, `:`, a space…) selects the segment after `seg`, as in native date inputs,
   * which also ends the digits being typed into `seg`: `1/5` in a month/day layout gives month 1, then
   * day 5. Right after a segment completed on its own and selected the next one, it does nothing, so
   * that a date typed with its separators (`2026-10-03` in en-CA) doesn't skip a segment.
   */
  #type_separator(layout: DateFormatLayout, seg: DateFormatSegment | null) {
    const skip = this.#auto_advanced
    this.#end_typing()
    if (skip || !seg) return
    const next = layout.segments[layout.segments.indexOf(seg) + 1]
    if (next) this.#select_segment(next)
  }

  /**
   * Text about to be inserted or deleted without a key press handled by #on_keydown. On-screen keyboards
   * (phones, tablets) send their keys this way only: their `keydown` has no usable `key`. Typed text goes
   * through #type_char one character at a time, as if each was a key press, and a deletion empties the
   * segment at the caret as Backspace does; the browser's own edit is cancelled, since the mask is fixed.
   * Left to the browser (the `input` event then cleans the text up): a paste, a drop, a cut, and the text
   * of an input method composition, whose `beforeinput` can't be cancelled.
   */
  #on_beforeinput(ev: InputEvent) {
    const layout = this.ctx.get_layout()
    if (!layout) return
    const type = ev.inputType
    if (type === "insertText" || type === "insertReplacementText") {
      ev.preventDefault()
      // insertReplacementText (a suggestion picked, an autocorrection) may carry its text in dataTransfer only.
      const text = ev.data ?? ev.dataTransfer?.getData("text/plain") ?? ""
      for (const ch of text) this.#type_char(layout, ch)
      return
    }
    if (type.startsWith("delete") && type !== "deleteByCut" && type !== "deleteByDrag") {
      this.#end_typing()
      if (this.#clear_segment(layout, segment_at_caret(layout, this.input.selectionStart ?? 0))) ev.preventDefault()
    }
  }

  #on_input() {
    const text = this.#clamp_text(this.input.value)
    if (text !== this.input.value) this.#write_text(text)
    else this.#refresh_validity(text)
  }
}
