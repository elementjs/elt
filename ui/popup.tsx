/////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////
/**
 * Some popup handling.
 */

import { $enter, $leave, css, node_append, node_remove, o } from "elt"
import { rise_in, sink_out } from "./motion"
import { theme } from "./theme"
import { Future, sym_closed } from "./utils"
const colors = theme.colors

import {
  arrow,
  autoPlacement,
  autoUpdate,
  computePosition,
  type ComputePositionConfig,
  flip,
  hide,
  type Middleware,
  shift,
  size,
} from "@floating-ui/dom"

export type PopupResolution<T> = { resolution: "value"; value: T } | { resolution: "closed" }

const popups = new Set<Element>()
const popups_futures = new WeakMap<Element, Future<any | undefined>>()
/** What had focus when each popup opened, given it back when the popup closes. */
const popups_return_focus = new WeakMap<Element, HTMLElement>()

/** Find a suitable parent for a popup ; stops at a popup or a top layer element, or document.body if no root is found.
 * This helps avoid closing popups when clicking on a child of a popup.
 */
function find_parent_node(start: Node) {
  let el: Node | null = start
  while (el != null && el !== document.body) {
    // Open modal dialogs are promoted to the top layer
    if (el instanceof HTMLDialogElement && el.open) {
      return el
    }

    if (popups.has(el as Element)) {
      return el
    }

    // Elements with the Popover API open are also in the top layer
    if (el instanceof HTMLElement && el.hasAttribute("popover") && el.matches(":popover-open")) {
      return el
    }

    el = el.parentElement
  }

  return document.body
}

function _popup_resolve(p: Element) {
  // Popups opened from this one are attached inside it: they close with it.
  for (const child of [...popups]) if (child !== p && p.contains(child)) _popup_resolve(child)
  popups.delete(p)
  popups_futures.get(p)?.resolve(sym_closed)
  popups_futures.delete(p)
  // Give focus back to what had it at opening, unless the user already moved it elsewhere: only when
  // it is inside the closing popup, or lost to the body.
  const return_to = popups_return_focus.get(p)
  popups_return_focus.delete(p)
  const active = p.ownerDocument.activeElement
  if (return_to?.isConnected && (active == null || active === p.ownerDocument.body || p.contains(active))) {
    return_to.focus({ preventScroll: true })
  }
  p.classList.remove("open")
  // Its $leave plays the exit; the popup is already out of the flow (absolute), so it stays in flow.
  node_remove(p)
}

/** Escape closes the innermost popup only (the last opened), like one level of a native menu. */
function _close_popups_keydown(ev: KeyboardEvent) {
  if (ev.key === "Escape") {
    const innermost = [...popups].pop()
    if (innermost) _popup_resolve(innermost)
    _stop_listening_if_none()
    ev.preventDefault()
    ev.stopPropagation()
    ev.stopImmediatePropagation()
  }
}

function _close_popups() {
  if (popups.size === 0) return
  for (const p of popups) {
    _popup_resolve(p)
  }
  _stop_listening_if_none()
}

function _stop_listening_if_none() {
  if (popups.size === 0) {
    document.removeEventListener("click", _eval_popup_click, { capture: true })
    document.removeEventListener("keydown", _close_popups_keydown, { capture: true })
  }
}

function _eval_popup_click(ev: MouseEvent) {
  if (popups.size === 0) return
  let found_contain = false
  for (const p of popups) {
    if (p.contains(ev.target as Node)) {
      found_contain = true
      continue
    }

    if (found_contain) {
      // Close popups that didn't contain the click
      _popup_resolve(p)
    }
  }
  // If we get here, no popup contained the click, we close them all
  if (!found_contain) {
    _close_popups()
  }
}

/**
 * What a popup is anchored to: an element, or a point (a context menu at the pointer). A point names
 * the element it belongs to (`element`, typically the event's `currentTarget`): it tells whether the
 * popup opens from inside another popup, which then stays open, and where it attaches in the top
 * layer (an open modal dialog's subtree, for instance).
 */
