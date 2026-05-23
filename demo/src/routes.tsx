import { $click, App, type Renderable } from "elt"

import * as P from "elt-phosphor"

export const app = new App()

export const routes = app.setupRouter({
  buttons: ["/buttons", () => import("./buttons")],
  home: ["/home", () => import("./home")],
  typography: ["/typography", () => import("./typography")],
  init: ["", () => import("./init")]
})

const R = (route: App.Route | null, label: Renderable) =>
  <button>{$click(() => route?.activate())} {label}</button>

export const widget_menu = () => <>
  {R(routes.home, "Home")}
  <hr/>
  <h3>Widgets</h3>
  {R(null, <><P.PaintBrushBroad/> Theming</>)}
  {R(routes.typography, <><P.TextT/> Typography</>)}
  {R(routes.buttons, <><P.RadioButton/> Buttons</>)}
  {R(null, <><P.Browser/> Dialogs</>)}
</>


export default routes
