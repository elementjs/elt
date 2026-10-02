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
- undo/redo on the root column's header line (Layer 2 / Layer 5)
- constructor registry fallback when drill-in omits `factory` (Layer 5)
*/

import { $connected, $on, css, o, Repeat, type Renderable } from "elt"
import { popup, sym_popup_closed } from "elt/ui/popup"
import { theme } from "elt/ui"
import { cls_text_fill } from "./grid"
import { is_valid_mount } from "./mount"
import { resolve_factory_from_value } from "./registry"
import {
  anything,
  concrete_factory,
  dispatch_object_editor_open,
  type CommonNodeOptions,
  type Factory,
  type ObjectEditorOpenDetail,
} from "./schema"
import { RootUndoRing } from "./undo"

export { dispatch_object_editor_open, type ObjectEditorOpenDetail }

interface ColumnDescriptor {
  o_value: o.Observable<unknown>
  /** The factory the column was opened with, possibly an `either()`/`forward()` (re-resolved from on a type change). */
  declared: Factory<unknown>
  /** The concrete factory rendering the value now (see `concrete_factory`): its header/toolbar are the column's. */
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

    // The strip of columns: separate components, spaced at the component step (the default), each
    // with its own frame, in a scroll area for when they're wider than the editor. The columns sit in
    // an inner row rather than directly in the scroll area: a scroll area draws the frame of a
    // `packed border` child itself, and would take each column's own frame away.
    this.node = (
      <e-row scroll="x">
        {$on("elt-object-editor-open", (ev) => {
          ev.stopPropagation()
          this.open(ev.detail.o_value, ev.detail.title, ev.target as Node, ev.detail.factory, ev.detail.open_as)
        })}
        <e-row align="start">
          {Repeat(this.o_columns, (o_col, o_idx) => {
            if (o_col.get().presentation === "popup") {
              return document.createComment("oe-popup") as unknown as Renderable<Node>
            }
            return this.render_column(o_col, o_idx)
          })}
        </e-row>
      </e-row>
    ) as HTMLElement

    this.o_columns.set([this.create_column(this.o_root, undefined, this.options.schema ?? anything, "column")])
    this.undo.attach()
  }

  private create_column(
    o_value: o.Observable<unknown>,
    title: string | undefined,
    factory: Factory<unknown>,
    presentation: "column" | "popup",
  ): ColumnDescriptor {
    return { o_value, title, declared: factory, o_factory: o(concrete_factory(factory, o_value.get())), presentation }
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

      // The declared factory first (a schema's either() keeps its own branches), then any kind.
      const declared = concrete_factory(column.declared, value)
      const resolved = declared.canHandle(value) ? declared : concrete_factory(anything, value)
      if (resolved.canHandle(value)) {
        column.o_factory.set(resolved)
        return
      }

      if (is_root) {
        const schema = this.options.schema
        column.o_factory.set(concrete_factory(schema?.canHandle(value) ? schema : anything, value))
        return
      }

      this.close_after(idx - 1)
    })

    column.unwatch = () => column.o_value.removeObserver(observer)
  }

  private mount_popup(column: ColumnDescriptor, idx: number, anchor: Element) {
    this.watch_column(column, idx, false)

    const fut = popup(anchor, (fut) => {
      column.dismiss_popup = () => fut.resolve(sym_popup_closed)

      const panel = (
        <e-column align="stretch" class={cls_popup_panel}>
          {$connected((el: HTMLElement) => {
            column.host = (el.closest("[popover]") as HTMLElement | null) ?? el
          })}
          {this.render_chrome(column, () => fut.resolve(undefined), false)}
        </e-column>
      ) as HTMLElement

      return panel
    })

    fut.then((result) => {
      column.unwatch?.()
      if (result === sym_popup_closed) return
      const cols = this.o_columns.get()
      if (cols[idx] === column) this.close_after(idx - 1)
    })
  }

  /**
   * A column's or popup's content (Layer 2): one header line, the widget's toolbar if it has one, then
   * the widget. The header line holds the column title merged with the composite's type label
   * (`address · Object {3}`), the composite's actions (warning, `…` menu), then Undo/Redo on the
   * root or × elsewhere. The toolbar sits under the header, not under the rows: filtering shortens
   * the rows, and a toolbar below them would move. A composite's grid sits flush against the frame;
   * a scalar root is padded.
   */
  private render_chrome(column: ColumnDescriptor, close: () => void, is_root: boolean): HTMLElement {
    const o_widget = column.o_factory.tf((factory) => factory.render(column.o_value))
    const o_header = o_widget.tf((widget) => widget.header ?? null)
    const o_label = o.expression((get) => {
      const header = get(o_header)
      const type_label = header ? get(header.o_label) : null
      return [column.title, type_label].filter((part) => part != null && part !== "").join(" · ")
    })
    // `packed border`: the column draws its frame; header line, toolbar and rows touch, separated by
    // seams (the header line and toolbar, `packed border` themselves, keep only their inner seams).
    // `spacing="widget"`: a packed container's step is the step of what it packs (docs/md/ui-layout.md#packed),
    // here widget-padded groups. It adds no gap (packed), but gives the frame the widget radius its
    // first/last children's outer corners take, and the widget step to whatever inherits it inside.
    return (
      <e-column packed border pad="none" spacing="widget" align="stretch">
        {/* Widgets touching, each padded at the widget step, separated by seams. */}
        <e-row packed="widget" border align="center" class={theme.colors.tint.class_as_inverted}>
          <strong class={cls_text_fill} title={o_label}>
            {o_label}
          </strong>
          {o_header.tf((header) => header?.actions ?? null)}
          {is_root ? (
            <>
              <button type="button" disabled={this.undo.o_can_undo.tf((v) => !v)}>
                {$on("click", () => this.undo.undo())}
                Undo
              </button>
              <button type="button" disabled={this.undo.o_can_redo.tf((v) => !v)}>
                {$on("click", () => this.undo.redo())}
                Redo
              </button>
            </>
          ) : (
            <button type="button" aria-label="Close">
              {$on("click", close)}×
            </button>
          )}
        </e-row>
        {o_widget.tf((widget) => widget.toolbar ?? null)}
        {o_widget.tf((widget) =>
          widget.header ? widget.render() : <e-column pad="component">{widget.render()}</e-column>,
        )}
      </e-column>
    ) as HTMLElement
  }

  private render_column(
    o_column: o.Observable<ColumnDescriptor>,
    o_idx: o.IReadonlyObservable<number>,
  ): Renderable<Node> {
    // The column is its chrome element itself, a direct child of the strip.
    return o_column.tf((column) => {
      const idx = o_idx.get()
      const is_root = idx === 0
      const el = this.render_chrome(column, () => this.close_after(o_idx.get() - 1), is_root)
      el.classList.add(cls_column)
      column.host = el
      if (!column.unwatch) this.watch_column(column, idx, is_root)
      return el
    })
  }
}

/* Custom CSS: a flex child shrinks by default; a column keeps its width and the strip scrolls. */
const cls_column = css`.oe-column {
  flex: none;
}`

/* Custom CSS: a popup's size bounds, which no layout attribute expresses. */
const cls_popup_panel = css`.oe-popup-panel {
  min-width: 260px;
  max-width: min(90vw, 480px);
  max-height: 70vh;
}`
