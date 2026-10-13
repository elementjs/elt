/*
Composite chrome (Layer 2), shared by Object / Array / Set / Map / Table widgets: the type label,
warning and import/export add-ons the shell puts on the column's single header line and in its menu,
and the toolbar holding the add button and the row filter. The header menu itself (type change,
import/export, Delete) is the shell's: it knows the column's slot and parent.
*/

import { $bind, $click, o, type Renderable } from "elt"
import type { CommonNodeOptions, Factory, WidgetHeader } from "./schema"

/** Per-mount row filter state — lives in the composite render() closure. */
export interface FilterState {
  o_query: o.Observable<string>
  o_case_sensitive: o.Observable<boolean>
}

export function create_filter_state(): FilterState {
  return { o_query: o(""), o_case_sensitive: o(false) }
}

/** Match a row against the search field (keys + value previews, Layer 2). */
export function row_matches_search(query: string, case_sensitive: boolean, parts: string[]): boolean {
  const trimmed = query.trim()
  if (!trimmed) return true
  const norm = (s: string) => (case_sensitive ? s : s.toLowerCase())
  const q = norm(trimmed)
  return parts.some((part) => norm(part).includes(q))
}

/** Shallow preview text for search / display (not the drill-in preview button). */
export function value_preview_text(value: unknown): string {
  if (value === null) return "null"
  if (value === undefined) return "undefined"
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]"
    const head = value
      .slice(0, 2)
      .map((v) => value_preview_text(v))
      .join(", ")
    return value.length > 2 ? `[${head}, …]` : `[${head}]`
  }
  if (value instanceof Map) return `Map {${value.size}}`
  if (value instanceof Set) return `Set {${value.size}}`
  if (typeof value === "object") {
    const entries = Object.entries(value as object)
    if (entries.length === 0) return "{}"
    const head = entries
      .slice(0, 2)
      .map(([k, v]) => `${k}: ${value_preview_text(v)}`)
      .join(", ")
    return entries.length > 2 ? `{${head}, …}` : `{${head}}`
  }
  return String(value)
}

function cardinality_hint(value: unknown): string | null {
  if (Array.isArray(value)) return `[${value.length}]`
  if (value instanceof Map || value instanceof Set) return `{${value.size}}`
  if (typeof value === "object" && value !== null && !(value instanceof Date)) {
    return `{${Object.keys(value).length}}`
  }
  return null
}

function default_type_name(value: unknown, kind: string): string {
  if (value === null) return "null"
  if (Array.isArray(value)) return "Array"
  if (value instanceof Map) return "Map"
  if (value instanceof Set) return "Set"
  if (kind === "object" && typeof value === "object" && value !== null) {
    const ctor = (value as object).constructor?.name
    return ctor && ctor !== "Object" ? ctor : "Object"
  }
  return kind.charAt(0).toUpperCase() + kind.slice(1)
}

/**
 * The presentation settings of a composite, resolved. `packed` draws the column frame, the header line,
 * the toolbar and the rows as one touching group with seams; unpacked, they are plain
 * rows. The `show_*` flags choose which parts of the chrome appear.
 */
export interface EditorSettings {
  packed: boolean
  /** The label on the header line (the key it was opened from and the type). */
  show_title: boolean
  /** The row filter of the toolbar. */
  show_filter: boolean
  /** The "+ Add …" button of the toolbar. */
  show_add: boolean
  /** The `…` button and menus: change type, import/export, delete. */
  show_menu: boolean
}

/** The editor-wide defaults, before any attribute or node option. */
export const default_settings: EditorSettings = {
  packed: false,
  show_title: true,
  show_filter: true,
  show_add: true,
  show_menu: true,
}

/**
 * A composite's own settings: its node options (`CommonNodeOptions`) over `defaults` -- the editor
 * attributes, with `packed` inherited from the value it was opened from.
 */
export function resolve_settings(options: CommonNodeOptions | undefined, defaults: EditorSettings): EditorSettings {
  return {
    packed: options?.packed ?? defaults.packed,
    show_title: options?.show_title ?? defaults.show_title,
    show_filter: options?.show_filter ?? defaults.show_filter,
    show_add: options?.show_add ?? defaults.show_add,
    show_menu: options?.show_menu ?? defaults.show_menu,
  }
}

export interface CompositeToolbarProps {
  factory: Factory<CommonNodeOptions>
  o_value: o.Observable<unknown>
  filter: FilterState
  /** Factory kind tag for titling when value is ambiguous. */
  kind: string
  /** Import/export add-ons registered for this editor instance (v1: usually empty). */
  import_export_addons?: { id: string; label: string }[]
  /** Header-line warning (Table's "extra keys"). */
  warning?: Renderable
  /** The toolbar's add button ("+ Add key", …), when the composite allows adding. */
  add?: { label: string; on_add: () => void } | null
  /** The settings in force where this composite is shown (editor attributes, inherited `packed`). */
  settings: EditorSettings
}

/**
 * A composite's chrome (Layer 2): its part of the header line (type label, warning, import/export
 * add-ons for the header menu), hoisted into the column's single header line by the shell, and its
 * toolbar (add button, filter). The toolbar is `null` when it would be empty.
 */
export function render_composite_chrome(props: CompositeToolbarProps): {
  header: WidgetHeader
  toolbar: Renderable | null
} {
  const { factory, o_value, filter, kind, import_export_addons = [] } = props
  const settings = resolve_settings(factory.options, props.settings)
  const o_label = o_value.tf((value) => {
    const label = factory.options.chrome_label
    if (label === false) return null
    if (typeof label === "string") return label
    const hint = cardinality_hint(value)
    const name = default_type_name(value, kind)
    return hint ? `${name} ${hint}` : name
  })

  const add = settings.show_add ? props.add : null
  // Packed: a band of touching widgets in the column's frame. Unpacked: a plain row of spaced widgets.
  const toolbar =
    settings.show_filter || add ? (
      <e-row
        surface={settings.packed ? "neutral-1" : undefined}
        packed={settings.packed ? "widget" : undefined}
        align={settings.packed ? "stretch" : "baseline"}
      >
        {add && (
          <button type="button">
            {$click(add.on_add)}+ {add.label}
          </button>
        )}
        {settings.show_filter && (
          <>
            <input type="search" e-ellipsis placeholder="Filter rows…">
              {$bind.string(filter.o_query)}
            </input>
            <label e-widget="toggle" title="Match case">
              <input type="checkbox">{$bind.boolean(filter.o_case_sensitive)}</input>
              Aa
            </label>
          </>
        )}
      </e-row>
    ) : null

  return {
    header: {
      o_label,
      actions: props.warning ?? null,
      import_export: factory.options.show_import_export === false ? [] : import_export_addons,
    },
    toolbar,
  }
}
