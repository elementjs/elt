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

import { $connected, $observe, $on, type Attrs, css, type Decorator, o, Repeat, type Renderable } from "elt"
import { popup } from "elt/ui/popup"
import { theme } from "elt/ui"
import { $keymap } from "elt/ui/keymap"
import { default_settings, type EditorSettings, resolve_settings } from "./composite-toolbar"
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
import { RootUndoRing } from "./undo"

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
  host?: HTMLElement
  /** Close a popup presentation for this stack entry, if open. */
  dismiss_popup?: () => void
}

/**
 * The editor-wide settings: every one is the default for the nodes of the schema, which replace it
 * for themselves with the option of the same name (`CommonNodeOptions`). Unlike the others, `packed`
 * also carries on to what a node opens.
 */
export interface ShellOptions extends Partial<EditorSettings> {
  schema?: Factory<unknown>
  prefer_popups?: boolean
  /** The size of the history, or `false` for none: no Undo/Redo buttons, no shortcut. */
  undo?: { depth?: number; import_undo_depth?: number } | false
  /** The Undo/Redo buttons of the root's header line; the shortcut stays. Default true. */
  show_undo_redo?: boolean
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

    // The strip of columns: separate components, spaced at the component step (the default), each
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

  /** What a column's node resolves to: its own options over the settings the column starts from. */
  private settings_of(column: ColumnDescriptor): EditorSettings {
    return resolve_settings(column.o_factory.get().options as CommonNodeOptions | undefined, column.inherited)
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
    return { o_value, title, declared: factory, o_factory, presentation, inherited, on_delete }
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
    const inherited = { ...this.defaults, packed: opener ? this.settings_of(opener).packed : this.defaults.packed }
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
    const fut = popup(anchor, (fut) => {
      column.dismiss_popup = () => fut.resolve(undefined)

      // Unpacked, the popup is a floating panel of plain rows: it keeps a frame, and pads its content itself.
      const packed = this.settings_of(column).packed
      const panel = (
        <e-column
          align="stretch"
          surface="background"
          border
          pad={packed ? undefined : "component"}
          class={cls_popup_panel}
        >
          {$connected((el: HTMLElement) => {
            column.host = (el.closest("[popover]") as HTMLElement | null) ?? el
          })}
          {this.render_chrome(column, () => fut.resolve(undefined), false, this.watch_column(column, idx, false))}
        </e-column>
      ) as HTMLElement

      return panel
    })

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
   * (`address · Object {3}`), the composite's actions (warning, `…` menu), then Undo/Redo on the
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
    const options = (current.options ?? {}) as CommonNodeOptions
    if (!resolve_settings(options, column.inherited).show_menu) return []
    return menu_sections([
      type_change_item(
        "Value",
        column.o_value,
        current,
        slot_type_targets(column.declared, current.type_change_extra()),
      ),
      {
        title: "Import / export",
        items: (header?.import_export ?? []).map((addon) => ({ label: addon.label, run: () => {}, disabled: true })),
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
    const settings = this.settings_of(column)
    const { packed } = settings
    // The widget gets the column's starting settings: it resolves its own node options over them.
    const o_widget = column.o_factory.tf((factory) => factory.render(column.o_value, column.inherited))
    const o_header = o_widget.tf((widget) => widget.header ?? null)
    const menu = () => this.header_menu(column, o_header.get(), close)
    // The `…` button shows when the menu has something; re-checked when the value's kind changes.
    const o_has_menu = o_header.tf(() => menu().length > 0)
    const o_label = o.expression((get) => {
      if (!settings.show_title) return ""
      const header = get(o_header)
      const type_label = header ? get(header.o_label) : null
      return [column.title, type_label].filter((part) => part != null && part !== "").join(" · ")
    })
    const has_undo_buttons = is_root && this.options.undo !== false && this.options.show_undo_redo !== false
    // The root's header line goes away when nothing is left on it. Any other column keeps it for its ×.
    const o_has_header = o.expression(
      (get) => !is_root || has_undo_buttons || get(o_label) !== "" || get(o_has_menu) || get(o_header)?.actions != null,
    )
    // Packed: `packed border` -- the column draws its frame; header line, toolbar and rows touch,
    // separated by seams (the header line and toolbar, `packed border` themselves, keep only their
    // inner seams). `spacing="widget"`: a packed container's step is the step of what it packs
    // (docs/md/ui-layout.md#packed), here widget-padded groups. It adds no gap (packed), but gives the
    // frame the widget radius its first/last children's outer corners take, and the widget step to
    // whatever inherits it inside. Unpacked, all of it is plain rows and columns, spaced by the
    // ambient step and with no frame.
    return (
      <e-column
        packed={packed}
        border={packed}
        pad={packed ? "none" : undefined}
        spacing={packed ? "widget" : undefined}
        align="stretch"
      >
        {watch}
        {o_has_header.tf(
          (has_header) =>
            has_header && (
              // Packed: widgets touching, each padded at the widget step, separated by seams.
              <e-row
                packed={packed ? "widget" : undefined}
                seamless={packed}
                border={packed}
                align={packed ? "center" : "baseline"}
                class={packed ? theme.colors.tint.class_as_inverted : undefined}
              >
                {$editor_menu_when(settings.show_menu, menu)}
                <strong e-ellipsis title={o_label}>
                  {o_label}
                </strong>
                {o_header.tf((header) => header?.actions ?? null)}
                {o_has_menu.tf(
                  (has) =>
                    has && (
                      <button type="button" aria-label="More actions" aria-haspopup="menu">
                        {$on("click", (ev) => open_menu_from_button(ev.currentTarget as HTMLElement, menu))}…
                      </button>
                    ),
                )}
                {has_undo_buttons ? (
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
                  !is_root && (
                    <button type="button" aria-label="Close">
                      {$on("click", close)}×
                    </button>
                  )
                )}
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
    // The column is its chrome element itself, a direct child of the strip.
    return o_column.tf((column) => {
      const idx = o_idx.get()
      const is_root = idx === 0
      const el = this.render_chrome(
        column,
        () => this.close_after(o_idx.get() - 1),
        is_root,
        this.watch_column(column, idx, is_root),
      )
      el.classList.add(cls_column)
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
