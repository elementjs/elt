import { $click, $observe, $on, type Attrs, css, If, is_promise_like, o, type Renderable, RepeatVirtual } from "elt"
import { CaretDown, Check } from "./icons"
import { focus_when_shown, list_nav, type ListNavOptions } from "./list-nav"
import { popup } from "./popup"
import { Spinner } from "./spinner"
import { theme } from "./theme"
import { sym_closed } from "./utils"
const colors = theme.colors

/**
 * A select component that does not use the native select element for custom rendering of options.
 */

export interface SelectAttributes<T, T2 = T> extends Attrs<HTMLButtonElement> {
  model?: o.Observable<T>
  /**
   * The options, or a promise of them (fetched from a server, typically from `query`). While a
   * promise is pending, the last options stay shown with a loading row; a promise replaced by a newer
   * one before it settles is ignored. Options from a promise are shown as they come, never filtered
   * by the Select (the server filtered them), and can't be used with `convert_fn`.
   */
  options: o.RO<Iterable<T2> | Promise<Iterable<T2>>>
  /** The model's value for an option. Without it, the option is the value. */
  convert_fn?: (opt: T2) => T
  /** How an option is drawn; `query` is what the user typed (`""` when not filtering), to highlight it. */
  label_fn?: (opt: T2, query: string) => Renderable
  /** The option as text: what completion matches against and puts in the input. Default `String(opt)`. */
  text_fn?: (opt: T2) => string
  /**
   * Type to filter the options: a click turns the Select into a text input holding the current
   * option's text, all selected; typing filters the options whose `text_fn` contains it (ignoring
   * case and accents).
   */
  completion?: boolean
  /** Written with what the user types in completion mode, to derive remote `options` from it. */
  query?: o.Observable<string>
  disabled?: o.RO<boolean>
  placeholder?: o.RO<Renderable>
}

/** Lowercase, accents stripped: what completion compares. */
function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase()
}

interface OptionsState<T2> {
  items: T2[]
  /** A promise is pending. */
  loading: boolean
  /** The last promise was rejected. */
  failed: boolean
  /** The items came from a promise: shown as they are, never filtered here. */
  remote: boolean
}

let select_ids = 0

/**
 * Select component that does not use the native select. Use instead of <select> whenever the observable is more than just a string or its representation is not the string itself, which is most of the time.
 */
