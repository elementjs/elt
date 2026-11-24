/// <reference types="bun" />
// Runs observable.bench.ts and repeat.bench.tsx in Chromium (Playwright's build). Bun bundles each in memory
// (nothing is written to disk), the bundle runs in a blank page, and its console output is printed here.
import { chromium } from "@playwright/test"

const browser = await chromium.launch()
try {
  for (const file of ["observable.bench.ts", "repeat.bench.tsx"]) {
    const build = await Bun.build({ entrypoints: [`${import.meta.dir}/${file}`], target: "browser" })
    if (!build.success) throw new AggregateError(build.logs, `bundling ${file} failed`)
    const page = await browser.newPage()
    page.on("console", (msg) => console.log(msg.text()))
    // The bench runs synchronously while the script is added, so its console events reach us before this resolves.
    await page.addScriptTag({ content: await build.outputs[0]!.text() })
    await page.close()
  }
} finally {
  await browser.close()
}
