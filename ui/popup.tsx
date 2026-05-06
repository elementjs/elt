/////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////
/**
 * Some popup handling.
 */

import { css, node_append, node_do_disconnect, node_remove } from "elt"
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
    ev.preventDefault()
    ev.stopPropagation()
    _close_popups()
  }
}

export const sym_popup_closed = Symbol("popup closed")

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
  fut.then(val => {
    if (val !== sym_popup_closed) {
      _close_popups()
    }
  })

  const popup = <e-box class={cls_popup} popover="manual">
    {fn(fut)}
  </e-box> as HTMLElement


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

    node_append(opts.parent ?? doc.body, popup)

    popup.showPopover()
    popup.classList.add("open")
    const arro = opts.arrow ? <e-box class={cls_arrow} /> as HTMLElement : null
    if (arro) {
      // node_append(popup, arro)
    }

    async function updatePosition() {
      const { x, y, middlewareData, placement } = await computePosition(anchor, popup, {
        ...opts,
        middleware: [
          // offset(10),
          autoPlacement({
            allowedPlacements: ["top-start", "top", "top-end", "bottom-start", "bottom", "bottom-end", ]
          }),
          flip(),
          hide(),
          ...(opts.arrow ? [arrow({ element: arro! })] : []),
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
        // console.log(placement)
        // console.log(middlewareData.arrow)
        // const a = middlewareData.arrow
        // if (a.x != null) {
        //   arro.style.left = `${middlewareData.arrow?.x}px`
        // }
        // if (a.y != null) {
        //   arro.style.top = `${middlewareData.arrow?.y}px`
        // }
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
  max-height: 80vh;
  max-width: 320px;
  border-radius: var(--e-border-radius);
  overflow: hidden;
  background-color: ${colors.bg};
  color: ${colors.text};
  border: 1px solid ${colors.text.mid};
  box-shadow: 0 4px 8px ${colors.text.light},
  0 2px 4px ${colors.text.light};

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
  width: 12px;
  height: 12px;
  position: absolute;
  overflow: visible; /* important */

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background: ${colors.bg}; /* same as panel */
    transform: rotate(45deg);
  }

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    transform: rotate(45deg);
    border: 1px solid ${colors.tint.mid}; /* same as panel */
    border-bottom: none;
    border-right: none;
    border-radius: 2px;
  }
}`