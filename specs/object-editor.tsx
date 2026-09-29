/*
The object editor is a widget made to be able to edit arrays of thousands of rows as well as single objects, or even single values.

When selecting a node, it adds a column to the right.

*/

import {
  $click,
  $observe,
  $scrollable,
  type Attrs,
  css,
  type NRO,
  o,
  type Renderable,
  Repeat,
  VirtualScroll,
} from "elt"
import * as ph from "elt-phosphor"
import { popup } from "elt/ui"
import { theme } from "elt/ui"
import { data_loader_dialog } from "./data-loader"
import { $resizable } from "./resizable"

// type Value = string | number | boolean | null | undefined

export interface JsonVisualizerAttrs extends Attrs {
  readonly?: NRO<boolean>
  idx?: o.IReadonlyObservable<number>
  data: o.Observable<unknown>
  o_paths?: o.ReadonlyObservable<(string | number)[][]>
}

const interesting = new WeakMap<WeakKey, boolean>()

// Scan the first 10 rows or 0.5% of the array length (whichever is greater), return true if they are all objects and all have the same keys.
function is_object_table(data: unknown[]): boolean {
  const length = data.length
  if (length === 0 || typeof data[0] !== "object" || data[0] === null || Array.isArray(data[0])) {
    return false
  }
  const prev = interesting.get(data)
  if (prev !== undefined) return prev
  const min_length = 10
  const keys = Object.keys(data[0])
  const sample = data.slice(0, min_length)
  const res = keys.every((key) => sample.every((item) => Object.hasOwn(item, key)))
  interesting.set(data, res)
  return res
}

/////////////////////////////////////////////////////////////////

