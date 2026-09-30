---
title: Cheatsheet
---

# Elt Cheatsheet

**This is NOT react**

- `<tsx>code</tsx>` returns plain `Node`s, there is no virtual-dom
- 

**General**

| Subject | Explanation |
| --- | --- |
| `o.Observable` | Most important class of `elt`; called Signal in other librairies, a synchronous value holder that can be combined to form more complex Observables and observed to drive dynamicity in the UI |
| `$<name>()` | **decorators**, meant to be added as children of their target node that run as callbacks when appended to them |
| `<div>JSX</div>` | TSX constructs that return `Element` because typescript does not let us type it further. Full type available in decorator. `<button>{btn => {  }}</button>` btn is `HTMLButtonElement` there. |
| `e("button", { class: "cls" }, ...)` or `E` | Functions behind the TSX with correct return type. Not favored since code is more readable with TSX. |
| `function Component(attrs: Attrs & { prop: Type }, children?: Renderable) { return <tsx_code/> }` | `Attrs` contains declaration of basic HTML attributes as understood by elt. children is optional and should only be specified when wanting to place the children somewhere in the result - otherwise they're added to the root node of the result. |
| `<Component class={["cls", {cls_name: oo_boolean}]} style={{fontWeight: "bold"}} id="id"/>` | **Global attrs** (`id`, `class`, `style`, `slot`, `name`, `title`, `aria-*`, `data-*`) are forwarded to the component's root node after it returns, whether or not the component reads them. Any other prop is custom and only reaches the DOM if the component applies it itself. |

**Code naming conventions**

| Pattern | For |
| --- | --- |
| `o_<name>` | A writable observable |
| `oo_<name>` | A readonly observable, usually comes from `.tf` / `o.expression` with no write specified |
| `cls_<name>` | A class coming from the `css` helper : `` const cls_bold = css`.bold { font-weight: bold }` `` |
| `<Name>Service` | class that extends `Service`. Should be default export of its file. |
| `<Name>Screen` | class that extends `Service` or Service function that uses `@view` or `srv.view` extensively, meant to be used as a route target. Should be default export of its file. |


**Frequently imported symbols**

| Use | To |
| --- | --- |
| `o`| as function : create or convert values to observables `o("a string")`, as namespace : all observable utility functions |
| `css` | tagged template function. Only one statement per call. If starting by `.class-name`, the class name will be "uniquified" to avoid collisions and returned as result |
| `$click` | `<button>{$click(mouse_event => /* */)}</button>` react to the click event. Does nothing more than `$on`, but is more readable. |
| `$on` / `$once` | Simple addEventListener alias `<input>{$on("input", input_event => { /* */ })}</input>` `<button>{$on("click", mouse_event => { /* */ })}</button>`. `$once` only runs once |
| `$observe` | Observe an observable and get called when it changes. Return value of callback can further change it before other observers. |
| `$scrollable` | Make a container scrollable with some touch handling to harmonize behaviour |
| `$connected` / `$disconnected` | Run a callback when the node enters/leaves the living DOM |
| `$shadow` | Not common ; attach a shadow DOM to a node |

**Observables**

If an observable holds a value that extends `Renderable`, it can be used directly as a TSX child for dynamicity. Use it extensively.

| Use | To |
| --- | --- |
| `.set` | (method) set an observable's value |
| `.tf`| (method) create a new observable from another |
| `o.get` | Get the instant value of something that _may_ be an observable, more flexible type-wise than `.get()` |
| `o.expression` | like .tf, but involving several observables. `o.expression((get) => { const dep1 = get(o_dep1); /* ... */ return result })`.  |
| `o.assign` | simple immutable updates to `.set` new values or in custom transformers |
| `o.mutate` | Optional but recommanded way of performing complex immutable updates, in combination with the mutative library and `import "elt/mutative"` |

**Verbs**

Use them extensively. Verbs follow writability of provided observables. `.withKeyFunction()` on `Repeat` and `VirtualScroll` is very important performance-wise and must be used whenever possible.

| Use | To |
| --- | --- |
| `If` | dynamicity `If(oo_condition, o_as_truthy => Renderable).ElseIf(o_cond2, o_as_truthy2 => Renderable).Else(() => Renderable)` |
| `Repeat` | Simple repeat over array observables `Repeat(o_my_array).RenderEach(o_value => Renderable)`. |
| `VirtualScroll` | Repeat in a scrollable container, more involved than Repeat to set up, suited whenever arrays can be big. `import { } "elt/virtual"` |
| `DisplayPromise` | Show a `Promise`-valued observable's loading/resolved/error states: `DisplayPromise(o_promise).WhileWaiting(() => Renderable).WhenResolved(o_value => Renderable).UponRejection(o_err => Renderable)`. |
| `Switch` | One-of-several branches by value: `Switch(o_obs).Case(ro_value_or_predicate, o_truthy_value => Renderable).Else(() => Renderable)`. |


**App**

| Subject | Explanation |
| --- | --- |
| `new App()` + `app.setupRouter({ name: [path, () => import("./file")] })` | Declares routes; builder is lazy (`() => import(...)`), path is a hash path without `#`, `""` is the landing route. `setupRouter(defs, { mode: "path", base: "/prefix" })` reads routes from the URL path instead. |
| `class MyScreen extends Service({ base: import("./base") })` + `@view` | Canonical screen shape. Deps go in `Service({...})`; register a named view (e.g. `Content`) with `@view` on a method. |
| `app.DisplayView("Content")` / `srv.DisplayView("Content")` | Compose a named view into the tree. |
| `srv.param("key", default?)` / `srv.param_soft("key", default?)` | URL param binding; `param` re-activates the service on change, `param_soft` updates in place via an observable. |
| `await router.someRoute.activate()` | Always `await` activation; can be interrupted (redirect) or throw if a concurrent un-awaited activation is in flight. |

**Avoid the following**

These are not anti-patterns, but they're not meant to be reached for unless for a good reason.

| Avoid | Because |
| --- | --- |
| `o.join` / `o.merge` / `o.combine` | Create an observable from several others, lower level that `o.expression` but a _little_ more performant at the cost of much more verbosity. |
| `node_append` `node_remove` | Meant to only be used to mount the initial App or when integrating 3rd party libraries. Use verbs instead. |


## Do NOT

- **do not** use `o.get` or `.get()` outside of observer logic unless the need is explicitely to look at an observable at a precise point in time
- **do not** use `addObserver()` yourself on an observer ; `$observe`, `node_observe` or `.observe` method of things like `Service` / `App` exclusively to avoid leaking.
- **do not** use DOM `Node`'s insertion/removal methods directly such as `append`, `remove`, `insertChild`. They will not set up observables and lifecycle callbacks.

