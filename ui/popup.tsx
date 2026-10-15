/////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////
/**
 * Some popup handling.
 */

import { $connected, $enter, $leave, css, Future, o, show } from "elt"
import { rise_in, sink_out } from "./motion"
import { theme } from "./theme"
const colors = theme.colors

import {
  arrow,
  autoPlacement,
  autoUpdate,
  computePosition,
  flip,
  hide,
  type Middleware,
  type Placement,
  shift,
  size,
} from "@floating-ui/dom"

const popups = new Set<Element>()
const popups_futures = new WeakMap<Element, Future<any>>()
/** What had focus when each popup opened, given it back when the popup closes. */
const popups_return_focus = new WeakMap<Element, HTMLElement>()
/** The document whose click and keydown listeners are installed: set while at least one popup is open. */
let listening_doc: Document | null = null

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
  popups_futures.get(p)?.resolve(undefined)
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
  // Its future ended: `show` removes it, and its $leave plays the exit.
  _stop_listening_if_none()
}

/**
 * Escape closes the innermost popup only (the last opened), like one level of a native menu. The
 * event is stopped only when it closed one: otherwise it goes on to a surrounding dialog or keymap.
 */
function _close_popups_keydown(ev: KeyboardEvent) {
  if (ev.key !== "Escape") return
  const innermost = [...popups].pop()
  if (innermost == null) return
  _popup_resolve(innermost)
  ev.preventDefault()
  ev.stopPropagation()
  ev.stopImmediatePropagation()
}

function _close_popups() {
  for (const p of popups) _popup_resolve(p)
}

/** Listen for dismissals (click outside, Escape) on `doc`, unless already listening. */
function _listen(doc: Document) {
  if (listening_doc != null) return
  listening_doc = doc
  doc.addEventListener("click", _eval_popup_click, { capture: true })
  doc.addEventListener("keydown", _close_popups_keydown, { capture: true })
}