function cellToTsv(value: unknown): string {
  if (value == null) return ""
  const text = typeof value === "object" ? JSON.stringify(value) : String(value)
  if (/[\t\r\n"]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function objectTableToTsv(rows: object[], columns: string[], includeHeaders: boolean): string {
  const lines: string[] = []
  if (includeHeaders) lines.push(columns.map(cellToTsv).join("\t"))
  for (const row of rows) {
    const record = row as Record<string, unknown>
    lines.push(columns.map((col) => cellToTsv(record[col])).join("\t"))
  }
  return lines.join("\n")
}

async function copyObjectTableToClipboard(rows: object[], columns: string[], includeHeaders: boolean) {
  const tsv = objectTableToTsv(rows, columns, includeHeaders)
  await navigator.clipboard.write([
    new ClipboardItem({
      "text/plain": new Blob([tsv], { type: "text/plain" }),
    }),
  ])
}

function TableCopyButtonPopup({ data }: { data: o.ReadonlyObservable<object[]> }): Element {
  return (
    <button type="button">
      {$click((ev) => {
        const rows = data.get()
        const columns = Object.keys(rows[0])
        popup(
          ev.currentTarget as HTMLElement,
          (fut) => {
            function $choose(cbk: (ev: MouseEvent) => unknown) {
              return $click((ev) => {
                cbk(ev)
                fut.resolve(null)
              })
            }
            return (
              <e-column pad="component" packed="widget" role="menu" aria-label="Copy options">
                <button type="button" role="menuitem">
                  <ph.BracketsCurly />
                  {$choose(() => navigator.clipboard.writeText(JSON.stringify(rows, null, 2)))}
                  Copy JSON
                </button>
                <button type="button" role="menuitem">
                  <ph.Table />
                  {$choose(() => void copyObjectTableToClipboard(rows, columns, false))}
                  Copy table
                </button>
                <button type="button" role="menuitem">
                  <ph.Table />
                  {$choose(() => void copyObjectTableToClipboard(rows, columns, true))}
                  Copy table with headers
                </button>
                <hr />
                <button type="button" role="menuitem">
                  <ph.FileCsv />
                  {$choose(() => {
                    /* implement me */
                  })}
                  Download CSV
                </button>
              </e-column>
            )
          },
          {},
        )
      })}
      <ph.Copy />
    </button>
  ) as Element
}

/////////////////////////////////////////////////////////////////

export function JsonVisualizer({ data }: JsonVisualizerAttrs): Element {
  const o_paths = o([] as (string | number)[][])
  return (
    <e-flex class={cls_column_holder} align="start" max-width>
      {$observe(data, (_dt, old) => {
        if (old !== o.NoValue) {
          // Reset path if data changes too much.
          const paths = o_paths.get() ?? []
          for (let i = 0; i < paths.length; i++) {
            const path = paths[i]
            if (data.p(path).get() === undefined) {
              o_paths.set(paths.slice(0, i))
            }
          }
        }
      })}
      {$observe(o_paths, (pth) => {
        console.log("displaying paths", pth)
      })}

      <JsonVisualizerColumn data={data} paths={o_paths} />

      {Repeat(o_paths, (o_path, o_idx) => {
        const obs = data.p(o_path)
        return <JsonVisualizerColumn data={obs} idx={o_idx} path={o_path} paths={o_paths} />
      })}
    </e-flex>
  ) as Element
}

export function JsonVisualizerColumn({
  data,
  path,
  idx,
  paths,
}: JsonVisualizerAttrs & {
  path?: o.RO<(string | number)[]>
  idx?: o.RO<number>
  paths: o.Observable<(string | number)[][]>
}): Element {
  const copy = (
    <button type="button">
      {$click(() => {
        const val = JSON.stringify(data.get())
        const clipboard = navigator.clipboard
        clipboard.writeText(val)
      })}
      <ph.Copy />
    </button>
  )

  const import_btn = (
    <button type="button">
      {$click(async () => {
        // import_dialog(data)
        const res = await data_loader_dialog()
        if (res != null) {
          data.set(res)
        }
      })}
      {/* to implement: open a dialog that offers to paste text in a textarea. buttons allow to choose whether importing JSON, tsv or CSV. content should be scanned to detect which it is to help the user. data is replaced with the result of the transformation. An error is displayed if it could not convert.

    If we are rendering an object array, allow not specifying the columns */}
      <ph.Pencil />
    </button>
  )

  return (
    <e-flex column class={cls_visu_column}>
      {data.tf((value) => {
        const pth = path && o.tf(path, (p) => `${p[p.length - 1]}:`)
        const tp = typeof value
        if (value == null) return <Property data={data} />
        if (tp === "string" || tp === "number" || tp === "boolean" || tp === "bigint") {
          return (
            <>
              <e-flex class={cls_header}>
                <h3>
                  {pth} {value.constructor.name}
                </h3>
                {import_btn}
                {copy}
              </e-flex>
              <e-prose pad>
                <Property data={data} />
              </e-prose>
            </>
          )
        }

        if (Array.isArray(value)) {
          if (is_object_table(value)) {
            return (
              <>
                <e-flex class={cls_header}>
                  <h3>
                    {pth} {value.constructor.name} [{value.length}]
                  </h3>

                  {import_btn}
                  <TableCopyButtonPopup data={data as o.Observable<object[]>} />
                </e-flex>
                <ObjectTable data={data as o.Observable<object[]>} paths={paths} path={path} idx={idx} />
              </>
            )
            // render a table
          }
          // return "Array mode not implemented" // not implemented yet, will probably do something with not too many keys at once
        }

        // object mode, displaying keys
        const keys = Array.isArray(value) ? value.map((_, i) => i) : Object.keys(value).sort()
        const header = Array.isArray(value) ? (
          <h3>
            {pth} {value.constructor.name} [{value.length}]
          </h3>
        ) : (
          <h3>
            {pth} {value.constructor.name} {"{"}
            {keys.length}
            {"}"}
          </h3>
        )

        return (
          <>
            <e-flex class={cls_header}>
              {header}
              {import_btn}
              {copy}
            </e-flex>
            <e-column packed="widget" role="list" class={cls_properties_menu}>
              {$scrollable}
              {VirtualScroll(o(keys), (o_key) => (
                <Property name={o_key} data={data.p(o_key)}>
                  {$click(() => {
                    const pth = o.get(path) ?? []
                    const key = o.get(o_key)
                    const i = o.get(idx) ?? -1
                    const current_paths = (o.get(paths) ?? []).slice(0, i + 1)
                    current_paths.push([...pth, key])
                    paths?.set(current_paths)
                  })}
                </Property>
              ))}
            </e-column>
          </>
        )
      })}
    </e-flex>
  ) as Element
}

function Property({
  name,
  data,
}: { name?: o.RO<string | number>; data: o.ReadonlyObservable<unknown> } & Attrs): HTMLElement {
  const solo = !name
  return (
    <div align-items="center">
      {name && <e-prose class={cls_key_name}>{name}</e-prose>}
      <e-prose class={[cls_property_value, solo && cls_property_value_solo]}>{inline_display(data)}</e-prose>
      {!solo && nav_indicator(data)}
    </div>
  ) as HTMLElement
}

function nav_indicator(data: o.ReadonlyObservable<unknown>): Renderable {
  return data.tf((value) => {
    if (value == null || typeof value !== "object") return null
    return (
      <e-prose class={cls_nav}>
        <ph.CaretRight />
      </e-prose>
    )
  })
}

function inline_display(data: o.ReadonlyObservable<unknown>): Renderable {
  return data.tf((value) => {
    if (value == null) return null
    if (Array.isArray(value)) return <>Array[{value.length}]</>
    switch (typeof value) {
      case "object":
        return (
          <>
            {value?.constructor.name}
            {"{"}
            {Object.keys(value).length}
            {"}"}
          </>
        )
      case "string":
        return <span class={cls_string}>{value}</span>
      case "number":
        return <span class={cls_number}>{value}</span>
      case "boolean":
        return <span class={cls_number}>{value ? "true" : "false"}</span>
      default:
        return null
    }
  })
}

function ObjectTable({
  data,
  paths,
  path,
  idx,
}: {
  data: o.ReadonlyObservable<object[]>
  paths?: o.Observable<(string | number)[][]>
  path?: o.RO<(string | number)[]>
  idx?: o.RO<number>
}): Element {
  const oo_columns = data.tf((dt) => {
    return Object.keys(dt[0])
  })
  return (
    <e-prose table-container style={{ height: "100%" }}>
      {$scrollable}
      <table style={{ width: "max-content" }}>
        <thead>
          <tr>
            <th>#</th>
            {oo_columns.tf((cols) =>
              cols.map((h) => (
                <th>
                  {$resizable}
                  {h}
                </th>
              )),
            )}
          </tr>
        </thead>
        <tbody>
          {VirtualScroll(data).RenderEach((o_row, oo_idx) => {
            return (
              <tr>
                <td>{oo_idx}</td>
                {Repeat(oo_columns).RenderEach((o_col) => {
                  const o_prop = o_row.p(o_col)
                  const oo_is_complex = o_prop.tf((val) => {
                    return typeof val === "object" && val !== null
                  })
                  return (
                    <td class={{ [cls_clickable]: oo_is_complex }}>
                      {$click(() => {
                        if (!oo_is_complex.get()) {
                          return
                        }
                        const pth = o.get(path) ?? []
                        const key = o.get(o_col)
                        if (!pth || !paths) return
                        const i = o.get(idx) ?? -1
                        const current_paths = (o.get(paths) ?? []).slice(0, i + 1)
                        current_paths.push([...pth, o.get(oo_idx) as unknown as string, key])
                        paths?.set(current_paths)
                      })}
                      {inline_display(o_prop)}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </e-prose>
  ) as Element
}

const cls_clickable = css`.clickable {
  &:hover {
    background-color: ${theme.colors.text.hover};
  }
  cursor: pointer;
}`

// function renderValue(v: any) {
//   if (typeof v === "number") {
//     return <span class={cls_number}>{v}</span>
//   } else if (typeof v === "string") {
//     if (v[0] === "#" && (v.length === 7 || v.length === 9) && v.match(/^#[0-9a-fA-F]+$/)) {
//       return <label class={cls_color}>
//         <input type="color">
//           {$bind.string(o(v))}
//         </input> {v}
//       </label>
//     }
//   }
//   return v
// }

const cls_column_holder = css`.column-holder {
  max-width: 100%;
  min-height: 0;
  overflow-x: auto;
  overflow-y: hidden;
  border: 1px solid ${theme.colors.text.mid};
  border-radius: ${theme.settings.borderRadius};

  & > * ~ * {
    border-left: 1px solid ${theme.colors.text.mid};
  }

}`

const cls_visu_column = css`.visu-column {
  min-height: 0;
  height: 100%;
  overflow: hidden;

  & [table-container] {
    border-radius: 0;
  }
}`

const cls_string = css`.string {
}`

const cls_number = css`.number {
  ${theme.colors.magenta.css.as_tint};
  color: ${theme.colors.tint};
}`

const _cls_color = css`.color {
  color: ${theme.colors.tint};
}`

const cls_key_name = css`.key-name {
  grid-column: content;
  font-weight: bold;
  color: ${theme.colors.text.mid};
  font-size: 0.8em;
}`

const cls_property_value = css`.property-value {
  grid-column: right;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}`

const cls_property_value_solo = css`.property-value-solo {
  grid-column: content / -1;
}`

const cls_nav = css`.nav {
  grid-column: nav;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${theme.colors.text.mid};
}`

const cls_header = css`.header {
  ${theme.colors.text.faded.css.as_inverted}
  width: 100%;
  font-size: ${theme.settings.formFontSize};

  & > h3 {
    flex-grow: 1;
    padding: 0 ${theme.settings.spacingWidget};
  }

  & > button {
    border: none;
    border-radius: 0;
    & + & {
      border-left: 1px solid ${theme.colors.text.mid};
    }
  }


}`

const cls_properties_menu = css`.properties-menu {
  flex: 1;
}`
