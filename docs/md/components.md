---
title: Components
section: Core
order: 10
---

# Components

A component is a plain function used as a JSX tag. No classes, no virtual DOM: `e()` calls the function and uses whatever `Node` it returns.

## One-arg vs two-arg

```tsx
//@inline-example
import { type Attrs } from "elt"

// One-arg: JSX children are appended to the returned root node.
function Box(attrs: Attrs<HTMLDivElement> & { label: string }) {
  return (<div class="box">{attrs.label}</div>) as HTMLDivElement
}

return <Box label="hello"><span>this lands inside the div</span></Box>
```

There is no `children` prop: JSX children of a one-argument component are appended to the root node it returns.

Whether a component receives a second argument (a `RefChild`) is decided by `fn.length` — the number of declared parameters *before* the first one with a default value. `(attrs, ref) => ...` has `length === 2` and gets a `RefChild`. `(attrs = {}, ref) => ...` has `length === 0`: it silently becomes a one-arg component and `ref` is always `undefined`.

> Don't give `attrs` a default value on a two-arg component — it breaks `RefChild` delivery with no error.

## `RefChild` — placing children explicitly

```tsx
//@inline-example
import { type Attrs, RefChild } from "elt"

function Row(_attrs: Attrs<HTMLDivElement>, ref: RefChild) {
  return (
    <div>
      <span>label</span>
      {ref}
    </div>
  ) as HTMLDivElement
}

return <Row><b>appended at {"{ref}"}, not at the end</b></Row>
```

A bare `{ref}` is a fixed insertion point: it is always present, whether or not children were passed. `ref.IfChildren(fn)` scaffolds only when JSX children were actually passed, and returns a placeholder you must embed in the returned tree (not `ref` itself):

```tsx
//@inline-example
import { type Attrs, RefChild } from "elt"

function Panel(attrs: Attrs<HTMLDivElement> & { title: string }, ref: RefChild) {
  return (
    <div>
      <h2>{attrs.title}</h2>
      {ref.IfChildren((r) => <div class="body">{r}</div>)}
    </div>
  ) as HTMLDivElement
}

return <Panel title="No children below">{null}</Panel>
```

Rules:

- Use **either** bare `{ref}` **or** `ref.IfChildren(...)`, never both. This is a convention, not enforced by the library — mixing them is undefined behavior.
- A two-arg component that places `ref` nowhere behaves exactly like a one-arg component: children are appended at the end of the root.

### Extra slots

A component with more than one place to put content takes the extra content as props typed `Renderable` (`footer?: Renderable`), and places them like any other child. For named destinations inside a shadow root, use [`$shadow`](./decorators.md#shadow-dom-shadow) with `<slot>` elements.

## Global attrs on `<Comp id class style .../>`

After the component returns, `node_append` applies a fixed set of attributes to the **root node**, whether or not the component reads or forwards them from `attrs`:

- `class`, `style` — always applied. Both accept observables and map forms, exactly like [`$class` / `$style`](./decorators.md#reflecting-values-observe-class-style-id-title): `class={[cls_row, { active: o_on }]}`, `style={{ color: oo_color }}`. `false` and `null` add no class or style, so `class={o_on.tf((on) => on && "active")}` and `style={cond && { color: "red" }}` work.
- `id`, `slot`, `part`, `role`, `tabindex`, `lang`, `inert`, `title`, `autofocus`, `nonce`.
- Any `data-*` / `aria-*` key.

Everything else — including `name`, `hidden`, `dir`, `contenteditable`, `spellcheck`, and any custom prop — type-checks against `Attrs<N>` but is **not** auto-applied. The component must read it from `attrs` and apply it itself if it wants that behavior.

```tsx
//@inline-example
import { type Attrs } from "elt"

function Chip(attrs: Attrs<HTMLSpanElement> & { label: string }) {
  // "aria-pressed" and "data-x" below reach the DOM automatically; "hidden" would not.
  return <span class="chip">{attrs.label}</span> as HTMLSpanElement
}

return <Chip label="x" id="c1" aria-pressed="true" data-x="1" />
```

## Reactive attributes

An attribute that should follow changes is typed `o.RO<T>`: either a plain `T` or a read-only observable of it. Use it as is in JSX, or derive from it with `o.tf(attr, fn)` / `o.expression`; read it with `o.get(attr)` only when you need its value at one precise moment (in an event handler, for instance), since that read doesn't follow later changes.

```tsx
import { type Attrs, o } from "elt"

function Badge(attrs: Attrs<HTMLSpanElement> & { count: o.RO<number> }) {
  return <span class="badge">{o.tf(attrs.count, (n) => (n > 99 ? "99+" : String(n)))}</span> as HTMLSpanElement
}
```

## Typing JSX

TypeScript types every JSX expression as `Element`, whatever the tag. Cast when you need the concrete type: `(<div/> as HTMLDivElement)`.

- `e("div", attrs, ...children)` / `E(...)`, the functions JSX compiles to, return precise types (`e("div")` is an `HTMLDivElement`). They are less readable than JSX, so they are not the default.
- Inside a decorator placed among a node's children, the node is fully typed: in `<button>{(btn) => { … }}</button>`, `btn` is an `HTMLButtonElement`.

## Renderable

What a JSX child (and a component's or verb's render function) may be is the type `Renderable` (`src/types.ts`):

- a string, a number, a boolean, `null` or `undefined` (the last three render nothing),
- a `Node`,
- a decorator (a function called with the parent node, see [Decorators](./decorators.md#anatomy-of-a-decorator)),
- an **appender**: an object that inserts its own nodes at its position and keeps them up to date. Verbs (`If`, `Repeat`, …) return appenders, not nodes,
- an array of any of these,
- a read-only observable of any of these: the DOM follows it.

An observable holding something that isn't renderable (an object, a date) must be turned into something renderable first: `o_user.tf((u) => u.name)`.

## SVG

SVG is native: `<svg>…</svg>` and its children are created with the SVG namespace and work like any other JSX, observables and decorators included.

## Fragments

`<>...</>` is a `DocumentFragment`. It never itself becomes attached to a `Node`, so `$observe` / `$connected` / `$disconnected` placed directly on a fragment root do not get lifecycle semantics tied to it: decorators still run when the fragment is created, but nothing stops or restarts them with the document. Use a real element as the observing root when you need connect/disconnect behavior.

## No class components, no ref forwarding

- There are no class-based JSX components — only functions.
- There's no built-in way for a caller to obtain a handle to a component's internal DOM node other than the value the function returns.
- There are no `onClick`-style attrs. Event handling goes through decorators placed as JSX children (`$click`, `$on`, ...) — see [Decorators](./decorators.md#events-on-once-click).

## See also

- [Decorators](./decorators.md) — every `$…` decorator, with runnable examples.
- [elt rules](./elt-rules.md#components) — the rules for components.
- `src/elt.ts` (`e()`, `RefChild`), `src/dom.ts` (`node_append`, `basic_attrs`), `src/types.ts` (`Attrs`, `Renderable`) — source of truth.
