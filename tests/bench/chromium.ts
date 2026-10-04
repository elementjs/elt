/// <reference types="bun" />
// Runs observable.bench.ts in Chromium (Playwright's build). Bun bundles it in memory (nothing is written to
// disk), the bundle runs in a blank page, and its console output is printed here.
import { chromium } from "@playwright/test"

const build = await Bun.build({ entrypoints: [`${import.meta.dir}/observable.bench.ts`], target: "browser" })
if (!build.success) throw new AggregateError(build.logs, "bundling observable.bench.ts failed")
const code = await build.outputs[0]!.text()

const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  page.on("console", (msg) => console.log(msg.text()))
  // The bench runs synchronously while the script is added, so its console events reach us before this resolves.
  await page.addScriptTag({ content: code })
} finally {
  await browser.close()
}
