---
title: Never do these
section: Start
order: 3
---

# Never do these

**Never do these.** They matter more than every other rule in this documentation. They apply to every application and library built on elt, including elt/ui and anything larger built on it (an editor, a design tool). The only exceptions are the code of elt itself, and glue between elt and a third-party library that does not know about elt. In glue, disable the Biome rule on that line with a comment that says why. If you use Biome, enable the plugins ([Enforcing with Biome](#enforcing-with-biome)). If one of these feels like the natural way to do what you're doing, stop and read the linked rule: the reason and the right alternative are there.

UI code also follows [Never do these with elt/ui](./ui-hard-dont.md).

## The list

1. **`addObserver()` and `removeObserver()`.** Observe with `$observe`, or with the `.observe` method of a service or an `EltCustomElement`. See [elt rules § Hard rules](./elt-rules.md#hard-rules) (rule 3) and [Observables § Observing](./observables.md#observing-observe-nodeobserve-observe).
2. **`node_append`, `node_remove` and `node_clear`.** Structure that follows state is an `If`, a `Repeat` or a `Switch`. A dialog, a popup or an alert, which lives until a promise settles, is a [`show`](./verbs.md#show-content-that-lives-until-a-promise-settles). The root of the app is `app.mount`. See [elt rules § Hard rules](./elt-rules.md#hard-rules) (rules 2 and 9) and [Verbs](./verbs.md).
3. **The DOM's own insertion and removal on nodes elt renders:** `appendChild`, `insertBefore`, `removeChild`, `replaceChildren`, `replaceWith`, `insertAdjacentElement`, `insertAdjacentHTML`, `append`, `remove`, and assigning `innerHTML` or `outerHTML`. They skip elt's connect and disconnect step, so observers and lifecycle callbacks inside never start or stop. See [elt rules § Hard rules](./elt-rules.md#hard-rules) (rule 2). The Biome plugin cannot check `append` and `remove` (`classList.remove`, `FormData.append` and others share the names), so these two are yours to watch.

## Enforcing with Biome

The package ships Biome plugins for the first two rules and for the DOM methods of the third. Add them to your `biome.json`:

```json
{
  "plugins": [
    "./node_modules/elt/lint/no-add-observer.grit",
    "./node_modules/elt/lint/no-node-mutation.grit",
    "./node_modules/elt/lint/no-raw-dom-insertion.grit"
  ]
}
```

A report is an error. Where an exception applies, disable the rule on the line, with the reason:

```ts
// biome-ignore lint/plugin: a third-party widget inserts this node itself
```

An app that does not use an `App` mounts its root with `node_append`, and disables the rule at that one line the same way.
