import { Window } from "happy-dom"

// Create and register DOM globals
const window = new Window()
const document = window.document

// Register DOM globals
Object.assign(globalThis, {
  window,
  document,
  Node: window.Node,
  Element: window.Element,
  Comment: window.Comment,
  Document: window.Document,
  DocumentFragment: window.DocumentFragment,
  Text: window.Text,
  HTMLElement: window.HTMLElement,
  HTMLInputElement: window.HTMLInputElement,
  HTMLButtonElement: window.HTMLButtonElement,
  CSSStyleSheet: window.CSSStyleSheet,
  customElements: window.customElements,
  CustomEvent: window.CustomEvent,
  Event: window.Event,
  EventTarget: window.EventTarget,
  requestAnimationFrame: window.requestAnimationFrame,
  cancelAnimationFrame: window.cancelAnimationFrame,
  getComputedStyle: window.getComputedStyle.bind(window),
  ResizeObserver: window.ResizeObserver,
  DEBUG: false, // Set DEBUG flag for tests
})

// happy-dom querySelector uses window.SyntaxError for invalid selectors
;(window as typeof window & { SyntaxError: typeof SyntaxError }).SyntaxError = globalThis.SyntaxError

// ui/theme.tsx normalizes each theme color by setting `color: oklch(from
// var(--color) l c h)` on a scratch element and reading back the browser's
// resolved oklch() triple from getComputedStyle -- real relative-color-syntax
// resolution, which happy-dom doesn't implement (its getComputedStyle leaves
// `color` unresolved/empty here). Without this, Theme's constructor throws on
// module load, which blocks testing ANY ui/* code, since most of ui/ imports
// theme.tsx. The exact resulting color is never asserted on in tests, so a
// fixed placeholder oklch() triple is enough to let module init proceed.
const real_getComputedStyle = window.getComputedStyle.bind(window)
function patched_getComputedStyle(el: unknown) {
  const cs = real_getComputedStyle(el as Parameters<typeof window.getComputedStyle>[0])
  // happy-dom's CSSStyleDeclaration rejects `oklch(from var(--x) l c h)`
  // outright (doesn't even store it, so `.color` reads back empty) --
  // detect getOkLch's scratch element by the `--color` custom property it
  // sets instead of by the (unparseable, here) `color` value itself.
  const style = (el as HTMLElement).style
  if (style?.getPropertyValue("--color")) {
    return new Proxy(cs, {
      get(target, prop, receiver) {
        if (prop === "color") return "oklch(0.5 0.1 180)"
        return Reflect.get(target, prop, receiver)
      },
    })
  }
  return cs
}
Object.assign(globalThis, { getComputedStyle: patched_getComputedStyle })
