/*
Schema-authoring API: schema nodes ARE widget configs ARE the widget constructor,
collapsed into one `Factory` instance per Layer 4's "Schema vs widget definition"
direction. A `Factory` is plain-ish data (its `options`) plus behavior; the
registry is implicit (class identity), not a `kind: string` switch -- `kind` is
kept as a stable tag for introspection / custom-widget registration / later
JSON-Schema-subset import, not for dispatch.

Recursion goes through `forward()` (like `z.lazy`): `object-editor.tsx` and
`resizable.tsx` are unrelated proofs of concept, not part of this shape.
*/

import { $bind, $observe, $on, $scrollable, css, o, Repeat, VirtualScroll, type attrs_input, type Renderable } from "elt"
import { Select } from "elt/ui/select"
import { theme } from "elt/ui"
import {
  allows_delete,
  allows_insert,
  append_set_member,
  insert_array_at,
  insert_map_entry,
  remove_array_at,
  remove_map_entry,
  remove_set_member,
  resolve_item_default,
  table_column_keys,
  table_has_extra_keys,
} from "./list-edit"
import { INVALID_MOUNT, is_valid_mount, safe_array_index, safe_map_key, safe_map_value, safe_object_child, safe_set_member, safe_table_cell } from "./mount"
// Subpath, not the "elt/ui" barrel: this only needs DateTimePicker itself,
// not ui/index.tsx's side effects (theme init, reset/layout/form/typography
// CSS) -- a real elt/ui app will load those anyway, but editor/schema.tsx
// shouldn't force them as a side effect of importing one component.
import { DateTimePicker, type DateTimePickerAttributesBAse } from "elt/ui/date"
import type { SelectAttributes } from "elt/ui/select"
import { $forward_attrs, skip_keys } from "./forward-attrs"
import {
  create_toolbar_state,
  render_composite_toolbar,
  render_type_change_menu_button,
  row_matches_search,
  value_preview_text,
} from "./composite-toolbar"
import { register_constructor } from "./registry"
import { $resizable } from "./table-resize"
import { register_unknown_type_change_catalog } from "./type-change"

// A value that isn't null, an array, or one of the composite built-ins --
// the shape ArrayFactory/MapFactory/SetFactory convert FROM and ObjectFactory
// converts TO by default (Layer 5 "Type-change targets").
function is_plain_object(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Map) &&
    !(value instanceof Set) &&
    !(value instanceof Date)
  )
}

// Two values "are the same type" when a mounted widget for one would still be
// a reasonable widget for the other -- used by EitherFactory to avoid
// recreating its branch widget on every unrelated value change (e.g. number
// -> number). Structural, not exact: two plain objects of different shapes
// still count as the same type here; EitherFactory re-checks `canHandle`
// separately when the branch itself needs re-resolving.
function is_same_type(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null) return false
  if (typeof a !== typeof b) return false
  if (typeof a === "object") return (a as object).constructor === (b as object).constructor
  return true
}

export interface RenderableWidget {
  render(): Renderable

  // Error code for this widget's own value. Codes are translated to
  // renderables via i18n that's still unspecified; v1 just draws the code.
  // Composite widgets (Object/Array/...) additionally aggregate their
  // children's errors into a warning surfaced on their own toolbar (see
  // Layer 3's `o_has_extra_keys` for the precedent) -- not modeled here yet.
  o_error: o.ReadonlyObservable<string | null>
}

// Open contract (Layer 1b "Asking to open (DOM)" / "Editor shell"): widgets
// dispatch this, the shell only listens -- so it belongs with the widgets
// (here), not with the shell (editor/shell.tsx re-exports it for callers
// that only imported the shell module).
export interface ObjectEditorOpenDetail {
  o_value: o.Observable<unknown>
  title: string
  // Optional: the exact factory to mount for this value, when the
  // dispatching widget already knows it (e.g. ObjectFactory knows a
  // property's own schema-declared type). The shell uses this instead of
  // resolving from scratch when present, falling back to unknown mode
  // (`anything`) otherwise -- Layer 5 "Resolution" step 3's constructor
  // registry (schema.tsx) fills in when this is omitted.
  factory?: Factory<unknown>
  /** Per-node column vs popup; wins over shell `prefer_popups` when set. */
  open_as?: "column" | "popup"
}

declare global {
  interface GlobalEventHandlersEventMap {
    "elt-object-editor-open": CustomEvent<ObjectEditorOpenDetail>
  }
}

/** Widgets call this to ask the shell to open `o_value` -- never hold a shell reference (Layer 1b). */
export function dispatch_object_editor_open(target: EventTarget, detail: ObjectEditorOpenDetail) {
  target.dispatchEvent(new CustomEvent("elt-object-editor-open", { detail, bubbles: true, composed: true }))
}

// Composite kinds render as a preview + drill-in button when nested inside
// another composite (Layer 4: "object()'s default composite rendering is a
// preview + drill-in") -- only the factory mounted directly in a column (the
// root, or an opened child) renders its full editable content. `kind` is
// used here as the tag it's meant to be (introspection), not for dispatch.
const COMPOSITE_KINDS = new Set(["object", "array", "set", "map"])

// Shared preview button for any composite property/element nested inside a
// parent composite -- dispatches the real open event so the shell creates a
// new column, rather than inlining the child's content in place.
function render_composite_preview(
  o_value: o.Observable<unknown>,
  title: string,
  resolve_factory: () => Factory<unknown>,
): Renderable {
  let btn!: HTMLButtonElement
  btn = (
    <button type="button" class={cls_preview}>
      {$on("click", () => {
        const factory = resolve_factory()
        dispatch_object_editor_open(btn, {
          o_value,
          title,
          factory,
          open_as: (factory.options as CommonNodeOptions | undefined)?.open_as,
        })
      })}
      Open ›
    </button>
  ) as HTMLButtonElement
  return btn
}

const cls_preview = css`.oe-preview {
  border: 1px solid ${theme.colors.text.light};
  background: none;
  border-radius: ${theme.settings.borderRadius};
  padding: 0.3em 0.6em;
  cursor: pointer;
}`

const cls_unrepresentable = css`.oe-unrepresentable {
  color: ${theme.colors.text.mid};
  font-style: italic;
  padding: 0.25em 0;
}`

/** Unknown-mode branch pick — assigned once `anything` is constructed below. */
let resolve_unknown_value: (value: unknown) => Factory<unknown> = () => unrepresentable_factory

/** Pick widget factory for one array/set element or object field value. */
function resolve_element_factory(values_factory: Factory<unknown>, value: unknown): Factory<unknown> {
  if (values_factory.canHandle(value)) return values_factory
  if (values_factory.kind === "either") return (values_factory as EitherFactory).resolve(value)
  return resolve_unknown_value(value)
}

