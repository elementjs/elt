---
title: Start here
order: -1
---

# elt documentation

elt is a TypeScript library for building web applications with real DOM nodes and observables — no virtual DOM. `elt/ui` is its optional sub-library for theme, layout and widgets.

This page is the entry point for humans and coding agents alike. Pick the **one** page that matches your task below; don't read everything up front.

## Where to go

| You are… | Read |
| -------- | ---- |
| New to elt, wanting the ideas behind it | [Using elt](./using-elt.md), then [Using elt/ui](./using-elt-ui.md) if you use the UI sub-library |
| Coming from React, wanting a one-page summary | [Cheatsheet](./cheatsheet.md) |
| Writing or changing **application code** with core elt (observables, verbs, components, routes, services) | [elt guide](./elt-guide.md) |
| Building or changing **UI** with `elt/ui` (layout, spacing, theme, colors, forms, widgets) | [elt/ui guide](./elt-ui-guide.md) — its Hard rules apply to all UI work |
| Looking up an `elt/ui` attribute, theme helper, widget option or export | [elt/ui reference](./elt-ui-reference.md) |
| Needing the **why** behind a UI rule, or judging a case the rules don't cover | [elt/ui guidelines](./ui-guidelines.md) |
| Going deep on one core concept | [Observables](./observables.md), [Verbs](./verbs.md), [Decorators](./decorators.md), [Components](./components.md), [App](./app.md), [Custom elements](./custom-elements.md) |
| Writing tests for elt or `elt/ui` code | [Testing](./testing.md) |
| Using the object editor (`elt/editor`) | [Object editor](./object-editor.md) — **unstable**: its API may still change |
| Writing pages of this documentation | [About this documentation](./about-this-documentation.md) |

When a task spans several rows (a new screen with routing and themed controls, for instance), read the core guide first, then the UI guide for the UI-specific parts only.

## Reading a guide

The two guides are sectioned so you can stop early: read **Hard rules** first (always), then only the section that matches the task — color work, for instance, only needs the UI guide's colors section. Reference pages are for lookup when a rule or a recipe sends you there.

## When the docs and the code disagree

The code and its JSDoc (`src/`, `ui/`, `editor/`) win. Treat the doc as not yet updated, and flag the mismatch.
