/// <reference types="bun" />
// Runs observable.bench.ts in Bun. Bun has no DOM, but loading the observable module reads `window` and
// subclasses `Comment` (src/dom.ts): give them stand-ins first. The benchmark itself never touches the DOM.
const g = globalThis as any
g.window = g
g.Comment = class {}

// A dynamic import, so that it runs after the stand-ins above (static imports would run first).
await import("./observable.bench")

// Makes this file a module for TypeScript, which allows the top-level `await` above.
export {}
