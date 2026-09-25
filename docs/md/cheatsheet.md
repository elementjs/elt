---
title: Cheatsheet
---

# Elt Cheatsheet

**Conventions**

When a `.method` is mentioned, it means a method on an observable.

| Prefix | For |
| --- | --- |
| `o_` | A writable observable |
| `oo_` | A readonly observable, usually comes from `.tf` / `o.expression` with no write specified |
| `cls_` | A class coming from `css` : `const cls_bols = css\`\`` |

## Frequently imported symbols

These are used all the time, in all applications

| Use | To |
| --- | --- |
| `o`| as function : create or convert values to observables `o("a string")`, as namespace : all observable utility functions |
| `If` | `If(oo_condition)` |

Observables

| Use | To |
| --- | --- |
| `.tf`| create a new observable from another |
| `o.expression` | like .tf, but involving several observables |
| `o.assign` | simple immutable updates to `.set` new values or in custom transformers |
| `o.mutate` | recommanded way of performing complex immutable updates, in combination with the mutative library and `import "elt/mutative"` |

## Less frequently imported symbols

Avoid them in general

### Observables

| Use | To |
| --- | --- |
| `.join` / `.merge` / `o.combine` | Create an observable from several others, lower level that `o.expression` but a _little_ more performant. |

## Do NOT
