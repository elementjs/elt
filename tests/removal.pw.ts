import { test, expect } from "./fixture"

// Every removal and move done by elt goes through node_remove_range / node_move_range. These tests
// pin the behaviour shared by all their callers: nodes are disconnected while still in place, then
// detached, and moves carry a comment holder with its whole content.

test.describe("removal", () => {
  test("node_remove_range disconnects every node while still attached, then detaches them all", async ({ page }) => {
    const r = await page.evaluate(() => {
      const { o, $observe, $disconnected, node_append, node_remove_range, node_is_observing } = window.__ELT__
      const parent = document.createElement("div")
      node_append(document.body, parent)
      const obs = o(0)
      const attached_at_disconnect: boolean[] = []
      const nodes = ["a", "b", "c", "d"].map((id) => {
        const el = document.createElement("span")
        el.id = id
        $observe(obs, () => {})(el)
        $disconnected((n: HTMLElement) => attached_at_disconnect.push(n.parentNode === parent))(el)
        node_append(parent, el)
        return el
      })
      node_remove_range(nodes[1], nodes[2])
      const out = {
        left: [...parent.children].map((c) => c.id),
        attached_at_disconnect: [...attached_at_disconnect],
        observing: nodes.map((n) => node_is_observing(n)),
      }
      window.__ELT__.node_remove(parent)
      return out
    })
    expect(r.left).toEqual(["a", "d"])
    expect(r.attached_at_disconnect).toEqual([true, true])
    expect(r.observing).toEqual([true, false, false, true])
  })

  test("node_clear disconnects children while they are still in place (regression: it detached first)", async ({
    page,
  }) => {
    const r = await page.evaluate(() => {
      const { $disconnected, node_append, node_clear, node_is_connected } = window.__ELT__
      const parent = document.createElement("div")
      node_append(document.body, parent)
      const attached_at_disconnect: boolean[] = []
      const kids = [0, 1, 2].map(() => {
        const el = document.createElement("span")
        $disconnected((n: HTMLElement) => attached_at_disconnect.push(n.parentNode === parent))(el)
        node_append(parent, el)
        return el
      })
      node_clear(parent)
      const out = {
        count: parent.childNodes.length,
        attached_at_disconnect: [...attached_at_disconnect],
        connected: kids.map((k) => node_is_connected(k)),
      }
      window.__ELT__.node_remove(parent)
      return out
    })
    expect(r.count).toBe(0)
    expect(r.attached_at_disconnect).toEqual([true, true, true])
    expect(r.connected).toEqual([false, false, false])
  })

  test("CommentHolder.remove() removes its markers and content and stops the content's observers", async ({ page }) => {
    const r = await page.evaluate(() => {
      const { o, $observe, CommentHolder, node_append, node_is_observing } = window.__ELT__
      const parent = document.createElement("div")
      node_append(document.body, parent)
      const before = document.createElement("i")
      const after = document.createElement("b")
      node_append(parent, before)
      const holder = new CommentHolder("holder")
      node_append(parent, holder)
      node_append(parent, after)
      const content = document.createElement("span")
      $observe(o(0), () => {})(content)
      holder.updateRenderable([content, "text"])
      holder.remove()
      const out = {
        left: [...parent.childNodes].map((n) => n.nodeName),
        observing: node_is_observing(content),
      }
      window.__ELT__.node_remove(parent)
      return out
    })
    expect(r.left).toEqual(["I", "B"])
    expect(r.observing).toBe(false)
  })

  test("CommentHolder.empty() keeps its markers and removes everything between them", async ({ page }) => {
    const r = await page.evaluate(() => {
      const { CommentHolder, node_append } = window.__ELT__
      const parent = document.createElement("div")
      node_append(document.body, parent)
      const holder = new CommentHolder("holder")
      node_append(parent, holder)
      holder.updateRenderable(["one", document.createElement("span"), "two"])
      const before = holder.hasContent
      holder.empty()
      const out = { before, after: holder.hasContent, nodes: parent.childNodes.length }
      window.__ELT__.node_remove(parent)
      return out
    })
    expect(r).toEqual({ before: true, after: false, nodes: 2 })
  })

  test("CommentHolder.moveTo() carries its content, and disconnects it when moved out of the document", async ({
    page,
  }) => {
    const r = await page.evaluate(() => {
      const { o, $observe, CommentHolder, node_append, node_is_observing } = window.__ELT__
      const a = document.createElement("div")
      const b = document.createElement("div")
      node_append(document.body, a)
      node_append(document.body, b)
      const tail = document.createElement("hr")
      node_append(b, tail)
      const holder = new CommentHolder("holder")
      node_append(a, holder)
      const content = document.createElement("span")
      $observe(o(0), () => {})(content)
      holder.updateRenderable(content)

      holder.moveTo(b, tail)
      const live = {
        a: a.childNodes.length,
        b: [...b.childNodes].map((n) => n.nodeName),
        observing: node_is_observing(content),
      }

      const detached = document.createElement("div")
      holder.moveTo(detached)
      const out = {
        live,
        detached: detached.childNodes.length,
        observing_detached: node_is_observing(content),
      }
      window.__ELT__.node_remove(a)
      window.__ELT__.node_remove(b)
      return out
    })
    expect(r.live).toEqual({ a: 0, b: ["#comment", "SPAN", "#comment", "HR"], observing: true })
    expect(r.detached).toBe(3)
    expect(r.observing_detached).toBe(false)
  })

  test("If disconnects the branch it drops while it is still in place", async ({ page }) => {
    const r = await page.evaluate(() => {
      const { o, If, $disconnected, node_append } = window.__ELT__
      const parent = document.createElement("div")
      node_append(document.body, parent)
      const o_cond = o(true)
      let attached_at_disconnect: boolean | null = null
      node_append(
        parent,
        If(
          o_cond,
          () => {
            const el = document.createElement("span")
            $disconnected((n: HTMLElement) => {
              attached_at_disconnect = n.parentNode === parent
            })(el)
            return el
          },
          () => document.createElement("em"),
        ),
      )
      o_cond.set(false)
      const out = { attached_at_disconnect, elements: [...parent.children].map((c) => c.nodeName) }
      window.__ELT__.node_remove(parent)
      return out
    })
    expect(r).toEqual({ attached_at_disconnect: true, elements: ["EM"] })
  })
})
