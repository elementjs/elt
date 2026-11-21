// Builds the docs site as static files: `bun docs/build.ts <outdir>`, with `DOCS_BASE` the path it will be
// served under ("/elt/" on GitHub Pages; default "/").
//
// The site is one page whose router reads the URL path, so a static host must answer every route with that
// page. Each route gets its own copy, `<route>.html`: GitHub Pages serves `/elt/app` from `app.html`, where a
// `app/index.html` would first redirect to `/elt/app/`, a path no route matches. `404.html` answers the
// rest (GitHub Pages serves it for any missing path), so a mistyped link still shows the site and its menu.
// `.nojekyll` stops GitHub Pages from running Jekyll, which drops files whose name starts with "_".
import { mkdir, readdir, rm } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { docs_base, fullExampleUrl, generate_docs } from "./src/macro.ts"

const outdir = resolve(process.argv[2] ?? resolve(import.meta.dir, "dist"))
const base = docs_base()
// Emptied first, so files of an earlier build (bundles named by their hash) don't pile up; but only a missing or
// empty directory, or an earlier build (it has the `.nojekyll` written below): never one a mistyped argument names.
const existing: string[] = await readdir(outdir).catch(() => [])
if (existing.length > 0 && !existing.includes(".nojekyll"))
  throw new Error(`docs/build.ts: ${outdir} is not empty and is not an earlier build; refusing to empty it`)
await rm(outdir, { recursive: true, force: true })

// Writes the pages and the route table the bundle imports, and gives the routes to copy the page for.
const { pages } = await generate_docs()

const result = await Bun.build({
  entrypoints: [resolve(import.meta.dir, "index.html")],
  outdir,
  // Asset URLs are absolute: a route's copy of the page sits deeper than the bundle (`full-example/x/0.html`).
  publicPath: `${base}/`,
  minify: true,
})
if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}

const page = await Bun.file(resolve(outdir, "index.html")).text()
const routes = pages.flatMap((p) => [p.url, ...p.fullExampleLines.map((_, n) => fullExampleUrl(p.name, n))])
for (const route of routes) {
  if (route === "/") continue
  const file = resolve(outdir, `.${route}.html`)
  await mkdir(dirname(file), { recursive: true })
  await Bun.write(file, page)
}
await Bun.write(resolve(outdir, "404.html"), page)
await Bun.write(resolve(outdir, ".nojekyll"), "")

console.log(`docs: ${routes.length} routes under "${base}/" in ${outdir}`)
