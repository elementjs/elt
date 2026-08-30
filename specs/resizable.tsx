import { $connected, css, node_add_event_listener } from "elt"

const DEFAULT_MIN_WIDTH = 48

export interface ResizableOptions {
  minWidth?: number
}

const lastFrozenColumnCount = new WeakMap<HTMLTableElement, number>()
const pendingFreeze = new WeakSet<HTMLTableElement>()

function freezeTableLayout(table: HTMLTableElement) {
  const headerRow = table.tHead?.rows[0]
  if (!headerRow) return

  const count = headerRow.cells.length
  const last = lastFrozenColumnCount.get(table)
  if (table.style.tableLayout === "fixed" && last === count) return

  for (const cell of headerRow.cells) {
    if (!cell.style.width) {
      cell.style.width = `${cell.getBoundingClientRect().width}px`
    }
  }
  table.style.tableLayout = "fixed"
  lastFrozenColumnCount.set(table, count)
}

function scheduleFreeze(table: HTMLTableElement) {
  if (pendingFreeze.has(table)) return
  pendingFreeze.add(table)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      pendingFreeze.delete(table)
      freezeTableLayout(table)
    })
  })
}

function setColumnWidth(table: HTMLTableElement, index: number, px: number) {
  table.style.tableLayout = "fixed"
  const header = table.tHead?.rows[0]?.cells[index]
  if (header) header.style.width = `${px}px`
}

function startResize(th: HTMLTableCellElement, minWidth: number) {
  return (ev: MouseEvent) => {
    ev.preventDefault()
    ev.stopPropagation()

    const found = th.closest("table")
    if (found === null) return
    const table: HTMLTableElement = found

    const index = th.cellIndex
    const startX = ev.clientX
    const startWidth = th.getBoundingClientRect().width
    const body = th.ownerDocument.body

    body.style.cursor = "col-resize"
    body.style.userSelect = "none"

    function move(ev: MouseEvent) {
      setColumnWidth(table, index, Math.max(minWidth, startWidth + ev.clientX - startX))
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

const cls_resizable_th = css`.elt-resizable-th {
  position: relative;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}`

const cls_resize_handle = css`.elt-col-resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  width: 5px;
  height: 100%;
  cursor: col-resize;
  touch-action: none;
}`

function makeResizable(opts?: ResizableOptions) {
  const minWidth = opts?.minWidth ?? DEFAULT_MIN_WIDTH
  return $connected((th: HTMLTableCellElement) => {
    th.classList.add(cls_resizable_th)

    const handle = document.createElement("span")
    handle.className = cls_resize_handle
    th.appendChild(handle)
    node_add_event_listener(handle, "mousedown", startResize(th, minWidth))

    const table = th.closest("table")
    if (table) scheduleFreeze(table)
  })
}

export function $resizable(th: HTMLTableCellElement): void
export function $resizable(opts: ResizableOptions): (th: HTMLTableCellElement) => void
export function $resizable(arg: HTMLTableCellElement | ResizableOptions) {
  if (arg instanceof HTMLTableCellElement) {
    makeResizable()(arg)
    return
  }
  return makeResizable(arg)
}
