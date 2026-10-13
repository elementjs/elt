/**
 * Keyboard navigation in a list of items — a menu, the options of a Select — shared by every
 * list-like popup of elt/ui.
 *
 * It works on item **indexes**, not on DOM elements, so it also drives virtual lists whose items
 * are mostly not rendered. Focus doesn't move between items: it stays on one element (the list
 * itself, or a combobox's input), whose `aria-activedescendant` names the active item — the model a
 * text input needs, since focus must stay in it while the arrows move through the options, and a
 * virtual list needs, since most of its items have no element to focus. A menu whose items are all
 * in the DOM moves focus itself instead ({@link menu_nav}).
 */

import { css, node_add_event_listener, node_is_connected, node_observe, node_on_connected, o } from "elt"

export interface ListNavOptions {
  /** The active item's index, -1 for none. Owned by the caller: bind `e-active` on items from it, or move focus to them. */
  o_active: o.Observable<number>
  /** How many items there are now. */
  count: () => number
  /** Run the item at `index` (Enter, or Space outside a text field). */
  activate: (index: number) => void
  /** Bring the item at `index` into view (a virtual list scrolls to it). */
  reveal?: (index: number) => void
  /** The `id` of the item at `index`, for `aria-activedescendant`; `null` when it has none (not rendered). */
  id_of?: (index: number) => string | null
  /** The item's text, for jumping to an item by typing its first letters. Without it, typing does nothing. */
  text_of?: (index: number) => string
  /** How many items PageUp/PageDown move by. Default 10. */
  page_size?: () => number
}

/** How long, in ms, typed letters keep adding up into one search ("ap" finds "apple", not "pear"). */
const TYPEAHEAD_RESET = 600

/**
 * Wire keyboard navigation on the element that keeps focus (`node`): Up/Down, Home/End,
 * PageUp/PageDown move the active index, Enter (and Space, unless `node` is a text field) activates
 * it, and printable letters jump to the next item whose `text_of` starts with them. Keys it uses are
 * `preventDefault`-ed; the others go through (Escape is for the popup to handle).
 *
 * Also keeps `aria-activedescendant` on `node` in sync with the active index.
 */
export function list_nav(node: HTMLElement, opts: ListNavOptions) {
  const is_text_field = node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement
  let typed = ""
  let typed_at = 0

  function move_to(index: number) {
    const count = opts.count()
    if (count === 0) return opts.o_active.set(-1)
    const clamped = Math.max(0, Math.min(count - 1, index))
    opts.o_active.set(clamped)
    opts.reveal?.(clamped)
  }

  node_observe(node, opts.o_active, (index) => {
    const id = index >= 0 ? opts.id_of?.(index) : null
    if (id) node.setAttribute("aria-activedescendant", id)
    else node.removeAttribute("aria-activedescendant")
  })

  node_add_event_listener(node, "keydown", (ev) => {
    if (ev.altKey || ev.ctrlKey || ev.metaKey) return
    const active = opts.o_active.get()
    const page = opts.page_size?.() ?? 10
    // Any navigation key ends the letters being typed.
    if (ev.key.length !== 1) typed = ""
    switch (ev.key) {
      case "ArrowDown":
        move_to(active < 0 ? 0 : active + 1)
        break
      case "ArrowUp":
        move_to(active < 0 ? opts.count() - 1 : active - 1)
        break
      case "Home":
        // In a text field, Home/End move the caret.
        if (is_text_field) return
        move_to(0)
        break
      case "End":
        if (is_text_field) return
        move_to(opts.count() - 1)
        break
      case "PageDown":
        move_to(Math.max(active, 0) + page)
        break
      case "PageUp":
        move_to(Math.max(active, 0) - page)
        break
      case "Enter":
        if (active < 0) return
        opts.activate(active)
        break
      case " ":
        if (is_text_field || active < 0) return
        opts.activate(active)
        break
      default: {
        if (is_text_field || opts.text_of == null || ev.key.length !== 1 || ev.key === " ") return
        const now = performance.now()
        typed = now - typed_at > TYPEAHEAD_RESET ? ev.key : typed + ev.key
        typed_at = now
        // The same letter repeated ("bb") cycles through the items starting with it, as in native menus.
        const repeated = [...typed].every((c) => c === typed[0])
        const found = find_by_prefix(opts.text_of, opts.count(), repeated ? typed[0] : typed, active)
        if (found >= 0) move_to(found)
        break
      }
    }
    ev.preventDefault()
  })
}

/**
 * The next item whose text starts with `prefix`, case-insensitively, searching from the active one
 * (included when `prefix` grew, so "a" then "ap" stays on "apple") and wrapping around. -1 if none.
 */
