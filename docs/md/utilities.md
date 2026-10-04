---
title: Utilities
section: Core
order: 80
---

# Utilities

Small helpers exported by `"elt"`, used by elt itself and handy in app code.

## `Deferred`

A promise you resolve or reject from outside:

```ts
import { Deferred } from "elt"

const d = new Deferred<number>()

d.resolve(1)        // or d.reject(err), from anywhere
const n = await d   // a Deferred is thenable
```

- `d.promise` is the underlying `Promise`, for an API that requires a real one.
- `then`, `catch` and `finally` work as on a promise.
- It is handy as the input of [`DisplayPromise`](./verbs.md#displaypromise-a-promises-lifecycle) when the result arrives through a callback.

## `is_promise_like`

`is_promise_like(v)` tells whether `v` is a promise or any other "thenable" (an object with a `then` method), the test `await` itself makes. As a type guard, it narrows `v` to `PromiseLike<T>`:

```ts
import { is_promise_like } from "elt"

function show(v: string[] | Promise<string[]>) {
  if (is_promise_like<string[]>(v)) v.then(render)
  else render(v)
}
```

## `@memoize`

On a class getter, computes the value on first access and caches it per instance:

```ts
import { memoize } from "elt"

class Report {
  @memoize
  get totals() {
    return compute_totals(this.rows)  // runs once per instance
  }
}
```

- A `null` or `undefined` result is not cached: the getter runs again on the next access.
- It works with both legacy (`experimentalDecorators`) and standard decorators.

## See also

- `src/utils.ts` — source of truth.
