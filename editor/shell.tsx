/*
Shell draft -- Layer 1b / Layer 2 of ui-object-editor.md, scoped to a first
implementation slice. Implements:

- the open contract (`elt-object-editor-open`, `$on`, `target` not
  `currentTarget` -- Layer 1b "Asking to open (DOM)" / "Editor shell")
- the column stack: ordered hosts, truncate-from-source-column-on-open,
  breadcrumb from column titles (Layer 1b "Display path, breadcrumbs")
- dead-column detection: each column watches its own `o_value`, closes
  itself + everything right of it on a `canHandle` failure, except the
  root, which re-resolves in place (Layer 1b "Invalid parent / external
  writes", "Dead-column detection (v1)")

The column stack is real state (`o_columns: o.Observable<ColumnDescriptor[]>`)
rendered by `Repeat`, not a manually tracked array paired with
`node_append`/`node_remove` calls -- opening/closing just replaces the array
(default reference-identity keying means untouched columns aren't
re-rendered, only the tail actually added/removed changes). Each column's own
content swap (dead-column recovery) is a `.tf()` off that column's own
`o_factory`, not a manual `node_clear` + re-render -- see
`docs/using-elt-agent.md` Hard rule 9.

Deliberately NOT here yet (see specs/TODO.md and ui-object-editor.md Scope):
- popups (`open_as` isn't modeled on `Options` yet -- everything opens as a
  column for now)
- shell toolbar: undo/redo, import/export, host application slots
- the constructor registry driving schema resolution for opened columns
  whose dispatcher didn't supply one (Layer 5 "Resolution" step 3, resolving
  from a value's runtime type/constructor with no schema at all). A
  dispatcher that already knows its child's factory (ObjectFactory's own
  composite-property preview button, schema.tsx) passes it through
  `ObjectEditorOpenDetail.factory` instead -- the shell prefers that when
  present, and only falls back to unknown mode (`anything`) when it's
  omitted. The registry is still needed for the omitted case (e.g. a future
  Array/Set/Map's own preview buttons, or unknown-mode drilling).
- INVALID_MOUNT: no composite in this slice mints child observables via the
  safe-child helper yet (Layer 1b), so dead-column detection's clause (a)
  is a no-op here -- only clause (b) (`canHandle`) can currently fire.
*/

import { $observe, $on, css, o, Repeat, type Renderable } from "elt"
import { anything, dispatch_object_editor_open, type Factory, type ObjectEditorOpenDetail } from "./schema"

export { dispatch_object_editor_open, type ObjectEditorOpenDetail }

interface ColumnDescriptor {
  o_value: o.Observable<unknown>
  // The resolved factory for this column, as an Observable: dead-column
  // recovery (render_column, below) sets a new one and lets `.tf()`
  // re-render reactively, instead of a manual node_clear + re-render.
  o_factory: o.Observable<Factory<unknown>>
  // Column header label -- optional (the root's own column has none by
  // default: "root" isn't meaningful chrome). The header bar itself always
  // renders regardless, for consistent height and as the future toolbar
  // slot (Layer 2).
  title: string | undefined
  // Set once by render_column (a self-referencing closure, same trick as
  // the close button below) -- used only by index_of_column_containing's
  // DOM hit-testing. Rendering/mounting itself is Repeat's job, not this
  // field's.
  host?: HTMLElement
}

export interface ShellOptions {
  // Root schema; defaults to unknown mode (Layer 5 `anything`).
  schema?: Factory<unknown>
}

export class ObjectEditorShell {
  readonly node: HTMLElement
  private readonly o_columns = o<ColumnDescriptor[]>([])
  // Titles of every open column right of the root, in order -- derived, not
  // separately maintained: reading `o_columns` is the single source of
  // truth. The shell itself doesn't render a breadcrumb bar from this
  // (redundant with each column's own header) -- it's here for a host app
  // that wants to build its own breadcrumb UI, and for tests.
  readonly o_breadcrumb: o.ReadonlyObservable<string[]>

  constructor(
    private readonly o_root: o.Observable<unknown>,
    private readonly options: ShellOptions = {},
  ) {
    this.o_breadcrumb = this.o_columns.tf((cols) => cols.slice(1).map((c) => c.title ?? ""))

    this.node = (
      <e-flex column class={cls_shell}>
        {$on("elt-object-editor-open", (ev) => {
          // Real DOM + bubbling (Layer 1b "Why"): stop it here so a shell
          // nested inside another one (not a v1 concern, but cheap to get
          // right) doesn't also react.
          ev.stopPropagation()
          this.open(ev.detail.o_value, ev.detail.title, ev.target as Node, ev.detail.factory)
        })}
        <e-flex class={cls_strip}>{Repeat(this.o_columns, (o_col, o_idx) => this.render_column(o_col, o_idx))}</e-flex>
      </e-flex>
    ) as HTMLElement

    // No title for the root's own column -- see ColumnDescriptor.title.
    this.o_columns.set([this.create_column(this.o_root, undefined, this.options.schema ?? anything)])
  }