function render_object_field(
  key: string,
  o_child: o.Observable<unknown>,
  options: ObjectOptions,
): Renderable {
  return o_child.tf(() => {
    const value = o_child.get()
    if (!is_valid_mount(value)) return null
    const factory = resolve_factory_for_key(key, value, options)
    return COMPOSITE_KINDS.has(factory.kind)
      ? render_composite_preview(o_child, key, () => resolve_factory_for_key(key, o_child.get(), options))
      : factory.render(o_child).render()
  })
}

function render_element_or_preview(
  o_child: o.Observable<unknown>,
  title: string,
  values_factory: Factory<unknown>,
): Renderable {
  return o_child.tf(() => {
    const value = o_child.get()
    if (!is_valid_mount(value)) return null
    const factory = resolve_element_factory(values_factory, value)
    return COMPOSITE_KINDS.has(factory.kind)
      ? render_composite_preview(o_child, title, () => resolve_element_factory(values_factory, o_child.get()))
      : factory.render(o_child).render()
  })
}

// Shared, immutable sentinel -- widgets with nothing to report reuse this
// instead of each allocating their own always-null observable.
const no_error: RenderableWidget["o_error"] = o(null as string | null)

// Placeholder widget used before an EitherFactory has resolved a branch, and
// by factories with nothing to render.
const null_widget: RenderableWidget = {
  render: () => null,
  o_error: no_error,
}

export abstract class Factory<Options> {
  // Stable id for this factory's kind, e.g. "object", "array", "string".
  // Used for introspection, custom-widget registration, and (later) mapping
  // to/from a JSON-Schema-subset importer -- NOT for render/canHandle
  // dispatch, which goes through the instance/class itself.
  abstract readonly kind: string

  constructor(public options: Options) {}

  // Mounts a widget bound to `o_value`. Per-mount state (anything that
  // varies per cell/row, not per schema definition) MUST live in this
  // method's closure or on the returned RenderableWidget -- never as a field
  // on `this`, since one Factory instance is shared across every row/cell
  // that uses it (e.g. an ArrayFactory's `values`).
  abstract render(o_value: o.Observable<unknown>): RenderableWidget

  // Suitability: can this factory's widget represent `value` as-is? Drives
  // union branch matching (EitherFactory) and unknown-mode auto-pick.
  // Boolean only -- see `canConvert` for "not suitable, but convertible".
  canHandle(_value: unknown): boolean {
    return false
  }

  // Convertibility: could this factory represent `value` if the user
  // explicitly asked to convert it here (Layer 1 "Type changes and
  // conversion")? Only ever consulted from the user-initiated type-change
  // menu -- NEVER during automatic Either resolution, which must not mutate
  // data as a side effect of the value changing under it (see
  // EitherFactory.resolve). Separate from `canHandle`: a value can be
  // inconvertible-but-already-suitable (canHandle true, canConvert
  // irrelevant) or convertible-but-not-suitable-as-is (canHandle false,
  // canConvert true).
  canConvert(_value: unknown): boolean {
    return false
  }

  // Performs the conversion `canConvert` checked. Only ever called after a
  // `canConvert` check returned true for the same value -- this base
  // implementation throws so a caller that skips the check fails loudly
  // instead of silently returning nonsense.
  convert(value: unknown): unknown {
    throw new Error(`${this.kind}: convert() called without a passing canConvert() check (got ${String(value)})`)
  }

  // Value to start from when this kind is force-picked (type change, new
  // array/set item) and no conversion applies, or as the always-available
  // "reset to default" choice in the type-change menu alongside "Convert".
  defaultValue(): unknown {
    return null
  }

  // Type-safe partial override for schema supplement (Layer 5's "extend the
  // default"). Factories are class instances, not plain data, so this
  // replaces "generic deep-merge" as the merge mechanism. Default: shallow-
  // merge `options`. Composite kinds override to recurse into their nested
  // factories (see ObjectFactory.extend for the property-list case).
  extend(partial: Partial<Options>): this {
    const Ctor = this.constructor as new (options: Options) => this
    return new Ctor({ ...this.options, ...partial })
  }
}

// Either's honest "I don't know what this is" terminal state -- see
// EitherFactory.resolve. A read-only placeholder: canHandle/canConvert are
// always false, defaultValue() is null but is NEVER written automatically
// (only the explicit type-change menu writes anything, and only after the
// user picks a different, real kind). Not named "Unknown*" to avoid clashing
// with this spec's separate "unknown mode" (no-schema) vocabulary.
export class UnrepresentableFactory extends Factory<{}> {
  readonly kind = "unrepresentable"

  render(_o_value: o.Observable<unknown>): RenderableWidget {
    return {
      // TODO: an error/placeholder ("this value's type isn't supported
      // here"), but keep the type-change control available so the user can
      // still force a kind via canConvert/convert or defaultValue() --
      // this widget itself must never write to o_value on its own.
      render: () => (
        <e-block class={cls_unrepresentable} title="Use the … menu on a parent composite to change type">
          Unsupported value here
        </e-block>
      ),
      o_error: no_error,
    }
  }
}

export const unrepresentable_factory = new UnrepresentableFactory({})

export interface EitherOptions {
  options: Factory<unknown>[]
}

export interface UndefinedOptions {}

/** Per-composite toolbar pieces; set a flag to false to hide (schema opt-out). */
export interface CompositeToolbarOptions {
  search?: false
  menu?: false
  type_change?: false
  import_export?: false
}

/** Node-level config shared by every composite factory (Layer 5). */
export interface CommonNodeOptions {
  /** Replace default constructor/cardinality title, or false to hide. */
  chrome_label?: string | false
  toolbar?: CompositeToolbarOptions
  open_as?: "column" | "popup"
  /** When set, only these factory `kind` values appear in the type-change menu. */
  conversions?: readonly string[]
}

export interface PropertyOption {
  name?: string | RegExp
  type: Factory<unknown>
  required?: boolean // defaults to true
}

export interface ObjectOptions extends CommonNodeOptions {
  properties?: PropertyOption[]
  /** When false, only declared properties render; no add/remove. Default true. */
  free_keys?: boolean
}

export interface ArrayOptions extends CommonNodeOptions {
  mode?: "auto" | "table" | "list" // defaults to "auto"
  values: Factory<unknown>

  allow_insert?: boolean
  allow_delete?: boolean
  allow_reorder?: boolean

  /** Default value or callback for a newly inserted item. Omitted means `null`. */
  item_default?: unknown | (() => unknown)

  /** Manual table columns instead of first-row auto-detect (Layer 3 Table). */
  columns?: readonly string[]

  // Row identity for VirtualScroll key reuse under reorder (spec: Layer 1b
  // "Row / element identity"). Omitted ("keyless schema") falls back to
  // index/position -- reorder then does not migrate the row's observable,
  // an accepted, documented degradation. Unknown mode never hits this
  // fallback: it uses the object-stamp mechanism below instead.
  key?: (item: unknown, index: number) => PropertyKey
}

