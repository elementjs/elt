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

      async function home_srv(srv: import("elt").ServiceHelper<any>) {
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
      async function good_srv(srv: import("elt").ServiceHelper<any>) {
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

// See docs/md/app.md, "Hash mode and path mode"
test.describe("Router", () => {
  test("rejects invalid options and route paths", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { App } = window.__ELT__
      const srv = () => async () => {}
      const error = (fn: () => void) => {
        try {
          fn()
          return "no error"
        } catch (e) {
          return (e as Error).message
        }
      }
      return {
        base_in_hash_mode: error(() => new App().setupRouter({}, { base: "/app" })),
        intercept_in_hash_mode: error(() => new App().setupRouter({}, { intercept_links: false })),
        scroll_in_hash_mode: error(() => new App().setupRouter({}, { scroll_to_fragment: false })),
        relative_base: error(() => new App().setupRouter({}, { mode: "path", base: "app" })),
        rest_not_last: error(() => new App().setupRouter({ r: ["/f/:p*/x", srv] })),
      }
    })
    expect(result.base_in_hash_mode).toContain("mode")
    expect(result.intercept_in_hash_mode).toContain("mode")
    expect(result.scroll_in_hash_mode).toContain("scroll_to_fragment")
    expect(result.relative_base).toContain("must start with")
    expect(result.rest_not_last).toContain("last token")
  })

  test("path params are percent-encoded when building a URL and decoded when matching", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { App } = window.__ELT__
      const app = new App()
      const routes = app.setupRouter({
        file: ["/files/:name", () => async (srv: import("elt").ServiceHelper<any>) => void srv.param("name")],
      })
      const url = routes.file.urlFor({ name: "a/b?c #%" })
      history.replaceState(null, "", url)
      await app.router.activateFromUrl(true)
      return { url, name: app.o_params.get().name }
    })
    expect(result.url.endsWith("#/files/a%2Fb%3Fc%20%23%25")).toBe(true)
    expect(result.name).toBe("a/b?c #%")
  })

  test(":name matches one segment, :name* the rest, literals are escaped, first registered wins", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { App } = window.__ELT__
      const srv = () => async () => {}
      const app = new App()
      const routes = app.setupRouter({
        two: ["/a/:x/:y", srv],
        rest: ["/files/:path*", srv],
        dot: ["/v.1/:n", srv],
        first: ["/x/:a", srv],
        second: ["/x/:b", srv],
        exact: ["/x/new", srv],
      })
      const m = (p: string) => {
        const r = app.router.match(p)
        return r ? { name: r.route.name, params: r.params } : null
      }
      return {
        three_segments: m("/a/1/2/3"),
        two_segments: m("/a/1/2"),
        rest: m("/files/a/b%2Fc"),
        rest_empty: [m("/files"), m("/files/")],
        dot_literal: m("/vx1/2"),
        order: m("/x/1"),
        exact: m("/x/new"),
        rest_url: routes.rest.urlFor({ path: "a b/c" }),
      }
    })
    expect(result.three_segments).toBeNull()
    expect(result.two_segments).toEqual({ name: "two", params: { x: 1, y: 2 } })
    expect(result.rest).toEqual({ name: "rest", params: { path: "a/b/c" } })
    expect(result.rest_empty).toEqual([null, null])
    expect(result.dot_literal).toBeNull()
    expect(result.order?.name).toBe("first")
    expect(result.exact?.name).toBe("exact")
    expect(result.rest_url.endsWith("#/files/a%20b/c")).toBe(true)
  })

  test("the route query splits at the first ? and first =, keeps +, and path params win", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { App } = window.__ELT__
      const app = new App()
      app.setupRouter({
        q: [
          "/q/:id",
          () => async (srv: import("elt").ServiceHelper<any>) => {
            for (const k of ["id", "x", "y", "z"]) srv.param_soft(k)
          },
          { defaults: { id: "0" } },
        ],
      })
      history.replaceState(null, "", "#/q/5?x=a?b&y=a+b&z=a=b&id=9")
      await app.router.activateFromUrl(true)
      return app.o_params.get()
    })
    expect(result).toEqual({ id: 5, x: "a?b", y: "a+b", z: "a=b" })
  })

  test("hash mode: first write replaces, a route path change adds an entry, a query change replaces", async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      const { App } = window.__ELT__
      const app = new App()
      const routes = app.setupRouter({
        a: ["/a", () => async () => {}],
        b: [
          "/b/:id",
          () => async (srv: import("elt").ServiceHelper<any>) => {
            srv.param("id")
            srv.param_soft("f")
          },
        ],
      })
      const l0 = history.length
      const steps: [number, string][] = []
      const step = () => steps.push([history.length - l0, location.hash])
      await routes.a.activate()
      step()
      await routes.b.activate({ id: 1 })
      step()
      await routes.b.activate({ id: 2 })
      step()
      app.o_params.set({ id: 2, f: "x" })
      step()
      return steps
    })
    expect(result).toEqual([
      [0, "#/a"],
      [1, "#/b/1"],
      [2, "#/b/2"],
      [2, "#/b/2?f=x"],
    ])
  })

  test("the landing route is not activated twice for the same empty URL", async ({ page }) => {
    const builds = await page.evaluate(async () => {
      const { App } = window.__ELT__
      let builds = 0
      const app = new App()
      app.setupRouter({ init: ["", () => async () => void builds++] })
      await app.router.activateFromUrl()
      // the one scheduled by setupRouter
      await new Promise((r) => setTimeout(r, 10))
      await app.router.activateFromUrl()
      return builds
    })
    expect(builds).toBe(1)
  })

  test("nested route groups accumulate every parent prefix", async ({ page }) => {
    const path = await page.evaluate(() => {
      const { App } = window.__ELT__
      const routes = new App().setupRouter({ g: ["/g", { h: ["/h", { leaf: ["/leaf", () => async () => {}] }] }] })
      return routes.g.h.leaf.path
    })
    expect(path).toBe("/g/h/leaf")
  })

  test("url() fills path params from defaults and throws without them", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { App } = window.__ELT__
      const srv = () => async () => {}
      const routes = new App().setupRouter({ d: ["/u/:id", srv, { defaults: { id: "7" } }], n: ["/n/:id", srv] })
      let error = "no error"
      try {
        routes.n.url()
      } catch (e) {
        error = (e as Error).message
      }
      return { url: routes.d.url(), error }
    })
    expect(result.url.endsWith("#/u/~7")).toBe(true)
    expect(result.error).toContain(":id")
  })

  test("o.exclusive_lock is released when its callback throws", async ({ page }) => {
    const ran = await page.evaluate(() => {
      const { o } = window.__ELT__
      const lock = o.exclusive_lock()
      try {
        lock(() => {
          throw new Error("boom")
        })
      } catch {}
      let ran = false
      lock(() => {
        ran = true
      })
      return ran
    })
    expect(ran).toBe(true)
  })

  test("path mode: base prefix, landing route, outside base", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { App } = window.__ELT__
      const srv = () => async () => {}
      const app = new App()
      app.setupRouter({ landing: ["", srv], root: ["/", srv] }, { mode: "path", base: "/app/" })
      const at = async (url: string) => {
        app.o_current_route.set(null)
        history.replaceState(null, "", url)
        await app.router.activateFromUrl(true)
        return app.o_current_route.get()?.name ?? null
      }
      return [await at("/app"), await at("/app/"), await at("/application"), await at("/other")]
    })
    expect(result).toEqual(["landing", "root", null, null])
  })

  test("path mode: reads location.search, leaves the fragment alone, pushes on route change, Back works", async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      const { App } = window.__ELT__
      const app = new App()
      const routes = app.setupRouter(
        {
          user: [
            "/users/:id",
            () => async (srv: import("elt").ServiceHelper<any>) => {
              srv.param("id")
              srv.param_soft("f")
            },
          ],
          other: ["/other", () => async () => {}],
        },
        { mode: "path", base: "/app" },
      )
      history.replaceState(null, "", "/app/users/3?f=x#sec")
      const l0 = history.length
      await app.router.activateFromUrl(true)
      const params = app.o_params.get()
      const after_activation = location.href.slice(location.origin.length)

      app.o_params.set({ id: 3, f: "y" })
      const after_query_change = [location.href.slice(location.origin.length), history.length - l0]

      await routes.other.activate()
      const after_route_change = [location.href.slice(location.origin.length), history.length - l0]

      const popped = new Promise((r) => window.addEventListener("popstate", r, { once: true }))
      history.back()
      await popped
      while (app.o_current_route.get()?.name !== "user" || app.o_activating.get())
        await new Promise((r) => setTimeout(r, 0))

      return {
        params,
        after_activation,
        after_query_change,
        after_route_change,
        after_back: location.pathname,
        url_for: routes.user.urlFor({ id: 4 }).slice(location.origin.length),
      }
    })
    expect(result.params).toEqual({ id: 3, f: "x" })
    expect(result.after_activation).toBe("/app/users/3?f=x#sec")
    expect(result.after_query_change).toEqual(["/app/users/3?f=y#sec", 0])
    expect(result.after_route_change).toEqual(["/app/other", 1])
    expect(result.after_back).toBe("/app/users/3")
    expect(result.url_for).toBe("/app/users/4")
  })

  test("path mode: link interception and its exclusions", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { App } = window.__ELT__
      const app = new App()
      app.setupRouter(
        {
          home: ["/", () => async () => {}],
          user: ["/users/:id", () => async (srv: import("elt").ServiceHelper<any>) => void srv.param("id")],
        },
        { mode: "path", base: "/app" },
      )
      history.replaceState(null, "", "/app/")
      await app.router.activateFromUrl(true)

      // runs after the router's document listener : records its decision and blocks real navigations
      let intercepted = false
      window.addEventListener("click", (e) => {
        intercepted = e.defaultPrevented
        e.preventDefault()
      })

      const click = (attrs: Record<string, string>, init: MouseEventInit = {}, in_shadow = false) => {
        const a = document.createElement("a")
        for (const [k, v] of Object.entries(attrs)) a.setAttribute(k, v)
        a.textContent = "link"
        const host = document.createElement("div")
        if (in_shadow) host.attachShadow({ mode: "open" }).append(a)
        else host.append(a)
        document.body.append(host)
        a.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, composed: true, ...init }))
        host.remove()
        return intercepted
      }

      const l0 = history.length
      const route_link = click({ href: "/app/users/1" })
      while (app.o_current_route.get()?.name !== "user" || app.o_activating.get())
        await new Promise((r) => setTimeout(r, 0))

      return {
        route_link,
        pushed: history.length - l0,
        pathname: location.pathname,
        in_shadow: click({ href: "/app/users/2" }, {}, true),
        ctrl: click({ href: "/app/users/3" }, { ctrlKey: true }),
        middle_button: click({ href: "/app/users/3" }, { button: 1 }),
        target_blank: click({ href: "/app/users/3", target: "_blank" }),
        target_self: click({ href: "/app/users/3", target: "_self" }),
        download: click({ href: "/app/users/3", download: "" }),
        other_origin: click({ href: "https://example.com/app/users/3" }),
        outside_base: click({ href: "/other" }),
        no_route: click({ href: "/app/files/report.pdf" }),
        fragment_only: click({ href: "#section" }),
      }
    })
    expect(result).toEqual({
      route_link: true,
      pushed: 1,
      pathname: "/app/users/1",
      in_shadow: true,
      ctrl: false,
      middle_button: false,
      target_blank: false,
      target_self: true,
      download: false,
      other_origin: false,
      outside_base: false,
      no_route: false,
      fragment_only: false,
    })
  })

  test("path mode: intercept_links: false leaves links to the browser", async ({ page }) => {
    const intercepted = await page.evaluate(() => {
      const { App } = window.__ELT__
      history.replaceState(null, "", "/app/")
      new App().setupRouter(
        { user: ["/users/:id", () => async () => {}] },
        { mode: "path", base: "/app", intercept_links: false },
      )
      let intercepted = true
      window.addEventListener("click", (e) => {
        intercepted = e.defaultPrevented
        e.preventDefault()
      })
      const a = document.createElement("a")
      a.href = "/app/users/1"
      document.body.append(a)
      a.click()
      return intercepted
    })
    expect(intercepted).toBe(false)
  })

  test("path mode: initial URL fragment scrolls to a target rendered late, not to one that never comes", async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      const { App } = window.__ELT__
      // the harness document does not scroll : use a scroll container, as an app layout would
      const box = document.createElement("div")
      box.id = "box"
      box.style.cssText = "position:fixed;inset:0;overflow:auto"
      const spacer = document.createElement("div")
      spacer.style.height = "5000px"
      box.append(spacer)
      document.body.append(box)
      const app = new App()
      app.setupRouter(
        {
          doc: [
            "/doc",
            () => async () => {
              // views render after the activation promise would have been looked at
              setTimeout(() => {
                const t = document.createElement("div")
                t.id = "a b"
                t.style.cssText = "position:absolute;top:3000px;height:20px"
                box.append(t)
              }, 150)
            },
          ],
        },
        { mode: "path", base: "/app" },
      )
      history.replaceState(null, "", "/app/doc#a%20b")
      await app.router.activateFromUrl(true, true)
      const before = box.scrollTop
      const end = Date.now() + 1500
      while (box.scrollTop === 0 && Date.now() < end) await new Promise((r) => setTimeout(r, 10))
      const scrolled = Math.abs(document.getElementById("a b")!.getBoundingClientRect().top) < 2

      // an unknown target neither throws nor scrolls
      box.scrollTop = 0
      history.replaceState(null, "", "/app/doc#nope")
      await app.router.activateFromUrl(true, true)
      await new Promise((r) => setTimeout(r, 100))
      return { before, scrolled, after_unknown: box.scrollTop, hash: location.hash }
    })
    expect(result.before).toBe(0)
    expect(result.scrolled).toBe(true)
    expect(result.after_unknown).toBe(0)
    expect(result.hash).toBe("#nope")
  })

  test("path mode: link clicks scroll, query-only writes and Back do not", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { App } = window.__ELT__
      // the harness document does not scroll : use a scroll container, as an app layout would
      const box = document.createElement("div")
      box.id = "box"
      box.style.cssText = "position:fixed;inset:0;overflow:auto"
      const spacer = document.createElement("div")
      spacer.style.height = "5000px"
      box.append(spacer)
      document.body.append(box)
      const target = document.createElement("div")
      target.id = "target"
      target.style.cssText = "position:absolute;top:3000px;height:20px"
      box.append(target)
      const settle = () => new Promise((r) => setTimeout(r, 100))

      const app = new App()
      app.setupRouter(
        {
          doc: [
            "/doc/:id",
            () => async (srv: import("elt").ServiceHelper<any>) => {
              srv.param("id")
              srv.param_soft("q")
            },
          ],
          other: ["/other", () => async () => {}],
        },
        { mode: "path", base: "/app" },
      )
      history.replaceState(null, "", "/app/doc/1")
      await app.router.activateFromUrl(true)

      const click = async (href: string) => {
        const a = document.createElement("a")
        a.href = href
        document.body.append(a)
        a.click()
        a.remove()
        while (app.o_activating.get()) await new Promise((r) => setTimeout(r, 0))
        await settle()
      }
      const top = () => Math.round(Math.abs(target.getBoundingClientRect().top))

      // a link to another route with a fragment
      await click("/app/doc/2#target")
      const link_scrolls = top() < 2

      // a query-only write driven by the params, with the fragment still in the URL, does not scroll
      box.scrollTop = 0
      app.o_params.set({ id: 2, q: "x" })
      await settle()
      const query_write_scrolls = box.scrollTop !== 0

      // a query-only link naming the fragment does
      await click("/app/doc/2?q=y#target")
      const query_link_scrolls = top() < 2

      // Back does not : the browser restores the scroll position it saved
      await click("/app/other")
      box.scrollTop = 0
      let back_scrolls = 0
      const scrollTo = app.router.__scrollTo.bind(app.router)
      app.router.__scrollTo = (f: string) => (back_scrolls++, scrollTo(f))
      const popped = new Promise((r) => window.addEventListener("popstate", r, { once: true }))
      history.back()
      await popped
      await settle()
      const back = { path: location.pathname, back_scrolls }
      return { link_scrolls, query_write_scrolls, query_link_scrolls, back }
    })
    expect(result.link_scrolls).toBe(true)
    expect(result.query_write_scrolls).toBe(false)
    expect(result.query_link_scrolls).toBe(true)
    expect(result.back.path).toBe("/app/doc/2")
    expect(result.back.back_scrolls).toBe(0)
  })

  test("path mode: activate and urlFor with a fragment", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { App } = window.__ELT__
      // the harness document does not scroll : use a scroll container, as an app layout would
      const box = document.createElement("div")
      box.id = "box"
      box.style.cssText = "position:fixed;inset:0;overflow:auto"
      const spacer = document.createElement("div")
      spacer.style.height = "5000px"
      box.append(spacer)
      document.body.append(box)
      const target = document.createElement("div")
      target.id = "target"
      target.style.cssText = "position:absolute;top:3000px;height:20px"
      box.append(target)
      const settle = () => new Promise((r) => setTimeout(r, 100))
      const rel = () => location.href.slice(location.origin.length)

      const app = new App()
      const routes = app.setupRouter(
        {
          doc: ["/doc/:id", () => async (srv: import("elt").ServiceHelper<any>) => void srv.param("id")],
          quiet: ["/quiet", () => async () => {}, { silent: true }],
          bad: ["/bad", () => async () => Promise.reject(new Error("nope"))],
          __error__: ["/error", () => async () => {}],
        },
        { mode: "path", base: "/app" },
      )
      history.replaceState(null, "", "/app/doc/1")
      await app.router.activateFromUrl(true)
      await routes.doc.activate({ id: 9 }) // the first write after startup replaces : get it out of the way
      const l0 = history.length

      const url = routes.doc.urlFor({ id: 5 }, { fragment: "a b" }).slice(location.origin.length)

      await routes.doc.activate({ id: 2 }, { fragment: "target" })
      await settle()
      const route_change = [rel(), history.length - l0, Math.round(Math.abs(target.getBoundingClientRect().top)) < 2]

      // same route and params, other fragment : no re-activation, one more history entry
      box.scrollTop = 0
      await routes.doc.activate({ id: 2 }, { fragment: "other" })
      await settle()
      const fragment_only = [rel(), history.length - l0]

      // an empty fragment removes it and scrolls nowhere
      await routes.doc.activate({ id: 2 }, { fragment: "" })
      const cleared = [rel(), box.scrollTop]

      // a failed activation neither scrolls nor leaves the fragment in the URL
      await routes.bad.activate({}, { fragment: "target" }).catch(() => {})
      await settle()
      const failed = [box.scrollTop, location.hash]

      // no fragment : the old behaviour, the fragment is dropped on a route change
      await routes.doc.activate({ id: 3 }, { fragment: "x" })
      await routes.doc.activate({ id: 4 })
      return { url, route_change, fragment_only, cleared, failed, dropped: location.hash }
    })
    expect(result.url).toBe("/app/doc/5#a%20b")
    expect(result.route_change).toEqual(["/app/doc/2#target", 1, true])
    expect(result.fragment_only).toEqual(["/app/doc/2#other", 2])
    expect(result.cleared).toEqual(["/app/doc/2", 0])
    expect(result.failed[0]).toBe(0)
    expect(result.failed[1]).toBe("")
    expect(result.dropped).toBe("")
  })

  test("path mode: scroll_to_fragment: false writes the fragment but never scrolls", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { App } = window.__ELT__
      // the harness document does not scroll : use a scroll container, as an app layout would
      const box = document.createElement("div")
      box.id = "box"
      box.style.cssText = "position:fixed;inset:0;overflow:auto"
      const spacer = document.createElement("div")
      spacer.style.height = "5000px"
      box.append(spacer)
      document.body.append(box)
      const target = document.createElement("div")
      target.id = "target"
      target.style.cssText = "position:absolute;top:3000px;height:20px"
      box.append(target)

      const app = new App()
      const routes = app.setupRouter(
        { doc: ["/doc", () => async () => {}] },
        { mode: "path", base: "/app", scroll_to_fragment: false },
      )
      history.replaceState(null, "", "/app/doc#target")
      await app.router.activateFromUrl(true, true)
      await routes.doc.activate({}, { fragment: "target" })
      await new Promise((r) => setTimeout(r, 100))
      return { scrollY: box.scrollTop, hash: location.hash }
    })
    expect(result).toEqual({ scrollY: 0, hash: "#target" })
  })

  test("hash mode: a fragment option throws", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { App } = window.__ELT__
      const routes = new App().setupRouter({ home: ["/home", () => async () => {}] })
      const error = async (fn: () => unknown) => {
        try {
          await fn()
          return "no error"
        } catch (e) {
          return (e as Error).message
        }
      }
      return [
        await error(() => routes.home.urlFor({}, { fragment: "x" })),
        await error(() => routes.home.activate({}, { fragment: "x" })),
      ]
    })
    expect(result[0]).toContain("path")
    expect(result[1]).toContain("path")
  })
})
