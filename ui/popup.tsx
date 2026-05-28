/////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////
/**
 * Some popup handling.
 */

import { $scrollable, css, node_append, node_do_disconnect, node_remove, o } from "elt"
import { animate, animate_hide, animate_show, stop_animations } from "./animation"
import { theme } from "./theme"
import { Future } from "./utils"
const colors = theme.colors

import { arrow, autoPlacement, autoUpdate, computePosition, type ComputePositionConfig, flip, hide } from "@floating-ui/dom"

export type PopupResolution<T> =
  | { resolution: "value", value: T }
  | { resolution: "closed" }

const popups = new Set<Element>()
const popups_futures = new WeakMap<Element, Future<any | undefined>>()

/** Find a suitable parent for a popup ; stops at a popup or a top layer element, or document.body if no root is found.
 * This helps avoid closing popups when clicking on a child of a popup.
 */
function find_parent_node(el: Node) {
  while (el != null && el != document.body) {
    // Open modal dialogs are promoted to the top layer
    if (el instanceof HTMLDialogElement && el.open) {
      return el
    }

    if (popups.has(el as Element)) {
      return el
    }

    // Elements with the Popover API open are also in the top layer
    if (
      el instanceof HTMLElement &&
      el.hasAttribute('popover') &&
      el.matches(':popover-open')
    ) {
      return el
    }

    el = el.parentElement!
  }

  return document.body

}

async function _popup_resolve(p: Element) {
  popups.delete(p)
  popups_futures.get(p)?.resolve(sym_popup_closed)
  popups_futures.delete(p)
  const _p = p as HTMLElement
  _p.classList.remove("open")
  node_do_disconnect(_p)
  await stop_animations(_p)
  await animate(_p, animate_hide, { duration: 150, easing: "cubic-bezier(0.22, 1, 0.36, 1)" })
  node_remove(p)
}

function _close_popups_keydown(ev: KeyboardEvent) {
  if (ev.key === "Escape") {
    _close_popups()
    ev.preventDefault()
    ev.stopPropagation()
    ev.stopImmediatePropagation()
  }
}

function _close_popups() {
  if (popups.size === 0) return
  for (let p of popups) {
    _popup_resolve(p)
  }
  if (popups.size === 0) {
    document.removeEventListener("click", _eval_popup_click, { capture: true })
    document.removeEventListener("keydown", _close_popups_keydown, { capture: true })
  }
}

function _eval_popup_click(ev: MouseEvent) {
  if (popups.size === 0) return
  let found_contain = false
  for (let p of popups) {
    if (p.contains(ev.target as Node)) {
      found_contain = true
      continue
    }

    if (found_contain) {
      // Close popups that didn't contain the click
      _popup_resolve(p)
      continue
    }
  }
  // If we get here, no popup contained the click, we close them all
  if (!found_contain) {
    _close_popups()
  }
}

export const sym_popup_closed = Symbol("popup closed")

const ARROW_WIDTH = 12
/** Side length; base span along panel ≈ S×√2, outward tip distance ≈ S/√2. */
const ARROW_OFFSET = ARROW_WIDTH / 2

type ArrowPlacement = "top" | "bottom" | "left" | "right"

/** Arrow state as per floating-ui's arrow middleware */
interface ArrowState {
  side: ArrowPlacement
  ax: number | null
  ay: number | null
  visible: boolean
}

function popup_placement_to_arrow_placement(placement: string): ArrowPlacement {
  const pp = placement.split("-")[0] as ArrowPlacement
  if (pp === "top") return "bottom"
  if (pp === "bottom") return "top"
  if (pp === "left") return "right"
  if (pp === "right") return "left"
  throw new Error(`Invalid popup placement: ${placement}`)
}

