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

import { $observe, o, type Renderable } from "elt"
import "elt/ui"

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
      render: () => <e-box class="oe-error">{/* "unsupported value" */}</e-box>,
      o_error: no_error,
    }
  }
}

export const unrepresentable_factory = new UnrepresentableFactory({})

export interface EitherOptions {
  options: Factory<unknown>[]
}

export interface UndefinedOptions {}

export interface PropertyOption {
  name?: string | RegExp
  type: Factory<unknown>
  required?: boolean // defaults to true
}

export interface ObjectOptions {
  properties?: PropertyOption[]
}

export interface ArrayOptions {
  mode?: "auto" | "table" | "list" // defaults to "auto"
  values: Factory<unknown>

  allow_insert?: boolean
  allow_delete?: boolean
  allow_reorder?: boolean

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

export interface SetOptions {
  values: Factory<unknown>
  // Row identity for VirtualScroll (Layer 1b) -- unrelated to Set membership,
  // which is always checked by value equality via `Set.has`.
  key?: (item: unknown, index: number) => PropertyKey

  allow_insert?: boolean
  allow_delete?: boolean
  allow_reorder?: boolean
}

export interface MapOptions {
  // Separate from `values`: Map keys are edited with their own widget
  // (Layer 3 Map). A Map entry's own key is already a stable row identity
  // (Layer 1b), so there is no separate `key` field here.
  keys: Factory<unknown>
  values: Factory<unknown>

  allow_insert?: boolean
  allow_delete?: boolean
  allow_reorder?: boolean
}

export interface StringOptions {
  multiline?: boolean
}

export interface NumberOptions {
  maximumFractionDigits?: number
  max?: number
  min?: number
}

export interface BooleanOptions {}

export interface ColorOptions {}

export interface DatetimeOptions {
  time?: boolean
  date?: boolean
  nullable?: boolean // allows the control to clear the date, putting it to null
}

// Mirrors elt/ui's own Select<T, T2> (ui/select.tsx) rather than a fixed
// primitive union -- see Layer 4 "select options typing".
export interface SelectOptions<T, T2 = T> {
  options: T2[]
  convert_fn?: (opt: T2) => T
  label_fn?: (opt: T2) => Renderable
  // "developer" widgets (Layer 4): not in the default unknown catalog.
  allow_other?: boolean
  fill_from_table_column?: boolean
}

export type FactoryOptions<Fact> = Fact extends Factory<infer Opts> ? Opts : never

/////////////////////////////////////////////////////////////////
// Factory classes

export class NullFactory extends Factory<{}> {
  readonly kind = "null"

  canHandle(value: unknown): boolean {
    return value === null
  }

  defaultValue(): unknown {
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

  canHandle(value: unknown): boolean {
    return value === undefined
  }

  defaultValue(): unknown {
    return undefined
  }

  render(): RenderableWidget {
    return {
      render: () => <span>UNDEFINED</span>,
      o_error: no_error,
    }
  }
}

export class StringFactory extends Factory<StringOptions> {
  readonly kind = "string"

  canHandle(value: unknown): boolean {
    return typeof value === "string"
  }

  canConvert(value: unknown): boolean {
    return typeof value === "number" || typeof value === "boolean"
  }

  convert(value: unknown): unknown {
    return String(value)
  }

  defaultValue(): unknown {
    return ""
  }

  render(_o_value: o.Observable<unknown>): RenderableWidget {
    return {
      // TODO: $bind.string(o_value) into a <textarea> (multiline) or
      // single-line <input>, commit on blur/Enter -- see Layer 1 commit
      // timing and Layer 4's default string widget.
      render: () => (this.options.multiline ? <textarea /> : <input type="text" />),
      o_error: no_error,
    }
  }
}

export function string(opts: StringOptions = {}) {
  return new StringFactory(opts)
}

export class NumberFactory extends Factory<NumberOptions> {
  readonly kind = "number"

  canHandle(value: unknown): boolean {
    return typeof value === "number"
  }

  canConvert(value: unknown): boolean {
    if (typeof value === "boolean") return true
    return typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))
  }

  convert(value: unknown): unknown {
    return Number(value)
  }

  defaultValue(): unknown {
    return 0
  }

  render(_o_value: o.Observable<unknown>): RenderableWidget {
    return {
      // TODO: $bind.number(o_value), commit on blur/Enter, honor
      // min/max/maximumFractionDigits -- see Layer 4 default number widget.
      render: () => <input type="number" min={this.options.min} max={this.options.max} />,
      o_error: no_error,
    }
  }
}

