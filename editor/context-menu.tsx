/*
The editor's menus: a row's context menu (right click, long press, Ctrl+click, the keyboard's Menu key
or Shift+F10) and a column's header menu (the same, or its `…` button). Both are lists of sections —
a small header, then items — drawn as one packed, seamless column with `<hr>` between sections. The
destructive item (Delete) is red, with the trash icon.
*/

import { $click, $context_menu, $on, css, type Decorator, type o, type Renderable } from "elt"
import { theme } from "elt/ui/theme"
import { Trash } from "elt/ui/icons"
import { menu_nav } from "elt/ui/list-nav"
import { type PopupAnchor, popup } from "elt/ui/popup"
import { sym_closed } from "elt/ui/utils"
import type { CommonNodeOptions, Factory } from "./schema"
import { apply_type_change, type_change_actions } from "./type-change"

/** An item that runs something, then closes the menu. */
export interface MenuAction {
  label: string
  run: () => void
  /** Destructive (Delete): drawn red, with the trash icon. */
  danger?: boolean
  /** Shown but not available (an add-on slot not wired yet). */
  disabled?: boolean
}

/** An item opening a second menu next to it ("Change type…"). */
export interface MenuSubmenu {
  label: string
  sections: () => MenuSection[]
}

export type MenuItem = MenuAction | MenuSubmenu

export interface MenuSection {
  /** The section's small header; none for the Delete section. */
  title?: string
  items: MenuItem[]
}

/** The sections that have items, so an empty one never draws a header or a separator. */
function non_empty(sections: (MenuSection | null)[]): MenuSection[] {
  return sections.filter((s): s is MenuSection => s != null && s.items.length > 0)
}

/**
 * Open a menu at `anchor`. `close_parent` closes the menu this one was opened from, so running an
 * item of a submenu closes the whole chain.
 */
export function open_menu(anchor: PopupAnchor, sections: MenuSection[], close_parent?: () => void) {
  let close = () => {}
  const fut = popup(
    anchor,
    (fut) => {
      close = () => {
        fut.resolve(sym_closed)
        close_parent?.()
      }
      return render_menu(sections, () => close())
    },
    // A submenu opens beside its item, like native ones.
    anchor instanceof Element ? { placement: "right-start", arrow: false } : undefined,
  )
  return fut
}

function render_menu(sections: MenuSection[], close: () => void): HTMLElement {
  const menu = (
    <e-column surface="background" border seamless packed="widget" align="stretch" role="menu">
      {sections.map((section, i) => (
        <>
          {i > 0 && <hr />}
          {section.title && <h3 class={cls_menu_header}>{section.title}</h3>}
          {section.items.map((item) => render_item(item, close))}
        </>
      ))}
    </e-column>
  ) as HTMLElement
  menu_nav(menu)
  return menu
}

function render_item(item: MenuItem, close: () => void): Renderable {
  if ("sections" in item) {
    return (
      <button type="button" role="menuitem" aria-haspopup="menu" class={cls_menu_item}>
        {$click((ev) => {
          const sub = non_empty(item.sections())
          if (sub.length > 0) open_menu(ev.currentTarget, sub, close)
        })}
        {/* ArrowRight opens the submenu, as in native menus. */}
        {$on("keydown", (ev) => {
          if (ev.key === "ArrowRight") (ev.currentTarget as HTMLElement).click()
        })}
        {item.label}
      </button>
    )
  }
  return (
    <button
      type="button"
      role="menuitem"
      disabled={item.disabled}
      class={[cls_menu_item, item.danger && [theme.colors.red.class_as_tint, cls_menu_danger]]}
    >
      {$click(() => {
        close()
        item.run()
      })}
      {item.danger && Trash()}
      {item.label}
    </button>
  )
}

/**
 * The "Change type…" item for a value: a submenu listing the types its slot accepts (`targets`),
 * or `null` when there are none. `current` is the factory rendering the value now.
 */
export function type_change_item(
  title: string,
  o_value: o.Observable<unknown>,
  current: Factory<unknown>,
  targets: Factory<unknown>[],
): MenuSection | null {
  const options = (current.options ?? {}) as CommonNodeOptions
  if (options.toolbar?.type_change === false) return null
  const actions = type_change_actions(current, o_value.get(), options, targets)
  if (actions.length === 0) return null
  return {
    title,
    items: [
      {
        label: "Change type…",
        sections: () => [
          {
            title: `${title} type`,
            items: actions.map((action) => ({
              label: action.label,
              run: () => apply_type_change(o_value, current, action),
            })),
          },
        ],
      },
    ],
  }
}

/** The Delete section: one red item, no header. */
export function delete_section(run: (() => void) | null | undefined): MenuSection | null {
  return run ? { items: [{ label: "Delete", run, danger: true }] } : null
}

