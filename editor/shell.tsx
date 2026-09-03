/*
Shell draft -- Layer 1b / Layer 2 of ui-object-editor.md, scoped to a first
implementation slice. Implements:

- the open contract (`elt-object-editor-open`, `$on`, `target` not
  `currentTarget` -- Layer 1b "Asking to open (DOM)" / "Editor shell")
- the column stack: ordered hosts, truncate-from-source-column-on-open,
  breadcrumb from column titles (Layer 1b "Display path, breadcrumbs")
- dead-column detection: each column watches its own `o_value`, closes
  itself + everything right of it on a `canHandle` failure, except the
  root, which re-resolves in place (Layer 1b "Invalid parent / external
  writes", "Dead-column detection (v1)")

Deliberately NOT here yet (see specs/TODO.md and ui-object-editor.md Scope):
- popups (`open_as` isn't modeled on `Options` yet -- everything opens as a
  column for now)
- shell toolbar: undo/redo, import/export, host application slots
- the constructor registry driving schema resolution for OPENED (non-root)
  columns (Layer 5 "Resolution" step 3) -- nothing in this slice's
  composites dispatches `elt-object-editor-open` yet (their `render()`
  bodies are still TODO stubs in schema.tsx), so this is
  unexercised; opened columns fall back to unknown mode (`anything`) until
  a real registry exists. //> Question: build the registry now, or wait
  until a composite actually needs to open a child?
- INVALID_MOUNT: no composite in this slice mints child observables via the
  safe-child helper yet (Layer 1b), so dead-column detection's clause (a)
  is a no-op here -- only clause (b) (`canHandle`) can currently fire.
*/

import { $observe, $on, css, node_append, node_clear, node_remove, o } from "elt"
import { anything, type Factory } from "./schema"

export interface ObjectEditorOpenDetail {
  o_value: o.Observable<unknown>
  title: string
}

declare global {
  interface GlobalEventHandlersEventMap {
    "elt-object-editor-open": CustomEvent<ObjectEditorOpenDetail>
  }
}

/** Widgets call this to ask the shell to open `o_value` -- never hold a shell reference (Layer 1b). */
export function dispatch_object_editor_open(target: EventTarget, detail: ObjectEditorOpenDetail) {
  target.dispatchEvent(new CustomEvent("elt-object-editor-open", { detail, bubbles: true, composed: true }))
}

interface Column {
  host: HTMLElement
  body: HTMLElement
  o_value: o.Observable<unknown>
  factory: Factory<unknown>
  title: string
}

export interface ShellOptions {
  // Root schema; defaults to unknown mode (Layer 5 `anything`).
  schema?: Factory<unknown>
}

export class ObjectEditorShell {
  readonly node: HTMLElement
  private readonly strip: HTMLElement
  private readonly columns: Column[] = []
  readonly o_breadcrumb = o<string[]>([])

  constructor(
    private readonly o_root: o.Observable<unknown>,
    private readonly options: ShellOptions = {},
  ) {
    this.strip = (<e-flex class={cls_strip}></e-flex>) as HTMLElement
    this.node = (
      <e-flex column class={cls_shell}>
        {$on("elt-object-editor-open", (ev) => {
          // Real DOM + bubbling (Layer 1b "Why"): stop it here so a shell
          // nested inside another one (not a v1 concern, but cheap to get
          // right) doesn't also react.
          ev.stopPropagation()
          this.open(ev.detail.o_value, ev.detail.title, ev.target as Node)
        })}
        <e-flex class={cls_breadcrumb}>{this.o_breadcrumb.tf((titles) => ["root", ...titles].join(" › "))}</e-flex>
        {this.strip}
      </e-flex>
    ) as HTMLElement

    this.mount_column(this.o_root, "root", this.options.schema ?? anything)
  }

  /** Layer 1b "Column truncation": DOM only locates the source column; the stack is the source of truth. */
  private index_of_column_containing(source: Node): number {
    for (let i = this.columns.length - 1; i >= 0; i--) {
      if (this.columns[i]?.host.contains(source)) return i
    }
    return -1
  }