function find_by_prefix(text_of: (index: number) => string, count: number, prefix: string, active: number): number {
  const needle = prefix.toLocaleLowerCase()
  // A single letter looks past the current item (repeated "a" cycles through the a's); a longer
  // prefix starts on it.
  const start = prefix.length === 1 ? active + 1 : Math.max(active, 0)
  for (let k = 0; k < count; k++) {
    const i = (start + k) % count
    if (text_of(i).trim().toLocaleLowerCase().startsWith(needle)) return i
  }
  return -1
}

/**
 * Focus `el` once it's connected and shown. A popup shows its content a moment after attaching it,
 * and focus can only land on a shown element.
 *
 * Nothing happens if `el` was disconnected in the meantime: a popup closed within that frame is
 * still in the document while it fades out, and focusing it would drop focus to the body once it is
 * removed.
 */
export function focus_when_shown(el: HTMLElement) {
  node_on_connected(el, () =>
    requestAnimationFrame(() => {
      if (node_is_connected(el)) el.focus({ preventScroll: true })
    }),
  )
}

/**
 * {@link list_nav} for a menu built as plain DOM: its items are the `[role=menuitem]` elements
 * inside `menu` that aren't disabled (headers and `<hr>` are skipped).
 *
 * Focus moves between the items themselves (roving focus): the active item is the focused one, the
 * others are out of the tab order (`tabindex="-1"`), and the browser's `:focus-visible` draws the
 * keyboard cursor, so a menu needs no marker of its own. That is the right model for a menu, whose
 * items are all in the DOM; a list that may not render all its items, or whose focus must stay in a
 * text field (the Select), keeps focus elsewhere and names the active item with
 * `aria-activedescendant` ({@link list_nav} alone). The pointer makes the item under it the active one,
 * so keys continue from where the mouse is. Activating an item clicks it.
 *
 * Call it once the items are in `menu`; the first item starts active, and takes focus once shown (so in
 * a popup, focus is in the menu from the start and keys work right away). `menu` is the target of the
 * keys and takes the focus itself when it has no item.
 */
export function menu_nav(menu: HTMLElement) {
  // The items, looked up once per key press or pointer move rather than on each call list_nav makes
  // (a typed letter calls text_of up to once per item). The list is dropped in a microtask, that is once
  // the current event handler returns, so items added or removed between two events are seen.
  let cached: HTMLElement[] | null = null
  const items = () => {
    if (cached == null) {
      cached = [...menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])')]
      for (const item of cached) item.tabIndex = -1
      queueMicrotask(() => {
        cached = null
      })
    }
    return cached
  }
  const o_active = o(items().length > 0 ? 0 : -1)
  menu.tabIndex = -1

  list_nav(menu, {
    o_active,
    count: () => items().length,
    activate: (i) => items()[i]?.click(),
    reveal: (i) => items()[i]?.scrollIntoView({ block: "nearest" }),
    text_of: (i) => items()[i]?.textContent ?? "",
  })

  // The active item has the focus. Not before the menu is shown: a popup shows its content a moment
  // after attaching it, and focus can only land on a shown element (focus_when_shown).
  node_observe(menu, o_active, (index) => {
    if (index >= 0 && menu.contains(document.activeElement)) items()[index]?.focus({ preventScroll: true })
  })
  node_on_connected(menu, () =>
    requestAnimationFrame(() => {
      if (node_is_connected(menu)) (items()[o_active.get()] ?? menu).focus({ preventScroll: true })
    }),
  )

  // The pointer makes the item under it active (and focused, through the observer above).
  node_add_event_listener(menu, "pointermove", (ev) => {
    const item = (ev.target as Element).closest?.('[role="menuitem"]')
    const index = item ? items().indexOf(item as HTMLElement) : -1
    if (index >= 0 && index !== o_active.get()) o_active.set(index)
  })
  // Focus moved by other means (a click, Tab, a script) is the new active item.
  node_add_event_listener(menu, "focusin", (ev) => {
    const index = items().indexOf((ev.target as Element).closest?.('[role="menuitem"]') as HTMLElement)
    if (index >= 0 && index !== o_active.get()) o_active.set(index)
  })
}

/* The keyboard cursor of a list that keeps its focus elsewhere (\`e-active\`) looks like a hovered item,
   which it stands in for on the keyboard, and a selected option is the selected state's
   (ui/states.css.tsx). A menu's cursor is the focused item itself. */
css`:is([role="menu"], [role="listbox"]):focus-visible {
  outline: none;
}`
