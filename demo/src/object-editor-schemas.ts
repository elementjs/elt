import { anything, array, boolean, date, map, number, object, set, string } from "elt/editor"

const address_schema = object({
  chrome_label: "Postal address",
  toolbar: { search: false },
  properties: [
    { name: "street", type: string() },
    { name: "city", type: string() },
    { name: "country", type: string() },
  ],
})

/** Schema-mode profile: scalars, nested object, string array, toolbar opt-out on address. */
export const profile_schema = object({
  chrome_label: "Author profile",
  properties: [
    { name: "name", type: string() },
    { name: "bio", type: string({ multiline: true }) },
    { name: "age", type: number({ min: 0, max: 130, step: 1 }) },
    { name: "active", type: boolean() },
    { name: "birthday", type: date({ date: true, nullable: true }) },
    { name: "tags", type: array({ values: string(), chrome_label: "Tags (list mode)" }) },
    { name: "address", type: address_schema },
  ],
})

/** Uniform object rows — table auto-detect (`mode: "auto"`). */
export const roster_schema = array({
  chrome_label: "Team roster",
  mode: "auto",
  values: anything,
  item_default: () => ({ name: "", role: "", active: true }),
})

export const roster_seed = [
  { name: "Ada Lovelace", role: "Author", active: true },
  { name: "Charles Babbage", role: "Reviewer", active: false },
  { name: "Grace Hopper", role: "Editor", active: true },
]

/** Forced table with manual columns; second row carries a hidden extra key for the warning icon. */
export const ledger_schema = array({
  chrome_label: "Inventory ledger",
  mode: "table",
  columns: ["sku", "qty", "unit"],
  values: anything,
  item_default: () => ({ sku: "", qty: 0, unit: "ea" }),
})

export const ledger_seed = [
  { sku: "BOOK-001", qty: 12, unit: "ea", warehouse: "A" },
  { sku: "BOOK-002", qty: 3, unit: "ea" },
  { sku: "PART-9", qty: 140, unit: "mm" },
]

/** Large table for VirtualScroll — rows built programmatically, not hand-authored. */
export const big_table_schema = array({
  chrome_label: "Large dataset",
  mode: "table",
  columns: ["id", "name", "department", "score", "active"],
  values: anything,
  item_default: () => ({ id: 0, name: "", department: "", score: 0, active: true }),
})

const BIG_TABLE_DEPARTMENTS = ["Engineering", "Research", "Operations", "Design", "Support"] as const

/** Build `count` uniform object rows for table VirtualScroll demos. */
export function make_big_table_seed(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Employee ${String(i + 1).padStart(5, "0")}`,
    department: BIG_TABLE_DEPARTMENTS[i % BIG_TABLE_DEPARTMENTS.length],
    score: (i * 17 + 23) % 100,
    active: i % 4 !== 0,
  }))
}

/** Default row count for the big-table demo section. */
export const BIG_TABLE_DEFAULT_ROWS = 2_000

/** Set list — duplicate values rejected on commit. */
export const tags_set_schema = set({
  chrome_label: "Unique tags",
  values: string(),
  item_default: "",
})

export const tags_set_seed = new Set(["algorithm", "math", "notes"])

/** Map rows — string keys, boolean values. */
export const flags_map_schema = map({
  chrome_label: "Feature flags",
  keys: string(),
  values: boolean(),
})

export const flags_map_seed = new Map<string, boolean>([
  ["search", true],
  ["editor", true],
  ["beta_ui", false],
])

/** Unknown-mode document seed — exercises search, add/remove keys, nested composites. */
export const document_seed = {
  title: "Notes on the Analytical Engine",
  tags: ["algorithm", "math", "history"],
  meta: { revision: 3, published: true },
  stats: { views: 1284, likes: 97 },
  links: ["https://example.com/ada", "https://example.com/babbage"],
}

/** Closed-shape config object — RegExp catch-all for extension fields. */
export const config_schema = object({
  chrome_label: "Runtime config",
  free_keys: true,
  properties: [
    { name: "theme", type: string() },
    { name: "debug", type: boolean() },
    { name: /^feature_/, type: boolean() },
  ],
})

export const config_seed = {
  theme: "dark",
  debug: false,
  feature_search: true,
  feature_editor: true,
}
