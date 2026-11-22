import { type Page, test, expect } from "./fixture"

/**
 * The page has #outer, holding #inner, holding #leaf, then #plain and a file input #picker, all outside any zone.
 * #outer accepts anything with "copy", #inner accepts files only with "link". `window.log` records drops and
 * hover changes as `<zone> drop <files>` / `<zone> hover <effect|null>`.
 */
async function setup(page: Page) {
  await page.evaluate(() => {
    const { $dropzone, node_append, o } = window.__ELT__
    document.body.innerHTML = `<div id="outer" style="padding:20px"><div id="inner" style="padding:20px"><span id="leaf">x</span></div></div><div id="plain">p</div><input id="picker" type="file" />`
    const w = window as unknown as { log: string[] }
    w.log = []
    const zone = (id: string, accept: (dt: DataTransfer) => "copy" | "link" | false) => {
      const o_hover = o<{ effect: string } | null>(null)
      o_hover.addObserver((h) => w.log.push(`${id} hover ${h?.effect ?? null}`))
      node_append(
        document.getElementById(id)!,
        $dropzone({
          accept,
          drop: (dt) => w.log.push(`${id} drop ${Array.from(dt.files, (f) => f.name).join(",")}`),
          out_hover: o_hover,
        }),
      )
    }
    zone("outer", () => "copy")
    zone("inner", (dt) => $dropzone.has_files(dt) && "link")
    // Observers run once when added.
    w.log = []
  })
}

/** Dispatches a drag event on `id`, carrying `files` (or a text if empty); returns whether it was cancelled. A synthetic event's dropEffect can't be set: the effect shows through the hover. */
async function drag(page: Page, type: string, id: string, files: string[] = ["a.xlsx"]) {
  return page.evaluate(
    ({ type, id, files }) => {
      const w = window as unknown as { dt?: DataTransfer }
      // One DataTransfer per drag, as the browser does.
      if (type === "dragenter" && w.dt == null) {
        w.dt = new DataTransfer()
        if (files.length === 0) w.dt.setData("text/plain", "hello")
        for (const f of files) w.dt.items.add(new File(["x"], f))
      }
      const dt = w.dt!
      const ev = new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt })
      const cancelled = !document.getElementById(id)!.dispatchEvent(ev)
      if (type === "drop" || type === "dragend") w.dt = undefined
      return cancelled
    },
    { type, id, files },
  )
}

const log = (page: Page) => page.evaluate(() => (window as unknown as { log: string[] }).log)

test.describe("$dropzone", () => {
  test.beforeEach(async ({ page }) => setup(page))

  test("the innermost zone accepting the drag takes it, outer zones show no hover", async ({ page }) => {
    await drag(page, "dragenter", "leaf")
    expect(await drag(page, "dragover", "leaf")).toBe(true)
    expect(await drag(page, "drop", "leaf")).toBe(true)
    expect(await log(page)).toEqual(["inner hover link", "inner hover null", "inner drop a.xlsx"])
  })

  test("a zone refusing the drag lets the outer zone take it", async ({ page }) => {
    await drag(page, "dragenter", "leaf", [])
    expect(await drag(page, "dragover", "leaf", [])).toBe(true)
    await drag(page, "drop", "leaf", [])
    expect(await log(page)).toEqual(["outer hover copy", "outer hover null", "outer drop "])
  })

  test("moving between the zone's children keeps the hover, leaving the zone ends it", async ({ page }) => {
    await drag(page, "dragenter", "outer")
    await drag(page, "dragover", "outer")
    // Into a child: the browser fires dragenter on the child first, then dragleave on the zone.
    await drag(page, "dragenter", "leaf")
    await drag(page, "dragleave", "outer")
    expect(await log(page)).toEqual(["outer hover copy"])
    await drag(page, "dragleave", "leaf")
    expect(await log(page)).toEqual(["outer hover copy", "outer hover null"])
  })

  test("a zone answering none keeps the drag from outer zones, shows the hover and never drops", async ({ page }) => {
    await page.evaluate(() => {
      const { $dropzone, node_append } = window.__ELT__
      const w = window as unknown as { log: string[] }
      node_append(
        document.getElementById("leaf")!,
        $dropzone({
          accept: () => "none",
          drop: () => w.log.push("leaf drop"),
          out_hover: { set: (h) => w.log.push(`leaf hover ${h?.effect ?? null}`) },
        }),
      )
    })
    await drag(page, "dragenter", "leaf")
    expect(await drag(page, "dragover", "leaf")).toBe(true)
    expect(await drag(page, "drop", "leaf")).toBe(true)
    expect(await log(page)).toEqual(["leaf hover none", "leaf hover null"])
  })

  test("a drag ended elsewhere clears the hover", async ({ page }) => {
    await drag(page, "dragenter", "outer")
    await drag(page, "dragover", "outer")
    await drag(page, "dragend", "plain")
    expect(await log(page)).toEqual(["outer hover copy", "outer hover null"])
  })

  test("files dropped outside every zone are refused, but a file input still takes them", async ({ page }) => {
    await drag(page, "dragenter", "plain")
    expect(await drag(page, "dragover", "plain")).toBe(true)
    expect(await drag(page, "drop", "plain")).toBe(true)
    await drag(page, "dragenter", "picker")
    expect(await drag(page, "dragover", "picker")).toBe(false)
    expect(await drag(page, "drop", "picker")).toBe(false)
    expect(await log(page)).toEqual([])
  })
})

test.describe("$draggable", () => {
  test("dropping onto a zone delivers the data, and the source sees the zone's effect", async ({ page }) => {
    await page.evaluate(() => {
      const { $draggable, $dropzone, node_append } = window.__ELT__
      document.body.innerHTML = `<div id="src" style="width:50px;height:50px">drag</div><div id="dst" style="width:200px;height:200px;margin-top:50px">here</div>`
      const w = window as unknown as { log: string[] }
      w.log = []
      node_append(
        document.getElementById("src")!,
        $draggable(() => ({ "text/plain": "hello", "application/x-test": "42" }), {
          effect: "copyMove",
          end: (effect) => w.log.push(`end ${effect}`),
        }),
      )
      node_append(
        document.getElementById("dst")!,
        $dropzone({
          accept: (dt) => dt.types.includes("application/x-test") && "move",
          drop: (dt) => w.log.push(`drop ${dt.getData("text/plain")} ${dt.getData("application/x-test")}`),
        }),
      )
    })
    await page.dragAndDrop("#src", "#dst")
    await expect.poll(() => log(page)).toEqual(["drop hello 42", "end move"])
  })

  test("a file to give outside the browser is carried as an absolute DownloadURL", async ({ page }) => {
    const url = await page.evaluate(() => {
      const { $draggable, node_append } = window.__ELT__
      document.body.innerHTML = `<div id="src">drag</div>`
      const src = document.getElementById("src")!
      node_append(
        src,
        $draggable(() => ({ "text/plain": "a.csv" }), {
          file: () => ({ name: "a.csv", mime: "text/csv", url: "files/a.csv" }),
        }),
      )
      const dt = new DataTransfer()
      src.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt }))
      return dt.getData("DownloadURL")
    })
    expect(url).toBe(`text/csv:a.csv:${new URL("files/a.csv", page.url()).href}`)
  })
})
