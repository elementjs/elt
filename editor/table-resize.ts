/*
Resizable table column headers — adapted from specs/resizable.tsx (reference sketch).
*/

import { $connected, css, node_add_event_listener } from "elt"

const DEFAULT_MIN_WIDTH = 48

export interface TableResizeOptions {
  minWidth?: number
}

const last_frozen_count = new WeakMap<HTMLTableElement, number>()
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
  table.style.tableLayout = "fixed"
  last_frozen_count.set(table, count)
}

function schedule_freeze(table: HTMLTableElement) {
  if (pending_freeze.has(table)) return
  pending_freeze.add(table)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      pending_freeze.delete(table)
      freeze_table_layout(table)
    })
  })
}

function set_column_width(table: HTMLTableElement, index: number, px: number) {
  table.style.tableLayout = "fixed"
  const header = table.tHead?.rows[0]?.cells[index]
  if (header) header.style.width = `${px}px`
}

function start_resize(th: HTMLTableCellElement, min_width: number) {
  return (ev: MouseEvent) => {
    ev.preventDefault()
    ev.stopPropagation()

    const table = th.closest("table")
    if (!(table instanceof HTMLTableElement)) return

    const index = th.cellIndex
    const start_x = ev.clientX
    const start_width = th.getBoundingClientRect().width
    const body = th.ownerDocument.body

    body.style.cursor = "col-resize"
    body.style.userSelect = "none"

    function move(ev: MouseEvent) {
      set_column_width(table, index, Math.max(min_width, start_width + ev.clientX - start_x))
    }

    function up() {
      document.removeEventListener("mousemove", move)
      document.removeEventListener("mouseup", up)
      body.style.cursor = ""
      body.style.userSelect = ""
    }

    document.addEventListener("mousemove", move)
    document.addEventListener("mouseup", up)
  }
}

const cls_resizable_th = css`.oe-resizable-th {
  position: relative;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}`

const cls_resize_handle = css`.oe-col-resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  width: 5px;
  height: 100%;
  cursor: col-resize;
  touch-action: none;
}`

function make_resizable(opts?: TableResizeOptions) {
  const min_width = opts?.minWidth ?? DEFAULT_MIN_WIDTH
  return $connected((th: HTMLTableCellElement) => {
    th.classList.add(cls_resizable_th)

    const handle = document.createElement("span")
    handle.className = cls_resize_handle
    th.appendChild(handle)
    node_add_event_listener(handle, "mousedown", start_resize(th, min_width))

    const table = th.closest("table")
    if (table instanceof HTMLTableElement) schedule_freeze(table)
  })
}

/** Attach a drag handle to a `<th>` for column resize. */
export function $resizable(th: HTMLTableCellElement): void
export function $resizable(opts: TableResizeOptions): (th: HTMLTableCellElement) => void
export function $resizable(arg: HTMLTableCellElement | TableResizeOptions) {
  if (arg instanceof HTMLTableCellElement) {
    make_resizable()(arg)
    return
  }
  return make_resizable(arg)
}
