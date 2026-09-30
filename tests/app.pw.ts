import { expect, test } from "@playwright/test"

test.beforeEach(async ({ page }) => {
  await page.goto("/tests/browser/harness.html")
})

test.describe("App", () => {
  test.afterEach(async ({ page }) => {
    await page.evaluate(() => {
      window.location.hash = ""
    })
  })

  test("route activation registers views on the app", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { App } = window.__ELT__

      async function home_srv(srv: import("elt").ServiceHelper) {
        srv.views.set("Main", () => "home")
      }

      const app = new App()
      const router = app.setupRouter({
        home: ["/home", () => home_srv],
      })

      await router.home.activate()
      return {
        main_view: app.o_views.get().get("Main")?.(),
        active_service_not_null: app.o_active_service.get() !== null,
        current_route_name: app.o_current_route.get()?.name,
      }
    })

    expect(result.main_view).toBe("home")
    expect(result.active_service_not_null).toBe(true)
    expect(result.current_route_name).toBe("home")
  })

  test("a failing activation rejects and leaves the app no longer activating", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { App } = window.__ELT__

      async function bad_srv(_srv: import("elt").ServiceHelper) {
        throw new Error("boom")
      }

      const app = new App()
      const router = app.setupRouter({ bad: ["/bad", () => bad_srv] })
      let message = "no error"
      try {
        await router.bad.activate()
      } catch (e) {
        message = (e as Error).message
      }
      return { message, activating: app.o_activating.get() }
    })
    expect(result).toEqual({ message: "boom", activating: false })
  })

  test("a failing activation superseded by a newer one drops its error and the newer one wins", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { App } = window.__ELT__

      let fail!: () => void
      const bad_gate = new Promise<void>((_, reject) => {
        fail = () => reject(new Error("boom"))
      })
      async function bad_srv(_srv: import("elt").ServiceHelper) {
        await bad_gate
      }
      async function good_srv(srv: import("elt").ServiceHelper) {
        srv.views.set("Main", () => "good")
      }

      const app = new App()
      const router = app.setupRouter({ bad: ["/bad", () => bad_srv], good: ["/good", () => good_srv] })
      const first = router.bad.activate()
      // wait until the first activation is actually running before requesting the second one
      while (!app.o_activating.get()) await new Promise((r) => setTimeout(r, 0))
      const second = router.good.activate()
      fail()
      let first_outcome = "resolved"
      await first.catch(() => (first_outcome = "rejected"))
      await second
      // the reactivation runs detached from `first`; wait for it to settle
      while (app.o_activating.get()) await new Promise((r) => setTimeout(r, 0))
      return { first_outcome, main_view: app.o_views.get().get("Main")?.() }
    })
    expect(result).toEqual({ first_outcome: "resolved", main_view: "good" })
  })

  test("param() invalidates the service when a hard-bound param changes", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { App } = window.__ELT__

      let builds = 0
      async function user_srv(srv: import("elt").ServiceHelper<{ id: string }>) {
        builds++
        srv.param("id")
        srv.views.set("Main", () => "user")
      }

      const app = new App()
      const router = app.setupRouter({
        user: ["/users/:id", () => user_srv],
      })

      await router.user.activate({ id: "1" })
      const after_first = builds

      await router.user.activate({ id: "2" })
      const after_second = builds

      return { after_first, after_second }
    })

    expect(result.after_first).toBe(1)
    expect(result.after_second).toBe(2)
  })

  test("param_soft() does not invalidate when the param value changes", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { App } = window.__ELT__

      let builds = 0
      async function list_srv(srv: import("elt").ServiceHelper<{ filter?: string }>) {
        builds++
        srv.param_soft("filter", "")
        srv.views.set("Main", () => "list")
      }

      const app = new App()
      const router = app.setupRouter({
        list: ["/list", () => list_srv],
      })

      await router.list.activate({ filter: "a" })
      const after_activate = builds

      app.o_params.set({ filter: "b" })
      const after_set = builds

      return { after_activate, after_set }
    })

    expect(result.after_activate).toBe(1)
    expect(result.after_set).toBe(1)
  })

  test("active service view shadows the same name on a required service", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { App } = window.__ELT__

      const base_srv: import("elt").ServiceBuilderFunction<void> = async (srv) => {
        srv.views.set("Slot", () => "base")
      }

      const leaf_srv: import("elt").ServiceBuilderFunction<void> = async (srv) => {
        await srv.require(base_srv)
        srv.views.set("Slot", () => "leaf")
      }

      const app = new App()
      const router = app.setupRouter({
        leaf: ["/leaf", () => leaf_srv],
      })

      await router.leaf.activate()
      return app.o_views.get().get("Slot")?.()
    })

    expect(result).toBe("leaf")
  })
})
