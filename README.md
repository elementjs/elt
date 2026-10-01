# elt

elt is a [TypeScript](https://typescriptlang.org) library for building web applications. It is an alternative to React, Angular and the like, but it does **not** use a virtual DOM: JSX returns real DOM nodes, and the parts of the page that change are driven by observables, with observing tied to whether a node is in the document.

## Documentation

**Start at [`docs/md/index.md`](./docs/md/index.md)** — the same page is the root of the hosted documentation site. It points humans and coding agents alike to the right page for the task: a narrative introduction, the rules and recipes for core elt and for `elt/ui`, and reference pages. Inside an installed package, it is at `node_modules/elt/docs/md/index.md`.

## Objectives

- Writing and reading code using it **must** be pleasant.
- All overheads induced by its use **should** be kept as low as possible.
- Everything **must** be typed correctly. This library **must** be refactoring-friendly.

## Installation

```bash
npm install elt
```

The package ships TypeScript sources and is meant to be bundled. Setup (`tsconfig.json`) and a first example: [Using elt](./docs/md/using-elt.md).

## Community

Join the [discord](https://discord.gg/A8tKA7q) for questions, or go to the [repository](https://github.com/elementjs/elt) to file issues.
