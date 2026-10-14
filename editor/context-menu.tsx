/*
The editor's menus: a row's context menu (right click, long press, Ctrl+click, the keyboard's Menu key
or Shift+F10) and a column's header menu (the same, or its `…` button). Both are lists of sections —
a small header, then items — drawn as one packed grid without lines (`seams="none"`) with `<hr>` between sections.
Its three columns are an icon, the text and what follows it (a submenu's caret); an empty column has no width, so
a menu without icons starts its text at the left edge. The destructive item (Delete) is red, with the trash icon.
*/

import { $click, $context_menu, $on, css, type Decorator, o, type Renderable } from "elt"
import { theme } from "elt/ui/theme"
import { ArrowsClockwise, CaretRight, ClipboardText, Copy, Scissors, SelectionAll, Trash } from "elt/ui/icons"
import { menu_nav } from "elt/ui/list-nav"
import { type PopupAnchor, popup } from "elt/ui/popup"
import type { CommonNodeOptions, Factory } from "./schema"
import { apply_type_change, type_change_actions } from "./type-change"
import { tint_class, type_style_of_kind } from "./type-style"

/** What every item has: its label, and an icon for the slot left of it (the others' text lines up with it). */
interface MenuItemBase {
  label: string
  icon?: () => Renderable
  /** A class making a color the item's tint (`tint_class` of a type): the icon takes it, the text a duller mix with the text color. */
  tint?: string
}

/** An item that runs something, then closes the menu. */
export interface MenuAction extends MenuItemBase {
  run: () => void
  /** Destructive (Delete): drawn red. */
  danger?: boolean
  /** Shown but not available (an add-on slot not wired yet). */
  disabled?: boolean
}

/** An item opening a second menu next to it ("Change type…"). */
export interface MenuSubmenu extends MenuItemBase {
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
        fut.resolve(undefined)
        close_parent?.()
      }
      return render_menu(sections, () => close())
    },
    // With an arrow, as every popup. A submenu opens exactly beside its item, like native ones: above or
    // below it, it would cover the menu it came from.
    { arrow: true, ...(anchor instanceof Element && { placement: "right-start", exact_placement: true }) },
  )
  return fut
}

function render_menu(sections: MenuSection[], close: () => void): HTMLElement {
  // A grid of three columns shared by every item (a subgrid each): the icon, the text, what comes
  // after it (the submenu's caret). A column no item fills has no width, so a menu without icons
  // starts its text at the left edge, and one with icons lines all its text up on the same column.
  const menu = (
    <e-grid surface="background" border seams="none" packed="widget" align="stretch" role="menu" class={cls_menu}>
      {sections.map((section, i) => (
        <>
          {i > 0 && <hr />}
          {section.title && (
            <span e-widget="label" class={cls_menu_wide}>
              {section.title}
            </span>
          )}
          {section.items.map((item) => render_item(item, close))}
        </>
      ))}
    </e-grid>
  ) as HTMLElement
  menu_nav(menu)
  return menu
}

