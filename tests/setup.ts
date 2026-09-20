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
  HTMLDialogElement: window.HTMLDialogElement,
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

// ui/popup.tsx uses Popover API + Element.animate(); happy-dom lacks both.
if (typeof window.HTMLElement.prototype.showPopover !== "function") {
  window.HTMLElement.prototype.showPopover = function (this: HTMLElement) {
    this.toggleAttribute("data-popover-open", true)
  }
  window.HTMLElement.prototype.hidePopover = function (this: HTMLElement) {
    this.toggleAttribute("data-popover-open", false)
  }
}
if (typeof window.Element.prototype.animate !== "function") {
  window.Element.prototype.animate = function (this: Element) {
    void this
    const anim = {
      finished: Promise.resolve(),
      cancel() {},
      addEventListener(_type: string, fn: EventListener) {
        queueMicrotask(() => fn(new Event(_type)))
      },
    }
    return anim as Animation
  }
}
if (typeof window.Element.prototype.getAnimations !== "function") {
  window.Element.prototype.getAnimations = function (this: Element) {
    void this
    return []
  }
}

// happy-dom's CSSParser doesn't implement CSS cascade layers at all:
// - a bare layer-order statement like `@layer reset, base, theme;` has no
//   `{ }` block, so the parser (which only finds rules by scanning for
//   `{`/`}`) sees zero rules and CSSStyleSheet.insertRule throws.
// - `@layer name { ... }` blocks fall through the parser's at-rule switch
//   to its "unknown rule" default, which never adds the rule to the
//   returned list, so insertRule throws there too.
// Layer membership is never asserted on in tests, so: replace bare
// layer-order statements with an equally-inert empty rule (CSSBuilder tracks
// its next insertion index by counting one call = one rule, so silently
// inserting nothing here would desync it from real cssRules.length on the
// next insertRule call), and rewrite layer blocks to `@media all { ... }`
// (a form the parser does support) to keep their nested rules testable.
const LAYER_STATEMENT = /^@layer\s+[^{}]+;$/
const LAYER_BLOCK = /^@layer\s+[\w-]+\s*\{/
const real_insertRule = window.CSSStyleSheet.prototype.insertRule
window.CSSStyleSheet.prototype.insertRule = function (
  this: CSSStyleSheet,
  rule: string,
  index?: number,
) {
  const trimmed = rule.trim()
  if (LAYER_STATEMENT.test(trimmed)) return real_insertRule.call(this, "@media all {}", index)
  if (LAYER_BLOCK.test(trimmed)) {
    const rewritten = trimmed.replace(LAYER_BLOCK, "@media all {")
    return real_insertRule.call(this, rewritten, index)
  }
  return real_insertRule.call(this, rule, index)
}
