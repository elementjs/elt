import { App } from "elt"

export const app = new App()

export const routes = app.setupRouter({
    buttons: ["/buttons", () => import("./buttons")],
    home: ["/home", () => import("./home")],
    typography: ["/typography", () => import("./typography")],
    init: ["", () => import("./init")]
})

export default routes
