// The path the docs site is served under, fixed at build time from `DOCS_BASE` (docs/src/macro.ts,
// docs_base): "" at the root, "/elt" on GitHub Pages.
import { docs_base } from "./macro" with { type: "macro" }

export const DOCS_BASE: string = docs_base()

/** A route path of the site ("/", "/app#x") as a link: under the base. */
export function docs_href(route: string): string {
  return DOCS_BASE + route
}
