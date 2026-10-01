/** @internal */
export const FRAGMENT_NEEDS_PATH_MODE = `the "fragment" option requires the router mode: "path"`

/** How long to wait for a fragment target that is not in the DOM yet (lazy views render after activation) */
const FRAGMENT_TIMEOUT_MS = 2000

/** Events that mean the user took over scrolling : stop looking for the target */
const USER_SCROLL_EVENTS = ["wheel", "touchstart", "mousedown", "keydown"] as const

/** The URL form of a fragment name : `#` followed by the percent-encoded name, or "" for an empty name */
export function _fragmentToHash(fragment: string) {
  return fragment === "" ? "" : `#${encodeURIComponent(fragment)}`
}

/** The name a raw (percent-encoded) fragment designates. A malformed encoding is taken literally, as browsers do. */
export function _decodeFragment(raw: string) {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

/** The element an HTML fragment designates : the element with that `id`, else an `<a name>` */
function _findTarget(name: string): Element | null {
  const by_id = document.getElementById(name)
  if (by_id != null) return by_id
  for (const el of document.getElementsByName(name)) if (el instanceof HTMLAnchorElement) return el
  return null
}

/**
 * @internal
 * Scroll to the element designated by `name`, like a browser does for `#name` links.
 * If it is not in the DOM yet, wait for it to appear until a timeout, or until the user scrolls.
 * An empty name does nothing ; `top` goes to the top of the page unless an element has that id.
 * @returns a function that stops the search
 */
export function _scrollToFragment(name: string): () => void {
  if (name === "") return () => {}

  let stop = () => {}
  let stopped = false
  let frame = 0

  // one animation frame first : the views of the activation may not be laid out yet
  frame = requestAnimationFrame(() => {
    const scrollIfFound = () => {
      const target = _findTarget(name)
      if (target == null) return false
      target.scrollIntoView()
      return true
    }
    if (stopped || scrollIfFound()) return
    if (name.toLowerCase() === "top") return window.scrollTo(0, 0)

    // the target is not there : look again whenever the DOM gets a new element or a new id / name
    const observer = new MutationObserver(() => {
      if (scrollIfFound()) cleanup()
    })
    const timeout = setTimeout(() => cleanup(), FRAGMENT_TIMEOUT_MS)
    const cleanup = () => {
      stopped = true
      observer.disconnect()
      clearTimeout(timeout)
      for (const ev of USER_SCROLL_EVENTS) window.removeEventListener(ev, cleanup, { capture: true })
    }
    observer.observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["id", "name"] })
    for (const ev of USER_SCROLL_EVENTS) window.addEventListener(ev, cleanup, { passive: true, capture: true })
    stop = cleanup
  })

  // cancelled before the frame fired, or after the observer was set up
  return () => {
    stopped = true
    cancelAnimationFrame(frame)
    stop()
  }
}
