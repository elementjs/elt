import { App } from "elt"

export const app = new App()

export const routes = app.setupRouter({
    init: ["", () => import("./init")]
})

export default routes