  private create_column(o_value: o.Observable<unknown>, title: string | undefined, factory: Factory<unknown>): ColumnDescriptor {
    return { o_value, title, o_factory: o(factory) }
  }

  /** Layer 1b "Column truncation": DOM only locates the source column; the array is the source of truth. */
  private index_of_column_containing(source: Node): number {
    const cols = this.o_columns.get()
    for (let i = cols.length - 1; i >= 0; i--) {
      if (cols[i]?.host?.contains(source)) return i
    }
    return -1
  }

  /** Layer 1b "Editor shell": open from inside a non-rightmost column truncates right of it; from the rightmost, appends. */
  open(o_value: o.Observable<unknown>, title: string, source: Node, factory?: Factory<unknown>) {
    const found = this.index_of_column_containing(source)
    // A source outside every column (e.g. a host-application control that
    // isn't itself part of a mounted widget) opens after the root, same as
    // opening from it -- root is never truncated by this path, only what's
    // deeper than it.
    const idx = found === -1 ? 0 : found
    const kept = this.o_columns.get().slice(0, idx + 1)
    // The dispatching widget's own factory when it supplied one (e.g.
    // ObjectFactory's preview button knows the property's declared schema),
    // else unknown mode -- see ObjectEditorOpenDetail.factory (schema.tsx).
    // The constructor-registry gap (Layer 5 "Resolution" step 3, resolving
    // from a value's runtime type/constructor with no schema at all) is
    // separate and still not built.
    this.o_columns.set([...kept, this.create_column(o_value, title, factory ?? anything)])
  }

  private close_after(idx: number) {
    this.o_columns.set(this.o_columns.get().slice(0, idx + 1))
  }

  private render_column(o_column: o.Observable<ColumnDescriptor>, o_idx: o.IReadonlyObservable<number>): Renderable<Node> {
    // Read once: this column's index never changes for its own lifetime
    // (columns only ever close as a contiguous suffix, from the right, so
    // anything still mounted to the left of a closed range keeps its index)
    // -- same for the descriptor itself, since `open`/`close_after` only
    // ever append or truncate the array, never replace a retained entry.
    const column = o_column.get()
    const idx = o_idx.get()
    const is_root = idx === 0

    const host = (
      <e-flex column class={cls_column}>
        {$observe(column.o_value, (value, old) => {
          if (old === o.NoValue) return // initial connect, not a change
          if (column.o_factory.get().canHandle(value)) return
          if (is_root) {
            // Root special case (Layer 1b): no parent slot to go missing,
            // so only a resolved-kind change can fire here -- re-resolve
            // instead of closing. Re-resolving to the SAME fixed schema
            // would be a no-op (it just failed canHandle on this very
            // value), so fall back to unknown mode when the schema can't
            // represent the new value -- Layer 1b: "the shell keeps one
            // root column showing the matching scalar widget."
            const schema = this.options.schema
            column.o_factory.set(schema?.canHandle(value) ? schema : anything)
          } else {
            this.close_after(idx - 1)
          }
        })}
        <e-flex full-width justify="space-between" align="center" pad="small" class={cls_column_header}>
          {column.title != null && <span>{column.title}</span>}
          {!is_root && (
            <button type="button" class={cls_column_close}>
              {$on("click", () => this.close_after(idx - 1))}×
            </button>
          )}
        </e-flex>
        <e-flex column gap="small" pad="small">
          {column.o_factory.tf((factory) => factory.render(column.o_value).render())}
        </e-flex>
      </e-flex>
    ) as HTMLElement

    column.host = host
    return host
  }
}

// `css` inserts one rule per call (rewriting the leading class to a unique
// generated name) -- one call per class, kept js-side via these consts
// rather than hardcoded class strings in the JSX above.
const cls_shell = css`.oe-shell {
  border: 1px solid var(--e-color-text-light, #ccc);
  border-radius: 4px;
  overflow: hidden;
}`

const cls_strip = css`.oe-strip {
  overflow-x: auto;
  align-items: stretch;
}`

const cls_column = css`.oe-column {
  min-width: 260px;
  border-right: 1px solid var(--e-color-text-light, #ccc);
  flex: none;
}`

// Fixed height regardless of content (a bare title vs. title + close
// button) so every column's header bar lines up across the strip -- not
// just left-aligned but bottom-edge-aligned too.
const cls_column_header = css`.oe-column-header {
  min-height: 1.8em;
  background: var(--e-color-tint, #eee);
  font-weight: bold;
}`

const cls_column_close = css`.oe-column-close {
  border: none;
  background: none;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  padding: 0;
  width: 1.4em;
  height: 1.4em;
}`
