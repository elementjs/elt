import { $bind, $click, css, Service, o, view } from "elt"
import { ObjectEditorShell } from "elt/editor"

import {
  BIG_TABLE_DEFAULT_ROWS,
  big_table_schema,
  config_schema,
  config_seed,
  document_seed,
  flags_map_schema,
  flags_map_seed,
  ledger_schema,
  ledger_seed,
  make_big_table_seed,
  profile_schema,
  roster_schema,
  roster_seed,
  tags_set_schema,
  tags_set_seed,
} from "./object-editor-schemas"

export default class ScreenObjectEditor extends Service({
  base: import("./base"),
}) {
  o_profile = o({
    name: "Ada Lovelace",
    bio: "Wrote the first published algorithm meant to be run on a machine.",
    age: 36,
    active: true,
    birthday: new Date(1815, 11, 10) as Date | null,
    tags: ["analytical-engine", "algorithm", "notes"],
    address: { street: "12 Analytical Engine Ave", city: "London", country: "UK" },
  })

  o_document = o(structuredClone(document_seed))
  o_config = o(structuredClone(config_seed))
  o_roster = o(structuredClone(roster_seed))
  o_ledger = o(structuredClone(ledger_seed))
  o_big_table = o(make_big_table_seed(BIG_TABLE_DEFAULT_ROWS))
  o_big_table_row_count = o(BIG_TABLE_DEFAULT_ROWS)
  o_tags_set = o(structuredClone(tags_set_seed))
  o_flags_map = o(structuredClone(flags_map_seed))

  shell_profile = new ObjectEditorShell(this.o_profile, { schema: profile_schema })
  shell_document = new ObjectEditorShell(this.o_document)
  shell_config = new ObjectEditorShell(this.o_config, { schema: config_schema })
  shell_roster = new ObjectEditorShell(this.o_roster, { schema: roster_schema })
  shell_ledger = new ObjectEditorShell(this.o_ledger, { schema: ledger_schema })
  shell_big_table = new ObjectEditorShell(this.o_big_table, { schema: big_table_schema })
  shell_tags_set = new ObjectEditorShell(this.o_tags_set, { schema: tags_set_schema })
  shell_flags_map = new ObjectEditorShell(this.o_flags_map, { schema: flags_map_schema })

  regenerate_big_table() {
    const count = Math.max(1, Math.min(50_000, Math.floor(this.o_big_table_row_count.get())))
    this.o_big_table_row_count.set(count)
    this.o_big_table.set(make_big_table_seed(count))
  }

  @view
  Content() {
    return (
      <e-box typographic pad>
        {this.base.DisplayTitle()}

        <p>
          Object editor demos on one screen: schema-mode objects, unknown-mode documents,{" "}
          <strong>table</strong> arrays (auto-detect, manual columns, and a{" "}
          {BIG_TABLE_DEFAULT_ROWS.toLocaleString()}-row VirtualScroll stress table), <strong>Set</strong> /{" "}
          <strong>Map</strong> lists, RegExp catch-alls, composite toolbars (search, type-change{" "}
          <code>…</code> menu), column drill-in, and shell undo/redo.
        </p>

        <h2>Author profile (schema object)</h2>
        <p class={cls_hint}>
          Scalars, multiline bio, date, nested address (search hidden on that node), tags in{" "}
          <em>list</em> mode. Breadcrumb:{" "}
          {this.shell_profile.o_breadcrumb.tf((crumbs) => (crumbs.length ? crumbs.join(" › ") : "(root only)"))}
        </p>
        {this.shell_profile.node}
        <details>
          <summary>Live JSON</summary>
          <pre>{this.o_profile.tf((v) => JSON.stringify(v, null, 2))}</pre>
        </details>

        <h2>Team roster (table — auto-detect)</h2>
        <p class={cls_hint}>
          Uniform object rows switch to <strong>table</strong> layout (<code>mode: "auto"</code>). Edit cells inline;
          use <em>+ Add item</em> for a new row. Filter rows via the toolbar search.
        </p>
        {this.shell_roster.node}
        <details>
          <summary>Live JSON</summary>
          <pre>{this.o_roster.tf((v) => JSON.stringify(v, null, 2))}</pre>
        </details>

        <h2>Inventory ledger (table — manual columns)</h2>
        <p class={cls_hint}>
          <code>mode: "table"</code> with <code>columns: ["sku", "qty", "unit"]</code>. The first row still has{" "}
          <code>warehouse</code> in JSON — look for the <strong>⚠ extra keys</strong> toolbar warning (hidden column
          data stays on the object).
        </p>
        {this.shell_ledger.node}
        <details>
          <summary>Live JSON</summary>
          <pre>{this.o_ledger.tf((v) => JSON.stringify(v, null, 2))}</pre>
        </details>

        <h2>Large dataset (table — VirtualScroll)</h2>
        <p class={cls_hint}>
          {this.o_big_table_row_count.tf((n) => n.toLocaleString())} rows generated on the fly (
          <code>make_big_table_seed</code>). Only rows near the viewport are mounted — scroll the table body and use
          toolbar search to filter. Regenerate with a different row count (1–50&nbsp;000).
        </p>
        <e-flex align="center" gap="small" class={cls_big_table_controls}>
          <label>
            Rows{" "}
            <input type="number" min="1" max="50000" step="100">
              {$bind.number(this.o_big_table_row_count)}
            </input>
          </label>
          <button type="button">
            {$click(() => this.regenerate_big_table())}
            Regenerate table
          </button>
          <span class={cls_hint}>
            Showing{" "}
            {this.o_big_table.tf((rows) => (Array.isArray(rows) ? rows.length : 0).toLocaleString())} rows
          </span>
        </e-flex>
        {this.shell_big_table.node}
        <details>
          <summary>Live JSON (first 3 rows)</summary>
          <pre>
            {this.o_big_table.tf((rows) =>
              JSON.stringify(Array.isArray(rows) ? rows.slice(0, 3) : rows, null, 2),
            )}
          </pre>
        </details>

        <h2>Unique tags (Set)</h2>
        <p class={cls_hint}>
          Set membership list — duplicates are rejected. <em>+ Add member</em> starts a transient row (default{" "}
          <code>""</code> from <code>item_default</code>).
        </p>
        {this.shell_tags_set.node}
        <details>
          <summary>Live JSON</summary>
          <pre>{this.o_tags_set.tf((v) => (v instanceof Set ? JSON.stringify([...v], null, 2) : String(v)))}</pre>
        </details>

        <h2>Feature flags (Map)</h2>
        <p class={cls_hint}>
          Key/value rows with separate key and value widgets. Add entries with <em>+ Add entry</em>; remove with{" "}
          <code>−</code>.
        </p>
        {this.shell_flags_map.node}
        <details>
          <summary>Live JSON</summary>
          <pre>
            {this.o_flags_map.tf((v) =>
              v instanceof Map ? JSON.stringify(Object.fromEntries(v), null, 2) : String(v),
            )}
          </pre>
        </details>

        <h2>Document (unknown mode)</h2>
        <p class={cls_hint}>
          Free keys, row filter, nested composites — open <code>meta</code> then <code>stats</code> from the root to
          exercise sibling column replacement. Breadcrumb:{" "}
          {this.shell_document.o_breadcrumb.tf((crumbs) => (crumbs.length ? crumbs.join(" › ") : "(root only)"))}
        </p>
        {this.shell_document.node}
        <details>
          <summary>Live JSON</summary>
          <pre>{this.o_document.tf((v) => JSON.stringify(v, null, 2))}</pre>
        </details>

        <h2>Runtime config (RegExp catch-alls)</h2>
        <p class={cls_hint}>
          Expected keys: <code>theme</code>, <code>debug</code>, and <code>/^feature_/</code>. Add{" "}
          <code>feature_foo</code> via <em>+ Add key</em>.
        </p>
        {this.shell_config.node}
        <details>
          <summary>Live JSON</summary>
          <pre>{this.o_config.tf((v) => JSON.stringify(v, null, 2))}</pre>
        </details>
      </e-box>
    )
  }
}

const cls_hint = css`.oe-demo-hint {
  color: var(--e-color-text-mid, #666);
  font-size: 0.92em;
}`

const cls_big_table_controls = css`.oe-big-table-controls {
  margin-bottom: 0.5em;
  flex-wrap: wrap;
}`