export type PopupAnchor = Element | { x: number; y: number; element: Element }

export interface PopupOptions extends Partial<ComputePositionConfig> {
  /** Where to attach the popup; by default the nearest open popup or dialog around the anchor, or the body. */
  parent?: Element | null
  /** Draw the arrow pointing at the anchor. Default: `true` with an element anchor, `false` with a point. */
  arrow?: boolean
}

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
  const oo_outer_arrow_position = o.expression((get) => {
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

  return (
    <div style={oo_outer_arrow_position} class={[cls_outer_arrow, o_state.p("side")]}>
      <div class={cls_arrow_placer} data-placement={o_state.p("side")}>
        <div class={cls_arrow_inner} />
      </div>
    </div>
  ) as HTMLElement
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

/**
 * Open a popup next to `anchor` and return a `Future` resolved by `fut.resolve(value)` from the
 * content, or with {@link sym_closed} when the user dismisses it (click outside, `Escape`).
 *
 * The element `render` returns is drawn as given — its own `border`, `surface`, `scroll` and padding;
 * the popup only adds placement, a drop shadow, the animation, dismissal and the arrow, whose colors
 * follow the element's background and border. The space available next to the anchor is exposed as
 * `--e-popup-max-height` / `--e-popup-max-width`, and the element is capped to it (and to `80vh`):
 * give it `scroll` when its content can be taller.
 */
export function popup<T>(
  anchor: PopupAnchor,
  render: (fut: Future<T | typeof sym_closed>) => Node,
  opts?: PopupOptions,
) {
  const anchor_el = anchor instanceof Element ? anchor : anchor.element
  // A point becomes a Floating UI "virtual element": a zero-size rect at the point.
  const reference =
    anchor instanceof Element
      ? anchor
      : { getBoundingClientRect: () => new DOMRect(anchor.x, anchor.y, 0, 0), contextElement: anchor_el }
  const doc = anchor_el.ownerDocument
  const fut = new Future<T | typeof sym_closed>()
  const rendered = render(fut)
  // Typed Node because that is what JSX gives; the popup needs one element to cap and color from.
  if (!(rendered instanceof HTMLElement)) throw new Error("popup(): render must return a single HTML element")
  const content = rendered
  content.classList.add(cls_popup_content)
  const popup = (
    <div popover="manual" class={cls_popup}>
      {$enter(rise_in)}
      {$leave(sink_out, { flow: true })}
      {content}
    </div>
  ) as HTMLElement

  // Remember who had focus, to give it back on close.
  if (doc.activeElement instanceof HTMLElement) popups_return_focus.set(popup, doc.activeElement)

  // However the future settles — a value from the content, sym_closed from the content (closing it
  // from code) or from a dismissal — the popup goes. A dismissal already took it out of `popups`.
  let settled = false
  fut.then(() => {
    settled = true
    if (popups.has(popup)) _popup_resolve(popup)
  })

  // Figure out if we were created from inside a popup, in which case
  // we do not close the previous pop-ups
  let creator_is_popup = false
  let iter = anchor_el as HTMLElement | null

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
    // Settled before it was even shown (closed right after opening): never show it.
    if (settled) return
    // node_append(anchor.parentElement!, popup_root, anchor.nextSibling)

    const o_arrow_state = o<ArrowState>({ side: "bottom", ax: null, ay: null, visible: true })
    const with_arrow = opts?.arrow ?? anchor instanceof Element
    const arro = with_arrow ? popup_arrow(o_arrow_state) : null
    if (arro) {
      // A sibling of the content, not a child: a scrolling content would clip it. Drawn after the
      // content, so above it.
      node_append(popup, arro)
    }

    node_append(opts?.parent ?? find_parent_node(anchor_el), popup)

    popup.showPopover()
    popup.classList.add("open")

    // Expose the room left next to the anchor; the content is capped to it (cls_popup_content).
    const size_middleware = size({
      apply({ availableWidth, availableHeight }) {
        popup.style.setProperty("--e-popup-max-width", `${Math.max(0, Math.floor(availableWidth))}px`)
        popup.style.setProperty("--e-popup-max-height", `${Math.max(0, Math.floor(availableHeight))}px`)
      },
    })

    // An element anchor picks the side with the most room, among the requested placement and the
    // vertical ones. A point (a context menu) opens below-right of it, like native menus, flipping
    // and shifting to stay on screen.
    const placement_middleware: Middleware[] =
      anchor instanceof Element
        ? [
            autoPlacement({
              allowedPlacements: [
                ...(opts?.placement ? [opts.placement] : []),
                "top",
                "top-start",
                "top-end",
                "bottom",
                "bottom-start",
                "bottom-end",
              ],
            }),
            flip(),
          ]
        : [flip(), shift({ padding: 4 })]

    async function updatePosition() {
      if (arro) arrow_colors_from(content, arro)
      let { x, y, middlewareData, placement } = await computePosition(reference, popup, {
        placement: anchor instanceof Element ? undefined : "bottom-start",
        ...opts,
        middleware: [
          ...placement_middleware,
          size_middleware,
          hide(),
          ...(arro ? [arrow({ element: arro, padding: 8 })] : []),
        ],
      })
      x = Math.round(x)
      y = Math.round(y)

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
        const _arr = `round(var(--arrow-size, 12px) / 2.8284, 1px)`
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
          ax: Math.round(data.x ?? 0),
          ay: Math.round(data.y ?? 0),
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
    const cleanup = autoUpdate(reference, popup, updatePosition)

    fut.finally(() => {
      cleanup()
    })
  })

  return fut
}

export namespace popup {
  /** Alias of {@link sym_closed}. */
  export const closed: typeof sym_closed = sym_closed
}

/**
 * The arrow takes the content's background and border colors, so it reads as part of it whatever
 * surface and border the content chose. A transparent content (no `surface`) gets the page
 * background; a borderless one, a borderless arrow.
 */
function arrow_colors_from(content: HTMLElement, arro: HTMLElement) {
  const cs = getComputedStyle(content)
  const transparent = cs.backgroundColor === "transparent" || cs.backgroundColor === "rgba(0, 0, 0, 0)"
  arro.style.setProperty("--e-arrow-fill", transparent ? "var(--e-color-bg)" : cs.backgroundColor)
  arro.style.setProperty("--e-arrow-border", cs.borderTopWidth === "0px" ? "transparent" : cs.borderTopColor)
}

const cls_popup = css`.popup {
  position: absolute;
  overflow: visible;
  background: transparent;
  /* 30% neutral instead of 20% text — neutral needs a larger mix fraction to read at the same
     visual weight (its own luminance sits closer to bg than text's does). */
  filter: drop-shadow(
    0px 0px 4px ${colors.neutral.from_bg("30%")});
}`
/* The content's size caps: the room left next to the anchor (set by the size middleware), and 80vh. */
const cls_popup_content = css`.popup-content {
  max-height: min(80vh, var(--e-popup-max-height, 80vh));
  max-width: var(--e-popup-max-width, 100vw);
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
  border: 1px solid var(--e-arrow-border, ${colors.neutral.faded});
  transform: rotate(45deg);
  top: calc(-1 * round(var(--arrow-size, 12px) / 2.8284, 1px));
  left: calc(-1 * round(var(--arrow-size, 12px) / 2.8284, 1px));
  transform-origin: center;
  width: calc(round(var(--arrow-size, 12px) / 1.4142, 1px));
  height: calc(round(var(--arrow-size, 12px) / 1.4142, 1px));
  background-color: var(--e-arrow-fill, ${colors.bg});
  ${theme.css_radius("nudge-2")}
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
