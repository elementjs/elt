/**
 * `$interactive`: makes any element behave as a control (docs/md/ui-states.md#interaction).
 *
 * Styling is the interaction layer's (ui/states.css.tsx), keyed on the `e-interactive` attribute this
 * sets. What CSS cannot give is a button's behavior, which a native `<button>` has and a `<div>` does
 * not: a role, a place in the tab order, and Enter and Space that activate it. Those are set here, so
 * that an app writes `{$interactive}{$click(…)}` and nothing else. Handlers stay `$click` / `$on("click")`:
 * a click is the event of "activate", and the keys here dispatch one.
 */

import { node_add_event_listener } from "elt"

export interface InteractiveOptions {
  /**
   * Whether the element joins the tab order (`tabindex="0"`). Default true. `false` for an element with a
   * focus model of its own, where focus stays on a container and a key moves a cursor among the items
   * (the options of a Select): it is still drawn and hovered as a control.
   */
  focusable?: boolean
}

/** Elements whose own behavior already is a button's: the browser gives them focus, the role and the keys. */
const NATIVE_CONTROL = "button, a[href], input, select, textarea, summary"

function apply(node: HTMLElement, opts: InteractiveOptions) {
  node.setAttribute("e-interactive", "")
  if (node.matches(NATIVE_CONTROL)) return

  // A role the element already has (an option, a menu item) is the widget's own: left alone, and so are
  // its keys, which belong to whatever navigates the widget.
  const given_role = node.getAttribute("role")
  if (given_role == null) node.setAttribute("role", "button")
  if (opts.focusable !== false && !node.hasAttribute("tabindex")) node.tabIndex = 0
  if (given_role != null && given_role !== "button") return

  // Space activates on release, as a button does, unless the key went down elsewhere (a press that
  // started in another element and slid onto this one is not ours).
  let space_down = false
  node_add_event_listener(node, "keydown", (ev: KeyboardEvent) => {
    // A key pressed in an element inside this one (a nested control) is that element's.
    if (ev.target !== node || ev.altKey || ev.ctrlKey || ev.metaKey || node.getAttribute("aria-disabled") === "true")
      return
    if (ev.key === "Enter") {
      ev.preventDefault()
      node.click()
    } else if (ev.key === " ") {
      // The page must not scroll on a press that is for us.
      ev.preventDefault()
      space_down = true
    }
  })
  node_add_event_listener(node, "keyup", (ev: KeyboardEvent) => {
    if (ev.key !== " " || !space_down) return
    space_down = false
    if (ev.target === node && node.getAttribute("aria-disabled") !== "true") node.click()
  })
  node_add_event_listener(node, "blur", () => {
    space_down = false
  })
}

/**
 * Make the element a control: it is drawn, hovered and pressed as one (`e-interactive`), has the role
 * `button` unless it has a role already, takes part in the tab order, and Enter and Space activate it
 * (they dispatch a `click`). Native buttons and links are controls already: they only get the attribute.
 *
 * ```tsx
 * <e-row pad border>{$interactive}{$click(open)}A card</e-row>
 * <e-row role="option">{$interactive({ focusable: false })}…</e-row>
 * ```
 *
 * Usable bare, as a decorator, or called with options, which returns the decorator.
 *
 * @group Decorators
 */
export function $interactive(node: HTMLElement): void
export function $interactive(opts?: InteractiveOptions): (node: HTMLElement) => void
export function $interactive(arg?: HTMLElement | InteractiveOptions): void | ((node: HTMLElement) => void) {
  if (arg instanceof HTMLElement) return apply(arg, {})
  return (node) => apply(node, arg ?? {})
}
