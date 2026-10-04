---
title: elt rules
section: Start
order: 2
---

# elt rules

Every binding rule for application code that uses elt, on one page. Read it in full before writing or changing app code; each rule links to the page that explains it. UI code also follows the [elt/ui rules](./elt-ui-rules.md).

**This is not React.** JSX returns real DOM nodes; there is no virtual DOM. What changes on screen is driven by observables and verbs, not by re-rendering.

## Hard rules

1. **Not React.** No virtual DOM. JSX, `e()` and `E()` return **real DOM nodes**. Updates come from observables and verbs, not reconciliation. See [Introduction](./introduction.md#the-ideas-in-order).
2. **Mount with `node_append`, unmount with `node_remove`.** Raw DOM methods (`append`, `remove`, `appendChild`, `removeChild`, …) skip elt's connect/disconnect step: lifecycle callbacks and observers inside will not run. Only the app's outermost mount usually needs `node_append`; verbs and App views already use it. For nodes inserted by third-party code, wrap them in [`<e-wrap>`](./custom-elements.md#e-wrap-lifecycle-for-nodes-elt-did-not-insert), or (heavier) call `setup_mutation_observer`.
3. **Observe through the DOM lifecycle.** Use `$observe`, `node_observe`, or the `.observe` method of a service or an `EltCustomElement`: they stop observing on their own. Do not call `addObserver()` yourself unless nothing else fits. See [Observables](./observables.md#good-patterns-vs-patterns-to-avoid).
4. **Propagation is synchronous.** `obs.set(v)` runs observers, dependents and DOM bindings **before `set` returns**. `o.transaction(fn)` defers the flush to the end of `fn`, then runs it synchronously. See [Observables](./observables.md#otransaction-batching-writes).
5. **`set` is `===`-gated.** Setting the same reference does nothing: mutating an object in place then `set`-ting it notifies no one. Replace the whole value, or use `.assign()` / `.mutate()`. See [Observables](./observables.md#creating-and-reading).
6. **No `children` prop.** JSX children of `<Comp>…</Comp>` go to the component's root node (one-argument component) or to its `RefChild` insertion point (two-argument component). See [Components](./components.md#one-arg-vs-two-arg).
7. **JSX is typed as `Element`.** Cast when you need a concrete type: `(<div/> as HTMLDivElement)`. `e()` / `E()` return precise types, and inside a decorator the node is fully typed. See [Components](./components.md#typing-jsx).
8. **Import from `"elt"`.** TypeScript only; the package is meant to be bundled. Import `"elt/mutative"` when you call `obs.mutate()`, and `"elt/ui"` only when the app uses that sub-library. See [Introduction](./introduction.md#setup).
9. **Model dynamic structure as an observable and a verb**, not as a manually tracked array paired with `node_append`/`node_remove`, and not as `node_clear` followed by a full re-render whenever a condition changes. Put the data that drives the structure in an observable and let `Repeat` (lists), `If` (one of two) or `Switch` (one of many) render it: they diff against the previous render and keep no second bookkeeping structure that can drift from the DOM. See [Verbs](./verbs.md#good-patterns-vs-patterns-to-avoid).
10. **An observer's return value is written back.** When an observer callback returns something other than `undefined`, that value is set on the observed observable (a promise is awaited first): it is meant as a trigger, for example an observer that resets the value it watches. Write observers that only do side effects with a block body (`(v) => { node.title = v }`), not an expression body (`(v) => (node.title = v)`), which returns the assigned value. Writing back to a read-only observable throws. See [Observables](./observables.md#an-observers-return-value).

## Naming

| Pattern | For |
| --- | --- |
| `o_<name>` | Source state, or any **writable** observable (including a writable `o.expression` or `o.merge`) |
| `oo_<name>` | A **read-only** derived observable (`.tf`, `o.expression` without a write-back, …) |
| `cls_<name>` | A class name returned by [`css`](./css.md#the-css-tagged-template): `` const cls_bold = css`.bold { font-weight: bold }` `` |
| `<Name>Service` | A class extending `Service`; the default export of its file |
| `<Name>Screen` | A `Service` meant as a route target, registering views with `@view`; the default export of its file |

These are conventions: the library does not enforce them, but code using elt follows them.

## Components

- Use JSX rather than calling `e()` / `E()` directly: it reads better. `e()` / `E()` are for the rare place a precise return type matters more. See [Components](./components.md#typing-jsx).
- In a two-argument component, place children with **either** a bare `{ref}` **or** `ref.IfChildren(…)`, never both. See [Components](./components.md#refchild-placing-children-explicitly).
- Don't give `attrs` a default value on a two-argument component: it silently turns it into a one-argument component. See [Components](./components.md#one-arg-vs-two-arg).
- Component attributes that should react to changes are typed `o.RO<T>` (a value or an observable of it). See [Components](./components.md#reactive-attributes).
- Put decorators (`$click`, `$bind`, …) among the JSX **children**, never as attributes. See [Decorators](./decorators.md#anatomy-of-a-decorator).
- Use a real element, not a fragment `<>…</>`, as the root that observes: a fragment never gets connected, so lifecycle-bound decorators placed on it don't stay tied to anything. See [Components](./components.md#fragments).
- In `$bind` options, give at most one of `debounce_*` / `throttle_*` per direction. See [Decorators](./decorators.md#binding-form-controls-bind).
- Build your own decorators from elt's node-lifecycle helpers (`node_add_event_listener`, `node_observe`, `node_on_connected`, `node_on_disconnected`), not from raw DOM calls with hand-tracked cleanup. See [Decorators](./decorators.md#writing-your-own-decorator).
- In a custom element, declare an `@attr` property with `declare` and no initializer; set defaults in `init()`. See [Custom elements](./custom-elements.md#registertag-and-attr).

## Observables

- An observable holding something renderable (a string, a number, a node, …) can be used directly as a JSX child, and the DOM follows it. Use that everywhere. Other values need a `.tf(…)` to something renderable first. See [Components](./components.md#renderable).
- Do not read a value with `o.get(x)` or `.get()` outside observer logic, unless you really mean "the value at this precise moment". To follow a value, derive from it (`.tf`, `o.expression`) or observe it. See [Observables](./observables.md#creating-and-reading).
- Prefer `o.expression` over `o.combine` / `o.merge` / `o.join` for new derived values. Keep `o.merge` / `o.join` for when a bundled object or tuple observable is the point. See [Observables](./observables.md#good-patterns-vs-patterns-to-avoid).
- Prefer `.assign()` / `.mutate()` over chaining `.p()` for deep or ad-hoc writes; `.p()` is for binding one field to one control. See [Observables](./observables.md#updating-assign-and-mutate).
- To bind a control to a field whose stored type differs from the control's (a number kept as a string, a date as a timestamp), bind a two-way `.tf` with a converter, not a copy kept in sync by hand. See [Decorators](./decorators.md#binding-form-controls-bind).
- DOM updates are synchronous: set observables when the data is coherent, and wrap several related `set` calls in `o.transaction`. See [Observables](./observables.md#otransaction-batching-writes).

## Verbs

- Use a verb for anything whose structure changes. See [Verbs](./verbs.md).
- Call `.withKeyFunction()` on `Repeat` and `RepeatVirtual` whenever items have an id: it matters for performance and for keeping per-item state (focus, unsaved input). See [Verbs](./verbs.md#repeat-a-list).
- Show a promise with `DisplayPromise`; a promise used directly as a JSX child is not rendered (it shows as its string conversion). See [Verbs](./verbs.md#displaypromise-a-promises-lifecycle).
- Don't re-render in place with `$observe` + `node_clear` + `node_append`: that is rule 9 again. `If` / `Switch` / `.tf` already skip the swap when nothing changed. See [Verbs](./verbs.md#good-patterns-vs-patterns-to-avoid).
- A `RepeatVirtual` row's height depends on its own content only, never on which other rows are rendered at the same time. See [Verbs](./verbs.md#repeatvirtual-a-long-list).
- For items to play their exit (`$leave`) when a `Repeat` both removes and adds items, give it a key function. See [Motion § Repeat](./motion.md#repeat).

## App

- **Always `await` an activation** (`await routes.home.activate()`): it can be interrupted by a redirect, a redirect not awaited inside a service's init shows the redirecting route before its target replaces it, and a failure nobody awaits is an unhandled rejection. See [App](./app.md#activation).
- Activate through `router.<route>.activate()`. `App._activate` is internal. See [App](./app.md#activation).
- Route builders are functions that **return** a service builder; prefer a lazy `() => import("./file")`. See [App](./app.md#setting-up-routes).
- The usual screen shape: dependencies declared in `Service({ … })`, state in `o_*` fields, derived values in `oo_*` fields, named views as `@view` methods. See [App](./app.md#services).
- Shared state lives in a store service that feature services depend on. Use `srv.param_soft` for URL values whose change must not rebuild the service, `srv.param` for those that must. See [App](./app.md#store-pattern).

## CSS

- One rule per `` css`…` `` call. To write several rules at once, put them in an `@layer` block. See [CSS](./css.md#the-css-tagged-template).
- Keep `css` calls at the top level of a module; export a class only when another module uses it. Delete unused classes. See [CSS](./css.md#organizing-styles).
- Prefer standard CSS; avoid vendor prefixes unless a supported browser still requires one.
- In apps that use `elt/ui`, layout comes from layout elements and theme tokens, not hand-written flex/gap rules: see the [elt/ui rules](./elt-ui-rules.md).

## DOM and layout

- Animate a node entering or leaving the page with `$enter` / `$leave` on the node itself, not with `$connected` + an animation, nor by animating and then removing it by hand: they play with verbs' updates, never on a verb's first render. A `$leave` inside removed content only plays when the removed node has a `$leave` too (`$leave(null)` when it has no exit of its own). Code that inserts or removes nodes itself passes `motion` (`node_append(…, true)`, `node_remove(node, true)`) to animate them. See [Motion](./motion.md).
- Code that runs later on a node (an animation frame, a timeout, a promise) checks `node_is_connected(node)`, not `node.isConnected`: a node playing its exit is still in the document but already disconnected. See [Motion § Notes](./motion.md#notes).
- When a change drives layout, never interleave reading layout (`getBoundingClientRect`, `offsetHeight`, `scrollTop`, …) and writing to the DOM in the same pass: each read after a write forces the browser to lay out again. Read everything once, compute, apply one batch of writes, and converge on later frames (`requestAnimationFrame`) if needed.

## Use sparingly

Not wrong, but not what to reach for first.

| Avoid | Because | Details |
| --- | --- | --- |
| `o.join` / `o.merge` / `o.combine` | Lower-level than `o.expression`, slightly faster, much more verbose. | [Observables](./observables.md#omerge-and-ojoin-bundling-several-observables) |
| `node_append` / `node_remove` | Meant for mounting the app's root or integrating third-party code. Inside the app, verbs do it. | [Hard rule 2](#hard-rules) |
| `e()` / `E()` | Precise types, but less readable than JSX. | [Components](./components.md#typing-jsx) |
| `$shadow` | Rarely needed outside custom elements with their own stylesheet. | [Decorators](./decorators.md#shadow-dom-shadow) |

## Code conventions

Apps using elt follow these:

- No `;`.
- `camelCase` methods, `MixedCase` classes, `snake_case` variables and functions.
- Prefer CPU- and memory-efficient algorithms; keep code DRY; comment non-obvious patterns briefly.
- Prefer current web standards over prefixed CSS or JS.
- `"strict": true` in `tsconfig.json`.
