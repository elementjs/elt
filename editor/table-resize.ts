/*
Resizable `<table>` headers: the drag handle is elt/ui's `$resizable`; what is specific to a table is
here (freezing the columns at their first laid-out widths, and where the dragged width goes).
*/

import { node_on_connected } from "elt"
import { $resizable as $ui_resizable } from "elt/ui"
import { observe_layout } from "../ui/internal"

export interface TableResizeOptions {
  /** Smallest column width in px. */
  minWidth?: number
}

const last_frozen_count = new WeakMap<HTMLTableElement, number>()

/** Columns sized by their header cells' widths. The table is as wide as its columns (max-content): with an
 * `auto` width, Firefox stretches a fixed-layout table to its container's width, and the columns with it. */
function fix_layout(table: HTMLTableElement) {
  table.style.tableLayout = "fixed"
  table.style.width = "max-content"
}
const pending_freeze = new WeakSet<HTMLTableElement>()

function freeze_table_layout(table: HTMLTableElement) {
  const header_row = table.tHead?.rows[0]
  if (!header_row) return

  const count = header_row.cells.length
  const last = last_frozen_count.get(table)
  if (table.style.tableLayout === "fixed" && last === count) return

  for (const cell of header_row.cells) {
    if (!cell.style.width) {
      cell.style.width = `${cell.getBoundingClientRect().width}px`
    }
  }
  fix_layout(table)
  last_frozen_count.set(table, count)
}

/** Freezes the table's columns at their first laid-out widths, once every header cell is in. */
function schedule_freeze(table: HTMLTableElement) {
  if (pending_freeze.has(table)) return
  pending_freeze.add(table)
  const stop = observe_layout(table, () => {
    stop()
    pending_freeze.delete(table)
    freeze_table_layout(table)
  })
}

function set_column_width(table: HTMLTableElement, index: number, px: number) {
  fix_layout(table)
  const header = table.tHead?.rows[0]?.cells[index]
  if (header) header.style.width = `${px}px`
}

function make_resizable(opts?: TableResizeOptions) {
  return (th: HTMLTableCellElement) => {
    // The cell is in its table only once connected: freeze the columns then.
    node_on_connected(th, () => {
      const table = table_of(th)
      if (table) schedule_freeze(table)
    })
    // A header cut with "…" when its column is narrower than its text.
    th.setAttribute("e-ellipsis", "")
    return $ui_resizable({
      min: opts?.minWidth,
      on_resize: (px) => {
        const table = table_of(th)
        if (table) set_column_width(table, th.cellIndex, px)
      },
    })(th)
  }
}

/** The table a header cell is in, once it is in one. */
function table_of(th: HTMLTableCellElement) {
  const table = th.closest("table")
  return table instanceof HTMLTableElement ? table : null
}

/** Attach a drag handle to a `<th>` for column resize. */
export function $resizable(th: HTMLTableCellElement): ReturnType<ReturnType<typeof make_resizable>>
export function $resizable(opts: TableResizeOptions): ReturnType<typeof make_resizable>
export function $resizable(arg: HTMLTableCellElement | TableResizeOptions) {
  if (arg instanceof HTMLTableCellElement) return make_resizable()(arg)
  return make_resizable(arg)
}
