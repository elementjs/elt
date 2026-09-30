---
title: Using elt
---

# Using elt

Opinionated TypeScript library for building UIs. JSX returns **real DOM nodes**. There is no virtual DOM and this is not React. UI updates come from **observables** and a few **verbs** (`If`, `Repeat`, …). Observing is tied to nodes being in the document: connect starts it, disconnect stops it — so you do not leak observers if you mount and unmount the elt way.

Import from `"elt"`. TypeScript only; the package is meant to be bundled.

tsconfig: `strict`, `jsx: "react"`, `jsxFactory: "E"`, `jsxFragmentFactory: "E.Fragment"`.

This documentation's own pages are runnable examples — see [`visual-test.md`](./visual-test.md), [`object-editor.md`](./object-editor.md). Signatures and edge cases live in JSDoc under `src/`. Agent-oriented companion: [`docs/md/using-elt-agent.md`](./using-elt-agent.md). Doc index: [`docs/md/index.md`](./index.md).

---

## Hello

```tsx
import { o, node_append, $click, $bind } from "elt"

const o_name = o("world")

const ui = <div>
  Hello, {o_name}!
  <input type="text">{$bind.string(o_name)}</input>
  <button>{$click(() => o_name.set("elt"))} Reset</button>
</div>

node_append(document.body, ui)
```

`o_name` in JSX keeps the text in sync. `$bind.string` keeps the input in sync both ways. `$click` is a **decorator**: a function placed among the **children**, not as a React-style prop. It runs when the node is created.

Always mount elt trees with **`node_append`** (and remove with **`node_remove`**). Plain `appendChild` skips the connect/disconnect hooks that drive observance. Verbs and the App layer already use `node_append` internally; you mainly need it for the root of your app.

---

## Observables

`o(value)` creates an observable (or returns the same one if you already passed an observable). Read with `.get()`, write with `.set()`.

Changes propagate **synchronously**: observers, derived observables, and DOM bindings all run before `set` returns. `o.transaction(() => { … })` batches several writes and flushes once at the end (still synchronously).

`set` only notifies when the new value is not `===` to the current one. Mutating an object in place and calling `set` with the same reference does nothing useful — replace the value, or use `.assign(partial)` / `.mutate(fn)` (after `import "elt/mutative"` for mutate).

**Naming convention** (apps, not enforced by the library):

- `o_*` — source state, or any writable observable
- `oo_*` — readonly derived values

### Deriving values

Default tool: **`o.expression`**.

```ts
const oo_label = o.expression(get =>
  `${get(o_first)} ${get(o_last)}`
)
```

Inside the callback, `get(obs)` both reads and subscribes. You also get `old`, `updated`, and `prev` if you want to skip heavy work when only some dependencies changed. Pass a second function to make the expression **writable** (writes can flow back into sources).

Also common:

- `.tf(fn)` — transform (read-only, or `{ transform, revert }` for two-way)
- `.p("key")` / `.p(0)` — focus one field or index (fine for a form binding; prefer `assign` / `mutate` for deep edits in app code)
- `.key(id)` — lookup on a `Map` observable

`o.RO<T>` means “observable or plain `T`”. Use `o.get(x)` when you need the current value once, outside a reactive context.

**In JSX children**, only put renderable things (nodes, strings, numbers, decorators, verbs, or observables of those). Anything else: `.tf(...)` first.

For side effects while a node is on screen, use `$observe(obs, cb)` rather than raw `addObserver`.

---

## Components and children

A component is a function that returns a real node:

```tsx
function Box(attrs: Attrs<HTMLDivElement> & { title: string }) {
  return <div class="box"><h3>{attrs.title}</h3></div> as HTMLDivElement
}
```

TypeScript types JSX as `Element`; cast when you need a concrete type. `e()` / `E()` do not need that cast.

There is **no** React-style `children` prop.

- **One argument** — JSX children are appended on the **root** node the function returns.
- **Two arguments** `(attrs, ref)` — children go to a **`RefChild`** marker you place in the tree:

```tsx
function Row(_attrs: Attrs<HTMLDivElement>, ref: RefChild) {
  return <div><span>label</span>{ref}</div> as HTMLDivElement
}
```