export function number(opts: NumberOptions = {}) {
  return new NumberFactory(opts)
}

export class BooleanFactory extends Factory<BooleanOptions> {
  readonly kind = "boolean"

  canHandle(value: unknown): boolean {
    return typeof value === "boolean"
  }

  canConvert(value: unknown): boolean {
    return typeof value === "number" || value === "true" || value === "false"
  }

  convert(value: unknown): unknown {
    if (typeof value === "number") return value !== 0
    return value === "true"
  }

  defaultValue(): unknown {
    return false
  }

  render(_o_value: o.Observable<unknown>): RenderableWidget {
    return {
      // TODO: elt/ui switch bound to o_value, commits immediately (not
      // staged like scalars with a text-entry commit step).
      render: () => <input type="checkbox" />,
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
  canHandle(value: unknown): boolean {
    return typeof value === "string" && /^(#[0-9a-fA-F]{3,8}|rgba?\(.*\))$/.test(value)
  }

  defaultValue(): unknown {
    return "#000000"
  }

  render(_o_value: o.Observable<unknown>): RenderableWidget {
    return {
      // TODO: mount elt/ui's new color control once specs/ui-color-picker.md
      // settles (component shape/name still under discussion there) --
      // $bind.string(o_value) into it, commit on change.
      render: () => <e-box>{/* elt/ui color control goes here */}</e-box>,
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

  canHandle(value: unknown): boolean {
    const convert = this.options.convert_fn ?? ((opt: T2) => opt as unknown as T)
    return this.options.options.some((opt) => convert(opt) === value)
  }

  defaultValue(): unknown {
    const convert = this.options.convert_fn ?? ((opt: T2) => opt as unknown as T)
    return this.options.options.length > 0 ? convert(this.options.options[0]) : null
  }

  render(_o_value: o.Observable<unknown>): RenderableWidget {
    return {
      // TODO: elt/ui's Select<T, T2> (ui/select.tsx), passed this.options
      // directly -- it already has the matching shape (options/convert_fn/label_fn).
      render: () => <button type="button" />,
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
  canHandle(value: unknown): boolean {
    return value instanceof Date || (typeof value === "string" && ISO_8601.test(value))
  }

  // Looser than canHandle on purpose: canHandle gates the unknown-mode
  // heuristic (deliberately tight, Layer 4), canConvert gates the explicit
  // type-change menu where the user already asked for a date and a wider net
  // (any Date.parse()-able string, or a timestamp number) is the more useful
  // default.
  canConvert(value: unknown): boolean {
    if (typeof value === "number") return true
    return typeof value === "string" && !Number.isNaN(Date.parse(value))
  }

  convert(value: unknown): unknown {
    return new Date(value as string | number)
  }

  defaultValue(): unknown {
    return this.options.nullable ? null : new Date()
  }

  render(_o_value: o.Observable<unknown>): RenderableWidget {
    const input_type = this.options.date && this.options.time ? "datetime-local" : this.options.time ? "time" : "date"
    return {
      // TODO: $bind between Date <-> input's string value, commit on change,
      // honor `nullable` (clear button) -- see Layer 4 date/time widget.
      render: () => <input type={input_type} />,
      o_error: no_error,
    }
  }
}

export function date(opts: DatetimeOptions = { date: true }) {
  return new DateFactory(opts)
}

export class ObjectFactory extends Factory<ObjectOptions> {
  readonly kind = "object"

  canHandle(value: unknown): boolean {
    return typeof value === "object" && value !== null && !Array.isArray(value)
  }

  canConvert(value: unknown): boolean {
    return Array.isArray(value) || value instanceof Map || value instanceof Set
  }

  convert(value: unknown): unknown {
    if (value instanceof Map) return Object.fromEntries(value.entries())
    const arr = Array.isArray(value) ? value : [...(value as Set<unknown>)]
    return Object.fromEntries(arr.map((v, i) => [String(i), v]))
  }

  defaultValue(): unknown {
    return {}
  }

  render(_o_value: o.Observable<unknown>): RenderableWidget {
    return {
      // TODO: one row per `this.options.properties` (schema mode) or per
      // Object.keys (unknown mode), key editable per Layer 3 Object rules,
      // aggregate children's o_error -- see Layer 3 -- Object.
      render: () => <e-flex column>{/* rows go here */}</e-flex>,
      o_error: no_error,
    }
  }

  // Merge property lists by name (string names only -- a RegExp-named
  // catch-all entry has no merge key and is simply appended) instead of
  // replacing the whole list, so `.extend({ properties: [...] })` can add or
  // override individual fields.
  extend(partial: Partial<ObjectOptions>): this {
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

export function object(opts: ObjectOptions = { properties: [] }) {
  return new ObjectFactory(opts)
}

export class ArrayFactory extends Factory<ArrayOptions> {
  readonly kind = "array"

  canHandle(value: unknown): boolean {
    return Array.isArray(value)
  }

  canConvert(value: unknown): boolean {
    return is_plain_object(value) || value instanceof Map || value instanceof Set
  }

  convert(value: unknown): unknown {
    if (value instanceof Map) return [...value.values()]
    if (value instanceof Set) return [...value]
    return Object.values(value as object)
  }

  defaultValue(): unknown {
    return []
  }

  render(o_value: o.Observable<unknown>): RenderableWidget {
    const o_show_table =
      this.options.mode === "table" ? o(true)
      : this.options.mode === "list" ? o(false)
      : o_value.tf((value) => this.eval_auto_table(value))

    return {
      // TODO: If(o_show_table, table_view, list_view), VirtualScroll rows,
      // aggregate children's o_error -- see Layer 3 Array/Table.
      render: () => <e-flex>{o_show_table.tf(() => null) /* table_view() / list_view() */}</e-flex>,
      o_error: no_error,
    }
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

  canHandle(value: unknown): boolean {
    return value instanceof Set
  }

  canConvert(value: unknown): boolean {
    return Array.isArray(value) || is_plain_object(value)
  }

  convert(value: unknown): unknown {
    return new Set(Array.isArray(value) ? value : Object.values(value as object))
  }

  defaultValue(): unknown {
    return new Set()
  }

  render(_o_value: o.Observable<unknown>): RenderableWidget {
    return {
      // TODO: list presentation like Array (Layer 3 Set), through the Set <->
      // array projection (Layer 1b "Set (and similar projections)") -- VirtualScroll
      // over projected rows, insert/reorder/dedupe write back into the Set.
      render: () => <e-flex>{/* rows go here */}</e-flex>,
      o_error: no_error,
    }
  }
}

export function set(opts: SetOptions) {
  return new SetFactory(opts)
}

export class MapFactory extends Factory<MapOptions> {
  readonly kind = "map"

  canHandle(value: unknown): boolean {
    return value instanceof Map
  }

  canConvert(value: unknown): boolean {
    return Array.isArray(value) || is_plain_object(value)
  }

  convert(value: unknown): unknown {
    if (Array.isArray(value)) return new Map(value.map((v, i) => [i, v]))
    return new Map(Object.entries(value as object))
  }

  defaultValue(): unknown {
    return new Map()
  }

  render(_o_value: o.Observable<unknown>): RenderableWidget {
    return {
      // TODO: like Object, but keys are also widgets (Layer 3 Map), through
      // the Map <-> entries projection (Layer 1b). Duplicate-key rejection
      // via `map.has(new_key)` on key-widget commit.
      render: () => <e-flex column>{/* rows go here */}</e-flex>,
      o_error: no_error,
    }
  }
}

export function map(opts: MapOptions) {
  return new MapFactory(opts)
}

export class EitherFactory extends Factory<EitherOptions> {
  readonly kind = "either"

  canHandle(value: unknown): boolean {
    return this.options.options.some((f) => f.canHandle(value))
  }

  canConvert(value: unknown): boolean {
    return this.options.options.some((f) => f.canConvert(value))
  }

  convert(value: unknown): unknown {
    const branch = this.options.options.find((f) => f.canConvert(value))
    if (!branch) return super.convert(value) // throws -- canConvert() should have been checked first
    return branch.convert(value)
  }

  defaultValue(): unknown {
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

  canHandle(value: unknown): boolean {
    return this.resolve().canHandle(value)
  }

  canConvert(value: unknown): boolean {
    return this.resolve().canConvert(value)
  }

  convert(value: unknown): unknown {
    return this.resolve().convert(value)
  }

  defaultValue(): unknown {
    return this.resolve().defaultValue()
  }

  extend(partial: Partial<O>): this {
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