function popup_arrow(o_state: o.Observable<ArrowState>) {

  const oo_outer_arrow_position = o.expression(get => {
    const { side, ax, ay, visible } = get(o_state)
    const style: Partial<CSSStyleDeclaration> = {
      visibility: visible ? "visible" : "hidden",
      left: "",
      top: "",
      right: "",
      bottom: "",
    }
    if (side === "bottom" || side === "top") {
      if (ax != null) style.left = `${ax}px`
      if (side === "top") style.top = `calc(-1 * var(--arrow-size, 12px) / 2)`
      else style.bottom = `calc(-1 * var(--arrow-size, 12px) / 2)`
    } else {
      if (ay != null) style.top = `${ay}px`
      if (side === "left") style.left = `calc(-1 * var(--arrow-size, 12px) / 2)`
      else style.right = `calc(-1 * var(--arrow-size, 12px))`
    }

    return style
  })

  return <e-box style={oo_outer_arrow_position} class={[cls_outer_arrow, o_state.p("side")]}>
    <e-box class={cls_arrow_placer} data-placement={o_state.p("side")}>
      <e-box class={cls_arrow_inner}/>
    </e-box>
  </e-box> as HTMLElement
}


/** Transform origins for the animation of the appearing/disappearing of the popup relative to its resolved position by floating-ui */
const popup_transform_origins = new Map<string, string>([
  ["top-start", "bottom left"],
  ["top", "bottom center"],
  ["top-end", "bottom right"],
  ["bottom-start", "top left"],
  ["bottom", "top center"],
  ["bottom-end", "top right"],
  ["left-start", "right top"],
  ["left", "right center"],
  ["left-end", "right bottom"],
  ["right-start", "left top"],
  ["right", "left center"],
  ["right-end", "left bottom"],
])

export function popup<T>(
  anchor: Element,
  fn: (fut: Future<T | typeof sym_popup_closed>) => Node,
  opts: Partial<ComputePositionConfig> & { parent?: Element | null, arrow?: boolean }
) {

  const doc = anchor.ownerDocument
  const fut = new Future<T | typeof sym_popup_closed>()
  const popup = <e-box class={cls_popup} popover="manual">
    <e-box class={cls_popup_content}>
      {$scrollable}
      {fn(fut)}
    </e-box>
  </e-box> as HTMLElement

  fut.then(val => {
    if (val !== sym_popup_closed) {
      _popup_resolve(popup)
    }
  })

  // Figure out if we were created from inside a popup, in which case
  // we do not close the previous pop-ups
  let creator_is_popup = false
  let iter = anchor as HTMLElement | null

  while (iter != null) {
    if (popups.has(iter)) {
      creator_is_popup = true
      break
    }
    iter = iter.parentElement
  }

  // The popup is not being created from inside a popup, so we close all other popups
  if (!creator_is_popup) {
    _close_popups()
  }


  setTimeout(async () => {
    // node_append(anchor.parentElement!, popup_root, anchor.nextSibling)

    const o_arrow_state = o<ArrowState>({ side: "bottom", ax: null, ay: null, visible: true })
    const arro = opts.arrow ? popup_arrow(o_arrow_state) : null
    if (arro) {
      // Sibling after scrollable content; z-index keeps it above the panel fill.
      node_append(popup, arro, popup.firstChild)
    }

    node_append(opts.parent ?? find_parent_node(anchor), popup)

    popup.showPopover()
    popup.classList.add("open")


    async function updatePosition() {
      const { x, y, middlewareData, placement } = await computePosition(anchor, popup, {
        ...opts,
        middleware: [
          autoPlacement({
            allowedPlacements: [...(opts.placement ? [opts.placement] : []), "top", "top-start", "top-end", "bottom", "bottom-start", "bottom-end",]
          }),
          flip(),
          hide(),
          ...(arro ? [arrow({ element: arro, padding: 8 })] : []),
        ],
      })

      const transform_origin = popup_transform_origins.get(placement)
      if (transform_origin != null) {
        popup.style.transformOrigin = transform_origin
      }

      if (middlewareData.hide) {
        popup.style.visibility = middlewareData.hide.referenceHidden ? "hidden" : "visible"
      }

      popup.style.left = `${x}px`
      popup.style.top = `${y}px`

      if (arro && middlewareData.arrow) {
        const side = popup_placement_to_arrow_placement(placement)
        const _arr = `var(--arrow-size, 12px) / 2.8284`
        if (side === "bottom") {
          popup.style.top = `calc(${y}px - ${_arr})`
        } else if (side === "top") {
          popup.style.top = `calc(${y}px + ${_arr})`
        } else if (side === "left") {
          popup.style.left = `calc(${x}px + ${_arr})`
        } else if (side === "right") {
          popup.style.left = `calc(${x}px - ${_arr})`
        }

        const data = middlewareData.arrow
        o_arrow_state.set({
          side,
          ax: data.x ?? null,
          ay: data.y ?? null,
          visible: !middlewareData.hide?.referenceHidden,
        })
      }
    }

    if (popups.size === 0) {
      doc.addEventListener("click", _eval_popup_click, { capture: true })
      doc.addEventListener("keydown", _close_popups_keydown, { capture: true })
    }

    // doc.body.appendChild(popup_root)
    popups.add(popup)
    popups_futures.set(popup, fut)
    const cleanup = autoUpdate(anchor, popup, updatePosition)

    fut.finally(() => {
      cleanup()
    })
    animate(popup, animate_show, { duration: 150, easing: "cubic-bezier(0.22, 1, 0.36, 1)" })
  })

  return fut
}

