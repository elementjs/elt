// The Biome plugins of lint/ (docs/md/hard-dont.md#enforcing-with-biome): each line of the fixture marked
// `// error` is reported by one of them, and nothing else is, including what the plugins deliberately let
// through (`classList.remove`, `FormData.append`, a documented `biome-ignore`).
import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const dir = join(import.meta.dir, "fixtures/lint")

/** The lines of `file` that Biome reports as plugin diagnostics, with the fixture's own biome.json. */
async function reported_lines(file: string): Promise<number[]> {
  const proc = Bun.spawn(["bunx", "biome", "lint", "--config-path=.", file], {
    cwd: dir,
    stdout: "pipe",
    stderr: "pipe",
  })
  // Diagnostics go to stderr.
  const output = (await new Response(proc.stdout).text()) + (await new Response(proc.stderr).text())
  await proc.exited
  return [...output.matchAll(new RegExp(`^${file.replace(".", "\\.")}:(\\d+):\\d+ plugin`, "gm"))].map((m) =>
    Number(m[1]),
  )
}

test("every marked line of the bad fixture is reported, and only those", async () => {
  const marked = readFileSync(join(dir, "bad.ts"), "utf8")
    .split("\n")
    .flatMap((line, i) => (line.includes("// error") ? [i + 1] : []))
  expect(marked.length).toBeGreaterThan(10)
  expect((await reported_lines("bad.ts")).sort((a, b) => a - b)).toEqual(marked)
})

test("the good fixture is not reported", async () => {
  expect(await reported_lines("good.ts")).toEqual([])
})