// Well-known enumerable symbol unknown-mode arrays/sets stamp onto object
// elements the first time they're seen, as their row key when no `key` was
// given. Enumerable so it survives `o.clone`'s Object.assign-based copy;
// never shows up in JSON.stringify / Object.keys / for...in.
export const sym_row_id = Symbol("object-editor:row-id")

export interface SetOptions extends CommonNodeOptions {
  values: Factory<unknown>
  item_default?: unknown | (() => unknown)
  // Row identity for VirtualScroll (Layer 1b) -- unrelated to Set membership,
  // which is always checked by value equality via `Set.has`.
  key?: (item: unknown, index: number) => PropertyKey

  allow_insert?: boolean
  allow_delete?: boolean
  allow_reorder?: boolean
}

export interface MapOptions extends CommonNodeOptions {
  // Separate from `values`: Map keys are edited with their own widget
  // (Layer 3 Map). A Map entry's own key is already a stable row identity
  // (Layer 1b), so there is no separate `key` field here.
  keys: Factory<unknown>
  values: Factory<unknown>

  allow_insert?: boolean
  allow_delete?: boolean
  allow_reorder?: boolean
  /** Default false in schema mode; unknown mode treats as true when omitted. */
  allow_key_type_change?: boolean
}

/** Factory-only: switches between `<input>` and `<textarea>`. */

export interface StringOptions extends Omit<attrs_input, "type" | "value"> {
  multiline?: boolean
}

export interface NumberOptions extends Omit<attrs_input, "type" | "value" | "checked"> {
  allow_non_finite?: boolean
}

export interface BooleanOptions extends Omit<attrs_input, "type" | "value" | "checked"> {}

export interface ColorOptions {}

export interface DatetimeOptions extends Omit<DateTimePickerAttributesBAse, "model" | "clearable"> {
  date?: boolean
  time?: boolean
  nullable?: boolean
}

export interface SelectOptions<T, T2 = T>
  extends Omit<SelectAttributes<T, T2>, "model" | "options" | "convert_fn" | "label_fn"> {
  options: T2[]
  convert_fn?: (opt: T2) => T
  label_fn?: (opt: T2) => Renderable
  allow_other?: boolean
  fill_from_table_column?: boolean
}

export type FactoryOptions<Fact> = Fact extends Factory<infer Opts> ? Opts : never

/////////////////////////////////////////////////////////////////
// Factory classes

export class NullFactory extends Factory<{}> {
  readonly kind = "null"

  override canHandle(value: unknown): boolean {
    return value === null
  }

  override defaultValue(): unknown {
    return null
  }

  render(): RenderableWidget {
    return {
      render: () => <span>NULL</span>,
      o_error: no_error,
    }
  }
}

export const null_factory = new NullFactory({})

export class UndefinedFactory extends Factory<UndefinedOptions> {
  readonly kind = "undefined"

  override canHandle(value: unknown): boolean {
    return value === undefined
  }

  override defaultValue(): unknown {
    return undefined
  }

  render(): RenderableWidget {
    return {
      render: () => <span>UNDEFINED</span>,
      o_error: no_error,
    }
  }
}

export function undef(opts: UndefinedOptions = {}) {
  return new UndefinedFactory(opts)
}

export class StringFactory extends Factory<StringOptions> {
  readonly kind = "string"

  override canHandle(value: unknown): boolean {
    return typeof value === "string"
  }

  override canConvert(value: unknown): boolean {
    return typeof value === "number" || typeof value === "boolean"
  }

  override convert(value: unknown): unknown {
    return String(value)
  }

  override defaultValue(): unknown {
    return ""
  }

  render(o_value: o.Observable<unknown>): RenderableWidget {
    const o_str = o_value as o.Observable<string>
    const o_error = o(null as string | null)
    const skip = skip_keys("multiline")
    const forwarded = $forward_attrs(this.options as Record<string, unknown>, skip)
    return {
      render: () =>
        this.options.multiline ? (
          <textarea>
            {forwarded}
            {$bind.string(o_str, { o_error })}
          </textarea>
        ) : (
          <input type="text">
            {forwarded}
            {$bind.string(o_str, { o_error })}
          </input>
        ),
      o_error,
    }
  }
}

export function string(opts: StringOptions = {}) {
  return new StringFactory(opts)
}

export class NumberFactory extends Factory<NumberOptions> {
  readonly kind = "number"

  override canHandle(value: unknown): boolean {
    return typeof value === "number"
  }

  override canConvert(value: unknown): boolean {
    if (typeof value === "boolean") return true
    return typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))
  }

  override convert(value: unknown): unknown {
    return Number(value)
  }

  override defaultValue(): unknown {
    return 0
  }

  render(o_value: o.Observable<unknown>): RenderableWidget {
    const o_num = o_value as o.Observable<number>
    const o_error = o(null as string | null)
    const allow_non_finite = !!this.options.allow_non_finite
    const skip = skip_keys("allow_non_finite")
    const forwarded = $forward_attrs(this.options as Record<string, unknown>, skip)
    return {
      render: () => (
        <input type="number">
          {forwarded}
          {$bind.number(o_num, {
            o_error,
            extra_check: allow_non_finite
              ? undefined
              : (value) => (Number.isFinite(value) ? null : "not_finite"),
          })}
        </input>
      ),
      o_error,
    }
  }
}

export function number(opts: NumberOptions = {}) {
  return new NumberFactory(opts)
}

export class BooleanFactory extends Factory<BooleanOptions> {
  readonly kind = "boolean"

  override canHandle(value: unknown): boolean {
    return typeof value === "boolean"
  }

  override canConvert(value: unknown): boolean {
    return typeof value === "number" || value === "true" || value === "false"
  }

  override convert(value: unknown): unknown {
    if (typeof value === "number") return value !== 0
    return value === "true"
  }

  override defaultValue(): unknown {
    return false
  }

  render(o_value: o.Observable<unknown>): RenderableWidget {
    const o_bool = o_value as o.Observable<boolean>
    const attrs: Record<string, unknown> = { ...this.options }
    if (attrs["e-variant"] == null) attrs["e-variant"] = "switch"
    const forwarded = $forward_attrs(attrs, skip_keys())
    return {
      render: () => (
        <input type="checkbox">
          {forwarded}
          {$bind.boolean(o_bool)}
        </input>
      ),
      o_error: no_error,
    }
  }
}

export function boolean(opts: BooleanOptions = {}) {
  return new BooleanFactory(opts)
}

export class ColorFactory extends Factory<ColorOptions> {
  readonly kind = "color"

