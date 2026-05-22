import {
  type DateFormatLayout,
  clamp_segment,
  date_to_values,
  is_literal_index,
  parse_segments,
  format_unavailable,
  rebuild_from_segments,
  segment_at,
  segments_complete,
  values_to_date,
} from "./date-format"

export interface SegmentedInputCtx {
  get_layout: () => DateFormatLayout
  set_model: (d: Date | null) => void
  clearable: boolean
  lock: (fn: () => void) => void
}

export function setup_segmented_date_input(input: HTMLInputElement, ctx: SegmentedInputCtx) {
  let editing = false
  let skip_input = false

  const refresh_validity = (text: string) => {
    const vals = parse_segments(ctx.get_layout(), text)
    const complete = segments_complete(ctx.get_layout(), vals)
    const d = complete ? values_to_date(ctx.get_layout(), vals) : null
    const empty = text.trim() === "" || text.includes("-")
    if (!complete && !(ctx.clearable && empty)) {
      input.setCustomValidity("Incomplete date")
    } else if (complete && d == null) {
      input.setCustomValidity("Invalid date")
    } else {
      input.setCustomValidity("")
    }
  }

  const write_text = (text: string, sel?: [number, number]) => {
    skip_input = true
    input.value = text
    refresh_validity(text)
    if (sel) input.setSelectionRange(sel[0], sel[1])
    skip_input = false
  }

  const apply_model = (m: Date | null, layout: DateFormatLayout) => {
    if (editing) return
    if (m == null) {
      write_text(ctx.clearable ? "" : format_unavailable(layout))
      return
    }
    write_text(rebuild_from_segments(layout, date_to_values(m, layout)))
  }

  const select_segment = (seg: { start: number, end: number } | null) => {
    if (!seg) return
    input.setSelectionRange(seg.start, seg.end)
  }

  const clamp_text = (text: string): string => {
    const vals = parse_segments(ctx.get_layout(), text)
    for (const seg of ctx.get_layout().segments) {
      const v = vals[seg.kind]
      if (v != null) vals[seg.kind] = clamp_segment(seg.kind, v, vals)
    }
    return rebuild_from_segments(ctx.get_layout(), vals)
  }

  const commit = () => {
    const layout = ctx.get_layout()
    const text = input.value
    ctx.lock(() => {
      if (ctx.clearable && (text.trim() === "" || text === format_unavailable(layout))) {
        ctx.set_model(null)
        refresh_validity(text)
        return
      }
      const vals = parse_segments(layout, text)
      const d = values_to_date(layout, vals)
      if (d != null) ctx.set_model(d)
      write_text(rebuild_from_segments(layout, vals))
    })
  }

  input.addEventListener("focus", () => { editing = true })
  input.addEventListener("blur", () => {
    editing = false
    commit()
  })

  input.addEventListener("click", () => {
    requestAnimationFrame(() => select_segment(segment_at(ctx.get_layout(), input.selectionStart ?? 0)))
  })

  input.addEventListener("keydown", ev => {
    const start = input.selectionStart ?? 0
    const seg = segment_at(ctx.get_layout(), start)

    if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") {
      ev.preventDefault()
      const segs = ctx.get_layout().segments
      const idx = seg ? segs.indexOf(seg) : -1
      const next = ev.key === "ArrowLeft"
        ? segs[Math.max(0, idx - 1)] ?? segs[0]
        : segs[Math.min(segs.length - 1, idx + 1)] ?? segs[segs.length - 1]
      if (next) select_segment(next)
      return
    }

    if (ev.key === "ArrowUp" || ev.key === "ArrowDown") {
      if (!seg) return
      ev.preventDefault()
      const vals = parse_segments(ctx.get_layout(), input.value)
      const cur = vals[seg.kind] ?? 0
      const delta = ev.key === "ArrowUp" ? 1 : -1
      vals[seg.kind] = clamp_segment(seg.kind, cur + delta, vals)
      write_text(rebuild_from_segments(ctx.get_layout(), vals), [seg.start, seg.end])
      return
    }

    if (ev.key.length === 1 && /\d/.test(ev.key)) {
      if (!seg || seg.kind === "dayPeriod") return
      ev.preventDefault()
      let text = input.value
      const pos = Math.max(seg.start, Math.min(start, seg.end - 1))
      const local = pos - seg.start
      const slice = text.slice(seg.start, seg.end)
      const chars = slice.split("")
      chars[local] = ev.key
      text = text.slice(0, seg.start) + chars.join("") + text.slice(seg.end)
      const vals = parse_segments(ctx.get_layout(), text)
      const digit_val = Number(chars.join("").replace(/\D/g, "") || ev.key)
      vals[seg.kind] = clamp_segment(seg.kind, digit_val, vals)
      text = rebuild_from_segments(ctx.get_layout(), vals)
      const next_pos = local + 1 < seg.digits ? seg.start + local + 1 : seg.end
      write_text(text, [next_pos, next_pos === seg.end ? seg.end : next_pos + 1])
      if (next_pos >= seg.end && ctx.get_layout().segments.indexOf(seg) < ctx.get_layout().segments.length - 1) {
        const nxt = ctx.get_layout().segments[ctx.get_layout().segments.indexOf(seg) + 1]
        if (nxt) select_segment(nxt)
      }
      return
    }

    if (ev.key === "Backspace" || ev.key === "Delete") {
      if (!seg) return
      ev.preventDefault()
      const vals = parse_segments(ctx.get_layout(), input.value)
      delete vals[seg.kind]
      write_text(rebuild_from_segments(ctx.get_layout(), vals), [seg.start, seg.end])
    }
  })

  input.addEventListener("beforeinput", ev => {
    if (skip_input) return
    const ie = ev as InputEvent
    if (ie.inputType === "insertText" && ie.data && /^[\d/aApPmM]/.test(ie.data)) {
      // handled in keydown for digits; allow AM/PM letters
      if (/^\d$/.test(ie.data)) {
        ev.preventDefault()
        return
      }
    }
    if (ie.inputType === "insertText" && ie.data && ctx.get_layout().literals.some(l => ie.data!.includes(l.char))) {
      ev.preventDefault()
      const start = input.selectionStart ?? 0
      let next = start + ie.data.length
      while (next < ctx.get_layout().length && is_literal_index(ctx.get_layout(), next)) next++
      input.setSelectionRange(next, next)
    }
  })

  input.addEventListener("input", () => {
    if (skip_input) return
    let text = clamp_text(input.value)
    if (text !== input.value) write_text(text)
    else refresh_validity(text)
  })

  return { apply_model, write_text, commit }
}
