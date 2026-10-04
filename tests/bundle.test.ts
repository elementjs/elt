/// <reference types="bun" />
// Regression: package.json's `sideEffects` decides what a tree-shaking bundler keeps from a module
// that is imported only for its side effects. With src/index.ts left out, Bun dropped the global
// `E` (the JSX factory, set in src/elt.ts, which index.ts re-exports) even with elt.ts listed; with
// ui/ left out, `import "elt/ui"` dropped the theme and every stylesheet. The dev server doesn't
// tree-shake, so neither showed there: only in a production bundle.
import { expect, test } from "bun:test"

test("a production bundle keeps elt's and elt/ui's side effects", async () => {
  const result = await Bun.build({ entrypoints: [`${import.meta.dir}/fixtures/bundle-entry.ts`] })
  expect(result.success).toBe(true)
  const code = await result.outputs[0]!.text()
  expect(code).toContain("globalThis.E = e") // src/elt.ts
  expect(code).toContain(":where(e-flex,e-grid,e-prose") // ui/layout.css.tsx
})