export function Select<T, T2 = T>(at: SelectAttributes<T, T2>) {
  const convert_fn = at.convert_fn
  const value_of = (opt: T2) => (convert_fn ? convert_fn(opt) : (opt as unknown as T))
  const label = (opt: T2, query: string) => (at.label_fn ? at.label_fn(opt, query) : String(opt))
  const text_of = (opt: T2) => {
    if (at.text_fn) return at.text_fn(opt)
    if (at.completion && typeof opt === "object" && opt !== null) {
      throw new Error("Select: completion on object options needs a text_fn")
    }
    return String(opt)
  }

  // Fail at creation, not at the first keystroke, when completion has no way to read object options.
  if (at.completion && !at.text_fn) {
    const initial = o.get(at.options)
    if (!is_promise_like(initial)) for (const opt of initial) text_of(opt)
  }

  const list_id = `e-select-${++select_ids}`
  const o_query = at.query ?? o("")
  const o_active = o(-1)
  const o_open = o(false)
  const o_editing = o(false)
  let close_list: (() => void) | null = null

  // The options as last known. A promise replaces them when it resolves, unless a newer one came
  // in the meantime (`current`).
  const o_state = o<OptionsState<T2>>({ items: [], loading: false, failed: false, remote: false })
  let current: unknown
  function on_options(v: Iterable<T2> | Promise<Iterable<T2>>) {
    current = v
    if (!is_promise_like<Iterable<T2>>(v)) {
      o_state.set({ items: [...v], loading: false, failed: false, remote: false })
      return
    }
    if (convert_fn) throw new Error("Select: convert_fn can't be used with promise options")
    o_state.set({ ...o_state.get(), loading: true, failed: false, remote: true })
    v.then(
      (items) => {
        if (current === v) o_state.set({ items: [...items], loading: false, failed: false, remote: true })
      },
      () => {
        if (current === v) o_state.set({ ...o_state.get(), loading: false, failed: true })
      },
    )
  }

  // Completion compares normalized texts, computed once per options change rather than per keystroke.
  const oo_texts = o_state.tf((s) => (s.remote ? null : s.items.map((item) => normalize(text_of(item)))))

  /** The options shown: all of them, or in completion mode those matching the query. */
  const o_visible = o.expression((get) => {
    const s = get(o_state)
    if (!at.completion || s.remote) return s.items
    const q = normalize(get(o_query).trim())
    if (!q) return s.items
    const texts = get(oo_texts) ?? []
    return s.items.filter((_, i) => texts[i].includes(q))
  })

  // The selected option. With convert_fn, looked up among the options (a Map per options change);
  // without, the model's value is the option itself, even before options load.
  const oo_values_map = o_state.tf((s) => (convert_fn ? new Map(s.items.map((opt) => [convert_fn(opt), opt])) : null))
  const oo_selected = o.expression((get): { opt: T2 } | null => {
    const val = get(at.model)
    if (val === undefined || val === null) return null
    const map = get(oo_values_map)
    if (map == null) return { opt: val as unknown as T2 }
    return map.has(val) ? { opt: map.get(val) as T2 } : null
  })

  function pick(opt: T2 | undefined) {
    if (opt === undefined) return
    at.model?.set(value_of(opt))
    close_list?.()
    if (at.completion) stop_editing(true)
  }

  /** Bring option `i` into view; when the virtual list hasn't rendered it, jump near it first. */
  function reveal(i: number) {
    const scroller = document.getElementById(list_id)
    if (scroller == null) return
    const id = `${list_id}-${i}`
    const el = document.getElementById(id)
    if (el) return el.scrollIntoView({ block: "nearest" })
    const row = scroller.querySelector<HTMLElement>('[role="option"]')
    if (row == null) return
    scroller.scrollTop = i * row.offsetHeight
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "nearest" }))
  }

  const nav: ListNavOptions = {
    o_active,
    count: () => o_visible.get().length,
    activate: (i) => pick(o_visible.get()[i]),
    reveal,
    id_of: (i) => `${list_id}-${i}`,
    // Typing jumps by first letters only outside completion, where typing filters instead.
    text_of: at.completion ? undefined : (i) => text_of(o_visible.get()[i]),
  }

  function render_list(anchor: HTMLElement) {
    const list = (
      <e-column
        scroll="y"
        align="stretch"
        id={list_id}
        role="listbox"
        surface="background"
        border="tint-2"
        class={cls_listbox}
        style={{ minWidth: `${anchor.offsetWidth}px` }}
      >
        {/* Focus stays where it is (the list, or the completion input): a press on an option must not take it. */}
        {$on("pointerdown", (ev) => ev.preventDefault())}
        <e-column packed="widget" align="stretch">
          {RepeatVirtual(o_visible, (o_option, o_index) => {
            const oo_is_selected = o.expression((get) => {
              const sel = get(oo_selected)
              return sel != null && value_of(sel.opt) === value_of(get(o_option))
            })
            return (
              <e-flex
                class={cls_item}
                role="option"
                id={o_index.tf((i) => `${list_id}-${i}`)}
                aria-selected={oo_is_selected.tf((selected) => String(selected))}
                data-active={o.expression((get) => get(o_active) === get(o_index))}
              >
                {$click(() => pick(o_option.get()))}
                {$on("pointermove", () => {
                  if (o_active.get() !== o_index.get()) o_active.set(o_index.get())
                })}
                <div class="selected-icon">{oo_is_selected.tf((selected) => selected && Check())}</div>
                {o.expression((get) => label(get(o_option), at.completion ? get(o_query) : ""))}
              </e-flex>
            )
          })}
          {If(
            o_state.p("loading"),
            () => (
              <e-flex class={cls_status} aria-live="polite">
                <Spinner />
              </e-flex>
            ),
            () =>
              If(
                o_state.p("failed"),
                () => <e-flex class={[cls_status, "error"]}>Couldn't load the options</e-flex>,
                () =>
                  If(
                    o_visible.tf((v) => v.length === 0),
                    () => <e-flex class={cls_status}>No options</e-flex>,
                  ),
              ),
          )}
        </e-column>
      </e-column>
    ) as HTMLElement
    return list
  }

  /** Open the option list under `anchor`, the selected option active. */
  function open_list(anchor: HTMLElement) {
    if (close_list || o.get(at.disabled)) return
    const visible = o_visible.get()
    const sel = oo_selected.get()
    const idx = sel ? visible.findIndex((opt) => value_of(opt) === value_of(sel.opt)) : -1
    o_active.set(idx >= 0 ? idx : visible.length > 0 ? 0 : -1)
    o_open.set(true)

    const fut = popup(
      anchor,
      () => {
        const list = render_list(anchor)
        // Without completion, the list itself takes focus and the keys; with it, the input keeps both.
        if (!at.completion) {
          list.tabIndex = -1
          list_nav(list, nav)
          focus_when_shown(list)
        }
        return list
      },
      at.completion ? { arrow: false, placement: "bottom-start" } : { arrow: true, placement: "right-start" },
    )
    close_list = () => fut.resolve(sym_closed)
    requestAnimationFrame(() => {
      if (o_active.get() >= 0) reveal(o_active.get())
    })
    fut.then((res) => {
      close_list = null
      o_open.set(false)
      // Dismissed (Escape, a click outside) while typing: the typing is abandoned too.
      if (res === sym_closed && at.completion && o_editing.get()) stop_editing(true)
    })
  }

  const caret = <span class={[cls_indicator, o_open.tf((open) => (open ? "open" : ""))]}>{CaretDown()}</span>

  const button = (
    <button
      class={cls_select_button}
      disabled={at.disabled}
      aria-haspopup="listbox"
      aria-expanded={o_open.tf((v) => String(v))}
    >
      {$observe(at.options, on_options)}
      {"‌"}
      {/* The current value, drawn by label_fn */}
      {o.expression((get) => {
        const sel = get(oo_selected)
        if (sel == null) return <span class={cls_placeholder}>{get(at.placeholder)}</span>
        return label(sel.opt, "")
      })}
      {$click((ev) => {
        if (at.completion) start_editing()
        else open_list(ev.currentTarget)
      })}
      {$on("keydown", (ev) => {
        if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
          ev.preventDefault()
          if (at.completion) start_editing()
          else open_list(ev.currentTarget as HTMLElement)
        }
      })}
      {caret}
    </button>
  ) as HTMLButtonElement

  if (!at.completion) return button

  // Completion: an input over the button, shown while editing. The button stays underneath and keeps
  // the Select's size, so switching doesn't move anything.
  let root!: HTMLElement
  const input = (
    <input
      class={cls_combo_input}
      role="combobox"
      aria-controls={list_id}
      aria-autocomplete="list"
      aria-expanded={o_open.tf((v) => String(v))}
      hidden={o_editing.tf((v) => !v)}
    >
      {$on("keydown", (ev) => {
        // ArrowDown / Alt+ArrowDown on a closed list opens it; list_nav, registered after, must not
        // also move the active option on the same key.
        if (ev.key === "ArrowDown" && !close_list) {
          ev.preventDefault()
          ev.stopImmediatePropagation()
          open_list(root)
        } else if (ev.key === "Escape") {
          // Usually the open popup takes Escape first (and its closing stops the editing); this is
          // the list closed, or not shown yet.
          ev.preventDefault()
          stop_editing(true)
        }
      })}
      {$on("input", () => {
        o_query.set(input.value)
        open_list(root)
        o_active.set(o_visible.get().length > 0 ? 0 : -1)
      })}
      {$on("blur", () => {
        if (o_editing.get()) stop_editing(false)
      })}
    </input>
  ) as HTMLInputElement
  list_nav(input, nav)

  function start_editing() {
    if (o.get(at.disabled) || o_editing.get()) return
    // The query stays "" until the text is edited: the whole list shows, the current option active.
    o_query.set("")
    const sel = oo_selected.get()
    input.value = sel ? text_of(sel.opt) : ""
    o_editing.set(true)
    input.focus()
    input.select()
    open_list(root)
  }

  /** Leave the input: the typed text is dropped, the model is unchanged unless an option was picked. */
  function stop_editing(refocus: boolean) {
    o_editing.set(false)
    close_list?.()
    o_query.set("")
    if (refocus) button.focus()
  }

  root = (
    <span class={cls_combo}>
      {button}
      {input}
    </span>
  ) as HTMLElement
  return root
}

