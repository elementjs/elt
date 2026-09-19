/*
Shell draft -- Layer 1b / Layer 2 of ui-object-editor.md, scoped to a first
implementation slice. Implements:

- the open contract (`elt-object-editor-open`, `$on`, `target` not
  `currentTarget` -- Layer 1b "Asking to open (DOM)" / "Editor shell")
- the column stack: ordered hosts, truncate-from-source-column-on-open,
  breadcrumb from column titles (Layer 1b "Display path, breadcrumbs")
- popup opens via `open_as` / `prefer_popups` (Layer 1b / Layer 2)
- dead-column detection: each column watches its own `o_value`; on a
  resolved-kind change it re-resolves the column factory in place (same
  pattern as inline mounts, Layer 1b / Layer 4). Columns close only when
  nothing can represent the value; the root also falls back to unknown
  mode when its schema no longer fits (Layer 1b "Invalid parent / external
  writes", "Dead-column detection (v1)")
- shell toolbar undo/redo (Layer 5)
- constructor registry fallback when drill-in omits `factory` (Layer 5)
*/

import { $connected, $on, css, o, Repeat, type Renderable } from "elt"
import { popup, sym_popup_closed } from "elt/ui/popup"
import { theme } from "elt/ui"
import { is_valid_mount } from "./mount"
import { resolve_factory_from_value } from "./registry"
import {
  anything,
  dispatch_object_editor_open,
  EitherFactory,
  type CommonNodeOptions,
  type Factory,
  type ObjectEditorOpenDetail,
} from "./schema"
import { RootUndoRing } from "./undo"

export { dispatch_object_editor_open, type ObjectEditorOpenDetail }

interface ColumnDescriptor {
  o_value: o.Observable<unknown>
  o_factory: o.Observable<Factory<unknown>>
  title: string | undefined
  presentation: "column" | "popup"
  host?: HTMLElement
  /** Close a popup presentation for this stack entry, if open. */
  dismiss_popup?: () => void
  /** Remove the dead-column observer when dismissing. */
  unwatch?: () => void
}

export interface ShellOptions {
  schema?: Factory<unknown>
  prefer_popups?: boolean
  undo?: { depth?: number; import_undo_depth?: number }
}

function root_is_scalar(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value !== "object") return true
  if (value instanceof Date) return true
  return false
}

export class ObjectEditorShell {
  readonly node: HTMLElement
  private readonly o_columns = o<ColumnDescriptor[]>([])
  readonly o_breadcrumb: o.ReadonlyObservable<string[]>
  private readonly undo: RootUndoRing

  constructor(
    private readonly o_root: o.Observable<unknown>,
    private readonly options: ShellOptions = {},
  ) {
    this.o_breadcrumb = this.o_columns.tf((cols) => cols.slice(1).map((c) => c.title ?? ""))
    this.undo = new RootUndoRing(this.o_root, this.options.undo ?? {})

    this.node = (
      <e-flex column class={cls_shell}>
        {$on("elt-object-editor-open", (ev) => {
          ev.stopPropagation()
          this.open(
            ev.detail.o_value,
            ev.detail.title,
            ev.target as Node,
            ev.detail.factory,
            ev.detail.open_as,
          )
        })}
        <e-flex class={cls_strip}>
          {Repeat(this.o_columns, (o_col, o_idx) => {
            if (o_col.get().presentation === "popup") {
              return document.createComment("oe-popup") as unknown as Renderable<Node>
            }
            return this.render_column(o_col, o_idx)
          })}
        </e-flex>
      </e-flex>
    ) as HTMLElement

    this.o_columns.set([
      this.create_column(this.o_root, undefined, this.options.schema ?? anything, "column"),
    ])
    this.undo.attach()
  }

  private create_column(
    o_value: o.Observable<unknown>,
    title: string | undefined,
    factory: Factory<unknown>,
    presentation: "column" | "popup",
  ): ColumnDescriptor {
    return { o_value, title, o_factory: o(factory), presentation }
  }

  private resolve_open_factory(factory: Factory<unknown> | undefined, o_value: o.Observable<unknown>) {
    return factory ?? resolve_factory_from_value(o_value.get(), anything)
  }

  private resolve_presentation(
    factory: Factory<unknown>,
    detail_open_as: "column" | "popup" | undefined,
  ): "column" | "popup" {
    const node_open = detail_open_as ?? (factory.options as CommonNodeOptions | undefined)?.open_as
    if (node_open === "popup") return "popup"
    if (node_open === "column") return "column"
    return this.options.prefer_popups ? "popup" : "column"
  }

  private index_of_column_containing(source: Node): number {
    const cols = this.o_columns.get()
    for (let i = cols.length - 1; i >= 0; i--) {
      if (cols[i]?.host?.contains(source)) return i
    }
    return -1
  }

  private dismiss_from(idx: number) {
    const cols = this.o_columns.get()
    for (let i = idx + 1; i < cols.length; i++) {
      cols[i]?.dismiss_popup?.()
      cols[i]?.unwatch?.()
    }
  }

  open(
    o_value: o.Observable<unknown>,
    title: string,
    source: Node,
    factory?: Factory<unknown>,
    open_as?: "column" | "popup",
  ) {
    const resolved = this.resolve_open_factory(factory, o_value)
    const presentation = this.resolve_presentation(resolved, open_as)
    const found = this.index_of_column_containing(source)
    const idx = found === -1 ? 0 : found
    this.dismiss_from(idx)
    const kept = this.o_columns.get().slice(0, idx + 1)
    const column = this.create_column(o_value, title, resolved, presentation)

    if (presentation === "popup" && source instanceof Element) {
      this.o_columns.set([...kept, column])
      this.mount_popup(column, kept.length, source)
      return
    }

    this.o_columns.set([...kept, column])
  }

