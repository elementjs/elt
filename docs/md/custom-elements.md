---
title: Custom elements
section: Core Library
order: 60
---

# Custom elements

elt works with standard [custom elements](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements) — classes extending `HTMLElement`, registered under a tag name containing a dash. This page covers what `elt` adds on top: `<e-wrap>`, the `EltCustomElement` base class, and the `@register` / `@attr` decorators. Source of truth: `src/custom-elements.ts`.

Most app code never needs a custom element: a [component](./components.md) (a function returning a node) covers reuse, and [decorators](./decorators.md) cover behavior. Reach for a custom element when the element itself must carry state or an API that other code reads off the node, when it needs a shadow root with its own stylesheet, or when markup produced outside elt (a third-party library, `innerHTML`) must still get elt's lifecycle.

## `<e-wrap>` — lifecycle for nodes elt did not insert

elt starts and stops observers when a node is connected or disconnected **through `node_append` / `node_remove`**. A node inserted another way (a third-party library calling `appendChild`, for instance) never gets those callbacks, so `$observe`, `$connected`, etc. inside it never run.

`<e-wrap>` fixes that for its subtree: it is `display: contents` (it adds no box to the layout), and when the browser connects or disconnects it, it runs elt's connect/disconnect callbacks on everything inside it.

```tsx
const widget = <e-wrap>
  <div>{$observe(o_value, (v) => console.log(v))}</div>
</e-wrap>

third_party_container.appendChild(widget)  // observers inside start anyway
```

It can also serve as the app's root instead of calling `node_append` on it. The heavier alternative, which watches the whole document, is `setup_mutation_observer(node)`.

## `EltCustomElement` — a base class wired to elt's lifecycle

Extend `EltCustomElement` instead of `HTMLElement` to get:

| Member | What it does |
| ------ | ------------ |
| `init()` | Override. Runs once, the first time the element is connected (or initialized by elt), after its shadow root is built. |
| `connected()` / `disconnected()` | Override. Run every time the element enters / leaves the document. |
| `shadow()` | Override to return a node: it becomes the content of an open shadow root (with `delegatesFocus`). Return `null` (the default) for no shadow root. |
| `static css` | A string, a `CSSStyleSheet`, or an array of them, adopted by the shadow root. |
| `static shadow_init` | `ShadowRootInit` options for the shadow root. Default `{ mode: "open", delegatesFocus: true }`. |
| `observe(obs, cb?)` | Observe while the element is connected — same as `node_observe(this, obs, cb)`. Stops automatically on disconnect. |
| `observeChanges(obs, cb)` | Same, but `cb` does not run for the initial value, only for changes. |
| `unobserve(obs_or_cb)` | Stop one of the above early. |
| `attrObservable(key)` | The observable backing an `@attr` property (below). Throws if `key` is not one. |

## `@register(tag)` and `@attr`

`@register("my-tag")` calls `customElements.define("my-tag", TheClass)` on the decorated class.

`@attr` marks a property as an **attribute property**: when elt sets the attribute of that name (from JSX, or through `setAttribute`), it assigns the property directly with the value as given — an object, a number, a boolean — instead of converting it to a string. An observable passed in JSX keeps the property in sync. Options, with `@attr({ … })`:

| Option | Meaning |
| ------ | ------- |
| `name` | Attribute name, when it differs from the property name. |
| `convert(str)` | Converts a string value (an attribute written in HTML, for instance) into the property's type. |
| `revert` | Reflect the property back to the attribute when it changes: `true` writes the value as is (`true` → empty attribute, `false`/`null` → removed), a function `(value) => string` formats it. |

`@attr` is a legacy-style decorator: it needs `"experimentalDecorators": true` in `tsconfig.json`. Declare the property with `declare` and no initializer — with modern class-field semantics (the default from `target: "es2022"`), an initializer would define a plain own property that hides the attribute property. Put defaults in `init()` instead.

To type the tag in JSX, declare it in `ElementMap`. `CustomElementAttributes<Class, "prop1" | "prop2">` is the usual attrs type: the standard attributes plus each listed property, accepting a plain value or an observable.

```tsx
import { $click, EltCustomElement, register, attr, o, type CustomElementAttributes } from "elt"

@register("x-counter")
export class XCounter extends EltCustomElement {
  static override css = `:host { display: inline-block }`

  @attr({ convert: Number }) declare start: number | undefined

  o_count = o(0)

  override init() {
    this.o_count.set(this.start ?? 0)
  }

  override shadow() {
    return <button>
      {$click(() => this.o_count.set(this.o_count.get() + 1))}
      {this.o_count}
    </button>
  }
}

declare module "elt" {
  interface ElementMap {
    "x-counter": CustomElementAttributes<XCounter, "start">
  }
}

// usage
<x-counter start={5} />
```

## See also

- [Components](./components.md) — the lighter-weight way to reuse markup.
- [Decorators](./decorators.md) — `$connected`, `$observe`, `$shadow` (a shadow root on any element, without a class).
