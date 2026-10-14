/*
How the editor draws each value type: a color from the theme, an icon, a name. This table is the one
place to change them: the Change type menu (icon and label), a column's frame, header and toolbar, the
drill-in buttons of nested values and the widgets of null, undefined, booleans, numbers and dates all read it.

A type with no color (strings and what holds strings: colors, selects; and the values no widget shows)
keeps the theme's own tint. A class instance (any object that isn't a plain one) is the `class` type.
*/

import { css, type Renderable } from "elt"
import { Calendar } from "elt/ui/icons"
import { type Mix, theme } from "elt/ui/theme"
import {
  ArrowsLeftRight,
  BracketsCurly,
  BracketsSquare,
  CaretUpDown,
  Cube,
  Hash,
  Palette,
  Prohibit,
  Question,
  Quotes,
  Selection,
  ToggleLeft,
} from "./icons"

export interface TypeStyle {
  /** The type's name; a CSS class name part. */
  name: string
  /** The theme color the type is drawn in; `null`: the theme's own tint. */
  color: Mix | null
  icon: () => Renderable
}

const colors = theme.colors

/** Every type of the editor, by its factory `kind` (and `class`, which no factory has: see `type_style_of_value`). */
const TYPE_STYLES: Record<string, TypeStyle> = Object.fromEntries(
  (
    [
      ["null", colors.magenta, Prohibit],
      ["undefined", colors.magenta, Question],
      ["boolean", colors.magenta, ToggleLeft],
      ["number", colors.purple, Hash],
      ["object", colors.cyan, BracketsCurly],
      ["map", colors.cyan_green, ArrowsLeftRight],
      ["array", colors.green, BracketsSquare],
      ["set", colors.yellow_green, Selection],
      ["class", colors.orange, Cube],
      ["date", colors.orange, Calendar],
      ["string", null, Quotes],
      ["color", null, Palette],
      ["select", null, CaretUpDown],
      ["unrepresentable", null, Question],
    ] as [string, Mix | null, () => Renderable][]
  ).map(([name, color, icon]) => [name, { name, color, icon }]),
)

/** The style of a factory `kind` (a type of the Change type menu, the widget of a leaf); neutral for a kind the table lacks. */
export function type_style_of_kind(kind: string): TypeStyle {
  return TYPE_STYLES[kind] ?? TYPE_STYLES.unrepresentable
}

/** The style of the type of `value`: its constructor decides, so a `Foo` is a class and a plain object an object. */
export function type_style_of_value(value: unknown): TypeStyle {
  if (value === null) return TYPE_STYLES.null
  if (value instanceof Date) return TYPE_STYLES.date
  if (Array.isArray(value)) return TYPE_STYLES.array
  if (value instanceof Set) return TYPE_STYLES.set
  if (value instanceof Map) return TYPE_STYLES.map
  if (typeof value === "object") {
    const proto = Object.getPrototypeOf(value)
    return proto === Object.prototype || proto === null ? TYPE_STYLES.object : TYPE_STYLES.class
  }
  return type_style_of_kind(typeof value === "undefined" ? "undefined" : typeof value)
}

/** Makes the type's color the tint of the element and its descendants; nothing for an uncolored type. */
export function tint_class(style: TypeStyle): string | undefined {
  return style.color?.class_as_tint
}

/** The text of an element drawn in the (tint's) ink color: the type's color mixed into the text color. */
const cls_ink = css`.oe-ink {
  color: ${theme.colors.tint.ink};
}`

/**
 * What draws an element in its type's color: the type's tint (the element is tinted, its focus ring, its
 * checked fill) and its text at `tint.ink`. The classes of a leaf widget or a drill-in button; an uncolored
 * type adds nothing.
 */
export function ink_classes(style: TypeStyle): (string | undefined)[] {
  return style.color ? [tint_class(style), cls_ink] : []
}
