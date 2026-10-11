import { expect, test } from "./fixture"

// show(parent, render, before?) (docs/md/verbs.md#show-content-that-lives-until-a-promise-settles):
// content that lives until the future it is given ends. Rejected with an AbortError when the parent
// leaves the page first.

test.describe("show", () => {
  test("inserts the content before `before`, and removes it, markers included, when the future resolves", async ({
    page,
  }) => {
    const r = await page.evaluate(async () => {
      const { show, node_append, node_remove } = window.__ELT__
      const parent = document.createElement("div")
      node_append(document.body, parent)
      parent.innerHTML = "<i id=a></i><i id=b></i>"
      const content = document.createElement("p")
      const fut = show<string>(parent, () => content, parent.lastChild)
      const during = [...parent.childNodes].map((n) => (n as Element).id ?? n.nodeName)
      const shown_between = content.previousSibling !== null && content.nextSibling !== null
      fut.resolve("done")
      const value = await fut
      await Promise.resolve()
      const after = [...parent.childNodes].map((n) => (n as Element).id ?? n.nodeName)
      node_remove(parent)
      return { value, during, shown_between, after, content_attached: content.isConnected }
    })
    expect(r.value).toBe("done")
    // a, show marker, <p>, show end marker, b
    expect(r.during).toEqual(["a", "#comment", "", "#comment", "b"])
    expect(r.shown_between).toBe(true)
    expect(r.after).toEqual(["a", "b"])
    expect(r.content_attached).toBe(false)
  })

  test("a rejected future removes the content too, and the rejection reaches whoever awaits it", async ({ page }) => {
    const r = await page.evaluate(async () => {
      const { show, node_append, node_remove } = window.__ELT__
      const parent = document.createElement("div")
      node_append(document.body, parent)
      const content = document.createElement("p")
      const fut = show<void>(parent, () => content)
      fut.reject(new Error("nope"))
      const message = await fut.then(
        () => "resolved",
        (e: Error) => e.message,
      )
      await Promise.resolve()
      const out = { message, children: parent.childNodes.length }
      node_remove(parent)
      return out
    })
    expect(r.message).toBe("nope")
    expect(r.children).toBe(0)
  })

  test("the future is given to render, and the content is connected when it is inserted", async ({ page }) => {
    const r = await page.evaluate(async () => {
      const { show, node_append, node_remove, $connected, $click } = window.__ELT__
      const parent = document.createElement("div")
      node_append(document.body, parent)
      let connected = false
      const fut = show<string>(parent, (f) => {
        const b = document.createElement("button")
        $connected(() => {
          connected = true
        })(b)
        $click(() => f.resolve("clicked"))(b)
        return b
      })
      const was_connected = connected
      parent.querySelector("button")!.click()
      const value = await fut
      node_remove(parent)
      return { was_connected, value }
    })
    expect(r.was_connected).toBe(true)
    expect(r.value).toBe("clicked")
  })

  test("throws when the parent is not in the page, and inserts nothing", async ({ page }) => {
    const r = await page.evaluate(() => {
      const { show } = window.__ELT__
      const parent = document.createElement("div")
      let rendered = false
      let message = ""
      try {
        show(parent, () => {
          rendered = true
          return document.createElement("p")
        })
      } catch (e) {
        message = (e as Error).message
      }
      return { rendered, message, children: parent.childNodes.length }
    })
    expect(r.rendered).toBe(false)
    expect(r.message).toContain("parent must be in the page")
    expect(r.children).toBe(0)
  })

  test("nothing is inserted when render throws", async ({ page }) => {
    const r = await page.evaluate(() => {
      const { show, node_append, node_remove } = window.__ELT__
      const parent = document.createElement("div")
      node_append(document.body, parent)
      let message = ""
      try {
        show(parent, () => {
          throw new Error("bad render")
        })
      } catch (e) {
        message = (e as Error).message
      }
      const out = { message, children: parent.childNodes.length }
      node_remove(parent)
      return out
    })
    expect(r.message).toBe("bad render")
    expect(r.children).toBe(0)
  })

  test("the future is rejected with an AbortError when an ancestor leaves the page", async ({ page }) => {
    const r = await page.evaluate(async () => {
      const { show, node_append, node_remove } = window.__ELT__
      const root = document.createElement("div")
      const parent = document.createElement("section")
      root.append(parent)
      node_append(document.body, root)
      const fut = show<string>(parent, () => document.createElement("p"))
      node_remove(root)
      const err = await fut.then(
        () => null,
        (e: DOMException) => e,
      )
      return { is_dom_exception: err instanceof DOMException, name: err?.name, children: parent.childNodes.length }
    })
    expect(r.is_dom_exception).toBe(true)
    expect(r.name).toBe("AbortError")
    // the content went with the future
    expect(r.children).toBe(0)
  })

  test("a future nobody awaits does not become an unhandled rejection when the parent leaves", async ({ page }) => {
    const r = await page.evaluate(async () => {
      const { show, node_append, node_remove } = window.__ELT__
      let unhandled = 0
      const on_unhandled = () => unhandled++
      window.addEventListener("unhandledrejection", on_unhandled)
      const parent = document.createElement("div")
      node_append(document.body, parent)
      show<void>(parent, () => document.createElement("p"))
      node_remove(parent)
      // unhandled rejections are reported after the microtasks of the turn
      await new Promise((res) => setTimeout(res, 50))
      window.removeEventListener("unhandledrejection", on_unhandled)
      return unhandled
    })
    expect(r).toBe(0)
  })

  test("nothing settles the future by itself: it stays pending while the parent stays", async ({ page }) => {
    const r = await page.evaluate(async () => {
      const { show, node_append, node_remove } = window.__ELT__
      const parent = document.createElement("div")
      node_append(document.body, parent)
      const content = document.createElement("p")
      const fut = show<void>(parent, () => content)
      let settled = false
      fut.then(
        () => {
          settled = true
        },
        () => {
          settled = true
        },
      )
      await new Promise((res) => setTimeout(res, 50))
      const out = { settled, attached: content.isConnected }
      node_remove(parent)
      return out
    })
    expect(r.settled).toBe(false)
    expect(r.attached).toBe(true)
  })

  test("the content plays its $enter, and stays until its $leave is done, marked as leaving", async ({ page }) => {
    const r = await page.evaluate(async () => {
      const { show, node_append, node_remove, node_on_enter, node_on_leave, motion_enabled } = window.__ELT__
      // The harness turns motion off; this test is about it.
      motion_enabled(true)
      const parent = document.createElement("div")
      node_append(document.body, parent)
      const content = document.createElement("p")
      content.textContent = "hello"
      let entered = 0
      node_on_enter(content, () => {
        entered++
      })
      let finish!: () => void
      node_on_leave(
        content,
        () =>
          new Promise<void>((res) => {
            finish = res
          }),
      )
      const fut = show<void>(parent, () => content)
      const entered_on_insert = entered
      fut.resolve()
      await fut
      await Promise.resolve()
      const while_leaving = {
        attached: content.parentNode === parent,
        leaving: content.hasAttribute("e-leaving"),
        // the two markers are already gone: only the leaving content is left
        children: parent.childNodes.length,
      }
      finish()
      await new Promise((res) => setTimeout(res, 20))
      const after = parent.childNodes.length
      node_remove(parent)
      motion_enabled(false)
      return { entered_on_insert, while_leaving, after }
    })
    expect(r.entered_on_insert).toBe(1)
    expect(r.while_leaving).toEqual({ attached: true, leaving: true, children: 1 })
    expect(r.after).toBe(0)
  })
})
