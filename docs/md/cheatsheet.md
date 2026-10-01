---
title: Cheatsheet
order: 3
---

# elt cheatsheet

One page to skim when coming from React or another framework. Each row only summarizes; the linked page owns the rule and its details.

**This is NOT React.** JSX returns real DOM nodes; there is no virtual DOM. What changes on screen is driven by observables and verbs, not by re-rendering. See [elt guide › Hard rules](./elt-guide.md).

## General

| Subject | In short | Owner |
| --- | --- | --- |
| `o.Observable` | elt's central class: a synchronous value holder (called a signal elsewhere) that can be derived, combined, and observed to make the UI dynamic. | [Observables](./observables.md) |
| `$<name>()` | **Decorators**: functions placed among a node's JSX children, called with that node. They replace React's `onClick={…}`-style props. | [Decorators](./decorators.md) |
| `<div>…</div>` | Returns a real node, typed as `Element` (TypeScript can't type JSX more precisely). Cast when you need the concrete type: `<div/> as HTMLDivElement`. Inside a decorator the node is fully typed: `<button>{(btn) => { … }}</button>` gives an `HTMLButtonElement`. | [elt guide › Hard rules](./elt-guide.md) |
| `e("button", { class: "cls" }, …)` / `E` | The functions behind JSX, with precise return types. Less readable than JSX, so not favored. | [Components](./components.md) |
| `function Comp(attrs: Attrs<HTMLDivElement> & { prop: T }) { … }` | **One-argument component**: JSX children passed to `<Comp>…</Comp>` are appended to the root node it returns. There is no `children` prop. | [Components › One-arg vs two-arg](./components.md) |
| `function Comp(attrs, ref: RefChild) { return <div>…{ref}…</div> }` | **Two-argument component**: children go where `{ref}` is placed, or use `ref.IfChildren((r) => …)` to render a wrapper only when children were passed. Never both in one component. | [Components › RefChild](./components.md) |
| `<Comp id class style title … />` | **Global attributes** are applied to the component's root node after it returns, whether or not the component reads them: `id`, `class`, `style`, `slot`, `part`, `role`, `tabindex`, `lang`, `inert`, `title`, `autofocus`, `nonce`, and every `aria-*` / `data-*`. Any other prop only reaches the DOM if the component applies it. `class` and `style` accept observables and `{ name: o_bool }` maps. | [Components › Global attrs](./components.md) |

## Naming conventions

| Pattern | For | Owner |
| --- | --- | --- |
| `o_<name>` | A writable observable | [elt guide › Naming](./elt-guide.md) |
| `oo_<name>` | A read-only observable, usually from `.tf` / `o.expression` with no write-back | [elt guide › Naming](./elt-guide.md) |
| `cls_<name>` | A class name from the `css` helper: `` const cls_bold = css`.bold { font-weight: bold }` `` | [elt guide › CSS](./elt-guide.md) |
| `<Name>Service` | A class extending `Service`; the default export of its file | [App › Services](./app.md) |
| `<Name>Screen` | A `Service` meant as a route target, registering views with `@view`; the default export of its file | [App › Views](./app.md) |

## Frequently imported symbols

| Symbol | Use | Owner |
| --- | --- | --- |
| `o` | As a function: make an observable, `o("a string")` (an observable passed in is returned as is). As a namespace: every observable helper. | [Observables](./observables.md) |
| `css` | Tagged template; one rule per call. A rule starting with `.class-name` gets that class name made unique, and the call returns it. | [elt guide › CSS](./elt-guide.md) |
| `$click` | `<button>{$click((ev) => …)}</button>`: react to clicks. | [Decorators › Events](./decorators.md) |
| `$on` / `$once` | `addEventListener`, tied to the node's lifecycle: `{$on("input", (ev) => …)}`. `$once` runs once. | [Decorators › Events](./decorators.md) |
| `$observe` | Run a callback with an observable's value, while the node is in the document. | [Decorators](./decorators.md) |
| `$bind.string` / `.number` / `.boolean` / … | Two-way binding between a form control and an observable. | [Decorators › $bind](./decorators.md) |
| `$connected` / `$disconnected` | Run a callback when the node enters / leaves the document. | [Decorators › Lifecycle](./decorators.md) |
| `$scrollable` | Make a container scrollable, with touch handling made consistent. | [Decorators](./decorators.md) |
| `$shadow` | Rare: attach a shadow root to a node. | [Decorators › Shadow DOM](./decorators.md) |

## Observables

An observable holding something renderable (a string, a node, …) can be used directly as a JSX child, and the DOM follows it. Use that everywhere.

| Use | To | Owner |
| --- | --- | --- |
| `.set(v)` | Write. Notifies only if `v !== ` the current value: mutating in place then `set`-ting the same object does nothing. | [Observables](./observables.md) |
| `.tf(fn)` | Derive a new observable from one other. `tf_*` helpers cover common shapes (filter, sort, group, "equals X"). | [Observables › .tf()](./observables.md) |
| `o.expression((get) => …)` | Derive from several observables; `get(o_x)` reads and subscribes. | [Observables › o.expression](./observables.md) |
| `o.get(x)` | The current value of something that may or may not be an observable. | [Observables](./observables.md) |
| `.assign(partial)` | Immutable update of part of an object or array. | [Observables › Updating](./observables.md) |
| `.mutate((draft) => …)` | Immutable update written as mutations, through the `mutative` library; needs `import "elt/mutative"`. | [Observables › Updating](./observables.md) |

## Verbs

Uppercase functions that render a dynamic region of the DOM from observables. Use them for anything whose structure changes. Calling `.withKeyFunction()` on `Repeat` / `VirtualScroll` matters a lot for performance and for keeping per-item state; use it whenever items have an id.

| Verb | To | Owner |
| --- | --- | --- |
| `If` | One of two branches: `If(oo_cond, (o_truthy) => …).ElseIf(o_cond2, …).Else(() => …)` | [Verbs › If](./verbs.md) |
| `Switch` | One of several branches by value: `Switch(o_obs).Case(value_or_predicate, (o_v) => …).Else(() => …)` | [Verbs › Switch](./verbs.md) |
| `Repeat` | A list: `Repeat(o_array, (o_item) => …)` | [Verbs › Repeat](./verbs.md) |
| `VirtualScroll` | A list in a scrollable container that only renders the visible rows; for lists that can be long. | [elt guide › Verbs](./elt-guide.md) |
| `DisplayPromise` | A promise's states: `DisplayPromise(o_promise).WhileWaiting(() => …).WhenResolved((o_value) => …).UponRejection((o_err) => …)` | [Verbs › DisplayPromise](./verbs.md) |

## App

| Subject | In short | Owner |
| --- | --- | --- |
| `new App()` + `app.setupRouter({ name: [path, () => import("./file")] }, { mode: "path" })` | Declares routes, lazily loaded. Path mode reads routes from the URL path; without options, routes live in the URL fragment (`#/…`). | [App › Setting up routes](./app.md) |
| `class MyScreen extends Service({ base: import("./base") })` + `@view` | The usual screen shape: dependencies in `Service({ … })`, named views (`Content`, …) as `@view` methods. | [App › Services](./app.md) |
| `app.DisplayView("Content")` | Insert a named view into the tree. | [App › Views](./app.md) |
| `srv.param("key")` / `srv.param_soft("key")` | URL parameters. A `param` change rebuilds the service; a `param_soft` change only updates an observable. | [App › Params](./app.md) |
| `await routes.some_route.activate()` | Always `await` an activation: it can be interrupted (a redirect), and an un-awaited overlapping call throws. | [App › Activation](./app.md) |
| `routes.some_route.urlFor({ … })` | The URL that activates a route, for `<a href>`. | [App › Links](./app.md) |

## Use sparingly

Not wrong, but not what to reach for first.

| Avoid | Because | Owner |
| --- | --- | --- |
| `o.join` / `o.merge` / `o.combine` | Lower-level than `o.expression`, slightly faster, much more verbose. | [Observables](./observables.md) |
| `node_append` / `node_remove` | Meant for mounting the app's root or integrating third-party code. Inside the app, verbs do it. | [elt guide › Hard rules](./elt-guide.md) |

## Do NOT

- **Do not** call `o.get` or `.get()` outside observer logic, unless you really mean "the value at this precise moment". See [Observables](./observables.md).
- **Do not** call `addObserver()` yourself: use `$observe`, `node_observe`, or the `.observe` method of `Service` / `App` / `EltCustomElement`, which stop observing on their own. See [elt guide › Hard rules](./elt-guide.md).
- **Do not** insert or remove nodes with DOM methods (`append`, `remove`, `appendChild`, …): elt's lifecycle callbacks and observers will not run. Use `node_append` / `node_remove`, or wrap foreign content in [`<e-wrap>`](./custom-elements.md).