/** Called each time a popup goes: the last one gone, the listeners go too (from the document they were added on). */
function _stop_listening_if_none() {
  if (popups.size > 0 || listening_doc == null) return
  listening_doc.removeEventListener("click", _eval_popup_click, { capture: true })
  listening_doc.removeEventListener("keydown", _close_popups_keydown, { capture: true })
  listening_doc = null
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
export type PopupAnchor = Element | { x: number; y: number; element: Element } | PointerInElement

/**
 * A pointer inside an element (a right click on a table cell): the popup opens against the element's
 * border, the nearest to `y` first (above for the upper half, below for the lower), with its start and
 * its arrow at `x`; and flips to the other border when that one has no room.
 */
export interface PointerInElement {
  within: Element
  x: number
  y: number
}

export interface PopupOptions {
  /**
   * With an element anchor, one more side the popup may open on besides above and below it; the
   * side with the most room wins. With a point anchor, where the popup opens (default `"bottom-start"`).
   */
  placement?: Placement
  /**
   * With an element anchor and a `placement`: open on exactly that side (flipped to the opposite side
   * when it has no room, and slid along the anchor's edge to stay on screen) instead of the side with
   * the most room. A submenu needs it: above or below its item, it would cover the menu it came from.
   */
  exact_placement?: boolean
  /** Where to attach the popup; by default the nearest open popup or dialog around the anchor, or the body. */
  parent?: Element | null
  /** Draw the arrow pointing at the anchor. Default: `true` with an element anchor, `false` with a point. */
  arrow?: boolean
  /**
   * Size limits of the content, for this popup only: a number is px, a string any CSS length. They
   * win over the theme's `popupMinWidth`, `popupMaxWidth` and `popupMaxHeight`; the content is
   * still capped to the room next to the anchor.
   */
  min_width?: number | string
  max_width?: number | string
  max_height?: number | string
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
      else style.right = `calc(-1 * var(--arrow-size, 12px) / 2)`
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
 * What a popup or a dialog can resolve with: any value but `undefined`, which is reserved for "closed
 * with no result" (dismissed, or cancelled by the content).
 */
export type OverlayResult = NonNullable<unknown> | null

/**
 * Open a popup next to `anchor` and return a `Future` resolved by `fut.resolve(value)` from the
 * content, or with `undefined` when it closes with no result: the user dismissed it (click outside,
 * `Escape`), or the content called `fut.resolve(undefined)` (a Cancel button, say). An affirmative answer is
 * always an explicit value, `T` being `boolean` unless given.
 *
 * The element `render` returns is drawn as given — its own `border`, `surface`, `scroll` and padding;
 * the popup only adds placement, a drop shadow, the animation, dismissal and the arrow, whose colors
 * follow the element's background and border. The space available next to the anchor is exposed as
 * `--e-popup-room-height` / `--e-popup-room-width`, and the element is capped to it and to the
 * theme's `popupMaxWidth` / `popupMaxHeight` (`100vw`, `80vh`; `PopupOptions` overrides them for one
 * popup): give it `scroll` when its content can be taller. `popupMinWidth` is its minimum width.
 */
export function popup<T extends OverlayResult = boolean>(
  anchor: PopupAnchor,
  render: (fut: Future<T | undefined>) => Node,
  opts?: PopupOptions,
) {
  const within = anchor instanceof Element || !("within" in anchor) ? null : anchor
  const anchor_el = anchor instanceof Element ? anchor : "within" in anchor ? anchor.within : anchor.element
  // Read once: where the pointer is in the element when the popup opens.
  const within_box = within?.within.getBoundingClientRect()
  // A point becomes a Floating UI "virtual element": a zero-size rect at the point. A pointer inside an
  // element, one as tall as the element at the pointer's x (kept at the same distance from the element's
  // left edge as it moves): the popup goes above or below the element, not over it.
  const reference =
    within && within_box
      ? {
          getBoundingClientRect: () => {
            const r = within.within.getBoundingClientRect()
            return new DOMRect(r.left + within.x - within_box.left, r.top, 0, r.height)
          },
          contextElement: anchor_el,
        }
      : anchor instanceof Element
        ? anchor
        : { getBoundingClientRect: () => new DOMRect(anchor.x, anchor.y, 0, 0), contextElement: anchor_el }
  // Where a point or a pointer opens: below-right of a point, like a native menu; on the side of the
  // element nearest to the pointer first.
  const point_placement: Placement =
    within && within_box && within.y < within_box.top + within_box.height / 2 ? "top-start" : "bottom-start"
  const doc = anchor_el.ownerDocument
  const fut = new Future<T | undefined>()
  const rendered = render(fut)
  // Typed Node because that is what JSX gives; the popup needs one element to cap and color from.
  if (!(rendered instanceof HTMLElement)) throw new Error("popup(): render must return a single HTML element")
  const content = rendered
  content.classList.add(cls_popup_content)
  // Per-popup size limits go on the content itself, where cls_popup_content reads them.
  for (const [token, value] of [
    ["min-width", opts?.min_width],
    ["max-width", opts?.max_width],
    ["max-height", opts?.max_height],
  ] as const) {
    if (value != null) content.style.setProperty(`--e-popup-${token}`, typeof value === "number" ? `${value}px` : value)
  }

  const o_arrow_state = o<ArrowState>({ side: "bottom", ax: null, ay: null, visible: true })
  const with_arrow = opts?.arrow ?? (anchor instanceof Element || within != null)
  const arro = with_arrow ? popup_arrow(o_arrow_state) : null

  const popup = (
    <div popover="manual" class={cls_popup}>
      {$enter(rise_in)}
      {$leave(sink_out, { flow: true })}
      {content}
      {/* A sibling of the content, not a child: a scrolling content would clip it. Drawn after the
          content, so above it. */}
      {arro}
      {$connected(open)}
    </div>
  ) as HTMLElement

  // Remember who had focus, to give it back on close.
  if (doc.activeElement instanceof HTMLElement) popups_return_focus.set(popup, doc.activeElement)

  // However the future settles — a value from the content, undefined from the content (closing it
  // from code) or from a dismissal, or a rejection — the popup goes. A dismissal already took it out
  // of `popups`. Handling both outcomes also keeps this derived promise from rejecting unhandled: the
  // rejection is for whoever awaits the future.
  let settled = false
  const on_settled = () => {
    settled = true
    if (popups.has(popup)) _popup_resolve(popup)
  }
  fut.then(on_settled, on_settled)

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

  // Once the popup is in the page: shown in the top layer, then placed next to its anchor.
  function open() {
    popup.showPopover()
    popup.classList.add("open")
    // Read once per open, now that the content is connected: not on each repositioning.
    const frame = arro ? read_frame(content) : null

    // Expose the room left next to the anchor; the content is capped to it (cls_popup_content).
    const size_middleware = size({
      apply({ availableWidth, availableHeight }) {
        popup.style.setProperty("--e-popup-room-width", `${Math.max(0, Math.floor(availableWidth))}px`)
        popup.style.setProperty("--e-popup-room-height", `${Math.max(0, Math.floor(availableHeight))}px`)
      },
    })

    // An element anchor picks the side with the most room, among the requested placement and the
    // vertical ones. A point (a context menu) opens below-right of it, like native menus, flipping
    // and shifting to stay on screen.
    const placement_middleware: Middleware[] =
      anchor instanceof Element && !opts?.exact_placement
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
        : [flip(), shift({ padding: 4, crossAxis: within != null })]

    async function updatePosition() {
      let { x, y, middlewareData, placement } = await computePosition(reference, popup, {
        placement: within
          ? point_placement
          : (opts?.placement ?? (anchor instanceof Element ? undefined : point_placement)),
        middleware: [
          ...placement_middleware,
          size_middleware,
          hide(),
          ...(arro && frame ? [arrow({ element: arro, padding: frame.arrow_padding })] : []),
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

      if (arro && frame && middlewareData.arrow) {
        const side = popup_placement_to_arrow_placement(placement)
        apply_frame(arro, frame, side)
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

    // The element the popup comes from stays marked while it is open (a point has none).
    const source = anchor instanceof Element ? anchor : (within?.within ?? null)
    if (source) {
      const unmark = mark_source(source)
      fut.then(unmark, unmark)
    }

    _listen(doc)
    popups.add(popup)
    popups_futures.set(popup, fut)
    const cleanup = autoUpdate(reference, popup, updatePosition)
    // Both outcomes: `finally` would make a promise that rejects unhandled when the future is rejected.
    fut.then(cleanup, cleanup)
  }

  setTimeout(() => {
    // Settled before it was even shown (closed right after opening): never show it.
    if (settled) return
    try {
      // Opening and closing are updates of `show`: the popup plays its $enter / $leave, and goes when its
      // future ends. The content already got `fut`, so the two futures end together.
      show<T | undefined>(opts?.parent ?? find_parent_node(anchor_el), (shown) => {
        fut.then(shown.resolve, shown.reject)
        shown.then(fut.resolve, fut.reject)
        return popup
      })
    } catch (e) {
      // The parent is not in the page.
      fut.reject(e)
    }
  })

  return fut
}

// How many open popups come from each element: the `e-source` mark stays until the last one closes.
const sources = new WeakMap<Element, number>()

/** Marks `el` as the source of an open popup (`e-source`, drawn in ui/states.css.tsx); returns what unmarks it. */
function mark_source(el: Element) {
  sources.set(el, (sources.get(el) ?? 0) + 1)
  el.setAttribute("e-source", "")
  let done = false
  return () => {
    if (done) return
    done = true
    const n = (sources.get(el) ?? 1) - 1
    sources.set(el, n)
    if (n === 0) el.removeAttribute("e-source")
  }
}

/** What the arrow takes from the content's frame: see `read_frame`. */
interface Frame {
  fill: string
  /** Per popup edge: width and color of the content's border there (the edge the arrow sits on). */
  borders: Record<ArrowPlacement, { width: string; color: string }>
  /** Least distance between the arrow and the content's ends, so it never sits on a rounded corner. */
  arrow_padding: number
}

const frame_edges: ArrowPlacement[] = ["top", "bottom", "left", "right"]

/**
 * The arrow prolongs the content's frame: it takes the background, and the border width and color
 * of the edge it sits on, so it reads as part of the content whatever surface and border the
 * content chose. A transparent content (no `surface`) gets the page background; an edge with no
 * border, an arrow with no stroke. The arrow keeps away from the ends of the edge by the largest
 * corner radius, so its base never lands on a curved corner.
 */
function read_frame(content: HTMLElement): Frame {
  const cs = getComputedStyle(content)
  const transparent = cs.backgroundColor === "transparent" || cs.backgroundColor === "rgba(0, 0, 0, 0)"
  const borders = {} as Frame["borders"]
  for (const side of frame_edges) {
    const width = cs.getPropertyValue(`border-${side}-width`)
    const none = width === "0px" || cs.getPropertyValue(`border-${side}-style`) === "none"
    borders[side] = {
      width: none ? "0px" : width,
      color: none ? "transparent" : cs.getPropertyValue(`border-${side}-color`),
    }
  }
  const radius = Math.max(
    ...["top-left", "top-right", "bottom-left", "bottom-right"].map(
      (c) => parseFloat(cs.getPropertyValue(`border-${c}-radius`)) || 0,
    ),
  )
  // Half the arrow's base is `arrow-size / 2` (12px by default); read it where the arrow lives.
  const arrow_size = parseFloat(cs.getPropertyValue("--e-arrow-size")) || 12
  return {
    fill: transparent ? "var(--e-color-bg)" : cs.backgroundColor,
    borders,
    arrow_padding: Math.max(8, radius + arrow_size / 2),
  }
}

/** Dress the arrow like the edge of the frame it sits on (`side`). */
function apply_frame(arro: HTMLElement, frame: Frame, side: ArrowPlacement) {
  const b = frame.borders[side]
  arro.style.setProperty("--e-arrow-fill", frame.fill)
  arro.style.setProperty("--e-arrow-border", b.color)
  arro.style.setProperty("--e-arrow-border-width", b.width)
}

const cls_popup = css`.popup {
  position: absolute;
  overflow: visible;
  background: transparent;
  ${theme.css_overlay_shadow_color}
  /* A filter and not a box-shadow so that the arrow casts its own: the shadow follows the outline of the
     body and the arrow together. */
  filter: ${theme
    .overlay_shadow_layers("popup")
    .map((l) => `drop-shadow(${l.join(" ")})`)
    .join(" ")};
}`
/* The content's size: the theme's limits (or the popup's own, set on the element), within the room
   left next to the anchor (set by the size middleware on the popup). */
const cls_popup_content = css`.popup-content {
  min-width: ${theme.settings.popupMinWidth};
  max-height: min(${theme.settings.popupMaxHeight}, var(--e-popup-room-height, 100vh));
  max-width: min(${theme.settings.popupMaxWidth}, var(--e-popup-room-width, 100vw));
}`

const cls_arrow_inner = css`.arrow-inner {
  position: absolute;
  border: var(--e-arrow-border-width, 1px) solid var(--e-arrow-border, ${colors.neutral.faded});
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
      translateY(calc(var(--arrow-size, 12px) / 2 + var(--e-arrow-border-width, 1px)));
  }
  &[data-placement="bottom"] {
    transform:
      translateX(calc(var(--arrow-size, 12px) / 2))
      translateY(calc(-1 * var(--e-arrow-border-width, 1px)))
      ;
  }
  &[data-placement="left"] {
    transform:
      translateX(calc(var(--arrow-size, 12px) / 2 + var(--e-arrow-border-width, 1px)))
      translateY(calc(var(--arrow-size, 12px) / 2));
  }
  &[data-placement="right"] {
    transform:
      translateX(calc(-1 * var(--e-arrow-border-width, 1px)))
      translateY(calc(var(--arrow-size, 12px) / 2));
  }
}`

const cls_outer_arrow = css`.outer-arrow {
  --arrow-size: var(--e-arrow-size, 12px);
  position: absolute;
  pointer-events: none;
  /* Clips the diamond to its outer half, plus the width of the frame's border on the content's side:
     there the arrow's fill covers the frame's border, which is how the border runs into the arrow's
     two slanted edges with no line across its base. */
  --e-arrow-bleed: var(--e-arrow-border-width, 1px);
  width: var(--arrow-size);
  height: calc(var(--arrow-size) * 0.5);
  background-color: transparent;
  &.top { clip-path: inset(0 0 calc(-1 * var(--e-arrow-bleed)) 0); }
  &.bottom { clip-path: inset(calc(-1 * var(--e-arrow-bleed)) 0 0 0); }
  &.left { clip-path: inset(0 calc(-1 * var(--e-arrow-bleed)) 0 0); }
  &.right { clip-path: inset(0 0 0 calc(-1 * var(--e-arrow-bleed))); }

  &.right, &.left {
    width: calc(var(--arrow-size) * 0.5);
    height: var(--arrow-size);
  }
}`
