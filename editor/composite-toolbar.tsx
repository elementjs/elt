/*
Composite chrome (Layer 2), shared by Object / Array / Set / Map / Table widgets: the type label,
warning and `…` menu the shell puts on the column's single header line, and the toolbar holding the
add button and the row filter. The … menu hosts type-change actions and import/export add-on slots.
*/

import { $bind, $click, o, type Renderable } from "elt"
import { popup } from "elt/ui/popup"
import { cls_text_fill } from "./grid"
import type { CommonNodeOptions, CompositeToolbarOptions, Factory, WidgetHeader } from "./schema"
import { apply_type_change, type_change_actions } from "./type-change"

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

function toolbar_flags(toolbar: CompositeToolbarOptions | undefined) {
  return {
    show_search: toolbar?.search !== false,
    show_menu: toolbar?.menu !== false,
    show_type_change: toolbar?.type_change !== false,
    show_import_export: toolbar?.import_export !== false,
  }
}

export interface CompositeToolbarProps {
  factory: Factory<CommonNodeOptions>
  o_value: o.Observable<unknown>
  filter: FilterState
  /** Factory kind tag for titling when value is ambiguous. */
  kind: string
  /** Extra type-change targets (map/set branches, either alternatives, …). */
  type_change_extra?: Factory<unknown>[]
  /** Import/export add-ons registered for this editor instance (v1: usually empty). */
  import_export_addons?: { id: string; label: string }[]
  /** Header-line warning (Table's "extra keys"). */
  warning?: Renderable
  /** The toolbar's add button ("+ Add key", …), when the composite allows adding. */
  add?: { label: string; on_add: () => void } | null
}

/**
 * A composite's chrome (Layer 2): its part of the header line (type label, warning, `…` menu),
 * hoisted into the column's single header line by the shell, and its toolbar (add button, filter).
 * The toolbar is `null` when it would be empty.
 */
export function render_composite_chrome(props: CompositeToolbarProps): {
  header: WidgetHeader
  toolbar: Renderable | null
} {
  const { factory, o_value, filter, kind, type_change_extra = [], import_export_addons = [] } = props
  const flags = toolbar_flags(factory.options.toolbar)
  const o_label = o_value.tf((value) => {
    const label = factory.options.chrome_label
    if (label === false) return null
    if (typeof label === "string") return label
    const hint = cardinality_hint(value)
    const name = default_type_name(value, kind)
    return hint ? `${name} ${hint}` : name
  })

  const has_menu_content =
    flags.show_menu &&
    ((flags.show_type_change &&
      type_change_actions(factory, o_value.get(), factory.options, type_change_extra).length > 0) ||
      (flags.show_import_export && import_export_addons.length > 0))

  const actions = (
    <>
      {props.warning}
      {has_menu_content && (
        <button type="button" aria-label="More actions">
          {$click(async (ev) => {
            const value = o_value.get()
            await popup(ev.currentTarget, (fut) => (
              <e-column pad="component" packed="widget" role="menu" aria-label="More actions">
                {flags.show_type_change && (
                  <>
                    <h3>Type</h3>
                    {type_change_actions(factory, value, factory.options, type_change_extra).map((action) => (
                      <button type="button" role="menuitem">
                        {$click(() => {
                          if (apply_type_change(o_value, factory, action)) fut.resolve(undefined)
                        })}
                        {action.label}
                      </button>
                    ))}
                  </>
                )}
                {flags.show_import_export && import_export_addons.length > 0 && (
                  <>
                    <hr />
                    <h3>Import / export</h3>
                    {import_export_addons.map((addon) => (
                      <button type="button" role="menuitem" disabled title="Add-on slot — not wired in this demo">
                        {addon.label}
                      </button>
                    ))}
                  </>
                )}
              </e-column>
            ))
          })}
          …
        </button>
      )}
    </>
  )

  const toolbar =
    flags.show_search || props.add ? (
      <e-row surface="neutral-1" packed="widget" border align="stretch">
        {props.add && (
          <button type="button">
            {$click(props.add.on_add)}+ {props.add.label}
          </button>
        )}
        {flags.show_search && (
          <>
            <input type="search" class={cls_text_fill} placeholder="Filter rows…">
              {$bind.string(filter.o_query)}
            </input>
            <label e-variant="toggle" title="Match case">
              <input type="checkbox">{$bind.boolean(filter.o_case_sensitive)}</input>
              Aa
            </label>
          </>
        )}
      </e-row>
    ) : null

  return { header: { o_label, actions }, toolbar }
}

/** Compact … menu for inline type changes, as a grid cell of its own (Map keys). */
export function render_type_change_menu_button(
  o_value: o.Observable<unknown>,
  factory: Factory<CommonNodeOptions>,
  type_change_extra: Factory<unknown>[] = [],
): Renderable {
  return (
    <button type="button" aria-label="Change type">
      {$click(async (ev) => {
        const value = o_value.get()
        await popup(ev.currentTarget, (fut) => (
          <e-column pad="component" packed="widget" role="menu" aria-label="Change type">
            <h3>Type</h3>
            {type_change_actions(factory, value, factory.options, type_change_extra).map((action) => (
              <button type="button" role="menuitem">
                {$click(() => {
                  if (apply_type_change(o_value, factory, action)) fut.resolve(undefined)
                })}
                {action.label}
              </button>
            ))}
          </e-column>
        ))
      })}
      …
    </button>
  )
}
