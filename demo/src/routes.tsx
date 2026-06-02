import { $click, App, css, type Attrs, type Renderable } from "elt"
import { theme } from "elt/ui"
import * as P from "elt-phosphor"
import { EltLogo } from "./widgets/logo"

export const app = new App()

export const routes = app.setupRouter({
  buttons: ["/buttons", () => import("./buttons")],
  home: ["/home", () => import("./home")],
  ui_usage: ["/ui-usage", () => import("./screen-ui-usage")],
  screen_select: ["/screen-select", () => import("./screen-select")],
  typography: ["/typography", () => import("./screen-typography")],
  date: ["/date", () => import("./date")],
  visual_test: ["/visual-test", () => import("./screen-visual-test")],
  layout: ["/layout", () => import("./screen-layout")],
  init: ["", () => import("./init")]
})

const R = (route: App.Route | null, icon: (at: Attrs<Element>) => Element, label: Renderable) => {
  if (route) {
    route_names.set(route, label)
  }

  const building = route == null ? cls_building : null

  return <button class={building}>{$click(() => route?.activate())} {route == null ? <P.Barricade/> : icon({})} <span>{label}</span> </button>
}

const cls_building = [css`.building {
  color: ${theme.colors.tint.faded};
}`, theme.colors.orange.as_tint]

export const route_names = new Map<App.Route, Renderable>()

export const widget_menu = () => <>
  {R(routes.home, EltLogo, "Home")}
  <hr/>
  <h3>Elt</h3>
  {R(null, P.Eye, "Observables")}
  {R(null, P.CurrencyDollar, "Decorators")}
  {R(null, P.SneakerMove, "Verbs")}
  {R(null, P.AppWindow, "App")}
  <hr/>
  <h3>UI Theming</h3>
  {R(routes.ui_usage, P.Play, "Usage")}
  {R(null, P.PaintBrushBroad, "Colors")}
  {R(routes.layout, P.Layout, "Layout")}
  {R(routes.typography, P.TextT, "Typography")}
  <hr/>
  <h3>UI Helpers</h3>
  {R(null, P.Keyboard, "Keymap")}
  <hr/>
  <h3>UI Widgets</h3>
  {R(routes.buttons, P.RadioButton, "Form Elements")}
  {R(routes.date, P.Calendar, "Time / Datepicker")}
  {R(routes.screen_select, P.AppWindow, "Select")}
  {R(null, P.Browser, "Dialog")}
  {R(null, P.Calendar, "Popup / Tooltips")}
  {R(null, P.List, "Menu")}
  <hr/>
  <h3>UI Recipes</h3>
  {R(routes.visual_test, P.MonitorPlay, "Visual Test")}
</>


export default routes
