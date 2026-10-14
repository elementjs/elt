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

import { $connected, $observe, $on, css, type Attrs, type Decorator, o, Repeat, type Renderable } from "elt"
import { theme } from "elt/ui"
import { DownloadSimple } from "elt/ui/icons"
import { ArrowClockwise, ArrowCounterClockwise } from "./icons"
import { popup } from "elt/ui/popup"
import { $keymap } from "elt/ui/keymap"
import { default_settings, type EditorSettings } from "./composite-toolbar"
import {
  $editor_menu_when,
  delete_section,
  type MenuSection,
  menu_sections,
  open_menu_from_button,
  text_field_of,
  type_change_item,
} from "./context-menu"
import { is_valid_mount } from "./mount"
import { resolve_factory_from_value } from "./registry"
import {
  anything,
  concrete_factory,
  dispatch_object_editor_open,
  type CommonNodeOptions,
  type Factory,
  type ObjectEditorOpenDetail,
  resolve_in_slot,
  slot_type_targets,
  type WidgetHeader,
} from "./schema"
import { tint_class, type_style_of_value } from "./type-style"
import { RootUndoRing } from "./undo"

/* The header line's text, the title and the buttons, in the column type's ink color (the tint is the column's). */
const cls_header = css`.oe-header {
  & > strong,
  & > button {
    color: ${theme.colors.tint.ink};
  }
}`

const cls_header_icon = css`.oe-header-icon {
  margin-inline-end: 0.4em;
}`

export { dispatch_object_editor_open, type ObjectEditorOpenDetail }

interface ColumnDescriptor {
  o_value: o.Observable<unknown>
  /** The factory the column was opened with, possibly an `either()`/`forward()` (re-resolved from on a type change). */
  declared: Factory<unknown>
  /** The concrete factory rendering the value now (see `concrete_factory`): its header/toolbar are the column's. */
  o_factory: o.Observable<Factory<unknown>>
  title: string | undefined
  /** Removes the value from its parent (the header menu's Delete); absent on the root and when the parent doesn't allow it. */
  on_delete?: () => void
  presentation: "column" | "popup"
  /** The settings this column starts from: the editor's attributes, with `packed` taken from the value that opened it. */
  inherited: EditorSettings
  /** The settings the shell itself reads for this column: its node's options over `inherited`, following both. */
  settings: Pick<EditorSettings, "packed" | "show_title" | "show_menu">
  host?: HTMLElement
  /** Close a popup presentation for this stack entry, if open. */
  dismiss_popup?: () => void
}

/**
 * The editor-wide settings: every one is the default for the nodes of the schema, which replace it
 * for themselves with the option of the same name (`CommonNodeOptions`). Unlike the others, `packed`
 * also carries on to what a node opens. The settings, `prefer_popups` and `show_undo_redo` are
 * `o.RO`: the editor follows an observable. `schema` and `undo` are read once, when the editor is built.
 */
export interface ShellOptions extends Partial<EditorSettings> {
  schema?: Factory<unknown>
  /** Opens values in popups rather than columns. Read each time something opens. */
  prefer_popups?: o.RO<boolean>
  /** The size of the history, or `false` for none: no Undo/Redo buttons, no shortcut. */
  undo?: { depth?: number; import_undo_depth?: number } | false
  /** The Undo/Redo buttons of the root's header line; the shortcut stays. Default true. */
  show_undo_redo?: o.RO<boolean>
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
  /** The settings of the root column, and the defaults of every node (`packed` aside, see `ColumnDescriptor.inherited`). */
  private readonly defaults: EditorSettings

