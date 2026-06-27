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
;(window as typeof window & { SyntaxError: typeof SyntaxError }).SyntaxError =
  globalThis.SyntaxError
