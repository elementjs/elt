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

The package ships Biome plugins in `lint/`, for the rules above and for others of [elt rules](./elt-rules.md) and [elt/ui rules](./elt-ui-rules.md) that the shape of the code shows. Add the files to your `biome.json`'s `plugins`. Each report says what to do instead and where the rule is explained.

| Plugin | Checks |
| --- | --- |
| `no-add-observer.grit` | No `addObserver` / `removeObserver` (rule 1) |
| `no-node-mutation.grit` | No `node_append`, `node_remove`, `node_clear` (rule 2) |
| `no-raw-dom-insertion.grit` | No DOM insertion or removal methods, but `append` and `remove` (rule 3) |
| `no-event-listener.grit` | No `addEventListener` / `removeEventListener`: `node_add_event_listener` or a decorator ([Decorators](./decorators.md#writing-your-own-decorator)) |
| `observable-prefix.grit` | `o_` for a writable observable, `oo_` for a read-only one, read from the call that makes it ([elt rules § Naming](./elt-rules.md#naming)) |
| `out-prefix.grit` | Anything typed `o.Out<T>` (an attribute, an option, a parameter) is named `out_<name>` ([elt rules § Naming](./elt-rules.md#naming)) |
| `out-no-read.grit` | A component never reads or renders an `out_` attribute (`out_x.get()` is already a type error) |
| `fragment-decorator.grit` | No decorator directly in a fragment `<>…</>` ([Components § Fragments](./components.md#fragments)) |
| `attr-declare.grit` | An `@attr` property is `declare`d, with no initializer ([Custom elements](./custom-elements.md#registertag-and-attr)) |
| `await-activate.grit` | A route's activation is awaited, as a statement `router.<route>.activate()` is not ([App](./app.md#activation)) |
| `css-top-level.grit` | `css` is called at the top level of a module ([CSS](./css.md#organizing-styles)) |
| `css-class-prefix.grit` | A class returned by `css` is named `cls_<name>` |
| `css-one-rule.grit` | One rule per `css` call, nested rules included, or an `@layer` block ([CSS](./css.md#the-css-tagged-template)) |
| `icon-button-name.grit` | A button with only an icon has a name ([elt/ui rules § Controls](./elt-ui-rules.md#controls)) |
| `no-margin.grit` | No margin but `0` in a `css` call ([Never do these with elt/ui](./ui-hard-dont.md), rule 1) |
| `theme-colors.grit` | No hex, `rgb()`, `hsl()` or `oklch()` color in a `css` call ([Theme](./ui-theme.md#colors)) |
| `motion-tokens.grit` | No duration or easing function written in a `css` call: the theme's tokens ([Overlays § Motion](./ui-overlays.md#motion)) |
| `layout-css.grit` | Layout CSS carries its reason ([Never do these with elt/ui § Check before you write](./ui-hard-dont.md#check-before-you-write)) |

The last four are for code that uses elt/ui, not for elt/ui itself, which implements the layout and the theme. The CSS checks read the text of a `` css`…` `` call: what an interpolation `${…}` holds isn't seen, and named colors (`red`) aren't checked. `observable-prefix.grit` has no types: it doesn't check an observable whose kind the call doesn't show (a function's result, a destructured one).

A report is an error. Where an exception applies, disable the rule on the line, naming the plugin, with the reason:

```ts
// biome-ignore lint/plugin/no-raw-dom-insertion: a third-party widget inserts this node itself
```

An app that does not use an `App` mounts its root with `node_append`, and disables the rule at that one line the same way. A file that calls `css` in functions whose results are cached may disable `css-top-level` for the whole file, with `// biome-ignore-all lint/plugin/css-top-level: <reason>` on its first line.
