// Real-browser test harness (tests/browser/harness.html is the served entry point). Playwright
// tests navigate here, then reach into `window.__ELT__` from `page.evaluate` to exercise the
// actual library code in a real browser — replacing happy-dom, which couldn't correctly parse
// several modern CSS constructs this codebase relies on (`@property`, nested `&`, `oklch()`,
// nested `:has()` through `:is()` — the old tests/setup.ts happy-dom shim needed workarounds for
// all of these and has since been removed.
import * as Elt from "elt"
import * as Editor from "elt/editor"
import * as UI from "elt/ui"

// Editor-internal modules not re-exported by elt/editor's own public index, but needed directly by
// tests that predate this harness and reached for them via a relative import.
import * as EditorCompositeToolbar from "../../editor/composite-toolbar"
import * as EditorMount from "../../editor/mount"
import * as EditorTypeChange from "../../editor/type-change"
// The docs site's code block, for its lazily run examples.
import * as Docs from "../../docs/src/code-example"

declare global {
  interface Window {
    __ELT__: typeof Elt & {
      UI: typeof UI
      Editor: typeof Editor & typeof EditorCompositeToolbar & typeof EditorMount & typeof EditorTypeChange
      Docs: typeof Docs
    }
  }
}

window.__ELT__ = {
  ...Elt,
  UI,
  Editor: { ...Editor, ...EditorCompositeToolbar, ...EditorMount, ...EditorTypeChange },
  Docs,
}

// Enter and leave motions would keep removed nodes in the page for a while : tests expect removals to
// be instant unless they test motion, and turn it back on themselves (motion_enabled(true)).
Elt.motion_enabled(false)
