# Import add-ons re-validate mount before write

When an import add-on's `import()` resolves asynchronously, `ctx.replace(value)` and `ctx.merge(value)` must re-check that the target observable is still a valid mount (not `INVALID_MOUNT`, and the resolved factory still `canHandle`s the value) before writing. If the check fails, no-op — no throw, no partial write.

Undo, column truncation, dead-mount detection, or external root writes can invalidate the target while parsing is in flight. Pushing that burden to every add-on author would be error-prone; the write boundary is the single enforcement point.
