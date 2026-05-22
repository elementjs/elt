import { App } from "elt"

export const InitDeps = App.Service.factory(async (srv) => {
    await srv.require(import("./base"))
    return {

    }
})

export default class Init extends InitDeps {

}