// Real-browser test harness (tests/browser/harness.html is the served entry point). Playwright
// tests navigate here, then reach into `window.__ELT__` from `page.evaluate` to exercise the
// actual library code in a real browser — replacing happy-dom, which couldn't correctly parse
// several modern CSS constructs this codebase relies on (`@property`, nested `&`, `oklch()`,
// nested `:has()` through `:is()` — the old tests/setup.ts happy-dom shim needed workarounds for
// all of these and has since been removed.
import * as Elt from "elt"
// Adds `.mutate()` to observables
import "elt/mutative"
import * as Editor from "elt/editor"
import * as UI from "elt/ui"

// Editor-internal modules not re-exported by elt/editor's own public index, but needed directly by
// tests that predate this harness and reached for them via a relative import.
import * as EditorCompositeToolbar from "../../editor/composite-toolbar"
import * as EditorMount from "../../editor/mount"
import * as EditorTypeChange from "../../editor/type-change"
// The docs site's code block, for its lazily run examples.
import * as Docs from "../../docs/src/code-example"

// Helpers for the tests themselves, not part of elt.
const helpers = {
  /** Resolves after `n` animation frames. */
  async frames(n = 1): Promise<void> {
    for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r))
  },
  /** A promise, with the functions that settle it. */
  deferred<T = void>() {
    let resolve!: (v: T) => void
    let reject!: (e?: unknown) => void
    const promise = new Promise<T>((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  },
}

declare global {
  interface Window {
    __ELT__: typeof Elt &
      typeof helpers & {
        UI: typeof UI
        Editor: typeof Editor & typeof EditorCompositeToolbar & typeof EditorMount & typeof EditorTypeChange
        Docs: typeof Docs
      }
  }
}

window.__ELT__ = {
  ...Elt,
  ...helpers,
  UI,
  Editor: { ...Editor, ...EditorCompositeToolbar, ...EditorMount, ...EditorTypeChange },
  Docs,
}

// Enter and leave motions would keep removed nodes in the page for a while : tests expect removals to
// be instant unless they test motion, and turn it back on themselves (motion_enabled(true)).
Elt.motion_enabled(false)
