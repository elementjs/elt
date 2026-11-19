/**
 * A tab strip's roles, keys and links (docs/md/ui-states.md#tabs). The markup stays the app's: three
 * decorators go on its row of tabs, on each tab and on the element that shows the view, so a tab can hold
 * anything (an icon, an "unsaved" dot), sit next to its close button, and the view can be anywhere.
 */

import {
  css,
  type Decorator,
  node_add_event_listener,
  node_observe,
  node_on_connected,
  node_on_disconnected,
  type o,
} from "elt"
import { DISABLED_SELECTOR } from "./selectors"
import { theme } from "./theme"

export interface TabStrip<T> {
  /** On the element around the tabs: `role="tablist"`, and the keys that move between them. */
  strip: Decorator<HTMLElement>
  /** On each tab, with the value of `o_selected` it shows: `role="tab"`, `aria-selected`, a click selects it. */
  tab: (value: T) => Decorator<HTMLElement>
  /** On the element that shows the selected view: `role="tabpanel"`, named by the selected tab. */
  panel: Decorator<HTMLElement>
}

let strip_count = 0
let tab_count = 0

const is_enabled = (el: Element) => !el.matches(DISABLED_SELECTOR)

/** The close button of a tab: the `tab-close` button right after it, as the tab look has it. */
const close_button_of = (tab: Element) => {
  const next = tab.nextElementSibling
  return next instanceof HTMLElement && next.getAttribute("e-widget") === "tab-close" ? next : null
}

/**
 * The tabs that show the values of `o_selected`, as decorators for the app's own markup. One strip and one
 * panel per call.
 *
 * - Only the selected tab is a Tab stop (the first enabled one when none is selected, or it is disabled); the arrow keys along
 *   the strip (Left/Right, or Up/Down when the strip has `aria-orientation="vertical"`), Home and End move
 *   to another tab and select it at once, skipping disabled tabs.
 * - Delete clicks the focused tab's close button (a `tab-close` right after it, out of the Tab order), then
 *   gives focus back to the tab that is now the Tab stop.
 * - Each tab controls the panel, the panel is named by the selected tab, and a close button controls its
 *   tab. A row of its own around a tab and its close button gets `role="none"`, so the tab still counts as
 *   one of the strip's.
 * - The panel is a Tab stop (`tabindex="0"`, unless it has one), so the keyboard reaches a view with nothing
 *   focusable in it.
 */
export function tab_strip<T>(o_selected: o.Observable<T>): TabStrip<T> {
  const prefix = `e-tabs-${++strip_count}`
  // The tabs of this strip and their values: a tab of a strip nested in the panel isn't one.
  const values = new WeakMap<Element, T>()
  let list: HTMLElement | null = null
  let panel: HTMLElement | null = null
  let pending = false

  const tabs_now = () =>
    list ? [...list.querySelectorAll<HTMLElement>('[role="tab"]')].filter((tab) => values.has(tab)) : []

  function sync() {
    pending = false
    if (list == null) return
    const tabs = tabs_now()
    const current = o_selected.get()
    const selected = tabs.find((tab) => values.get(tab) === current) ?? null
    // A disabled tab can't take focus: the strip would have no way in.
    const stop = selected && is_enabled(selected) ? selected : (tabs.find(is_enabled) ?? null)
    for (const tab of tabs) {
      tab.setAttribute("aria-selected", String(tab === selected))
      tab.tabIndex = tab === stop ? 0 : -1
      if (panel) tab.setAttribute("aria-controls", panel.id)
    }
    if (panel && selected) panel.setAttribute("aria-labelledby", selected.id)
    else panel?.removeAttribute("aria-labelledby")
  }
  // Tabs come and go a few at a time (a Repeat of open files): one pass once they're all in.
  const schedule = () => {
    if (pending) return
    pending = true
    queueMicrotask(sync)
  }

  function on_keydown(ev: KeyboardEvent) {
    if (ev.altKey || ev.ctrlKey || ev.metaKey || list == null) return
    const tab = (ev.target as Element).closest?.('[role="tab"]')
    if (tab == null || !values.has(tab)) return

    if (ev.key === "Delete") {
      const close = close_button_of(tab)
      if (close == null || !is_enabled(close)) return
      ev.preventDefault()
      close.click()
      // The app has removed the tab, or kept it: focus goes to the Tab stop if it left the strip.
      sync()
      if (!list.contains(document.activeElement))
        tabs_now()
          .find((t) => t.tabIndex === 0)
          ?.focus()
      return
    }

    const vertical = list.getAttribute("aria-orientation") === "vertical"
    const rtl = !vertical && getComputedStyle(list).direction === "rtl"
    const tabs = tabs_now().filter(is_enabled)
    const i = tabs.indexOf(tab as HTMLElement)
    let next: number
    switch (ev.key) {
      case vertical ? "ArrowUp" : rtl ? "ArrowRight" : "ArrowLeft":
        next = i - 1
        break
      case vertical ? "ArrowDown" : rtl ? "ArrowLeft" : "ArrowRight":
        next = i + 1
        break
      case "Home":
        next = 0
        break
      case "End":
        next = tabs.length - 1
        break
      default:
        return
    }
    ev.preventDefault()
    if (tabs.length === 0) return
    // The arrows wrap around, as in a native tab strip.
    const target = tabs[(next + tabs.length) % tabs.length]
    target.focus()
    o_selected.set(values.get(target) as T)
  }

  return {
    strip(node) {
      list = node
      node.setAttribute("role", "tablist")
      node_observe(node, o_selected, sync)
      node_add_event_listener(node, "keydown", on_keydown)
    },

    tab: (value) => (node) => {
      values.set(node, value)
      node.setAttribute("role", "tab")
      if (!node.id) node.id = `${prefix}-tab-${++tab_count}`
      node_add_event_listener(node, "click", () => o_selected.set(value))
      node_on_connected(node, () => {
        const parent = node.parentElement
        if (parent && parent !== list && !parent.hasAttribute("role")) parent.setAttribute("role", "none")
        // The close button is reached by Delete on its tab, not by Tab: the strip stays one Tab stop.
        const close = close_button_of(node)
        if (close) {
          close.setAttribute("aria-controls", node.id)
          close.tabIndex = -1
        }
        schedule()
      })
      node_on_disconnected(node, schedule)
    },

    panel(node) {
      panel = node
      node.setAttribute("role", "tabpanel")
      if (!node.id) node.id = `${prefix}-panel`
      if (!node.hasAttribute("tabindex")) node.tabIndex = 0
      node_on_connected(node, schedule)
    },
  }
}

/* The panel is a Tab stop, and the reset removes outlines: it draws the focus ring inside its edge, as the
   controls do, so a frame or a packed container around it can't cut it. */
css`[role="tabpanel"]:focus-visible {
  box-shadow: inset 0 0 0 ${theme.settings.focusRingSize} ${theme.colors.tint.mid};
}`