const cls_placeholder = css`.placeholder {
  color: ${colors.text.faded};
}`

const cls_select_button = css`.select-button {
  align-items: baseline;
}`

/* The completion input lies over the button, at its size. */
const cls_combo = css`.select-combo {
  display: inline-grid;
  & > * {
    grid-area: 1 / 1;
  }
  &:has(> input:not([hidden])) > button {
    visibility: hidden;
  }
}`

const cls_combo_input = css`.select-combo-input {
  min-width: 0;
  width: 100%;
}`

const cls_listbox = css`.select-listbox {
  max-height: min(24em, var(--e-popup-max-height, 24em));
}`

const cls_indicator = css`.indicator {
  display: inline-block;
  width: 16px;
  font-weight: bold;
  margin-left: ${theme.settings.spacingNudge4};
  rotate: 0deg;
  transition: rotate ${theme.settings.durationMedium} ease;
  transform-origin: center;
  &.open {
    rotate: -90deg;
  }
}`

const cls_item = css`.item {
  cursor: pointer;
  user-select: none;
  font-size: ${theme.settings.formFontSize};
  ${theme.css_radius("nudge-2")}

  & .selected-icon {
    color: ${colors.tint};
    padding: 0 ${theme.settings.spacingNudge4};
    text-align: center;
    width: 16px;
  }

  /* The selected fill (tint + 3, + 4 hovered or active) is list_nav's, shared by every option. */
  @media (hover: hover) and (pointer: fine) {
    &:where(:not([aria-selected="true"])):hover {
      background-color: ${colors.tint.hover};
    }
  }
}`

/* Loading, error and empty rows: not options, so not selectable or navigable. */
const cls_status = css`.select-status {
  justify-content: center;
  color: ${colors.text.faded};
  font-size: ${theme.settings.formFontSize};
  &.error {
    color: ${colors.error};
  }
}`