popup.closed = sym_popup_closed

const cls_popup = css`.popup {
  position: absolute;
  overflow: visible;
  border-radius: var(--e-border-radius);
  background-color: ${colors.bg};
  color: ${colors.text};
  border: 1px solid ${colors.text.mid};
  filter: drop-shadow(
    0px 0px 4px ${colors.text.light});
}`
const cls_popup_content = css`.popup-content {
  overflow: hidden;
  max-height: 80vh;
  max-width: 320px;
}`

/* Not sure if interesting
  &::backdrop {
    background: rgba(0, 0, 0, 0);
    transition: background 0.2s ease;
  }

  &.open::backdrop {
    background: rgba(0, 0, 0, 0.1);
  }
*/

const cls_arrow_inner = css`.arrow-inner {
  position: absolute;
  border: 1px solid ${colors.text.mid};
  transform: rotate(45deg);
  top: calc(-1 * var(--arrow-size, 12px) / 2.8284);
  left: calc(-1 * var(--arrow-size, 12px) / 2.8284);
  transform-origin: center;
  width: calc(var(--arrow-size, 12px) / 1.4142);
  height: calc(var(--arrow-size, 12px) / 1.4142);
  background-color: ${colors.bg};
  border-radius: 2px;
}`

const cls_arrow_placer = css`.arrow-placer {
  position: absolute;
  top: 0;
  left: 0;
  &[data-placement="top"] {
    transform:
      translateX(calc(var(--arrow-size, 12px) / 2))
      translateY(calc(var(--arrow-size, 12px) / 2 + 1px));
  }
  &[data-placement="bottom"] {
    transform:
      translateX(calc(var(--arrow-size, 12px) / 2))
      translateY(-1px)
      ;
  }
  &[data-placement="left"] {
    transform:
      translateX(calc(var(--arrow-size, 12px) / 2 + 1px))
      translateY(calc(var(--arrow-size, 12px) / 2));
  }
  &[data-placement="right"] {
    transform:
      translateX(calc(var(--arrow-size, 12px) / 2 - 1px))
      translateY(calc(var(--arrow-size, 12px) / 2));
  }
}`

const cls_outer_arrow = css`.outer-arrow {
  --arrow-size: var(--e-arrow-size, 12px);
  position: absolute;
  pointer-events: none;
  overflow: hidden;
  width: var(--arrow-size);
  height: calc(var(--arrow-size) * 0.5);
  background-color: transparent;

  &.right, &.left {
    width: calc(var(--arrow-size) * 0.5);
    height: var(--arrow-size);
  }
}`