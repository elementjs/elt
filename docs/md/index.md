---
title: Start here
section: Start
order: 0
---

# elt documentation

elt is a TypeScript library for building web applications with real DOM nodes and observables — no virtual DOM. `elt/ui` is its optional sub-library for theme, layout and widgets.

This page is the entry point for humans and coding agents alike. Pick the page that matches your task; don't read everything up front.

## Where to go

**Start**

| You are… | Read |
| -------- | ---- |
| New to elt, wanting the ideas behind it and a first app | [Introduction](./introduction.md) |
| Coming from React | [elt rules § Hard rules](./elt-rules.md#hard-rules): what is different, on one screen |
| Writing or changing **application code** (observables, verbs, components, routes, services) | [elt rules](./elt-rules.md) — read it in full first, then the topic page below for your subject |
| Writing or changing **UI** with `elt/ui` | [elt/ui rules](./elt-ui-rules.md) — read it in full first, then the UI page below for your subject |
| Converting older elt, elt-shoelace or legacy elt-ui code | [Migrating](./migrating.md) |

**Core**

| Subject | Page |
| ------- | ---- |
| State, derived values, batching | [Observables](./observables.md) |
| Lists, conditions, promises, long lists | [Verbs](./verbs.md) |
| Events, bindings, lifecycle, shadow DOM | [Decorators](./decorators.md) |
| Nodes animating as they enter and leave the page | [Motion](./motion.md) |
| Function components, children, `Renderable` | [Components](./components.md) |
| Routes, services, views, params | [App](./app.md) |
| Styles | [CSS](./css.md) |
| `<e-wrap>`, `EltCustomElement`, `@register`, `@attr` | [Custom elements](./custom-elements.md) |
| `Deferred`, `@memoize` | [Utilities](./utilities.md) |

**UI**

| Subject | Page |
| ------- | ---- |
| Layout elements, spacing, borders, `packed` | [Layout](./ui-layout.md) |
| Prose, text blocks, headings, tables | [Typography](./ui-typography.md) |
| Theme, dark mode, colors, surfaces, custom CSS | [Theme and colors](./ui-theme.md) |
| Buttons, inputs, checkboxes, button groups | [Forms](./ui-forms.md) |
| Select, date/time pickers, app-specific widgets | [Widgets](./ui-widgets.md) |
| Popups, dialogs, motion | [Overlays](./ui-overlays.md) |
| Keyboard shortcuts | [Keyboard shortcuts](./ui-keymap.md) |

**More**

| You are… | Read |
| -------- | ---- |
| Using the object editor (`elt/editor`) | [Object editor](./object-editor.md) — **unstable**: its API may still change |
| Looking at every widget and surface on one page | [Visual test](./visual-test.md) |
| Writing tests for elt or `elt/ui` code | [Testing](./testing.md) |
| Writing pages of this documentation | [About this documentation](./about-this-documentation.md) |

## Reading the docs

Read the rules page for the code you're writing (both for a screen with routing and themed controls: the elt rules first, then the elt/ui rules), then only the section of the one topic page your task needs. Topic pages hold the explanations, the lookup tables and the reasoning for their subject.

## When the docs and the code disagree

The code and its JSDoc (`src/`, `ui/`, `editor/`) win: JSDoc carries exact signatures, the pages carry the full picture with runnable examples. Treat the doc as not yet updated, and flag the mismatch. The list of public exports is `src/index.ts` (and `ui/index.tsx` for `elt/ui`).