  // Layer 4 color heuristic: `rgba?(...)` or `#`-hex.
  override canHandle(value: unknown): boolean {
    return typeof value === "string" && /^(#[0-9a-fA-F]{3,8}|rgba?\(.*\))$/.test(value)
  }

  override defaultValue(): unknown {
    return "#000000"
  }

  render(_o_value: o.Observable<unknown>): RenderableWidget {
    return {
      // TODO: mount elt/ui's new color control once specs/ui-color-picker.md
      // settles (component shape/name still under discussion there) --
      // $bind.string(o_value) into it, commit on change.
      render: () => <e-block>{/* elt/ui color control goes here */}</e-block>,
      o_error: no_error,
    }
  }
}

export function color(opts: ColorOptions = {}) {
  return new ColorFactory(opts)
}

// Not in the default unknown catalog (Layer 4 "Widgets for developers") --
// schema-only, since unknown mode has no fixed option list to offer.
export class SelectFactory<T, T2 = T> extends Factory<SelectOptions<T, T2>> {
  readonly kind = "select"

  override canHandle(value: unknown): boolean {
    const convert = this.options.convert_fn ?? ((opt: T2) => opt as unknown as T)
    return this.options.options.some((opt) => convert(opt) === value)
  }

  override defaultValue(): unknown {
    const convert = this.options.convert_fn ?? ((opt: T2) => opt as unknown as T)
    const first = this.options.options[0]
    return first !== undefined ? convert(first) : null
  }

  render(o_value: o.Observable<unknown>): RenderableWidget {
    const opts = this.options
    const convert_fn = opts.convert_fn ?? ((opt: T2) => opt as unknown as T)
    const o_options = o(opts.options)
    const { options: _opts, convert_fn: _cf, label_fn, allow_other: _ao, fill_from_table_column: _ft, ...rest } =
      opts
    const o_model = o_value as o.Observable<T>
    return {
      render: () =>
        Select({
          ...rest,
          model: o_model,
          options: o_options,
          convert_fn,
          label_fn,
        }),
      o_error: no_error,
    }
  }
}

export function select<T, T2 = T>(opts: SelectOptions<T, T2>) {
  return new SelectFactory(opts)
}

const ISO_8601 = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/

export class DateFactory extends Factory<DatetimeOptions> {
  readonly kind = "date"

  // Layer 4 date/time heuristic: a Date instance, or an ISO 8601 date/date-time
  // string -- deliberately tighter than plain Date.parse() success, which also
  // matches incidental strings like "January" or "5".
  override canHandle(value: unknown): boolean {
    return value instanceof Date || (typeof value === "string" && ISO_8601.test(value))
  }

  // Looser than canHandle on purpose: canHandle gates the unknown-mode
  // heuristic (deliberately tight, Layer 4), canConvert gates the explicit
  // type-change menu where the user already asked for a date and a wider net
  // (any Date.parse()-able string, or a timestamp number) is the more useful
  // default.
  override canConvert(value: unknown): boolean {
    if (typeof value === "number") return true
    return typeof value === "string" && !Number.isNaN(Date.parse(value))
  }

  override convert(value: unknown): unknown {
    return new Date(value as string | number)
  }

  override defaultValue(): unknown {
    return this.options.nullable ? null : new Date()
  }

  render(o_value: o.Observable<unknown>): RenderableWidget {
    const nullable = !!this.options.nullable
    const show_date = this.options.show_date ?? this.options.date ?? true
    const show_time = this.options.show_time ?? this.options.time ?? false
    const { nullable: _n, date: _d, time: _t, ...picker_rest } = this.options
    const o_date = o_value as o.Observable<Date | null>
    return {
      render: () =>
        nullable
          ? DateTimePicker({
              ...picker_rest,
              model: o_date,
              clearable: true,
              show_date,
              show_time,
            })
          : DateTimePicker({
              ...picker_rest,
              model: o_date as o.IObservable<Date | null, Date>,
              clearable: false,
              show_date,
              show_time,
            }),
      o_error: no_error,
    }
  }
}

export function date(opts: DatetimeOptions = { date: true }) {
  return new DateFactory(opts)
}

/** Resolve which factory edits `key` on `value` for this object schema. */
function resolve_factory_for_key(key: string, value: unknown, options: ObjectOptions): Factory<unknown> {
  for (const prop of options.properties ?? []) {
    if (typeof prop.name === "string" && prop.name === key) return prop.type
  }
  for (const prop of options.properties ?? []) {
    if (prop.name instanceof RegExp && prop.name.test(key)) return prop.type
  }
  if (options.free_keys === false) return unrepresentable_factory
  return resolve_unknown_value(value)
}

function object_allows_free_keys(options: ObjectOptions): boolean {
  return options.free_keys !== false
}

/** Row key order for the object grid (Layer 3 Object). */
function object_row_keys(value: Record<string, unknown>, options: ObjectOptions): string[] {
  const props = options.properties ?? []
  const string_names = props.filter((p): p is PropertyOption & { name: string } => typeof p.name === "string")
  const is_unknown_layout = props.length === 0

  if (is_unknown_layout) {
    return Object.keys(value).sort()
  }

  const keys: string[] = string_names.map((p) => p.name)
  const claimed = new Set(keys)

  if (object_allows_free_keys(options)) {
    for (const k of Object.keys(value)) {
      if (!claimed.has(k)) keys.push(k)
    }
  }
  return keys
}

function commit_object_key(
  o_obj: o.Observable<unknown>,
  key: string,
  child_value: unknown,
  previous_key?: string,
) {
  const obj = o_obj.get()
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return
  const next = { ...(obj as Record<string, unknown>) }
  if (previous_key != null && previous_key !== key) delete next[previous_key]
  if (Object.hasOwn(next, key) && previous_key == null) return // collision on add
  next[key] = child_value
  o_obj.set(next)
}

function remove_object_key(o_obj: o.Observable<unknown>, key: string) {
  const obj = o_obj.get()
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return
  const next = { ...(obj as Record<string, unknown>) }
  delete next[key]
  o_obj.set(next)
}

export class ObjectFactory extends Factory<ObjectOptions> {
  readonly kind = "object"

  override canHandle(value: unknown): boolean {
    return typeof value === "object" && value !== null && !Array.isArray(value)
  }

  override canConvert(value: unknown): boolean {
    return Array.isArray(value) || value instanceof Map || value instanceof Set
  }

  override convert(value: unknown): unknown {
    if (value instanceof Map) return Object.fromEntries(value.entries())
    const arr = Array.isArray(value) ? value : [...(value as Set<unknown>)]
    return Object.fromEntries(arr.map((v, i) => [String(i), v]))
  }

  override defaultValue(): unknown {
    return {}
  }

