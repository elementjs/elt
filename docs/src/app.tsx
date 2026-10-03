import "elt/ui"
import { $observe, $on, App, If, node_append, css, o } from "elt"
import { routes as routeDefs, menu } from "./routes.ts"

export const app = new App()
export const routes = app.setupRouter(routeDefs, { mode: "path" })

// Whether the sidebar is open. Only meaningful below `cls_nav`'s breakpoint, where the nav
// becomes an off-canvas drawer instead of a permanent column.
const o_nav_open = o(false)

function widget_nav_toggle() {
  return <button type="button" class={cls_nav_toggle} aria-label="Toggle navigation" aria-expanded={o_nav_open.tf(String)}>
    {$on("click", () => o_nav_open.set(!o_nav_open.get()))}
    <span></span><span></span><span></span>
  </button>
}

// Dims the page and closes the drawer on tap, so the drawer behaves like a modal on mobile.
function widget_nav_backdrop() {
  return <div class={[cls_nav_backdrop, { open: o_nav_open }]}>
    {$on("click", () => o_nav_open.set(false))}
  </div>
}

function widget_nav() {
  return <e-column packed="widget" align="stretch" class={[cls_nav, { open: o_nav_open }]} scroll>
    {menu.map((group) => <e-column packed align="stretch">
      {group.section != null ? <e-prose class={cls_section}>{group.section}</e-prose> : null}
      {group.items.map((item) => <a href={`${item.url}`}>
        {$on("click", () => o_nav_open.set(false))}
        {item.title}
      </a>)}
    </e-column>)}
  </e-column>
}

function content_column() {
  return <e-column grow align="stretch" scroll>
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

// Below this width the sidebar becomes a toggleable off-canvas drawer instead of a permanent column.
const NAV_BREAKPOINT = "860px"

const cls_nav_toggle = css`.nav-toggle {
  display: none;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: 4px;
  position: fixed;
  top: 0.5rem;
  left: 0.5rem;
  z-index: 101;
  width: 2.25rem;
  height: 2.25rem;
  padding: 0.4rem;
  border: none;
  border-radius: 4px;
  background: var(--e-color-bg);
  color: inherit;
  cursor: pointer;

  & > span {
    display: block;
    height: 2px;
    border-radius: 1px;
    background: currentColor;
  }

  @media (max-width: ${NAV_BREAKPOINT}) {
    & {
      display: flex;
    }
  }
}`

const cls_nav_backdrop = css`.nav-backdrop {
  display: none;

  @media (max-width: ${NAV_BREAKPOINT}) {
    &.open {
      display: block;
      position: fixed;
      inset: 0;
      z-index: 99;
      background: rgba(0, 0, 0, 0.4);
    }
  }
}`

const cls_nav = css`.nav {
  @media (max-width: ${NAV_BREAKPOINT}) {
    & {
      position: fixed;
      top: 0;
      left: 0;
      bottom: 0;
      z-index: 100;
      width: min(80vw, 320px);
      padding-top: 3.5rem;
      background: var(--e-color-bg);
      overflow-y: auto;
      transform: translateX(-100%);
      transition: transform 0.2s ease;
    }

    &.open {
      transform: translateX(0);
    }
  }
}`

// A `/full-example/:page/:n` route runs inside an isolated iframe (see the spec, "@full-example
// routing") — it should show only the example itself, not this app's own nav chrome around it.
const oo_is_full_example = app.o_current_route.tf((rt) => rt?.name.includes("__full-") ?? false)

node_append(document.body, If(oo_is_full_example,
  content_column,
  () => <e-row spacing="none" align="stretch" class={cls_main}>
    {$observe(app.o_current_route, () => o_nav_open.set(false))}
    {widget_nav_toggle()}
    {widget_nav_backdrop()}
    {widget_nav()}
    {content_column()}
  </e-row>,
))