function render_item(item: MenuItem, close: () => void): Renderable {
  const icon = item.icon?.()
  if ("sections" in item) {
    return (
      <button
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        e-emphasis="bare"
        class={[cls_menu_item, item.tint && [item.tint, cls_menu_typed]]}
      >
        {$click((ev) => {
          const sub = non_empty(item.sections())
          if (sub.length > 0) open_menu(ev.currentTarget, sub, close)
        })}
        {/* ArrowRight opens the submenu, as in native menus. */}
        {$on("keydown", (ev) => {
          if (ev.key === "ArrowRight") (ev.currentTarget as HTMLElement).click()
        })}
        {icon && <span class={[cls_menu_icon, item.tint && cls_menu_icon_typed]}>{icon}</span>}
        <span class={cls_menu_text}>{item.label}</span>
        <span class={cls_menu_after}>{CaretRight()}</span>
      </button>
    )
  }
  return (
    <button
      type="button"
      role="menuitem"
      disabled={item.disabled}
      e-emphasis="bare"
      class={[
        cls_menu_item,
        item.tint && [item.tint, cls_menu_typed],
        item.danger && [theme.colors.red.class_as_tint, cls_menu_danger],
      ]}
    >
      {$click(() => {
        close()
        item.run()
      })}
      {icon && <span class={[cls_menu_icon, item.tint && cls_menu_icon_typed]}>{icon}</span>}
      <span class={cls_menu_text}>{item.label}</span>
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
  if (options.show_menu === false) return null
  const actions = type_change_actions(current, o_value.get(), options, targets)
  if (actions.length === 0) return null
  return {
    title,
    items: [
      {
        label: "Change type…",
        icon: ArrowsClockwise,
        sections: () => [
          {
            title: `${title} type`,
            items: actions.map((action) => {
              const style = type_style_of_kind(action.target.kind)
              return {
                label: action.label,
                icon: style.icon,
                tint: tint_class(style),
                run: () => apply_type_change(o_value, current, action),
              }
            }),
          },
        ],
      },
    ],
  }
}

/** The Delete section: one red item, no header. */
export function delete_section(run: (() => void) | null | undefined): MenuSection | null {
  return run ? { items: [{ label: "Delete", run, danger: true, icon: Trash }] } : null
}

/** The text field (`input`, `textarea`) the event came from, if any. */
export function text_field_of(target: EventTarget | null): HTMLInputElement | HTMLTextAreaElement | null {
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
    //title: "Edit",
    items: [
      {
        label: "Cut",
        icon: Scissors,
        disabled: !writable || selected === "",
        run: () => navigator.clipboard.writeText(selected).then(() => replace("")),
      },
      { label: "Copy", icon: Copy, disabled: selected === "", run: () => navigator.clipboard.writeText(selected) },
      // Reading the clipboard may ask the user first, or be refused: nothing happens then.
      {
        label: "Paste",
        icon: ClipboardText,
        disabled: !writable,
        run: () => navigator.clipboard.readText().then(replace, () => {}),
      },
      {
        label: "Select all",
        icon: SelectionAll,
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
export function $editor_menu(
  sections: (target: Element | null) => (MenuSection | null)[],
  enabled: o.RO<boolean> = true,
): Decorator<HTMLElement> {
  const all_sections = (target: EventTarget | null) => {
    // Read when the menu is asked for, which is when its value matters: nothing to subscribe to.
    if (!o.get(enabled)) return []
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

/** `$editor_menu(sections)`, or nothing (the browser's own menu shows) when the node hides its menus. */
export function $editor_menu_when(enabled: o.RO<boolean>, sections: Parameters<typeof $editor_menu>[0]) {
  return enabled === false ? null : $editor_menu(sections, enabled)
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

/* The menu's three columns. `grid-template-*` of a grid that is not equal columns is the documented
   case for a rule of one's own (docs/md/ui-layout.md#grids); a minimum width keeps a menu of short
   labels from looking like a tooltip, and a long label still widens it. In ch, the width of a digit in
   the menu's own font. */
const cls_menu = css`.oe-menu {
  grid-template-columns: auto 1fr auto;
  min-width: 20ch;
  /* The items are cells placed straight in the packed grid, which leaves them square (rows get the
     grid's radius, cells don't): the first and last take the menu's own radius back. */
  & > :first-child {
    border-top-left-radius: inherit;
    border-top-right-radius: inherit;
  }
  & > :last-child {
    border-bottom-left-radius: inherit;
    border-bottom-right-radius: inherit;
  }
}`

/* Checked what elt/ui offers: `e-grid-row` is a subgrid too, but not a button (no native disabled and
   keys), so an item is a button that lays its three slots on the menu's columns itself. The slots'
   own padding, not a gap: a gap would stay on the empty first column. */
const cls_menu_item = css`.oe-menu-item {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: subgrid;
  align-items: center;
  text-align: start;
}`
/* A section's header spans the whole menu. */
const cls_menu_wide = css`.oe-menu-wide {
  grid-column: 1 / -1;
}`
const cls_menu_icon = css`.oe-menu-icon {
  grid-column: 1;
  padding-inline-end: 0.5em;
}`
const cls_menu_text = css`.oe-menu-text {
  grid-column: 2;
}`
const cls_menu_after = css`.oe-menu-after {
  grid-column: 3;
  padding-inline-start: 1em;
}`

/* An item of a colored type (Change type): the icon in the color, the text in the color mixed into the text color. */
const cls_menu_typed = css`.oe-menu-typed {
  color: ${theme.colors.tint.ink};
}`
const cls_menu_icon_typed = css`.oe-menu-icon-typed {
  color: ${theme.colors.tint};
}`

/* Delete: red text, and (red as the tint) a red hover. */
const cls_menu_danger = css`.oe-menu-danger {
  color: ${theme.colors.red};
}`