  render(o_value: o.Observable<unknown>): RenderableWidget {
    const can_add = object_allows_free_keys(this.options)
    const toolbar = create_toolbar_state()
    const declared_keys = new Set(
      (this.options.properties ?? [])
        .filter((p): p is PropertyOption & { name: string } => typeof p.name === "string")
        .map((p) => p.name),
    )
    const o_row_keys = o_value.tf((value) => {
      if (typeof value !== "object" || value === null || Array.isArray(value)) return [] as string[]
      return object_row_keys(value as Record<string, unknown>, this.options)
    })
    const o_visible_keys = o.expression((get) => {
      const keys = get(o_row_keys)
      const root = get(o_value)
      const query = get(toolbar.o_query)
      const case_sensitive = get(toolbar.o_case_sensitive)
      if (typeof root !== "object" || root === null || Array.isArray(root)) return keys
      const obj = root as Record<string, unknown>
      return keys.filter((key) => row_matches_search(query, case_sensitive, [key, value_preview_text(obj[key])]))
    })

    // Transient rows live outside the observable until the key commits (Layer 1).
    const transient_rows = new Map<string, { o_key: o.Observable<string>; o_value: o.Observable<unknown> }>()
    const o_transient_ids = o<string[]>([])

    const try_commit_transient = (id: string) => {
      const row = transient_rows.get(id)
      if (!row) return
      const key = row.o_key.get().trim()
      if (!key) return
      const obj = o_value.get()
      if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return
      if (Object.hasOwn(obj, key)) return
      const catchalls = (this.options.properties ?? []).filter((p) => p.name instanceof RegExp)
      if (
        catchalls.length > 0 &&
        !catchalls.some((p) => (p.name as RegExp).test(key)) &&
        !(this.options.properties ?? []).some((p) => typeof p.name === "string" && p.name === key)
      ) {
        return
      }
      commit_object_key(o_value, key, row.o_value.get())
      transient_rows.delete(id)
      o_transient_ids.set(o_transient_ids.get().filter((x) => x !== id))
    }

    const render_value = (key: string, o_child: o.Observable<unknown>) =>
      render_object_field(key, o_child, this.options)

    return {
      render: () => (
        <e-flex column gap="widget">
          {render_composite_toolbar({
            factory: this as Factory<CommonNodeOptions>,
            o_value,
            toolbar,
            kind: "object",
          })}
          <e-block class={cls_list_scroll}>
            {$scrollable}
            {VirtualScroll(o_visible_keys, (o_key) => (
              <e-flex align="center" gap="widget">
                <span class={cls_object_key}>{o_key}</span>
                <e-block class={cls_object_value} style={{ flex: "1" }}>
                  {o_key.tf((key) => render_value(key, safe_object_child(o_value, key)))}
                  {can_add &&
                    o_key.tf((key) =>
                      declared_keys.has(key) ? null : (
                        <button type="button" class={cls_row_remove} title="Remove key">
                          {$on("click", () => remove_object_key(o_value, key))}−
                        </button>
                      ),
                    )}
                </e-block>
              </e-flex>
            ))}
            {VirtualScroll(o_transient_ids, (o_id) => {
              const id = o_id.get()
              let row = transient_rows.get(id)
              if (!row) {
                row = { o_key: o(""), o_value: o(null) }
                transient_rows.set(id, row)
              }
              const { o_key, o_value: o_child } = row
              return (
                <e-flex align="center" gap="widget">
                  <input type="text" class={cls_object_key_input} placeholder="key">
                    {$bind.string(o_key)}
                    {$on("change", () => try_commit_transient(id))}
                  </input>
                  <e-block class={cls_object_value} style={{ flex: "1" }}>
                    {render_value(o_key.get() || id, o_child)}
                  </e-block>
                </e-flex>
              )
            })}
          </e-block>
          {can_add && (
            <button type="button" class={cls_add_key}>
              {$on("click", () => {
                const id = `__new_${Date.now()}`
                transient_rows.set(id, { o_key: o(""), o_value: o(null) })
                o_transient_ids.set([...o_transient_ids.get(), id])
              })}
              + Add key
            </button>
          )}
        </e-flex>
      ),
      o_error: no_error,
    }
  }

  // Merge property lists by name (string names only -- a RegExp-named
  // catch-all entry has no merge key and is simply appended) instead of
  // replacing the whole list, so `.extend({ properties: [...] })` can add or
  // override individual fields.
  override extend(partial: Partial<ObjectOptions>): this {
    if (!partial.properties) return super.extend(partial)
    const by_name = new Map<string, PropertyOption>()
    const unnamed: PropertyOption[] = []
    for (const p of this.options.properties ?? []) {
      if (typeof p.name === "string") by_name.set(p.name, p)
      else unnamed.push(p)
    }
    for (const p of partial.properties) {
      if (typeof p.name === "string") by_name.set(p.name, p)
      else unnamed.push(p)
    }
    const Ctor = this.constructor as new (options: ObjectOptions) => this
    return new Ctor({ ...this.options, ...partial, properties: [...by_name.values(), ...unnamed] })
  }
}

const cls_object_key = css`.oe-object-key {
  color: ${theme.colors.text.mid};
  white-space: nowrap;
}`

const cls_object_value = css`.oe-object-value {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.25em;
}`

const cls_object_key_input = css`.oe-object-key-input {
  font: inherit;
  color: ${theme.colors.text.mid};
  border: 1px solid ${theme.colors.text.light};
  border-radius: ${theme.settings.borderRadius};
  padding: 0.1em 0.3em;
  min-width: 6em;
}`

const cls_row_remove = css`.oe-row-remove {
  border: none;
  background: none;
  cursor: pointer;
  color: ${theme.colors.text.mid};
  padding: 0 0.2em;
}`

const cls_add_key = css`.oe-add-key {
  border: 1px dashed ${theme.colors.text.light};
  background: none;
  border-radius: ${theme.settings.borderRadius};
  padding: 0.3em 0.6em;
  cursor: pointer;
  justify-self: start;
}`

const cls_list_scroll = css`.oe-list-scroll {
  max-height: 24em;
  overflow: auto;
}`

const cls_table_scroll = css`.oe-table-scroll {
  overflow: auto;
  max-width: 100%;
  max-height: 24em;
}`

const cls_table = css`.oe-table {
  width: max-content;
  border-collapse: collapse;
  th, td {
    border: 1px solid ${theme.colors.text.light};
    padding: ${theme.settings.spacingWidget};
    vertical-align: top;
  }
  /* One sticky block for both header rows (toolbar + columns) — a fixed
     per-row top offset would need the toolbar row's height, which varies
     with its content (search + menu can wrap). */
  thead {
    position: sticky;
    top: 0;
    z-index: 1;
    background: ${theme.colors.bg};
  }
  thead th {
    background: ${theme.colors.text.ultra_light};
    font-weight: bolder;
  }
}`

const cls_table_toolbar_cell = css`.oe-table-toolbar-cell {
  font-weight: normal;
  text-align: start;
}`

const cls_table_index = css`.oe-table-index {
  color: ${theme.colors.text.mid};
  text-align: right;
  min-width: 2em;
}`

const cls_table_warn = css`.oe-table-warn {
  color: ${theme.colors.yellow.strong};
  font-size: 0.9em;
}`

export function object(opts: ObjectOptions = { properties: [] }) {
  return new ObjectFactory(opts)
}

export class ArrayFactory extends Factory<ArrayOptions> {
  readonly kind = "array"

  override canHandle(value: unknown): boolean {
    return Array.isArray(value)
  }

