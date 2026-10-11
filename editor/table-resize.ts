/*
Resizable column headers — adapted from specs/resizable.tsx (reference sketch). `$resizable` works
on a <table>'s <th>; `$column_resizable` on any header cell, reporting the new width to a callback
(a grid then puts it in its template).
*/

import { $on, css, node_on_connected } from "elt"

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

/**
 * Calls `fn` on the frame after each layout where `el` has a size: the moment a laid-out width can
 * be read and locked. A ResizeObserver tells when that layout happened, which also catches an
 * element laid out late (a popup not shown yet). `fn` runs on the next animation frame rather than
 * in the observer: what it writes changes sizes the browser already measured this frame (the
 * element's ancestors), whose own observers couldn't be notified until the next one, reported as a
 * "ResizeObserver loop completed with undelivered notifications" error. The frame's delay doesn't
 * show: a lock writes back the widths the columns already have. Returns a function that stops
 * watching. Shared by the `<table>` freeze below and the editor's grid column lock (editor/grid.tsx).
 */
export function observe_layout(el: HTMLElement, fn: () => void): () => void {
  let frame = 0
  const observer = new ResizeObserver(() => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      if (el.offsetWidth > 0) fn()
    })
  })
  observer.observe(el)
  return () => {
    observer.disconnect()
    cancelAnimationFrame(frame)
  }
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
  table.style.tableLayout = "fixed"
  const header = table.tHead?.rows[0]?.cells[index]
  if (header) header.style.width = `${px}px`
}

/** A mousedown handler dragging `cell`'s right edge: calls `set_width` with each new width (px). */
function start_resize(cell: HTMLElement, min_width: number, set_width: (px: number) => void) {
  return (ev: MouseEvent) => {
    ev.preventDefault()
    ev.stopPropagation()

    const start_x = ev.clientX
    const start_width = cell.getBoundingClientRect().width
    const body = cell.ownerDocument.body

    body.style.cursor = "col-resize"
    body.style.userSelect = "none"

    function move(ev: MouseEvent) {
      set_width(Math.max(min_width, start_width + ev.clientX - start_x))
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

/** The drag handle of `cell`'s right edge, for the decorator to return: elt puts it in the cell. */
function resize_handle(cell: HTMLElement, min_width: number, set_width: (px: number) => void) {
  cell.classList.add(cls_resizable_th)
  return E("span", { class: cls_resize_handle }, $on("mousedown", start_resize(cell, min_width, set_width)))
}

/** The table a header cell is in, once it is in one. */
function table_of(th: HTMLTableCellElement) {
  const table = th.closest("table")
  return table instanceof HTMLTableElement ? table : null
}

function make_resizable(opts?: TableResizeOptions) {
  const min_width = opts?.minWidth ?? DEFAULT_MIN_WIDTH
  return (th: HTMLTableCellElement) => {
    // The cell is in its table only once connected: freeze the columns then.
    node_on_connected(th, () => {
      const table = table_of(th)
      if (table) schedule_freeze(table)
    })
    return resize_handle(th, min_width, (px) => {
      const table = table_of(th)
      if (table) set_column_width(table, th.cellIndex, px)
    })
  }
}

/**
 * Attach a drag handle to any column header cell (a grid's, say): `set_width` receives the new width
 * in px while dragging; the caller applies it (e.g. in the grid's `grid-template-columns`).
 */
export function $column_resizable(set_width: (px: number) => void, opts?: TableResizeOptions) {
  const min_width = opts?.minWidth ?? DEFAULT_MIN_WIDTH
  return (cell: HTMLElement) => resize_handle(cell, min_width, set_width)
}

/** Attach a drag handle to a `<th>` for column resize. */
export function $resizable(th: HTMLTableCellElement): HTMLElement
export function $resizable(opts: TableResizeOptions): (th: HTMLTableCellElement) => HTMLElement
export function $resizable(arg: HTMLTableCellElement | TableResizeOptions) {
  if (arg instanceof HTMLTableCellElement) return make_resizable()(arg)
  return make_resizable(arg)
}