  private close_after(idx: number) {
    this.dismiss_from(idx)
    this.o_columns.set(this.o_columns.get().slice(0, idx + 1))
  }

  private watch_column(column: ColumnDescriptor, idx: number, is_root: boolean) {
    const observer = column.o_value.addObserver((value, old) => {
      if (old === o.NoValue) return

      if (is_root && root_is_scalar(value) && this.o_columns.get().length > 1) {
        this.close_after(0)
      }

      if (!is_valid_mount(value)) {
        if (!is_root) this.close_after(idx - 1)
        return
      }

      if (column.o_factory.get().canHandle(value)) return

      const resolved = (anything as EitherFactory).resolve(value)
      if (resolved.canHandle(value)) {
        column.o_factory.set(resolved)
        return
      }

      if (is_root) {
        const schema = this.options.schema
        column.o_factory.set(schema?.canHandle(value) ? schema : anything)
        return
      }

      this.close_after(idx - 1)
    })

    column.unwatch = () => column.o_value.removeObserver(observer)
  }

  private mount_popup(column: ColumnDescriptor, idx: number, anchor: Element) {
    const shell = this
    this.watch_column(column, idx, false)

    const fut = popup(anchor, (fut) => {
      column.dismiss_popup = () => fut.resolve(sym_popup_closed)

      const o_widget = column.o_factory.tf((factory) => factory.render(column.o_value))

      const panel = (
        <e-flex column class={cls_popup_panel}>
          {$connected((el: HTMLElement) => {
            column.host = (el.closest("[popover]") as HTMLElement | null) ?? el
          })}
          <e-flex column gap="widget" pad="widget" class={cls_column_header}>
            <e-flex full-width justify="space-between" align="center">
              {column.title != null && <span>{column.title}</span>}
              <button type="button" class={cls_column_close}>
                {$on("click", () => fut.resolve(undefined))}×
              </button>
            </e-flex>
            {o_widget.tf((widget) => widget.header ?? null)}
          </e-flex>
          <e-flex column gap="widget" pad="widget" class={cls_popup_body}>
            {o_widget.tf((widget) => widget.render())}
          </e-flex>
        </e-flex>
      ) as HTMLElement

      return panel
    })

    fut.then((result) => {
      column.unwatch?.()
      if (result === sym_popup_closed) return
      const cols = shell.o_columns.get()
      if (cols[idx] === column) shell.close_after(idx - 1)
    })
  }

  private render_column(o_column: o.Observable<ColumnDescriptor>, o_idx: o.IReadonlyObservable<number>): Renderable<Node> {
    const host = (
      <e-flex column class={cls_column}>
        {o_column.tf((column) => {
          const idx = o_idx.get()
          const is_root = idx === 0
          column.host = host
          if (!column.unwatch) this.watch_column(column, idx, is_root)
          const o_widget = column.o_factory.tf((factory) => factory.render(column.o_value))
          return (
            <e-flex column class={cls_column_body}>
              <e-flex column gap="widget" pad="widget" class={cls_column_header}>
                <e-flex full-width justify="space-between" align="center">
                  {column.title != null && <span>{column.title}</span>}
                  {is_root ? (
                    <e-row gap="widget">
                      <button type="button" e-variant="text" disabled={this.undo.o_can_undo.tf((v) => !v)}>
                        {$on("click", () => this.undo.undo())}
                        Undo
                      </button>
                      <button type="button" e-variant="text" disabled={this.undo.o_can_redo.tf((v) => !v)}>
                        {$on("click", () => this.undo.redo())}
                        Redo
                      </button>
                    </e-row>
                  ) : (
                    <button type="button" class={cls_column_close}>
                      {$on("click", () => this.close_after(o_idx.get() - 1))}×
                    </button>
                  )}
                </e-flex>
                {o_widget.tf((widget) => widget.header ?? null)}
              </e-flex>
              <e-flex column gap="widget" pad="widget">
                {o_widget.tf((widget) => widget.render())}
              </e-flex>
            </e-flex>
          )
        })}
      </e-flex>
    ) as HTMLElement

    return host
  }
}

const cls_shell = css`.oe-shell {
  border: 1px solid ${theme.colors.text.light};
  border-radius: ${theme.settings.frameBorderRadius};
  overflow: hidden;
}`

const cls_strip = css`.oe-strip {
  overflow-x: auto;
  align-items: stretch;
}`

const cls_column = css`.oe-column {
  min-width: 260px;
  border-right: 1px solid ${theme.colors.text.light};
  flex: none;
}`

const cls_column_body = css`.oe-column-body {
  flex: 1;
  min-height: 0;
}`

const cls_column_header = css`.oe-column-header {
  min-height: 1.8em;
  font-weight: bold;
  ${theme.colors.tint.css_as_inverted}
}`

const cls_column_close = css`.oe-column-close {
  border: none;
  background: none;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  padding: 0;
  width: 1.4em;
  height: 1.4em;
}`

const cls_popup_panel = css`.oe-popup-panel {
  min-width: 260px;
  max-width: min(90vw, 480px);
  max-height: 70vh;
}`

const cls_popup_body = css`.oe-popup-body {
  overflow: auto;
  min-height: 0;
}`
