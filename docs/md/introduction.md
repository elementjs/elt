---
title: Introduction
section: Start
order: 1
---

# Introduction

elt is a TypeScript library for building web **applications** (rather than content websites). JSX returns **real DOM nodes**: there is no virtual DOM, no re-rendering, and this is not React. `elt/ui` is its optional sub-library for theme, layout and widgets.

This page explains the ideas behind both. The binding rules are on two short pages, [elt rules](./elt-rules.md) and [elt/ui rules](./elt-ui-rules.md); each concept then has its own page with runnable examples.

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

- **Observables hold the state.** An [`Observable`](./observables.md#creating-and-reading) wraps a value and notifies whoever observes it when the value changes (other libraries call this a signal). Observables can be transformed (`.tf`) or combined (`o.expression`) into new observables that follow their sources. Updates are synchronous: when `set` returns, every derived value and every piece of DOM depending on it is already up to date.

- **Observing is tied to the DOM.** An observer kept alive forever leaks memory. elt ties observing to nodes: an observer attached to a node runs only while that node is in the document, and stops on its own when the node leaves. This is why trees are mounted with `node_append` rather than `appendChild`: `node_append` is what runs the connect/disconnect step. See [`$observe`](./decorators.md#reflecting-values-observe-class-style-id-title), and [`$connected` / `$disconnected`](./decorators.md#lifecycle-connected-disconnected) to run code when a node enters or leaves the document.

- **Verbs mark where the structure changes.** Instead of a component that decides what to render, elt uses **verbs**: functions whose name starts with an uppercase letter — [`If`, `Switch`, `Repeat`, `DisplayPromise`](./verbs.md), and [`RepeatVirtual`](./verbs.md#repeatvirtual-a-long-list) for long lists. Scanning the code for uppercase calls shows every place the DOM's shape can change, and each verb only patches what changed instead of rebuilding.

- **Decorators replace props for behavior.** Functions starting with `$` and a lowercase letter (`$click`, `$bind`, `$observe`, `$class`, …) are [decorators](./decorators.md#anatomy-of-a-decorator): they receive the node they're placed in and act on it. This avoids declaring a variable for every node you need to touch, and keeps "creates a node" (uppercase) visibly different from "modifies a node" (`$`).

- **Components are just functions.** A [component](./components.md#one-arg-vs-two-arg) is a function returning a node. JSX children go to that node, or to an explicit insertion point (`RefChild`) when the component takes a second argument.

- **An app layer is included.** For multi-screen applications, [`App`](./app.md) provides a router (URL path or URL fragment), services that resolve their dependencies and live as long as they're needed, and named views. It's small enough to ship in the core instead of as yet another package; it's optional for a single widget.

- **Styling and widgets are a separate sub-library.** [`css`](./css.md) (scoped class names) is in the core. Theming, layout elements and widgets are in `elt/ui` (see [elt/ui](#eltui) below).

## Why use it

- **You use TypeScript and care about types.** Everything is typed for inference; observables keep their types through transforms and combinations. Use `"strict": true`.
- **You like the observer pattern but not its leaks.** Observing is tied to a node's presence in the document, so there's nothing to unregister by hand.
- **You like manipulating the DOM directly.** Every JSX expression is a real element you can use with plain DOM APIs. The library sticks to web standards wherever it can.
- **You like explicit code.** Observables and verbs show at a glance which parts of the app can change, and every symbol is reachable with "go to definition" — no HTML string templates.
- **You don't want a dependency tree.** The core has no runtime dependencies. `elt/mutative` needs the `mutative` package for `.mutate()`, and `elt/ui`'s popups need `@floating-ui/dom`; both are optional peer dependencies.

## Setup

`tsconfig.json`:

- `"strict": true`
- `"jsx": "react"`
- `"jsxFactory": "E"`
- `"jsxFragmentFactory": "E.Fragment"`
- `"experimentalDecorators": true` if you write custom elements with `@attr`. `@view` and `@memoize` work with either decorator style.

The package ships TypeScript sources and is meant to be bundled. Import from `"elt"`, from `"elt/mutative"` when you call `.mutate()`, and from `"elt/ui"` when the app uses the UI sub-library.

## Minimal app

A multi-screen app is three kinds of files: the routes, a shared shell, and one service per screen. A complete running one is `docs/src/app.tsx`: this documentation site is itself an elt app.

```ts
// routes.ts
import { App, node_append } from "elt"

export const app = new App()

// Path mode: routes live in the URL path (https://host/home). With the default base "/", the
// root URL "/" is route path "/".
export const routes = app.setupRouter({
  root: ["/", () => import("./init")],
  home: ["/home", () => import("./home")],
}, { mode: "path" })

// app entry — setupRouter already schedules the first activation from the current URL
node_append(document.body, app.DisplayView("Main"))
```

```tsx
// base.tsx — the shared shell, required by every screen
import { Service, view, css } from "elt"
import { app } from "./routes"

export default class BaseService extends Service({}) {
  @view
  Main() {
    return <div class={cls_root}>
      {app.DisplayView("Content")}
    </div>
  }
}

const cls_root = css`.root { min-height: 100vh }`
```

```tsx
// home.tsx — a screen
import { Service, view } from "elt"

export default class HomeScreen extends Service({
  base: import("./base"),
}) {
  @view
  Content() {
    return <h1>Home</h1>
  }
}
```

Routes, path and hash modes, params and services are covered in [App](./app.md#setting-up-routes).

## Frequently imported symbols

| Symbol | Use | Details |
| --- | --- | --- |
| `o` | As a function: make an observable, `o("a string")` (an observable passed in is returned as is). As a namespace: every observable helper (`o.expression`, `o.get`, `o.transaction`, …). | [Observables](./observables.md#creating-and-reading) |
| `css` | Tagged template; one rule per call. A rule starting with `.class-name` gets that class name made unique, and the call returns it. | [CSS](./css.md#the-css-tagged-template) |
| `$click` | `<button>{$click((ev) => …)}</button>`: react to clicks. | [Decorators](./decorators.md#events-on-once-click) |
| `$on` / `$once` | `addEventListener`, tied to the node's lifecycle: `{$on("input", (ev) => …)}`. `$once` runs once. | [Decorators](./decorators.md#events-on-once-click) |
| `$observe` | Run a callback with an observable's value, while the node is in the document. | [Decorators](./decorators.md#reflecting-values-observe-class-style-id-title) |
| `$bind.string` / `.number` / `.boolean` / … | Two-way binding between a form control and an observable. | [Decorators](./decorators.md#binding-form-controls-bind) |
| `$connected` / `$disconnected` | Run a callback when the node enters / leaves the document. | [Decorators](./decorators.md#lifecycle-connected-disconnected) |
| `$shadow` | Rare: attach a shadow root to a node. | [Decorators](./decorators.md#shadow-dom-shadow) |
| `If`, `Switch`, `Repeat`, `DisplayPromise`, `RepeatVirtual` | Dynamic structure driven by observables. | [Verbs](./verbs.md) |
| `App`, `Service`, `view` | Routing, services, named views. | [App](./app.md) |

## elt/ui

`elt/ui` is elt's optional UI layer, imported once as `"elt/ui"` at the app's entry point. It is not a large component library: it is a **visual language** — a theme, a handful of layout elements, global styling for native HTML — plus a few widgets that native HTML can't provide (`Select`, date/time pickers, popup, dialog, keyboard shortcuts). Its aim is that building a new screen requires almost no layout or style decisions of your own.

**Native HTML, styled.** A `<button>`, `<input>` or `<dialog>` is already a themed control. Variants are attributes (`<button e-variant="inverted">`), not wrapper components.

**Five layout elements do the layout.** `<e-row>`, `<e-column>`, `<e-flex>` and `<e-grid>` arrange things (with `<e-grid-row>` for the rows of a grid); `<e-prose>` holds text you read. Their attributes (`pad`, `spacing`, `border`, `surface`, `packed`, …) replace most of the CSS you would otherwise write. Spacing is a parent's job: containers space their children, children never set margins.

**Spacing and color are relative.** Spacing flows down from container to container, and each container's step names what its children are: parts of a widget, widgets, or groups of widgets. Background fills stack: a panel inside a panel is one level further from the page, and hover fills and dividers are computed relative to whatever surface they sit on. A component therefore looks right wherever you put it, without knowing its ancestors.

**Colors are mixes, not palettes.** A theme supplies a background, a text color and an accent ("tint"); every other color is a mix between them, computed in OKLCH. Dark mode is derived automatically unless you provide one.

```tsx
import "elt/ui"
import { node_append } from "elt"

node_append(document.body, <e-column pad="component" border>
  <e-prose>
    <h1>Title</h1>
    <p>Body copy.</p>
  </e-prose>
  <e-row>
    <button e-variant="inverted">Save</button>
    <button e-variant="text">Cancel</button>
  </e-row>
</e-column>)
```

Before writing UI, read the [elt/ui rules](./elt-ui-rules.md); then the page for your subject: [layout](./ui-layout.md), [typography](./ui-typography.md), [theme and colors](./ui-theme.md), [forms](./ui-forms.md), [widgets](./ui-widgets.md), [overlays](./ui-overlays.md), [keyboard shortcuts](./ui-keymap.md). Live examples: [Visual Test](./visual-test.md), [Object Editor](./object-editor.md) (unstable).

## Where to go next

| Want | Read |
| ---- | ---- |
| The rules every piece of app code follows | [elt rules](./elt-rules.md) |
| The rules every piece of UI follows | [elt/ui rules](./elt-ui-rules.md) |
| Observables, verbs, decorators, components in depth | [Observables](./observables.md), [Verbs](./verbs.md), [Decorators](./decorators.md), [Components](./components.md) |
| Routing and services | [App](./app.md) |
| Converting older code | [Migrating](./migrating.md) |
| Exact signatures | JSDoc in `src/` and `ui/` |
