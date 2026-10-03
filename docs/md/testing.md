---
title: Testing
order: 90
---

# Testing

This page describes how elt's own tests are written. It is mostly for people changing elt itself (the `tests/` folder is not part of the published package), but the same pattern works for testing an app built with elt.

## The shape of a test

Tests run in a real browser with [Playwright](https://playwright.dev), because elt relies on modern CSS (`@property`, nesting, `:has()`, `oklch()`) and real layout that a simulated DOM gets wrong.

- Test files are `tests/*.pw.ts`. Run them all with `bunx playwright test`, or one file with `bunx playwright test tests/<file>.pw.ts`.
- Each test opens the **harness page**, `/tests/browser/harness.html`. It loads `elt`, `elt/ui` (with its theme and styles) and `elt/editor`, and exposes them on `window.__ELT__`: core exports directly, `elt/ui` exports under `.UI`, `elt/editor` exports under `.Editor`.
- The test body runs inside the page with `page.evaluate(() => { … })` and returns plain data (numbers, strings, objects) that the test then checks with `expect`. Code inside `page.evaluate` can't use JSX or decorator syntax and can't see variables from the test file: build nodes with `document.createElement` (or `window.__ELT__.e`) and pass any input as `page.evaluate`'s second argument.
- Mount with `node_append` (from `window.__ELT__`) when the test depends on elt's lifecycle — observers, `$connected`, verbs. Plain `appendChild` is fine for pure CSS checks.
- The harness turns motion off (`motion_enabled(false)`): removals are instant and nothing enters or leaves, so a removed node is gone when the next line runs. A test about motion turns it back on with `motion_enabled(true)` ([Motion](./motion.md#reduced-motion-and-turning-motion-off)).
- Measure what a user would see: `getComputedStyle(el)` for resolved style values, `getBoundingClientRect()` for positions and sizes.
- To compare against a theme value (a spacing step, a color), let the browser resolve it on a **probe element** rather than hard-coding pixels: set a style to `var(--e-spacing-component)` (or `theme.colors.tint.mid.toString()`) on a throwaway element and read it back.

## Example

```ts
import { expect, test } from "@playwright/test"

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/harness.html")
})

test("two widgets in a padded prose are spaced at the pad's step", async ({ page }) => {
  const r = await page.evaluate(() => {
    // Runs in the page: build the DOM under test
    const prose = document.createElement("e-prose")
    prose.setAttribute("pad", "section")
    const a = document.createElement("e-row")
    const b = document.createElement("e-row")
    a.textContent = b.textContent = "x"
    prose.append(a, b)
    document.body.appendChild(prose)

    // Probe element: the browser resolves the theme's own value for the step
    const probe = document.createElement("div")
    probe.style.height = "var(--e-spacing-section)"
    document.body.appendChild(probe)

    return {
      gap: Math.round(b.getBoundingClientRect().top - a.getBoundingClientRect().bottom),
      section: Math.round(probe.getBoundingClientRect().height),
    }
  })
  expect(r.gap).toBe(r.section)
})
```

## Conventions

- One `test.describe` per behavior, with a comment above it stating the rule being tested and which documentation page owns it.
- A regression test says so in its title or comment, with the wrong behavior it guards against: `"… (regression: the observable itself was passed to setAttribute)"`.
- Factor repeated setup into a helper function in the test file, as the existing files do.
