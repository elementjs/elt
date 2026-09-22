import { e, type Renderable } from "elt"
import * as EltNS from "elt"
import * as EltUiNS from "elt/ui"
import type { MdNode } from "./macro.ts"
import { CodeExample } from "elt/ui"

const snippet_imports = { elt: EltNS, "elt/ui": EltUiNS }

/** Turns raw HTML text into an actual DOM node — trusted content only (see specs/markdown-docs.md). */
function rawHtml(html: string): Node {
  const div = document.createElement("div")
  div.innerHTML = html
  return div
}

function children(n: MdNode): Renderable[] {
  const c = n[2]
  if (!Array.isArray(c)) return []
  return c.map(e2)
}

export function e2(n: MdNode): Renderable {
  const [type, meta] = n

  switch (type) {
    // The macro's root node is a synthetic wrapper (Bun.markdown.render has no top-level
    // "document" node of its own — see macro.ts, elt_md) — render its children as a flat list,
    // not inside any extra wrapping element.
    case "root": return children(n)
    case "heading": return e(`h${meta.level}`, meta.id ? { id: meta.id } : null, ...children(n))
    case "paragraph": return e("p", null, ...children(n))
    case "blockquote": return e("blockquote", null, ...children(n))
    case "list": return e(meta.ordered ? "ol" : "ul", null, ...children(n))
    case "listItem": return e("li", null, ...children(n))
    case "hr": return e("hr")
    case "table": return e("table", null, ...children(n))
    case "thead": return e("thead", null, ...children(n))
    case "tbody": return e("tbody", null, ...children(n))
    case "tr": return e("tr", null, ...children(n))
    case "th": return e("th", null, ...children(n))
    case "td": return e("td", null, ...children(n))
    case "strong": return e("strong", null, ...children(n))
    case "emphasis": return e("em", null, ...children(n))
    case "strikethrough": return e("s", null, ...children(n))
    case "codespan": return e("code", null, ...children(n))
    case "link": return e("a", { href: meta.href, title: meta.title }, ...children(n))
    case "image": return e("img", { src: meta.src, alt: meta.alt })
    case "html": return rawHtml(typeof n[2] === "string" ? n[2] : childrenAsText(n))
    case "text": return typeof n[2] === "string" ? n[2] : ""
    case "code": return CodeExample({
      code: typeof n[2] === "string" ? n[2] : "",
      language: meta.language,
      typeErrors: meta.typeErrors,
      compiledFnSource: meta.compiledFnSource,
      highlightedHtml: meta.highlightedHtml,
      imports: snippet_imports,
    })
    default: return ""
  }
}

function childrenAsText(n: MdNode): string {
  if (!Array.isArray(n[2])) return ""
  return n[2].map(c => typeof c[2] === "string" ? c[2] : childrenAsText(c)).join("")
}

export function e2Root(doc: { root: MdNode }): Renderable {
  return e2(doc.root)
}