/** The text field (`input`, `textarea`) the event came from, if any. */
function text_field_of(target: EventTarget | null): HTMLInputElement | HTMLTextAreaElement | null {
  const field = target instanceof Element ? target.closest("input, textarea") : null
  if (field instanceof HTMLTextAreaElement) return field
  // Checkboxes, radios, buttons, colors… hold no text to edit.
  if (field instanceof HTMLInputElement && !NON_TEXT_INPUTS.has(field.type)) return field
  return null
}
const NON_TEXT_INPUTS = new Set(["checkbox", "radio", "button", "submit", "reset", "color", "file", "range", "image"])

/**
 * The Edit section of a menu opened from a text field, standing in for the browser's own menu it
 * replaces: Cut, Copy, Paste, Select all. Fields without a text selection API (`number`, `email`)
 * act on their whole value. Edits go through `setRangeText` and an `input` event, so bindings see them.
 */
function edit_section(field: HTMLInputElement | HTMLTextAreaElement): MenuSection {
  // Read now: the menu takes focus, but the field keeps its selection.
  let start: number | null = null
  let end: number | null = null
  try {
    start = field.selectionStart
    end = field.selectionEnd
  } catch {
    // number, email: no selection API
  }
  const whole = start == null || end == null
  const from = whole ? 0 : (start as number)
  const to = whole ? field.value.length : (end as number)
  const selected = field.value.slice(from, to)
  const writable = !field.readOnly && !field.disabled

  const replace = (text: string) => {
    if (whole) field.value = text
    else field.setRangeText(text, from, to, "end")
    field.dispatchEvent(new Event("input", { bubbles: true }))
    field.focus()
  }

  return {
    title: "Edit",
    items: [
      {
        label: "Cut",
        disabled: !writable || selected === "",
        run: () => navigator.clipboard.writeText(selected).then(() => replace("")),
      },
      { label: "Copy", disabled: selected === "", run: () => navigator.clipboard.writeText(selected) },
      // Reading the clipboard may ask the user first, or be refused: nothing happens then.
      { label: "Paste", disabled: !writable, run: () => navigator.clipboard.readText().then(replace, () => {}) },
      {
        label: "Select all",
        run: () => {
          field.focus()
          field.select()
        },
      },
    ],
  }
}

/**
 * The context menu of `node` (a row, a header line). `sections` is computed when the menu is asked
 * for, from the element the event came from (a Table row's menu depends on the cell); when it has
 * nothing, the browser's own menu shows instead of an empty one. Nested menus: the innermost wins.
 *
 * In a text field, the menu replaces the browser's too — Map rows and Table cells are nothing but
 * fields — and starts with an Edit section (Cut, Copy, Paste, Select all). The keyboard (Menu key,
 * Shift+F10) opens it as well, under the focused element.
 */
export function $editor_menu(sections: (target: Element | null) => (MenuSection | null)[]): Decorator<HTMLElement> {
  const all_sections = (target: EventTarget | null) => {
    const field = text_field_of(target)
    return non_empty([field && edit_section(field), ...sections(target as Element | null)])
  }
  return (node: HTMLElement) => {
    $context_menu(
      (ev: MouseEvent) => {
        if (ev.defaultPrevented) return
        const list = all_sections(ev.target)
        if (list.length === 0) return
        ev.preventDefault()
        const at = ev.clientX === 0 && ev.clientY === 0 ? point_below(ev.target) : { x: ev.clientX, y: ev.clientY }
        open_menu({ ...at, element: node }, list)
        // On iOS, a long press in a text field opens this menu too: Map rows and Table cells have nothing else.
      },
      { text_fields: true },
    )(node)
    $on("keydown", (ev: KeyboardEvent) => {
      if (ev.defaultPrevented || (ev.key !== "ContextMenu" && !(ev.shiftKey && ev.key === "F10"))) return
      const list = all_sections(ev.target)
      if (list.length === 0) return
      // Prevented here, the browser fires no contextmenu event of its own.
      ev.preventDefault()
      open_menu({ ...point_below(ev.target), element: node }, list)
    })(node)
  }
}

/** Under the bottom-left corner of `target`: where a menu opened without a pointer goes. */
function point_below(target: EventTarget | null) {
  const rect = (target instanceof Element ? target : document.body).getBoundingClientRect()
  return { x: rect.left, y: rect.bottom }
}

/** Open `sections` from a button (the header's `…`): below it, from the keyboard as from the mouse. */
export function open_menu_from_button(button: HTMLElement, sections: () => (MenuSection | null)[]) {
  const list = non_empty(sections())
  if (list.length > 0) open_menu({ ...point_below(button), element: button }, list)
}

export { non_empty as menu_sections }

/* A section's header: small, quiet, not a menu item (menu_nav skips it). */
const cls_menu_header = css`.oe-menu-header {
  margin: 0;
  font-size: ${theme.settings.formFontSize};
  font-weight: 600;
  color: ${theme.colors.text.faded};
  user-select: none;
}`

/* Items start-aligned (a button centers its text), the icon and the label spaced. */
const cls_menu_item = css`.oe-menu-item {
  justify-content: flex-start;
  text-align: start;
  gap: ${theme.settings.spacingNudge4};
}`

/* Delete: red text, and (red as the tint) a red hover. */
const cls_menu_danger = css`.oe-menu-danger {
  color: ${theme.colors.red};
}`
