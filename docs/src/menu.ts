// Runtime-safe menu building — split out of macro.ts specifically because macro.ts has top-level
// Bun-only code (`new Bun.Glob(...)`, etc — see elt_md's own scan), so anything that plain-imports
// macro.ts (not through the `{ type: "macro" }` assertion) drags that in too, including into the
// client bundle. `routes.generated.ts` needs `buildMenu` as a real runtime import (see "Menu" in the
// spec — it reads frontmatter live off each statically-imported page module), so `buildMenu` and the
// types it needs live here instead, where nothing references `Bun` at module scope.

export type Frontmatter = {
  title?: string
  order?: number
  section?: string
}

/** One entry of the generated menu, grouped by section (see buildMenu). */
export type MenuEntry = { name: string; title: string; url: string; order: number }
export type MenuGroup = { section: string | null; items: MenuEntry[] }

/** section=null (ungrouped) first, then sections alphabetically; each group sorted by order, then
 * title. Called at runtime by routes.generated.ts, over frontmatter read live off each
 * statically-imported page module — see "Menu" in the spec. */
export function buildMenu(pages: { name: string; url: string; frontmatter: Frontmatter }[]): MenuGroup[] {
  const groups = new Map<string | null, MenuEntry[]>()
  for (const p of pages) {
    const section = p.frontmatter.section ?? null
    const entry: MenuEntry = {
      name: p.name,
      title: p.frontmatter.title ?? p.name,
      url: p.url,
      order: p.frontmatter.order ?? Number.MAX_SAFE_INTEGER,
    }
    const arr = groups.get(section) ?? []
    arr.push(entry)
    groups.set(section, arr)
  }
  for (const items of groups.values()) {
    items.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
  }
  const sections = [...groups.keys()].filter((s): s is string => s != null).sort()
  const out: MenuGroup[] = []
  if (groups.has(null)) out.push({ section: null, items: groups.get(null)! })
  for (const s of sections) out.push({ section: s, items: groups.get(s)! })
  return out
}
