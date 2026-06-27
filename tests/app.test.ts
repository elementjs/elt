///<reference types="bun">
import "./setup.ts"

import { test, expect, describe } from "bun:test"

import { App } from "../src/app"
import type { ServiceBuilderFunction, ServiceHelper } from "../src/app/service"

function home_srv(srv: ServiceHelper) {
  srv.views.set("Main", () => "home")
}

function user_srv(srv: ServiceHelper<{ id: string }>) {
  user_srv.builds = (user_srv.builds ?? 0) + 1
  srv.param("id")
  srv.views.set("Main", () => "user")
}
user_srv.builds = 0

function list_srv(srv: ServiceHelper<{ filter?: string }>) {
  list_srv.builds = (list_srv.builds ?? 0) + 1
  srv.param_soft("filter", "")
  srv.views.set("Main", () => "list")
}
list_srv.builds = 0

const base_srv: ServiceBuilderFunction<{}> = (srv) => {
  srv.views.set("Slot", () => "base")
}

const leaf_srv: ServiceBuilderFunction<{}> = async (srv) => {
  await srv.require(base_srv)
  srv.views.set("Slot", () => "leaf")
}

describe("App", () => {
  test("route activation registers views on the app", async () => {
    const app = new App()
    const router = app.setupRouter({
      home: ["/home", () => home_srv],
    })

    await router.home.activate()
    expect(app.o_views.get().get("Main")?.()).toBe("home")
    expect(app.o_active_service.get()).not.toBeNull()
    expect(app.o_current_route.get()?.name).toBe("home")
  })

  test("param() invalidates the service when a hard-bound param changes", async () => {
    user_srv.builds = 0
    const app = new App()
    const router = app.setupRouter({
      user: ["/users/:id", () => user_srv],
    })

    await router.user.activate({ id: "1" })
    expect(user_srv.builds).toBe(1)

    await router.user.activate({ id: "2" })
    expect(user_srv.builds).toBe(2)
  })

  test("param_soft() does not invalidate when the param value changes", async () => {
    list_srv.builds = 0
    const app = new App()
    const router = app.setupRouter({
      list: ["/list", () => list_srv],
    })

    await router.list.activate({ filter: "a" })
    expect(list_srv.builds).toBe(1)

    app.o_params.set({ filter: "b" })
    expect(list_srv.builds).toBe(1)
  })

  test("active service view shadows the same name on a required service", async () => {
    const app = new App()
    const router = app.setupRouter({
      leaf: ["/leaf", () => leaf_srv],
    })

    await router.leaf.activate()
    expect(app.o_views.get().get("Slot")?.()).toBe("leaf")
  })
})
