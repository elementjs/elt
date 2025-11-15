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
  DEBUG: false, // Set DEBUG flag for tests
})