  override canConvert(value: unknown): boolean {
    return is_plain_object(value) || value instanceof Map || value instanceof Set
  }

  override convert(value: unknown): unknown {
    if (value instanceof Map) return [...value.values()]
    if (value instanceof Set) return [...value]
    return Object.values(value as object)
  }

  override defaultValue(): unknown {
    return []
  }

  render(o_value: o.Observable<unknown>): RenderableWidget {
    const toolbar = create_toolbar_state()
    const values_factory = this.options.values
    const mode = this.options.mode ?? "auto"
    const arr = o_value.get()
    const use_table = mode === "table" || (mode === "auto" && Array.isArray(arr) && this.eval_auto_table(arr))

    if (use_table) {
      return this.render_table(o_value, toolbar, values_factory)
    }
    return this.render_list(o_value, toolbar, values_factory)
  }

  private render_list(
    o_value: o.Observable<unknown>,
    toolbar: ReturnType<typeof create_toolbar_state>,
    values_factory: Factory<unknown>,
  ): RenderableWidget {
    const o_indices = o_value.tf((value) => (Array.isArray(value) ? value.map((_, i) => i) : []))
    const o_visible_indices = o.expression((get) => {
      const indices = get(o_indices)
      const arr = get(o_value)
      const query = get(toolbar.o_query)
      const case_sensitive = get(toolbar.o_case_sensitive)
      if (!Array.isArray(arr)) return indices
      return indices.filter((i) =>
        row_matches_search(query, case_sensitive, [String(i), value_preview_text(arr[i])]),
      )
    })

    const transient_rows = new Map<string, o.Observable<unknown>>()
    const o_transient_ids = o<string[]>([])

    const try_commit_transient = (id: string) => {
      const row = transient_rows.get(id)
      if (!row) return
      const arr = o_value.get()
      if (!Array.isArray(arr)) return
      insert_array_at(o_value, arr.length, row.get())
      transient_rows.delete(id)
      o_transient_ids.set(o_transient_ids.get().filter((x) => x !== id))
    }

    return {
      render: () => (
        <e-flex column gap="widget">
          {render_composite_toolbar({
            factory: this as Factory<CommonNodeOptions>,
            o_value,
            toolbar,
            kind: "array",
            type_change_extra: [
              set({ values: values_factory }),
              map({ keys: string(), values: values_factory }),
            ],
          })}
          <e-block class={cls_list_scroll}>
            {$scrollable}
            {VirtualScroll(o_visible_indices, (o_i) => (
              <e-flex align="center" gap="widget">
                <span class={cls_object_key}>{o_i.tf((i) => String(i))}</span>
                <e-block class={cls_object_value} style={{ flex: "1" }}>
                  {o_i.tf((i) => render_element_or_preview(safe_array_index(o_value, i), String(i), values_factory))}
                </e-block>
                {allows_delete(this.options) &&
                  o_i.tf((i) => (
                    <button type="button" class={cls_row_remove} title="Remove row">
                      {$on("click", () => remove_array_at(o_value, i))}−
                    </button>
                  ))}
              </e-flex>
            ))}
            {VirtualScroll(o_transient_ids, (o_id) => {
              const id = o_id.get()
              const row = transient_rows.get(id)
              if (!row) return null
              return (
                <e-flex align="center" gap="widget">
                  <span class={cls_object_key}>+</span>
                  <e-block class={cls_object_value} style={{ flex: "1" }}>
                    {render_element_or_preview(row, "new", values_factory)}
                  </e-block>
                  <button type="button" class={cls_row_remove} title="Discard row">
                    {$on("click", () => {
                      transient_rows.delete(id)
                      o_transient_ids.set(o_transient_ids.get().filter((x) => x !== id))
                    })}
                    −
                  </button>
                </e-flex>
              )
            })}
          </e-block>
          {allows_insert(this.options) && (
            <button type="button" class={cls_add_key}>
              {$on("click", () => {
                const id = `t-${Date.now()}-${Math.random()}`
                const row = o(resolve_item_default(this.options.item_default))
                transient_rows.set(id, row)
                row.addObserver((val, old) => {
                  if (old === o.NoValue) return
                  try_commit_transient(id)
                })
                o_transient_ids.set([...o_transient_ids.get(), id])
              })}
              + Add item
            </button>
          )}
        </e-flex>
      ),
      o_error: no_error,
    }
  }

