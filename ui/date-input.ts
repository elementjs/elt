import {
  type DateFormatLayout,
  type SegmentKind,
  clamp_segment,
  date_to_values,
  is_literal_index,
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
 * No value at all: a blank text or the bare mask (`-` in every segment). A `-` elsewhere is not enough,
 * since some locales separate the date parts with it (`2000-11-22` in en-CA, `22-11-2000` in nl).
 */
function is_empty(layout: DateFormatLayout, text: string): boolean {
  return text.trim() === "" || text === format_unavailable(layout)
}

/** Segmented date/time text input: display, edit, validate, sync with an observable model. */
export class DateInputController {
  #editing = false

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
    })
    this.input.addEventListener("blur", () => {
      this.#editing = false
      this.commit_to_model()
    })

    this.input.addEventListener("click", () => {
      const layout = this.ctx.get_layout()
      if (!layout) return
      requestAnimationFrame(() => this.#select_segment(segment_at_caret(layout, this.input.selectionStart ?? 0)))
    })

    this.input.addEventListener("keydown", (ev) => this.#on_keydown(ev))
    this.input.addEventListener("beforeinput", (ev) => this.#on_beforeinput(ev))
    this.input.addEventListener("input", () => this.#on_input())
  }

  #on_keydown(ev: KeyboardEvent) {
    const layout = this.ctx.get_layout()
    if (!layout) return
    const start = this.input.selectionStart ?? 0
    const seg = segment_at_caret(layout, start)

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

    if (ev.key.length === 1 && /\d/.test(ev.key)) {
      if (!seg || seg.kind === "dayPeriod") return
      ev.preventDefault()
      let text = this.input.value
      const pos = Math.max(seg.start, Math.min(start, seg.end - 1))
      const local = pos - seg.start
      const slice = text.slice(seg.start, seg.end)
      const chars = slice.split("")
      chars[local] = ev.key
      text = text.slice(0, seg.start) + chars.join("") + text.slice(seg.end)
      const vals = parse_segments(layout, text)
      const digit_val = Number(chars.join("").replace(/\D/g, "") || ev.key)
      vals[seg.kind] = clamp_segment(seg.kind, digit_val, vals)
      text = rebuild_from_segments(layout, vals)
      const next_pos = local + 1 < seg.digits ? seg.start + local + 1 : seg.end
      this.#write_text(text, [next_pos, next_pos === seg.end ? seg.end : next_pos + 1])
      if (next_pos >= seg.end && layout.segments.indexOf(seg) < layout.segments.length - 1) {
        const nxt = layout.segments[layout.segments.indexOf(seg) + 1]
        if (nxt) this.#select_segment(nxt)
      }
      return
    }

    if (ev.key === "Backspace" || ev.key === "Delete") {
      if (!seg) return
      ev.preventDefault()
      const vals = parse_segments(layout, this.input.value)
      delete vals[seg.kind]
      this.#write_text(rebuild_from_segments(layout, vals), [seg.start, seg.end])
    }
  }

  #on_beforeinput(ev: Event) {
    const layout = this.ctx.get_layout()
    if (!layout) return
    const ie = ev as InputEvent
    if (ie.inputType === "insertText" && ie.data && /^\d$/.test(ie.data)) {
      ev.preventDefault()
      return
    }
    const data = ie.data
    if (ie.inputType === "insertText" && data && layout.literals.some((l) => data.includes(l.char))) {
      ev.preventDefault()
      const start = this.input.selectionStart ?? 0
      let next = start + data.length
      while (next < layout.length && is_literal_index(layout, next)) next++
      this.input.setSelectionRange(next, next)
    }
  }

  #on_input() {
    const text = this.#clamp_text(this.input.value)
    if (text !== this.input.value) this.#write_text(text)
    else this.#refresh_validity(text)
  }
}
