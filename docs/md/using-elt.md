---
title: Using elt
order: 2
---

# Using elt

elt is a TypeScript library for building web **applications** (rather than content websites). JSX returns **real DOM nodes**: there is no virtual DOM, no re-rendering, and this is not React. This page explains the ideas behind it; the rules and recipes live in the [elt guide](./elt-guide.md), and each concept has its own page with runnable examples.

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

`ui` is an actual `HTMLDivElement`. Putting `o_name` in the JSX keeps that text in sync with it, `$bind.string` keeps the input in sync both ways, and `$click` is a **decorator**: a function placed among the children rather than a React-style `onClick` prop.

## The ideas, in order

- **Observables hold the state.** An [`Observable`](./observables.md) wraps a value and notifies whoever observes it when the value changes. Observables can be transformed (`.tf`) or combined (`o.expression`) into new observables that follow their sources. Updates are synchronous: when `set` returns, every derived value and every piece of DOM depending on it is already up to date.

- **Observing is tied to the DOM.** An observer kept alive forever leaks memory. elt ties observing to nodes: an observer attached to a node runs only while that node is in the document, and stops on its own when the node leaves. This is why trees are mounted with `node_append` rather than `appendChild` — `node_append` is what runs the connect/disconnect step. See [`$observe`](./decorators.md), and [`$connected` / `$disconnected`](./decorators.md) to run code when a node enters or leaves the document.

- **Verbs mark where the structure changes.** Instead of a component that decides what to render, elt uses **verbs**: functions whose name starts with an uppercase letter — [`If`, `Switch`, `Repeat`, `DisplayPromise`](./verbs.md), and `VirtualScroll` for long lists. Scanning the code for uppercase calls shows every place the DOM's shape can change, and each verb only patches what changed instead of rebuilding.

- **Decorators replace props for behavior.** Functions starting with `$` and a lowercase letter (`$click`, `$bind`, `$observe`, `$class`, …) are [decorators](./decorators.md): they receive the node they're placed in and act on it. This avoids declaring a variable for every node you need to touch, and keeps "creates a node" (uppercase) visibly different from "modifies a node" (`$`).

- **Components are just functions.** A [component](./components.md) is a function returning a node. JSX children go to that node, or to an explicit insertion point (`RefChild`) when the component takes a second argument.

- **An app layer is included.** For multi-screen applications, [`App`](./app.md) provides a router (URL path or URL fragment), services that resolve their dependencies and live as long as they're needed, and named views. It's small enough to ship in the core instead of as yet another package; it's optional for a single widget.

- **Styling and widgets are a separate sub-library.** `css` (scoped class names) is in the core. Theming, layout elements and widgets are in `elt/ui` — see [Using elt/ui](./using-elt-ui.md).

## Why use it

- **You use TypeScript and care about types.** Everything is typed for inference; observables keep their types through transforms and combinations. Use `"strict": true`.
- **You like the observer pattern but not its leaks.** Observing is tied to a node's presence in the document, so there's nothing to unregister by hand.
- **You like manipulating the DOM directly.** Every JSX expression is a real element you can use with plain DOM APIs. The library sticks to web standards wherever it can.
- **You like explicit code.** Observables and verbs show at a glance which parts of the app can change, and every symbol is reachable with "go to definition" — no HTML string templates.
- **You don't want a dependency tree.** The core has no runtime dependencies. `elt/mutative` needs the `mutative` package for `.mutate()`, and `elt/ui`'s popups need `@floating-ui/dom`; both are optional peer dependencies.

## Setup

`tsconfig.json`: `"strict": true`, `"jsx": "react"`, `"jsxFactory": "E"`, `"jsxFragmentFactory": "E.Fragment"`, plus `"experimentalDecorators": true` if you write custom elements with `@attr` (`@view` and `@memoize` work with either decorator style). The package ships TypeScript sources and is meant to be bundled. Import from `"elt"`.

## Where to go next

| Want | Read |
| ---- | ---- |
| The rules and recipes | [elt guide](./elt-guide.md) |
| A one-page summary | [Cheatsheet](./cheatsheet.md) |
| Observables, verbs, decorators, components in depth | [Observables](./observables.md), [Verbs](./verbs.md), [Decorators](./decorators.md), [Components](./components.md) |
| Routing and services | [App](./app.md) |
| Theme, layout, widgets | [Using elt/ui](./using-elt-ui.md), then the [elt/ui guide](./elt-ui-guide.md) |
| A complete running app | `docs/src/app.tsx` — this documentation site is itself an elt app |
| Exact signatures | JSDoc in `src/` |