  constructor(
    private readonly o_root: o.Observable<unknown>,
    private readonly options: ShellOptions = {},
  ) {
    this.o_breadcrumb = this.o_columns.tf((cols) => cols.slice(1).map((c) => c.title ?? ""))
    this.undo = new RootUndoRing(this.o_root, this.options.undo || {})
    this.defaults = {
      packed: this.options.packed ?? default_settings.packed,
      show_title: this.options.show_title ?? default_settings.show_title,
      show_filter: this.options.show_filter ?? default_settings.show_filter,
      show_add: this.options.show_add ?? default_settings.show_add,
      show_menu: this.options.show_menu ?? default_settings.show_menu,
    }

    // The strip of columns: separate components, spaced at the section step, each
    // with its own frame, in a scroll area for when they're wider than the editor. The columns sit in
    // an inner row rather than directly in the scroll area: a scroll area draws the frame of a
    // `packed border` child itself, and would take each column's own frame away.
    this.node = (
      <e-row scroll="x">
        {this.options.undo !== false &&
          // The history follows the root while the editor is on screen. Immediate: the first call, now, seeds it with
          // the initial state, and a write made before the editor is mounted is still seen once it is.
          $observe(
            this.o_root,
            (value, old) => {
              this.undo.record(value, old)
            },
            { immediate: true },
          )}
        {this.options.undo !== false &&
          $keymap({
            // Not in a text field: there, the browser undoes the typing, which is what the user means.
            "Mod+z": { callback: (_, __, ev) => this.shortcut(ev, () => this.undo.undo()), prevent_default: false },
            "Mod+Shift+z": {
              callback: (_, __, ev) => this.shortcut(ev, () => this.undo.redo()),
              prevent_default: false,
            },
          })}
        {$on("elt-object-editor-open", (ev) => {
          ev.stopPropagation()
          const { o_value, title, factory, open_as, on_delete } = ev.detail
          this.open(o_value, title, ev.target as Node, factory, open_as, on_delete)
        })}
        <e-row align="start" spacing={o.tf(this.defaults.packed, (packed) => (packed ? undefined : "section"))}>
          {Repeat(this.o_columns, (o_col, o_idx) => {
            if (o_col.get().presentation === "popup") {
              return document.createComment("oe-popup") as unknown as Renderable<Node>
            }
            return this.render_column(o_col, o_idx)
          })}
        </e-row>
      </e-row>
    ) as HTMLElement

    this.o_columns.set([
      this.create_column(this.o_root, undefined, this.options.schema ?? anything, "column", this.defaults),
    ])
  }

  /** Runs an undo/redo shortcut unless focus is in a text field, whose own undo the browser keeps. */
  private shortcut(ev: KeyboardEvent, run: () => void) {
    if (text_field_of(ev.target)) return
    ev.preventDefault()
    run()
  }

