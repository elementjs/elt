import { $scrollable, App, css, o, view } from "elt"
import { theme } from "elt/ui"

import { app, route_names, widget_menu } from "./routes"

export default class Base extends App.ServiceClass {

  o_font = o("IBM Plex Sans")

  DisplayTitle() {
    return app.o_current_route.tf(act => {
      if (!act) return null
      const label = route_names.get(act)
      if (!label) return null
      return <h1>{label}</h1>
    })
  }

  @view
  Main() {
    return <e-flex column class={[cls_fullscreen]} style={{fontFamily: this.o_font.tf(ft => `${ft}, system-ui`)}}>
      {/* <header class={[cls_header, theme.class_light, theme.colors.blue.as_background]}>
        <nav>
          <EltLogo/>
          <button>{$click(() => routes.home.activate())} Home</button>
          <button>{$click(() => routes.buttons.activate())} Buttons</button>
          <button>Widgets <P.Table/></button>
          <button>Help <P.Question/></button>
        </nav>
      </header> */}

      <e-flex grow class={cls_main} align="stretch">
        <menu class={cls_aside_nav}>
          {$scrollable}
          {widget_menu()}
        </menu>
        <e-flex column grow>
          {$scrollable}
          {this.srv.DisplayView("Content")}
        </e-flex>
      </e-flex>
    </e-flex>
  }

}

const cls_aside_nav = css`.aside_nav {
  width: 240px;
  border-right: 1px solid ${theme.colors.text.mid};
}`

const cls_main = css`.main {
  height: 100%;
  overflow: hidden;
}`

const cls_fullscreen = css`.fullscreen {
  width: 100%;
  height: 100%;
}`

const cls_header = css`.header {
  display: flex;
  width: 100%;
}`