  /** Layer 1b "Editor shell": open from inside a non-rightmost column truncates right of it; from the rightmost, appends. */
  open(o_value: o.Observable<unknown>, title: string, source: Node) {
    const found = this.index_of_column_containing(source)
    // A source outside every column (e.g. a host-application control that
    // isn't itself part of a mounted widget) opens after the root, same as
    // opening from it -- root is never truncated by this path, only what's
    // deeper than it.
    const idx = found === -1 ? 0 : found
    this.truncate_after(idx)
    // //> Question: resolve via the (not-yet-built) constructor registry
    // instead of always falling back to unknown mode -- see file header.
    this.mount_column(o_value, title, anything)
  }

  private truncate_after(idx: number) {
    while (this.columns.length > idx + 1) {
      const col = this.columns.pop()!
      node_remove(col.host)
    }
    this.refresh_breadcrumb()
  }

  private mount_column(o_value: o.Observable<unknown>, title: string, factory: Factory<unknown>) {
    const body = (<e-flex column class={cls_column_body}></e-flex>) as HTMLElement
    const is_root = this.columns.length === 0
    const host = (
      <e-flex column class={cls_column}>
        <e-flex class={cls_column_header}>
          <span>{title}</span>
          {!is_root && (
            <button type="button" class={cls_column_close}>
              {$on("click", () => this.truncate_after(this.columns.indexOf(column) - 1))}×
            </button>
          )}
        </e-flex>
        {body}
      </e-flex>
    ) as HTMLElement

    const column: Column = { host, body, o_value, factory, title }
    this.render_into(column)
    node_append(this.strip, host)

    this.columns.push(column)
    this.refresh_breadcrumb()
  }

  private render_into(column: Column) {
    node_clear(column.body)
    const widget = column.factory.render(column.o_value)
    node_append(column.body, widget.render())
    node_append(
      column.body,
      // Dead-column watch, tied to the column body's own lifecycle -- torn
      // down automatically by node_remove when the column closes (no
      // manual unsubscribe needed, same pattern EitherFactory.render uses).
      $observe(column.o_value, (value, old) => {
        if (old === o.NoValue) return // initial connect, not a change
        if (column.factory.canHandle(value)) return
        const idx = this.columns.indexOf(column)
        if (idx === -1) return
        if (idx === 0) {
          // Root special case (Layer 1b): no parent slot to go missing, so
          // only a resolved-kind change can fire here -- re-resolve in
          // place instead of closing. Re-resolving to the SAME fixed schema
          // would be a no-op (it just failed canHandle on this very value),
          // so fall back to unknown mode when the schema can't represent
          // the new value -- Layer 1b: "the shell keeps one root column
          // showing the matching scalar widget."
          const schema = this.options.schema
          column.factory = schema?.canHandle(value) ? schema : anything
          this.render_into(column)
        } else {
          this.truncate_after(idx - 1)
        }
      }),
    )
  }

  private refresh_breadcrumb() {
    this.o_breadcrumb.set(this.columns.slice(1).map((c) => c.title))
  }
}

// `css` inserts one rule per call (rewriting the leading class to a unique
// generated name) -- one call per class, kept js-side via these consts
// rather than hardcoded class strings in the JSX above.
const cls_shell = css`.oe-shell {
  border: 1px solid var(--e-color-text-light, #ccc);
  border-radius: 4px;
  overflow: hidden;
}`

const cls_breadcrumb = css`.oe-breadcrumb {
  padding: 4px 8px;
  font-size: 0.85em;
  opacity: 0.7;
  border-bottom: 1px solid var(--e-color-text-light, #ccc);
}`

const cls_strip = css`.oe-strip {
  overflow-x: auto;
  align-items: stretch;
}`

const cls_column = css`.oe-column {
  min-width: 260px;
  border-right: 1px solid var(--e-color-text-light, #ccc);
  flex: none;
}`

const cls_column_header = css`.oe-column-header {
  justify-content: space-between;
  align-items: center;
  padding: 4px 8px;
  background: var(--e-color-tint, #eee);
  font-weight: bold;
}`

const cls_column_close = css`.oe-column-close {
  border: none;
  background: none;
  cursor: pointer;
  font-size: 1rem;
}`

const cls_column_body = css`.oe-column-body {
  padding: 8px;
}`
