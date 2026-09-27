import "elt/ui"
import { $scrollable, App, If, node_append, css } from "elt"
import { routes as routeDefs, menu } from "./routes.ts"

export const app = new App()
export const routes = app.setupRouter(routeDefs)

function widget_nav() {
  return <e-column packed align="stretch">
    {menu.map((group) => <e-column packed align="stretch">
      {group.section != null ? <e-block class={cls_section}>{group.section}</e-block> : null}
      {group.items.map((item) => <a href={`#${item.url}`}>{item.title}</a>)}
    </e-column>)}
  </e-column>
}

function content_column() {
  return <e-column grow>
    {$scrollable}
    {app.DisplayView("Content")}
  </e-column>
}

const cls_main = css`.main {
  height: 100%;
  width: 100%;
  overflow: hidden;
}`

const cls_section = css`.section {
  opacity: 0.6;
  font-size: 0.85em;
  text-transform: uppercase;
}`

// A `/full-example/:page/:n` route runs inside an isolated iframe (see the spec, "@full-example
// routing") — it should show only the example itself, not this app's own nav chrome around it.
const oo_is_full_example = app.o_current_route.tf((rt) => rt?.name.includes("__full-") ?? false)

node_append(document.body, If(oo_is_full_example,
  content_column,
  () => <e-row align="stretch" class={cls_main}>
    {widget_nav()}
    {content_column()}
  </e-row>,
))
