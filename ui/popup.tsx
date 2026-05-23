/////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////
/**
 * Some popup handling.
 */

import { $scrollable, css, node_append, node_do_disconnect, node_remove } from "elt"
import { animate, animate_hide, animate_show, stop_animations } from "./animation"
import { theme } from "./theme"
import { Future } from "./utils"
const colors = theme.colors

import { arrow, autoPlacement, autoUpdate, computePosition, type ComputePositionConfig, flip, hide, offset } from "@floating-ui/dom"

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

const ARROW_SIZE = 12
const ARROW_HALF = ARROW_SIZE / 2

/** Apply floating-ui arrow coords; static edge comes from final placement (see floating-ui arrow docs). */
function apply_arrow_position(arro: HTMLElement, placement: string, data: { x?: number, y?: number, centerOffset: number }) {
  const side = placement.split("-")[0] as "top" | "bottom" | "left" | "right"
  arro.dataset.placement = side
  arro.style.left = ""
  arro.style.top = ""
  arro.style.right = ""
  arro.style.bottom = ""

  if (side === "bottom" || side === "top") {
    if (data.x != null) arro.style.left = `${data.x}px`
    // Popup below anchor → arrow on top edge; above → on bottom edge.
    if (side === "bottom") arro.style.top = `${-ARROW_HALF}px`
    else arro.style.bottom = `${-ARROW_HALF}px`
  } else {
    if (data.y != null) arro.style.top = `${data.y}px`
    if (side === "right") arro.style.left = `${-ARROW_HALF}px`
    else arro.style.right = `${-ARROW_HALF}px`
  }

  arro.style.visibility = data.centerOffset !== 0 ? "hidden" : "visible"
}

const transform_origins = new Map<string, string>([
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

    const arro = opts.arrow ? <e-box class={cls_arrow} /> as HTMLElement : null
    if (arro) {
      // Sibling after scrollable content; z-index keeps it above the panel fill.
      node_append(popup, arro)
    }

    node_append(opts.parent ?? find_parent_node(anchor), popup)

    popup.showPopover()
    popup.classList.add("open")


    async function updatePosition() {
      const { x, y, middlewareData, placement } = await computePosition(anchor, popup, {
        ...opts,
        middleware: [
          offset(arro ? ARROW_HALF + 8 : 0),
          autoPlacement({
            allowedPlacements: ["top-start", "top", "top-end", "bottom-start", "bottom", "bottom-end", ]
          }),
          flip(),
          hide(),
          ...(arro ? [arrow({ element: arro, padding: 8 })] : []),
        ],
      })

      const transform_origin = transform_origins.get(placement)
      if (transform_origin != null) {
        popup.style.transformOrigin = transform_origin
      }

      if (middlewareData.hide) {
        popup.style.visibility = middlewareData.hide.referenceHidden ? "hidden" : "visible"
      }

      popup.style.left = `${x}px`
      popup.style.top = `${y}px`
      if (arro && middlewareData.arrow) {
        apply_arrow_position(arro, placement, middlewareData.arrow)
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
  box-shadow:
    0 4px 8px ${colors.text.light},
    0 2px 4px ${colors.text.light};
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

const cls_arrow = css`.arrow {
  width: ${ARROW_SIZE}px;
  height: ${ARROW_SIZE}px;
  position: absolute;
  pointer-events: none;
  z-index: 1;

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background: ${colors.bg};
    transform: rotate(45deg);
  }

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    transform: rotate(45deg);
    border: 1px solid ${colors.text.mid};
    border-bottom: none;
    border-right: none;
    border-radius: 2px;
  }

  &[data-placement="top"]::before,
  &[data-placement="top"]::after {
    transform: rotate(225deg);
  }

  &[data-placement="left"]::before,
  &[data-placement="left"]::after {
    transform: rotate(135deg);
  }

  &[data-placement="right"]::before,
  &[data-placement="right"]::after {
    transform: rotate(-45deg);
  }
}`