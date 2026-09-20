/*
Composite title row + toolbar (Layer 2). Shared by Object / Array / Set / Map widgets.
Search filters rows; the … menu hosts type-change actions and import/export add-on slots.
*/

import { $bind, $click, css, o, type Renderable } from "elt"
import { popup } from "elt/ui/popup"
import { theme } from "elt/ui"
import type { CommonNodeOptions, CompositeToolbarOptions, Factory } from "./schema"
import { apply_type_change, type_change_actions } from "./type-change"

/** Per-mount toolbar filter state — lives in the composite render() closure. */
export interface CompositeToolbarState {
  o_query: o.Observable<string>
  o_case_sensitive: o.Observable<boolean>
}

export function create_toolbar_state(): CompositeToolbarState {
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
    const head = value.slice(0, 2).map((v) => value_preview_text(v)).join(", ")
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
  toolbar: CompositeToolbarState
  /** Factory kind tag for titling when value is ambiguous. */
  kind: string
  /** Extra type-change targets (map/set branches, either alternatives, …). */
  type_change_extra?: Factory<unknown>[]
  /** Import/export add-ons registered for this editor instance (v1: usually empty). */
  import_export_addons?: { id: string; label: string }[]
}

/** Composite title + toolbar; hoisted into the column header by the shell (`RenderableWidget.header`). */
export function render_composite_toolbar(props: CompositeToolbarProps): Renderable {
  const { factory, o_value, toolbar, kind, type_change_extra = [], import_export_addons = [] } = props
  const flags = toolbar_flags(factory.options.toolbar)
  const oo_title = o_value.tf((value) => {
    const label = factory.options.chrome_label
    if (label === false) return null
    if (typeof label === "string") return label
    const hint = cardinality_hint(value)
    const name = default_type_name(value, kind)
    return hint ? `${name} ${hint}` : name
  })

  const has_menu_content =
    flags.show_menu &&
    ((flags.show_type_change && type_change_actions(factory, o_value.get(), factory.options, type_change_extra).length > 0) ||
      (flags.show_import_export && import_export_addons.length > 0))

  return (
    <e-flex column class={cls_toolbar_wrap} gap="widget">
      {oo_title.tf((title) => (title != null ? <span class={cls_title}>{title}</span> : null))}
      {(flags.show_search || has_menu_content) && (
        <e-flex align="center" gap="widget" class={cls_toolbar_row}>
          {flags.show_search && (
            <>
              <input type="search" class={cls_search} placeholder="Filter rows…">
                {$bind.string(toolbar.o_query)}
              </input>
              <label class={cls_case_toggle}>
                <input type="checkbox">{$bind.boolean(toolbar.o_case_sensitive)}</input>
                Aa
              </label>
            </>
          )}
          {has_menu_content && (
            <button type="button" class={cls_menu_btn} aria-label="More actions">
              {$click(async (ev) => {
                const value = o_value.get()
                await popup(ev.currentTarget, (fut) => (
                  <menu>
                    {flags.show_type_change && (
                      <>
                        <h3>Type</h3>
                        {type_change_actions(factory, value, factory.options, type_change_extra).map((action) => (
                          <button type="button">
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
                          <button type="button" disabled title="Add-on slot — not wired in this demo">
                            {addon.label}
                          </button>
                        ))}
                      </>
                    )}
                  </menu>
                ))
              })}
              …
            </button>
          )}
        </e-flex>
      )}
    </e-flex>
  )
}

/** Compact … menu for inline type changes (e.g. Map key cells). */
export function render_type_change_menu_button(
  o_value: o.Observable<unknown>,
  factory: Factory<CommonNodeOptions>,
  type_change_extra: Factory<unknown>[] = [],
): Renderable {
  return (
    <button type="button" class={cls_menu_btn} aria-label="Change type">
      {$click(async (ev) => {
        const value = o_value.get()
        await popup(ev.currentTarget, (fut) => (
          <menu>
            <h3>Type</h3>
            {type_change_actions(factory, value, factory.options, type_change_extra).map((action) => (
              <button type="button">
                {$click(() => {
                  if (apply_type_change(o_value, factory, action)) fut.resolve(undefined)
                })}
                {action.label}
              </button>
            ))}
          </menu>
        ))
      })}
      …
    </button>
  )
}

const cls_toolbar_wrap = css`.oe-composite-toolbar {
  flex: 1;
}`

const cls_title = css`.oe-composite-title {
  font-weight: bold;
}`

const cls_toolbar_row = css`.oe-composite-toolbar-row {
  flex-wrap: wrap;
}`

const cls_search = css`.oe-composite-search {
  flex: 1 1 8em;
  min-width: 6em;
}`

const cls_case_toggle = css`.oe-composite-case {
  display: inline-flex;
  align-items: center;
  gap: 0.25em;
  font-size: 0.85em;
  color: ${theme.colors.text.mid};
  user-select: none;
}`

const cls_menu_btn = css`.oe-composite-menu {
  border: 1px solid ${theme.colors.text.mid};
  background: none;
  border-radius: ${theme.settings.borderRadius};
  padding: 0.2em 0.55em;
  cursor: pointer;
  line-height: 1.2;
}`