If the body should exist only when the caller passed children, use `ref.IfChildren(r => <div class="body">{r}</div>)`. Do not mix bare `{ref}` and `IfChildren` in the same component.

Global attributes on the call site (`id`, `class`, `style`, `title`, …) are applied to the component **root** automatically. Your own props are whatever you read from `attrs`.

`class` and `style` understand observables, e.g. `class={{ active: o_on }}`.

SVG works like HTML: write normal `<svg>…</svg>`.

---

## Verbs

Uppercased helpers that insert **dynamic** regions. They are not normal elements; observables feed them.

```tsx
{If(o_user, u => <span>{u.tf(x => x.name)}</span>)
  .Else(() => <span>guest</span>)}

{Switch(o_tab)
  .Case("a", () => <PanelA/>)
  .Case("b", () => <PanelB/>)}

{Repeat(o_items, (item, idx) =>
  <li>{item.tf(i => i.label)}</li>
)}

{DisplayPromise(o_load)
  .WhileWaiting(() => <span>loading…</span>)
  .WhenResolved(o_data => <View data={o_data}/>)
  .UponRejection(o_err => <span>failed</span>)}
```

Prefer `DisplayPromise` whenever you care about loading or error UI. A bare promise in JSX is a weak substitute.

---

## CSS

```ts
const cls_row = css`.row {
  display: flex;
  gap: 0.5rem;
}`
```

`css` returns a scoped class name. Convention: store it in `cls_*`. Keep styles at module top level unless they are shared.

---

## App (multi-screen)

For a small widget you only need `node_append` and the pieces above. For a full app, elt ships a thin **App / Service / router** layer (routes in the URL fragment by default, or in the URL path with `setupRouter(defs, { mode: "path", base: "/prefix" })`). Live shape: `docs/src/app.tsx`, `docs/src/routes.ts` (this documentation site is itself one such app).

Sketch:

1. `const app = new App()`
2. `app.setupRouter({ home: ["/home", () => import("./home")], init: ["", () => import("./init")] })`
3. `node_append(document.body, app.DisplayView("Main"))`, then `app.router.activateFromUrl()` (often after mount)
4. Screens are services — typically `class Home extends Service({ base: import("./base") })` with `@view` methods that register named views (`Main`, `Content`, …)
5. Compose with `app.DisplayView("Content")` inside another view
6. **Always `await`** `route.activate()` — activation can be interrupted (e.g. redirect to login)

**Params:** `srv.param("id")` ties the value to service lifetime (change → re-activation). `srv.param_soft("q")` is an observable slice of the URL that can update without rebuilding the service.

Empty hash maps to path `""`. Register the landing route with that path. Path `"/"` is `#/`, not a bare empty hash.

Shared state usually lives on a store service; other services declare it in `Service({ … })` or `require` it and derive `oo_*` locally.

---

## Things that bite once

- Mount with `node_append`, not `appendChild`, or observance never starts.
- Fragments (`<>…</>`) are not real nodes: no connect/disconnect lifecycle on the fragment itself. Prefer a real element as the root of anything that observes.
- Because updates are synchronous, schedule coherent UI updates (and use `o.transaction` when several sources change together). If you measure layout (`getBoundingClientRect`, `scrollTop`) while also writing DOM driven by observables, do not interleave measure and write in a tight loop — read, compute, write once, then continue on later frames. Long lists: see `VirtualScroll` in `src/virtual.ts` and its tests; ordinary `Repeat` does not need that machinery.

---

## Where to go next

| Want | Look at |
| ---- | ------- |
| End-to-end UI | `docs/src/app.tsx` |
| Observable / Repeat / App behavior | `tests/` |
| Widgets and theme | `elt/ui` — [`ui/AGENTS.md`](../../ui/AGENTS.md), [`docs/md/using-elt-ui-agent.md`](./using-elt-ui-agent.md), [`docs/md/using-elt-ui.md`](./using-elt-ui.md) |
| Exact APIs | JSDoc in `src/` (`observable.ts`, `verbs.ts`, `decorators.ts`, `app/`) |
| Checklist-style reference | [`docs/md/using-elt-agent.md`](./using-elt-agent.md) |
