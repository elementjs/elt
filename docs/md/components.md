---
title: Components
section: Core Library
---

# Components

A component is a plain function used as a JSX tag. No classes, no virtual DOM: `e()` calls the
function and uses whatever `Node` it returns.

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

Whether a component receives a second argument (a `RefChild`) is decided by
`fn.length` — the number of declared parameters *before* the first one with a default
value. `(attrs, ref) => ...` has `length === 2` and gets a `RefChild`. `(attrs = {}, ref) => ...`
has `length === 0`: it silently becomes a one-arg component and `ref` is always `undefined`.

> Don't give `attrs` a default value on a two-arg component — it breaks `RefChild` delivery with
> no error.

## `RefChild` — placing children explicitly

```tsx
//@inline-example
import { Attrs, RefChild } from "elt"

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

`ref.IfChildren(fn)` scaffolds only when JSX children were actually passed, and returns a
placeholder you must embed in the returned tree (not `ref` itself):

```tsx
//@inline-example
import { Attrs, RefChild } from "elt"

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

- Use **either** bare `{ref}` **or** `ref.IfChildren(...)`, never both. This is a convention, not
  enforced by the library — mixing them is undefined behavior.
- A two-arg component that places `ref` nowhere behaves exactly like a one-arg component: children
  are appended at the end of the root.

## Global attrs on `<Comp id class style .../>`

After the component returns, `node_append` applies a fixed set of attributes to the **root
node**, whether or not the component reads or forwards them from `attrs`:

- `class`, `style` — always applied.
- `id`, `slot`, `part`, `role`, `tabindex`, `lang`, `inert`, `title`, `autofocus`, `nonce`.
- Any `data-*` / `aria-*` key.

Everything else — including `name`, `hidden`, `dir`, `contenteditable`, `spellcheck`, and any
custom prop — type-checks against `Attrs<N>` but is **not** auto-applied. The component must read
it from `attrs` and apply it itself if it wants that behavior.

```tsx
//@inline-example
import { Attrs } from "elt"

function Chip(attrs: Attrs<HTMLSpanElement> & { label: string }) {
  // "aria-pressed" and "data-x" below reach the DOM automatically; "hidden" would not.
  return <span class="chip">{attrs.label}</span> as HTMLSpanElement
}

return <Chip label="x" id="c1" aria-pressed="true" data-x="1" />
```

## Fragments

`<>...</>` is a `DocumentFragment`. It never itself becomes attached to a `Node`, so `$observe` /
`$connected` / `$disconnected` placed directly on a fragment root do not get lifecycle semantics
tied to it. Use a real element as the observing root when you need connect/disconnect behavior.

## No class components, no ref forwarding

- There are no class-based JSX components — only functions.
- There's no built-in way for a caller to obtain a handle to a component's internal DOM node
  other than the value the function returns.
- There are no `onClick`-style attrs. Event handling goes through decorators placed as JSX
  children (`$click`, `$on`, ...) — see [`decorators.md`](./decorators.md).

## See also

- [`decorators.md`](./decorators.md) — every `$…` decorator, with runnable examples.
- [`using-elt-agent.md`](./using-elt-agent.md) — hard rules, routes/services, decorators.
- [`cheatsheet.md`](./cheatsheet.md) — quick reference tables.
- `src/elt.ts` (`e()`, `RefChild`), `src/dom.ts` (`node_append`, `basic_attrs`), `src/types.ts`
  (`Attrs`, `Renderable`) — source of truth.
