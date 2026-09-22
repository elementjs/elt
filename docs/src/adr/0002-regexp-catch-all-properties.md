# RegExp catch-all object properties

In `object()` schemas, a `PropertyOption` whose `name` is a `RegExp` is a catch-all rule, not a merge key for `.extend()`.

Resolution order for an own key on the object: (1) exact string-named property wins if present earlier in `properties`; (2) otherwise the first RegExp entry whose pattern matches the key; (3) otherwise unknown-mode scalar resolution for that value (when `free_keys` allows the key to exist at all).

When `free_keys` is true and the schema declares at least one RegExp catch-all, a newly added key name must match one of those patterns before it can commit. When no catch-alls exist, free keys use default unknown resolution without a pattern gate.

`.extend({ properties: [...] })` merges string-named entries by name; RegExp entries have no merge key and are appended.
