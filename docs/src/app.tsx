import { theme } from "elt/ui"
import { $observe, $on, App, If, css, o } from "elt"
import { DOCS_BASE, docs_href } from "./base"
import { routes as routeDefs, menu } from "./routes.ts"

export const app = new App()
export const routes = app.setupRouter(routeDefs, { mode: "path", base: DOCS_BASE || "/" })

// Whether the sidebar is open. Only meaningful below `cls_nav`'s breakpoint, where the nav
// becomes an off-canvas drawer instead of a permanent column.
const o_nav_open = o(false)

function widget_nav_toggle() {
  return (
    <button type="button" class={cls_nav_toggle} aria-label="Toggle navigation" aria-expanded={o_nav_open.tf(String)}>
      {$on("click", () => o_nav_open.set(!o_nav_open.get()))}
      <span></span>
      <span></span>
      <span></span>
    </button>
  )
}

// Dims the page and closes the drawer on tap, so the drawer behaves like a modal on mobile.
function widget_nav_backdrop() {
  return <div class={[cls_nav_backdrop, { open: o_nav_open }]}>{$on("click", () => o_nav_open.set(false))}</div>
}

function widget_nav() {
  return (
    <e-column spacing="nudge-1" pad="section" align="stretch" class={[cls_nav, { open: o_nav_open }]} scroll>
      {menu.map((group) => (
        <e-column spacing="nudge-1" align="stretch" border="none" seams="none">
          {group.section != null ? <e-prose class={cls_section}>{group.section}</e-prose> : null}
          {group.items.map((item) => (
            <a
              href={docs_href(item.url)}
              e-emphasis="bare"
              aria-current={oo_current_name.tf((name) => (name === item.name ? "page" : undefined))}
            >
              {$on("click", () => o_nav_open.set(false))}
              {item.title}
            </a>
          ))}
        </e-column>
      ))}
    </e-column>
  )
}

// Name of the route being displayed, so each link can tell whether it is the current page.
const oo_current_name = app.o_current_route.tf((rt) => rt?.name)

function content_column() {
  return (
    <e-column grow align="stretch" scroll pad="section" tabindex="-1">
      {app.DisplayView("Content")}
    </e-column>
  )
}

// biome-ignore lint/plugin/layout-css: the page never scrolls, its columns do (scroll); no layout attribute clips
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

/* biome-ignore lint/plugin/layout-css: shown only below NAV_BREAKPOINT, and layout attributes don't follow a media
   query; its three bars are drawn by hand, as no icon of elt/ui is a menu icon. */
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

// biome-ignore lint/plugin/theme-colors: the same scrim as show_dialog's backdrop (ui/dialog.tsx); the theme has no scrim color yet
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

/* biome-ignore lint/plugin/layout-css: an off-canvas drawer below NAV_BREAKPOINT (its width, the top padding that
   clears the fixed toggle, its own scroll); layout attributes don't follow a media query. */
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
      transition: transform ${theme.settings.durationMedium} ${theme.settings.easingEnter};
    }

    &.open {
      transform: translateX(0);
    }
  }
}`

// A `/full-example/:page/:n` route runs inside an isolated iframe (see the spec, "@full-example
// routing") — it should show only the example itself, not this app's own nav chrome around it.
const oo_is_full_example = app.o_current_route.tf((rt) => rt?.name.includes("__full-") ?? false)

app.mount(document.body, () =>
  If(oo_is_full_example, content_column, () => (
    <e-row spacing="none" align="stretch" class={cls_main}>
      {$observe(app.o_current_route, () => o_nav_open.set(false))}
      {widget_nav_toggle()}
      {widget_nav_backdrop()}
      {widget_nav()}
      {content_column()}
    </e-row>
  )),
)
