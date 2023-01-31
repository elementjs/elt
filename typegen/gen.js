#!/usr/bin/env node
import * as Y from "js-yaml"
import * as fs from "fs"

const out = s => process.stdout.write(s)
const c = Y.load(fs.readFileSync("htmlref.yml", "utf-8"))

out(`

`)

for (let [name, desc] of Object.entries(c.globals)) {
  out(`export interface ${name} {\n`)
  dump_attrs(Object.entries(desc))
  out(`}\n`)
}

const ELTS = Object.entries(c.elements).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)
const SVG = Object.entries(c.svgelements).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)

for (let [tag, desc] of ELTS) {
  dump(tag, desc, "HTMLElementTagNameMap")
}

for (let [tag, desc] of SVG) {
  dump(tag, desc, "SVGElementTagNameMap", "svg_")
}

out(`\n\nexport interface ElementMap {\n`)
for (let [tag, _] of ELTS) {
  out(`  ${tag}: attrs_${tag}\n`)
}
for (let [tag, _] of SVG) {
  out(`  ${tag}: attrs_svg_${tag}\n`)
}
out(`}\n`)


/////////////////////////////////////////

function dump(name, desc, glb = "Global", pre = "") {
  let ext = desc?._extends ?? ""
  if (ext) {
    if (!Array.isArray(ext)) ext = [ext]
    ext = ", " + ext.map(name => `${name}`).join(", ")
    delete desc._extends
  }

  const entries = Object.entries(desc ?? {})
  out(`export interface attrs_${pre}${name} extends Attrs<${glb}["${name}"]>${ext} {`)
  if (entries.length) {
    out("\n")
    dump_attrs(entries)
  }
  out(`}\n`)
}

function dump_attrs(entries) {
  for (let [name, val] of entries) {
    if (name.includes("*")) {
      name = name.replace("*", "${string}")
      out(`  [K: \`${name}\`]: NRO<string | number>\n`)
      continue
    }
    if (name.includes("-")) name = `"${name}"`
    if (Array.isArray(val)) {
      val = val.map(v => v === "string" || v === "number" ? v : v === "" ? `"" | true` : `"${v}"`)
      out(`  ${name}?: NRO<${val.join(" | ")}>\n`)
    } else {
      out(`  ${name}?: NRO<string | number>\n`)
    }
  }
}