  private create_column(
    o_value: o.Observable<unknown>,
    title: string | undefined,
    factory: Factory<unknown>,
    presentation: "column" | "popup",
    inherited: EditorSettings,
    on_delete?: () => void,
  ): ColumnDescriptor {
    // The slot's factory for the value, or unknown mode's when the slot can't handle it.
    const o_factory = o(resolve_in_slot(factory, o_value.get()))
    // The node's own option over what the column inherits: each follows the factory (it changes with the
    // value's type) and the inherited setting, which may be an observable.
    const setting = (key: "packed" | "show_title" | "show_menu") =>
      o.expression((get) => (get(o_factory).options as CommonNodeOptions | undefined)?.[key] ?? get(inherited[key]))
    const settings = { packed: setting("packed"), show_title: setting("show_title"), show_menu: setting("show_menu") }
    return { o_value, title, declared: factory, o_factory, presentation, inherited, settings, on_delete }
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
    // Read now, when something opens: a later change applies to the next open.
    return o.get(this.options.prefer_popups) ? "popup" : "column"
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
    }
  }

  open(
    o_value: o.Observable<unknown>,
    title: string,
    source: Node,
    factory?: Factory<unknown>,
    open_as?: "column" | "popup",
    on_delete?: () => void,
  ) {
    const resolved = this.resolve_open_factory(factory, o_value)
    const presentation = this.resolve_presentation(resolved, open_as)
    const found = this.index_of_column_containing(source)
    const idx = found === -1 ? 0 : found
    this.dismiss_from(idx)
    const kept = this.o_columns.get().slice(0, idx + 1)
    // `packed` carries on from the column the value is opened from; the other settings restart from the editor's.
    const opener = kept[idx]
    const inherited = { ...this.defaults, packed: opener ? opener.settings.packed : this.defaults.packed }
    const column = this.create_column(o_value, title, resolved, presentation, inherited, on_delete)

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

  /**
   * Keeps a column's widget in step with its value: when the value stops fitting it, the widget changes or
   * the column closes. A decorator of the column's element: it observes while the column is on screen.
   */
  private watch_column(column: ColumnDescriptor, idx: number, is_root: boolean) {
    return $observe(
      column.o_value,
      (value) => {
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
      },
      { changes_only: true },
    )
  }

  private mount_popup(column: ColumnDescriptor, idx: number, anchor: Element) {
    const fut = popup(
      anchor,
      (fut) => {
        column.dismiss_popup = () => fut.resolve(undefined)

        // Unpacked, the popup is a floating panel of plain rows: it keeps a frame, and pads its content itself.
        const packed = column.settings.packed
        const panel = (
          <e-column
            align="stretch"
            surface="background"
            border
            radius="component"
            pad={o.tf(packed, (packed) => (packed ? undefined : "component"))}
          >
            {$connected((el: HTMLElement) => {
              column.host = (el.closest("[popover]") as HTMLElement | null) ?? el
            })}
            {this.render_chrome(column, () => fut.resolve(undefined), false, this.watch_column(column, idx, false))}
          </e-column>
        ) as HTMLElement

        return panel
      },
      // A column's width is more than a menu's: room for a label and a field, but not the whole page.
      { min_width: 260, max_width: "min(90vw, 480px)" },
    )

    // However it ends (the × button, the shell closing it, a dismissal), the column goes with it;
    // `close_after` is idempotent, so the shell closing it first is harmless.
    fut.then(() => {
      const cols = this.o_columns.get()
      if (cols[idx] === column) this.close_after(idx - 1)
    })
  }

  /**
   * A column's or popup's content (Layer 2): one header line, the widget's toolbar if it has one, then
   * the widget. The header line holds the column title merged with the composite's type label
   * (`address · Object (3)`), the composite's actions (warning, `…` menu), then Undo/Redo on the
   * root or × elsewhere. The toolbar sits under the header, not under the rows: filtering shortens
   * the rows, and a toolbar below them would move. A composite's grid sits flush against the frame;
   * a scalar root is padded.
   */
  /**
   * The column's header menu: its value's type change (what its slot accepts), the composite's
   * import/export add-ons, and Delete (removes the value from its parent, closing this column and
   * those after it). Empty when the composite's schema hides the menu (`show_menu: false`).
   */
  private header_menu(column: ColumnDescriptor, header: WidgetHeader | null, close: () => void): MenuSection[] {
    const current = column.o_factory.get()
    if (!o.get(column.settings.show_menu)) return []
    return menu_sections([
      type_change_item(
        "Value",
        column.o_value,
        current,
        slot_type_targets(column.declared, current.type_change_extra()),
      ),
      {
        title: "Import / export",
        items: (header?.import_export ?? []).map((addon) => ({
          label: addon.label,
          icon: DownloadSimple,
          run: () => {},
          disabled: true,
        })),
      },
      delete_section(
        column.on_delete &&
          (() => {
            column.on_delete?.()
            close()
          }),
      ),
    ])
  }

  private render_chrome(
    column: ColumnDescriptor,
    close: () => void,
    is_root: boolean,
    watch: Decorator<HTMLElement>,
  ): HTMLElement {
    const { packed, show_title, show_menu } = column.settings
    // The widget gets the column's starting settings: it resolves its own node options over them.
    // The column's type decides its color: it is the tint of the whole column (frame, header line, toolbar,
    // seams, a table's header), as the theme's `class_as_tint` does. Observed from the value, so a type
    // change recolors it; the same type is the same style, which observers skip.
    const o_style = column.o_value.tf(type_style_of_value)
    const o_widget = column.o_factory.tf((factory) => factory.render(column.o_value, column.inherited))
    const o_header = o_widget.tf((widget) => widget.header ?? null)
    const menu = () => this.header_menu(column, o_header.get(), close)
    // The `…` button shows when the menu has something; re-checked when the value's kind changes.
    const o_has_menu = o.expression(
      (get) => get(show_menu) && this.header_menu(column, get(o_header), close).length > 0,
    )
    const o_label = o.expression((get) => {
      if (!get(show_title)) return ""
      const header = get(o_header)
      const type_label = header ? get(header.o_label) : null
      return [column.title, type_label].filter((part) => part != null && part !== "").join(" · ")
    })
    const o_undo_buttons = o.tf(
      this.options.show_undo_redo ?? true,
      (show) => is_root && this.options.undo !== false && show,
    )
    // The root's header line goes away when nothing is left on it (no label, menu, action, Add button, or
    // Undo/Redo to offer). Any other column keeps it for its ×.
    const o_has_header = o.expression(
      (get) =>
        !is_root ||
        (get(o_undo_buttons) && (get(this.undo.o_can_undo) || get(this.undo.o_can_redo))) ||
        get(o_label) !== "" ||
        get(o_has_menu) ||
        get(o_header)?.actions != null ||
        get(get(o_header)?.add ?? null) != null,
    )
    // Packed: `packed border` -- the column draws its frame; header line, toolbar and rows touch,
    // separated by the column's lines (the header line and toolbar are groups inside it, cells of
    // the column that draw only the lines between their own children). `spacing="widget"`: a packed container's step is the step of what it packs
    // (docs/md/ui-layout.md#packed), here widget-padded groups. It adds no gap (packed), but gives the
    // frame the widget radius its first/last children's outer corners take, and the widget step to
    // whatever inherits it inside. Unpacked, all of it is plain rows and columns with no frame, spaced at
    // `component` (header line, toolbar and rows are widgets; the strip around spaces the columns at `section`).
    return (
      <e-column
        packed={packed}
        border={o.expression((get) => (get(packed) ? (get(o_style).color ? "tint" : true) : undefined))}
        class={o_style.tf(tint_class)}
        pad={o.tf(packed, (packed) => (packed ? "none" : undefined))}
        spacing={o.tf(packed, (packed) => (packed ? "widget" : "component"))}
        align="stretch"
      >
        {watch}
        {o_has_header.tf(
          (has_header) =>
            has_header && (
              // Packed: widgets touching, each padded at the widget step, separated by seams.
              <e-row
                packed={o.tf(packed, (packed) => (packed ? "widget" : undefined))}
                seams={o.tf(packed, (packed) => (packed ? "none" : undefined))}
                align={o.tf(packed, (packed) => (packed ? "center" : "baseline"))}
                class={cls_header}
              >
                {$editor_menu_when(show_menu, menu)}
                {/* The title: the icon of the column's type, then the label; none when the title is hidden. */}
                {o_label.tf(
                  (label) =>
                    label !== "" && (
                      <strong e-ellipsis title={label}>
                        <span class={cls_header_icon}>{o_style.tf((style) => style.icon())}</span>
                        {label}
                      </strong>
                    ),
                )}
                {o_header.tf((header) => header?.actions ?? null)}
                {o_has_menu.tf(
                  (has) =>
                    has && (
                      <button type="button" aria-label="More actions" aria-haspopup="menu">
                        {$on("click", (ev) => open_menu_from_button(ev.currentTarget as HTMLElement, menu))}…
                      </button>
                    ),
                )}
                {/* Undo and Redo, packed together, only when there is something to undo or redo. */}
                {o
                  .expression((get) => get(o_undo_buttons) && (get(this.undo.o_can_undo) || get(this.undo.o_can_redo)))
                  .tf(
                    (any) =>
                      any && (
                        <e-row packed="widget">
                          {this.undo.o_can_undo.tf(
                            (can) =>
                              can && (
                                <button type="button" title="Undo" aria-label="Undo">
                                  {$on("click", () => this.undo.undo())}
                                  {ArrowCounterClockwise()}
                                </button>
                              ),
                          )}
                          {this.undo.o_can_redo.tf(
                            (can) =>
                              can && (
                                <button type="button" title="Redo" aria-label="Redo">
                                  {$on("click", () => this.undo.redo())}
                                  {ArrowClockwise()}
                                </button>
                              ),
                          )}
                        </e-row>
                      ),
                  )}
                {o.tf(
                  o_undo_buttons,
                  (undo_buttons) =>
                    !undo_buttons &&
                    !is_root && (
                      <button type="button" aria-label="Close">
                        {$on("click", close)}×
                      </button>
                    ),
                )}
                {/* The "Add" button of a composite, at the very end. */}
                {o_header.tf((header) => header?.add ?? null)}
              </e-row>
            ),
        )}
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
    // The column is its chrome element itself, a direct child of the strip's row of columns.
    return o_column.tf((column) => {
      const idx = o_idx.get()
      const is_root = idx === 0
      const el = this.render_chrome(
        column,
        () => this.close_after(o_idx.get() - 1),
        is_root,
        this.watch_column(column, idx, is_root),
      )
      column.host = el
      return el
    })
  }
}

/** Attributes of the `<ObjectEditor>` component; the options are those of `ShellOptions`. */
export interface ObjectEditorAttrs extends ShellOptions, Attrs<HTMLElement> {
  /** The edited value. Edits write back into it, and external writes to it show up in the editor. */
  model: o.Observable<unknown>
}

/**
 * The object editor: `<ObjectEditor model={o_value} schema={...} />`. Renders the strip of columns
 * (see `ObjectEditorShell`, which does the work and is not needed to use the editor). `class` and
 * `style` apply to the strip.
 */
export function ObjectEditor(attrs: ObjectEditorAttrs): HTMLElement {
  const { model, ...options } = attrs
  return new ObjectEditorShell(model, options).node
}
