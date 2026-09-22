import "elt/ui"
import { $click, App, node_append, Service, view } from "elt"
import { e2Root } from "./e2.tsx"

// File registration: a `with { type: "text" }` import registers each page as a watched bundler
// dependency (so editing it hot-reloads); the macro can't receive that import's value directly
// (Bun macro arguments must be statically known), so it re-reads the same file itself by literal
// path. Both must name the same file. See specs/markdown-docs.md, "File registration".
import "./README.md" with { type: "text" }
import "./visual-test.md" with { type: "text" }
import { elt_md } from "./macro.ts" with { type: "macro" }

const readme = await elt_md("./README.md")
const visual_test = await elt_md("./visual-test.md")

export const app = new App()

// A class *expression* built per page inside a loop can't carry `@view` (`experimentalDecorators`
// rejects decorators on non-declaration classes — confirmed by testing), so each page is a plain
// top-level class declaration rather than a generated one. Bulk migration of the rest of
// docs/src/*.md into routed pages (see specs/markdown-docs.md, "Content migration") means more of
// these, added by hand the same way.
class ReadmePage extends Service({}) {
  @view
  Content() {
    return <e-block typographic pad>{e2Root(readme)}</e-block>
  }
}

class VisualTestPage extends Service({}) {
  @view
  Content() {
    return <e-block typographic pad>{e2Root(visual_test)}</e-block>
  }
}

export const routes = app.setupRouter({
  readme: ["", () => ReadmePage],
  visual_test: ["/visual-test", () => VisualTestPage],
})

function widget_nav() {
  return <nav>
    <button>
      {$click(() => routes.readme.activate())}
      {readme.frontmatter.title}
    </button>
    <button>
      {$click(() => routes.visual_test.activate())}
      {visual_test.frontmatter.title}
    </button>
  </nav>
}

node_append(document.body, <e-row align="stretch">
  {widget_nav()}
  <e-column grow>{app.DisplayView("Content")}</e-column>
</e-row>)
