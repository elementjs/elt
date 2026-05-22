import {
  type DateFormatLayout,
  type SegmentKind,
  clamp_segment,
  date_to_values,
  is_literal_index,
  parse_segments,
  format_unavailable,
  rebuild_from_segments,
  segment_at_caret,
  segments_complete,
  values_to_date,
} from "./date-format"

export interface DateInputControllerCtx {
  get_layout: () => DateFormatLayout | null
  set_model: (d: Date | null) => void
  clearable: boolean
  lock: (fn: () => void) => void
  minute_step?: number
  second_step?: number
}

function segment_arrow_step(kind: SegmentKind, ctx: DateInputControllerCtx): number {
  if (kind === "minute") return Math.max(1, Math.trunc(ctx.minute_step ?? 1))
  if (kind === "second") return Math.max(1, Math.trunc(ctx.second_step ?? 1))
  return 1
}

function bump_segment(kind: SegmentKind, cur: number, delta: number, ctx: DateInputControllerCtx): number {
  const step = segment_arrow_step(kind, ctx) * delta
  if (kind === "minute" || kind === "second") {
    return ((cur + step) % 60 + 60) % 60
  }
  return clamp_segment(kind, cur + step, { [kind]: cur + step })
}

/** Segmented date/time text input: display, edit, validate, sync with an observable model. */
export class DateInputController {
  #editing = false
  #skip_input = false

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
      if (this.ctx.clearable && (text.trim() === "" || text === format_unavailable(layout))) {
        this.ctx.set_model(null)
        this.#refresh_validity(text)
        return
      }
      const vals = parse_segments(layout, text)
      const d = values_to_date(layout, vals)
      if (d != null) this.ctx.set_model(d)
      this.#write_text(rebuild_from_segments(layout, vals))
    })
  }

  #refresh_validity(text: string) {
    const layout = this.ctx.get_layout()
    if (!layout) return
    const vals = parse_segments(layout, text)
    const complete = segments_complete(layout, vals)
    const d = complete ? values_to_date(layout, vals) : null
    const empty = text.trim() === "" || text.includes("-")
    if (!complete && !(this.ctx.clearable && empty)) {
      this.input.setCustomValidity("Incomplete date")
    } else if (complete && d == null) {
      this.input.setCustomValidity("Invalid date")
    } else {
      this.input.setCustomValidity("")
    }
  }

  #write_text(text: string, sel?: [number, number]) {
    this.#skip_input = true
    this.input.value = text
    this.#refresh_validity(text)
    if (sel) this.input.setSelectionRange(sel[0], sel[1])
    this.#skip_input = false
  }

  #select_segment(seg: { start: number, end: number } | null) {
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
    this.input.addEventListener("focus", () => { this.#editing = true })
    this.input.addEventListener("blur", () => {
      this.#editing = false
      this.commit_to_model()
    })

    this.input.addEventListener("click", () => {
      const layout = this.ctx.get_layout()
      if (!layout) return
      requestAnimationFrame(() =>
        this.#select_segment(segment_at_caret(layout, this.input.selectionStart ?? 0))
      )
    })

    this.input.addEventListener("keydown", ev => this.#on_keydown(ev))
    this.input.addEventListener("beforeinput", ev => this.#on_beforeinput(ev))
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
      const next = ev.key === "ArrowLeft"
        ? segs[Math.max(0, idx - 1)] ?? segs[0]
        : segs[Math.min(segs.length - 1, idx + 1)] ?? segs[segs.length - 1]
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
        if (vals[s.kind] != null) vals[s.kind] = clamp_segment(s.kind, vals[s.kind]!, vals)
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
    if (this.#skip_input) return
    const layout = this.ctx.get_layout()
    if (!layout) return
    const ie = ev as InputEvent
    if (ie.inputType === "insertText" && ie.data && /^\d$/.test(ie.data)) {
      ev.preventDefault()
      return
    }
    if (ie.inputType === "insertText" && ie.data && layout.literals.some(l => ie.data!.includes(l.char))) {
      ev.preventDefault()
      const start = this.input.selectionStart ?? 0
      let next = start + ie.data!.length
      while (next < layout.length && is_literal_index(layout, next)) next++
      this.input.setSelectionRange(next, next)
    }
  }

  #on_input() {
    if (this.#skip_input) return
    let text = this.#clamp_text(this.input.value)
    if (text !== this.input.value) this.#write_text(text)
    else this.#refresh_validity(text)
  }
}

export function setup_input_api(input: HTMLInputElement, ctx: DateInputControllerCtx): DateInputController {
  return new DateInputController(input, ctx)
}