  private render_table(
    o_value: o.Observable<unknown>,
    toolbar: ReturnType<typeof create_toolbar_state>,
    values_factory: Factory<unknown>,
  ): RenderableWidget {
    const o_columns = o_value.tf((value) => (Array.isArray(value) ? table_column_keys(value, this.options.columns) : []))
    const o_has_extra = o_value.tf((value) =>
      Array.isArray(value) ? table_has_extra_keys(value, table_column_keys(value, this.options.columns)) : false,
    )
    const o_indices = o_value.tf((value) => (Array.isArray(value) ? value.map((_, i) => i) : []))

    return {
      render: () => (
        <e-flex column gap="widget">
          <e-block class={cls_table_scroll}>
            {$scrollable}
            <table class={cls_table}>
              <thead>
                <tr>
                  <th colspan={o_columns.tf((cols) => cols.length + 1)} class={cls_table_toolbar_cell}>
                    {render_composite_toolbar({
                      factory: this as Factory<CommonNodeOptions>,
                      o_value,
                      toolbar,
                      kind: "array",
                      type_change_extra: [
                        set({ values: values_factory }),
                        map({ keys: string(), values: values_factory }),
                      ],
                      embedded: true,
                    })}
                    {o_has_extra.tf((has) =>
                      has ? <span class={cls_table_warn} title="Some rows have keys not shown as columns">⚠ extra keys</span> : null,
                    )}
                  </th>
                </tr>
                <tr>
                  <th class={cls_table_index}>#</th>
                  {Repeat(o_columns, (o_col) => (
                    <th>
                      {$resizable}
                      {o_col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {VirtualScroll(o_indices, (o_i) => (
                  <tr>
                    <td class={cls_table_index}>{o_i.tf((i) => String(i))}</td>
                    {Repeat(o_columns, (o_col) => (
                      <td>
                        {o_i.tf((i) =>
                          o_col.tf((col) =>
                            render_element_or_preview(
                              safe_table_cell(o_value, i, col),
                              `${i}:${col}`,
                              values_factory,
                            ),
                          ),
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </e-block>
        </e-flex>
      ),
      o_error: no_error,
    }
  }

  // Layer 3 Table auto-detect — used when `mode: "auto"` table branch is wired.
  eval_auto_table_for_table_mode(value: unknown): boolean {
    return this.eval_auto_table(value)
  }

  // Layer 3 Table auto-detect, "first-row" rule: non-empty, first element a
  // non-null plain object, every sampled element (first 10) owns every key
  // of the first row.
  private eval_auto_table(value: unknown): boolean {
    if (!Array.isArray(value) || value.length === 0) return false
    const first = value[0]
    if (typeof first !== "object" || first === null || Array.isArray(first)) return false
    const keys = Object.keys(first)
    const sample = value.slice(0, 10)
    return keys.every((key) => sample.every((item) => Object.hasOwn(item, key)))
  }
}

export function array(opts: ArrayOptions) {
  return new ArrayFactory(opts)
}

export class SetFactory extends Factory<SetOptions> {
  readonly kind = "set"

  override canHandle(value: unknown): boolean {
    return value instanceof Set
  }

  override canConvert(value: unknown): boolean {
    return Array.isArray(value) || is_plain_object(value)
  }

  override convert(value: unknown): unknown {
    return new Set(Array.isArray(value) ? value : Object.values(value as object))
  }

  override defaultValue(): unknown {
    return new Set()
  }

  render(o_value: o.Observable<unknown>): RenderableWidget {
    const toolbar = create_toolbar_state()
    const values_factory = this.options.values
    const o_members = o_value.tf((v) => (v instanceof Set ? [...v] : []))
    const o_visible_members = o.expression((get) => {
      const members = get(o_members)
      const query = get(toolbar.o_query)
      const case_sensitive = get(toolbar.o_case_sensitive)
      return members.filter((m) => row_matches_search(query, case_sensitive, [value_preview_text(m)]))
    })

    const transient_rows = new Map<string, o.Observable<unknown>>()
    const o_transient_ids = o<string[]>([])

    const try_commit_transient = (id: string) => {
      const row = transient_rows.get(id)
      if (!row) return
      const val = row.get()
      const s = o_value.get()
      if (!(s instanceof Set) || s.has(val)) return
      append_set_member(o_value, val)
      transient_rows.delete(id)
      o_transient_ids.set(o_transient_ids.get().filter((x) => x !== id))
    }

    return {
      render: () => (
        <e-flex column gap="widget">
          {render_composite_toolbar({
            factory: this as Factory<CommonNodeOptions>,
            o_value,
            toolbar,
            kind: "set",
            type_change_extra: [
              array({ values: values_factory }),
              map({ keys: string(), values: values_factory }),
            ],
          })}
          <e-block class={cls_list_scroll}>
            {$scrollable}
            {VirtualScroll(o_visible_members, (o_member) => (
              <e-flex align="center" gap="widget">
                <e-block class={cls_object_value} style={{ flex: "1" }}>
                  {o_member.tf((member) =>
                    render_element_or_preview(safe_set_member(o_value, member), value_preview_text(member), values_factory),
                  )}
                </e-block>
                {allows_delete(this.options) &&
                  o_member.tf((member) => (
                    <button type="button" class={cls_row_remove} title="Remove member">
                      {$on("click", () => remove_set_member(o_value, member))}−
                    </button>
                  ))}
              </e-flex>
            ))}
            {VirtualScroll(o_transient_ids, (o_id) => {
              const id = o_id.get()
              const row = transient_rows.get(id)
              if (!row) return null
              return (
                <e-flex align="center" gap="widget">
                  <e-block class={cls_object_value} style={{ flex: "1" }}>
                    {render_element_or_preview(row, "new", values_factory)}
                  </e-block>
                  <button type="button" class={cls_row_remove} title="Discard row">
                    {$on("click", () => {
                      transient_rows.delete(id)
                      o_transient_ids.set(o_transient_ids.get().filter((x) => x !== id))
                    })}
                    −
                  </button>
                </e-flex>
              )
            })}
          </e-block>
          {allows_insert(this.options) && (
            <button type="button" class={cls_add_key}>
              {$on("click", () => {
                const id = `t-${Date.now()}-${Math.random()}`
                const row = o(resolve_item_default(this.options.item_default))
                transient_rows.set(id, row)
                row.addObserver((val, old) => {
                  if (old === o.NoValue) return
                  try_commit_transient(id)
                })
                o_transient_ids.set([...o_transient_ids.get(), id])
              })}
              + Add member
            </button>
          )}
        </e-flex>
      ),
      o_error: no_error,
    }
  }
}

export function set(opts: SetOptions) {
  return new SetFactory(opts)
}

export class MapFactory extends Factory<MapOptions> {
  readonly kind = "map"

  override canHandle(value: unknown): boolean {
    return value instanceof Map
  }

  override canConvert(value: unknown): boolean {
    return Array.isArray(value) || is_plain_object(value)
  }

  override convert(value: unknown): unknown {
    if (Array.isArray(value)) return new Map(value.map((v, i) => [i, v]))
    return new Map(Object.entries(value as object))
  }

  override defaultValue(): unknown {
    return new Map()
  }

  render(o_value: o.Observable<unknown>): RenderableWidget {
    const toolbar = create_toolbar_state()
    const keys_factory = this.options.keys
    const values_factory = this.options.values
    const o_entry_keys = o_value.tf((v) => (v instanceof Map ? [...v.keys()] : []))
    const o_visible_keys = o.expression((get) => {
      const keys = get(o_entry_keys)
      const m = get(o_value)
      const query = get(toolbar.o_query)
      const case_sensitive = get(toolbar.o_case_sensitive)
      if (!(m instanceof Map)) return keys
      return keys.filter((k) =>
        row_matches_search(query, case_sensitive, [value_preview_text(k), value_preview_text(m.get(k))]),
      )
    })

    const transient_rows = new Map<string, { o_key: o.Observable<unknown>; o_val: o.Observable<unknown> }>()
    const o_transient_ids = o<string[]>([])

    const try_commit_transient = (id: string) => {
      const row = transient_rows.get(id)
      if (!row) return
      const key = row.o_key.get()
      if (key === INVALID_MOUNT) return
      if (!insert_map_entry(o_value, key, row.o_val.get())) return
      transient_rows.delete(id)
      o_transient_ids.set(o_transient_ids.get().filter((x) => x !== id))
    }

    return {
      render: () => (
        <e-flex column gap="widget">
          {render_composite_toolbar({
            factory: this as Factory<CommonNodeOptions>,
            o_value,
            toolbar,
            kind: "map",
            type_change_extra: [
              array({ values: values_factory }),
              set({ values: values_factory }),
            ],
          })}
          <e-block class={cls_list_scroll}>
            {$scrollable}
            {VirtualScroll(o_visible_keys, (o_key) => (
              <e-flex align="center" gap="widget">
                <e-block class={cls_object_value}>
                  {o_key.tf((key) => {
                    const o_k = safe_map_key(o_value, key)
                    return (
                      <e-flex align="center" gap="widget">
                        <e-block style={{ flex: "1" }}>{keys_factory.render(o_k).render()}</e-block>
                        {this.options.allow_key_type_change !== false &&
                          render_type_change_menu_button(o_k, this as Factory<CommonNodeOptions>)}
                      </e-flex>
                    )
                  })}
                </e-block>
                <e-block class={cls_object_value} style={{ flex: "1" }}>
                  {o_key.tf((key) =>
                    render_element_or_preview(safe_map_value(o_value, key), value_preview_text(key), values_factory),
                  )}
                </e-block>
                {allows_delete(this.options) &&
                  o_key.tf((key) => (
                    <button type="button" class={cls_row_remove} title="Remove entry">
                      {$on("click", () => remove_map_entry(o_value, key))}−
                    </button>
                  ))}
              </e-flex>
            ))}
            {VirtualScroll(o_transient_ids, (o_id) => {
              const id = o_id.get()
              const row = transient_rows.get(id)
              if (!row) return null
              return (
                <e-flex align="center" gap="widget">
                  <e-block class={cls_object_value}>{keys_factory.render(row.o_key).render()}</e-block>
                  <e-block class={cls_object_value} style={{ flex: "1" }}>
                    {render_element_or_preview(row.o_val, "new", values_factory)}
                  </e-block>
                </e-flex>
              )
            })}
          </e-block>
          {allows_insert(this.options) && (
            <button type="button" class={cls_add_key}>
              {$on("click", () => {
                const id = `t-${Date.now()}-${Math.random()}`
                const row = {
                  o_key: o(keys_factory.defaultValue()),
                  o_val: o(values_factory.defaultValue()),
                }
                transient_rows.set(id, row)
                row.o_key.addObserver(() => try_commit_transient(id))
                row.o_val.addObserver(() => try_commit_transient(id))
                o_transient_ids.set([...o_transient_ids.get(), id])
              })}
              + Add entry
            </button>
          )}
        </e-flex>
      ),
      o_error: no_error,
    }
  }
}

export function map(opts: MapOptions) {
  return new MapFactory(opts)
}

export class EitherFactory extends Factory<EitherOptions> {
  readonly kind = "either"

  override canHandle(value: unknown): boolean {
    return this.options.options.some((f) => f.canHandle(value))
  }

  override canConvert(value: unknown): boolean {
    return this.options.options.some((f) => f.canConvert(value))
  }

  override convert(value: unknown): unknown {
    const branch = this.options.options.find((f) => f.canConvert(value))
    if (!branch) return super.convert(value) // throws -- canConvert() should have been checked first
    return branch.convert(value)
  }

  override defaultValue(): unknown {
    return this.options.options[0]?.defaultValue() ?? null
  }

  // Automatic (reactive) resolution: which branch already fits the CURRENT
  // value -- no conversion, no write. First canHandle match wins; nothing
  // fits -> `unrepresentable_factory`, a read-only placeholder, never a
  // silent defaultValue() write. canConvert/convert are ONLY ever run from
  // the explicit, user-initiated type-change menu (elsewhere) -- never here,
  // since this reacts to external writes too (undo, import, outside
  // observers) and must not mutate data as a side effect of reacting.
  resolve(value: unknown): Factory<unknown> {
    return this.options.options.find((f) => f.canHandle(value)) ?? unrepresentable_factory
  }

  render(o_value: o.Observable<unknown>): RenderableWidget {
    // Per-mount state: which branch is currently active. Lives in this
    // closure, NOT on `this` -- this EitherFactory instance is shared across
    // every cell/row that resolves to a union (e.g. every element of an
    // `array({ values: anything })`), so per-mount state on `this` would
    // leak between rows.
    const o_current_widget = o<RenderableWidget>(null_widget)
    let current_branch: Factory<unknown> | null = null

    const node = (
      <e-flex>
        {$observe(o_value, (val, old) => {
          if (old !== o.NoValue && current_branch && is_same_type(val, old)) {
            return // same branch keeps handling the update, no recreate
          }
          const branch = this.resolve(val)
          current_branch = branch
          o_current_widget.set(branch.render(o_value))
        })}
        {o_current_widget.tf((w) => w.render())}
      </e-flex>
    )

    return {
      render: () => node,
      // Follows the current branch's own o_error through the swap above --
      // `.p("o_error")` derives the (observable) o_error field of whatever
      // widget is currently set, and `o.proxy` then follows THAT observable,
      // so this stays correct across branch changes without extra wiring.
      o_error: o.proxy(o_current_widget.p("o_error")) as o.ReadonlyObservable<string | null>,
    }
  }
}

export function either(...factories: Factory<unknown>[]) {
  return new EitherFactory({ options: factories })
}

// Recursion (self-referencing schemas, e.g. "anything" nested inside itself):
// lazily resolves `fn()` on first use and forwards every call to the result.
// Needed because `anything` can't reference itself while it's still being
// constructed.
class ForwardFactory<O> extends Factory<O> {
  readonly kind = "forward"
  private resolved: Factory<O> | null = null

  constructor(private fn: () => Factory<O>) {
    // No options of its own -- everything delegates to the resolved factory.
    super(undefined as unknown as O)
  }

  private resolve(): Factory<O> {
    return (this.resolved ??= this.fn())
  }

  render(o_value: o.Observable<unknown>): RenderableWidget {
    return this.resolve().render(o_value)
  }

  override canHandle(value: unknown): boolean {
    return this.resolve().canHandle(value)
  }

  override canConvert(value: unknown): boolean {
    return this.resolve().canConvert(value)
  }

  override convert(value: unknown): unknown {
    return this.resolve().convert(value)
  }

  override defaultValue(): unknown {
    return this.resolve().defaultValue()
  }

  override extend(partial: Partial<O>): this {
    return this.resolve().extend(partial) as this
  }
}

export function forward<O>(fn: () => Factory<O>): Factory<O> {
  return new ForwardFactory(fn)
}

/////////////////////////////////////////////////////////////////
// Default unknown-mode schema (Layer 5): heuristic kinds (color, date) are
// listed before plain string/number so their `canHandle` pattern checks get
// first refusal; composites before scalars. Map/Set are recognized here so an
// existing Map/Set value still resolves correctly in unknown mode -- they are
// NOT offered as type-change *targets* in unknown mode (Layer 5 "Type-change
// targets (unknown mode)"), only as the widget for a value that already is one.

const any_rec = forward<unknown>(() => anything)

export const anything: Factory<unknown> = either(
  object({ properties: [] }),
  array({ values: any_rec }),
  map({ keys: any_rec, values: any_rec }),
  set({ values: any_rec }),
  color(),
  date({ date: true, time: true, nullable: true }),
  boolean(),
  number(),
  string(),
  null_factory,
)

register_unknown_type_change_catalog(() => [
  null_factory,
  string(),
  number(),
  boolean(),
  object({ properties: [] }),
  array({ values: anything }),
])

resolve_unknown_value = (value) => (anything as EitherFactory).resolve(value)

register_constructor(Object, object({ properties: [] }))
register_constructor(Array, array({ values: any_rec }))
register_constructor(Map, map({ keys: any_rec, values: any_rec }))
register_constructor(Set, set({ values: any_rec }))
register_constructor(Date, date({ date: true, time: true, nullable: true }))
