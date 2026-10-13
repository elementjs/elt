/*
Composite grid (Layer 3): every composite (Object, Array, Set, Map, Table) is one `e-grid`, one
`e-grid-row` per entry, whose cells are the widgets' own elements (Layer 4 "a widget renders one
element: its cell"). Packed, the grid is bordered and draws the lines between its rows and cells (`seams`, default
mode); cells take no border of their own (see "Grids" in docs/md/ui-layout.md). Unpacked, the rows are plain, aligned on the
baseline of their first line, and each widget keeps its own border.

Column widths: the grid first lays out as its content wants (each track's `initial` template), then
each track is locked to the width it got, as soon as the grid has a body row and a size
(`observe_layout` of elt/ui, also used by `$resizable`). Rows come
and go as the list scrolls (RepeatVirtual); a locked width never follows them. A track that appears
later (a new table column) is locked the same way on the next layout.
*/

import { $connected, $disconnected, css, If, o, Repeat, RepeatVirtual, type Renderable } from "elt"
import { observe_layout } from "elt/ui"

export interface GridTrack {
  /** Stable id of the track ("label", "value", a table column's key…): widths are kept by id. */
  id: string
  /**
   * Template used until the track is locked: `fit-content(16em)` (a label), `max-content` (fixed-size
   * content: controls, an index), or `auto` for the fill track only -- `auto` tracks share the grid's
   * leftover width, and would be locked at that width rather than their content's.
   */
  initial: string
  /**
   * Once locked, also takes the width left over by the other tracks (`minmax(<locked>, 1fr)`), so
   * the grid always fills its column. One per grid: its last value track.
   */
  fill?: boolean
}

/** Locked widths in px, by track id. Shared with the table's resize handles. */
export type GridWidths = Record<string, number>

/** A row of a composite grid: an existing entry (by its key), or a transient row, not committed yet. */
type GridRow<K> = { entry: K } | { transient: string }

export interface CompositeGridProps<K> {
  /**
   * Rows are one RepeatVirtual in a scroll area (default), or all rendered by a plain Repeat in a
   * grid that doesn't scroll. The second is for a list whose size is bounded by a schema (an
   * object's declared properties): a scroll area clips the focus ring of a cell at its edge even
   * when nothing overflows, and a short list has no use for windowing.
   */
  virtual?: boolean
  /** Cells touching in one bordered group with seams, or plain rows spaced by elt/ui (the form look). */
  packed: boolean
  o_tracks: o.RO<GridTrack[]>
  o_keys: o.RO<K[]>
  o_transient_ids?: o.RO<string[]>
  /** Each renders one `<e-grid-row>`, one cell per track. */
  render_entry: (o_key: o.ReadonlyObservable<K>) => Renderable<HTMLElement>
  render_transient?: (id: string) => Renderable<HTMLElement>
  /** Sticky header row (Table), rendered before the rows. */
  head?: Renderable
  /** Pass to share the locked widths with something else (the table's resize handles). */
  o_widths?: o.Observable<GridWidths>
}

const no_transients = o<string[]>([])

/**
 * The scroll area and grid of a composite (the grid alone when `virtual` is false). Entries then
 * transient rows are one RepeatVirtual: a scroll area holds a single one, and transient rows must sit
 * after the list's true end, not after the rows currently rendered.
 *
 * A row's node can be re-keyed for another row (see Repeat), so whether it shows an entry or a
 * transient row, and which one, is observed rather than read once.
 */
export function render_composite_grid<K>(props: CompositeGridProps<K>): HTMLElement {
  const o_tracks = o(props.o_tracks)
  const o_widths = props.o_widths ?? o<GridWidths>({})
  const o_keys = o(props.o_keys)
  const o_transient_ids = o(props.o_transient_ids ?? no_transients)
  const render_transient = props.render_transient ?? (() => null)

  // Grid width beyond its tracks (lines, outer border), measured once at the first lock: with it, the
  // grid's min-width follows resized tracks without measuring again.
  const o_extra = o<number | null>(null)

  const o_template = o.expression((get) => {
    const widths = get(o_widths)
    return get(o_tracks)
      .map((t) => {
        const px = widths[t.id]
        if (px == null) return t.initial
        return t.fill ? `minmax(${px}px, 1fr)` : `${px}px`
      })
      .join(" ")
  })

  // Once locked, the grid's own width no longer comes from its cells (`contain: inline-size`), only
  // from the locked tracks (`min-width`). Without it, the fill track's content would still widen the
  // column it sits in whenever a wider row scrolls in.
  const o_min_width = o.expression((get) => {
    const extra = get(o_extra)
    if (extra == null) return ""
    const widths = get(o_widths)
    let sum = extra
    for (const t of get(o_tracks)) sum += widths[t.id] ?? 0
    return `${sum}px`
  })
  const o_contain = o_extra.tf((extra) => (extra == null ? "" : "inline-size"))

  const lock = (grid: HTMLElement) => {
    const tracks = o_tracks.get()
    const widths = o_widths.get()
    if (tracks.every((t) => widths[t.id] != null)) return
    // Nothing to measure but a header yet.
    if (grid.querySelector(":scope > e-grid-row:not([sticky])") == null) return
    // A grid container's computed template is its used track sizes, in px: one read for all tracks.
    const used = getComputedStyle(grid).gridTemplateColumns.split(" ").map(Number.parseFloat)
    if (used.length !== tracks.length) return // template not caught up with the track list yet
    const next = { ...widths }
    let sum = 0
    for (const [i, t] of tracks.entries()) {
      const px = used[i] ?? 0
      next[t.id] ??= px
      sum += px
    }
    if (o_extra.get() == null) o_extra.set(Math.max(0, grid.getBoundingClientRect().width - sum))
    o_widths.set(next)
  }

  // Locks on the first layout where the grid has a size and a body row; keeps watching, since rows
  // appearing in an empty grid or a new table column both change its size.
  let stop_observing: (() => void) | null = null

  const o_rows = o.expression((get): GridRow<K>[] => [
    ...get(o_keys).map((entry) => ({ entry })),
    ...get(o_transient_ids).map((transient) => ({ transient })),
  ])

  const render_row = (o_row: o.ReadonlyObservable<GridRow<K>>) =>
    If(
      o_row.tf((row) => "entry" in row),
      () => props.render_entry(o_row.tf((row) => (row as { entry: K }).entry)),
      () => o_row.tf((row) => render_transient((row as { transient: string }).transient)),
    )
  // A symbol per transient id can't be equal to any entry key, whatever its type.
  const key_of = (row: GridRow<K>) =>
    "entry" in row ? row.entry : Symbol.for(`object-editor:transient:${row.transient}`)
  const virtual = props.virtual !== false

  const grid = (
    <e-grid
      packed={props.packed ? "nudge-4" : undefined}
      border={props.packed}
      align={props.packed ? "stretch" : "baseline"}
      seam-color="neutral-separator"
      style={{ gridTemplateColumns: o_template, minWidth: o_min_width, contain: o_contain }}
    >
      {$connected((grid: HTMLElement) => {
        stop_observing ??= observe_layout(grid, () => lock(grid))
      })}
      {$disconnected(() => {
        stop_observing?.()
        stop_observing = null
      })}
      {props.head}
      {virtual
        ? RepeatVirtual(o_rows, render_row).withKeyFunction(key_of)
        : Repeat(o_rows, render_row).withKeyFunction(key_of)}
    </e-grid>
  ) as HTMLElement

  return virtual
    ? ((
        <e-column scroll align="stretch" class={cls_grid_scroll}>
          {grid}
        </e-column>
      ) as HTMLElement)
    : grid
}

/**
 * The cell of a grid's label column (an object's key, an index): a label (filled when the grid is
 * packed), with ellipsis when it's wider than the column. Not editable: a Map's keys, which are, are
 * ordinary cells.
 */
export function render_label_cell(text: o.RO<string>): Renderable<HTMLElement> {
  return (
    <span e-widget="label" e-ellipsis title={text}>
      {text}
    </span>
  ) as HTMLElement
}

/** Template of the label column before it locks: its content, capped (long keys get `…`). */
export const LABEL_TRACK = "fit-content(16em)"

/* Custom CSS: a scroll area needs a bounded height to scroll; no layout attribute gives one. It also
   takes the column's free height, from its content's height up (\`grow\` would start from 0 and
   collapse it in a column of no set height), so no empty space shows under a short grid. */
const cls_grid_scroll = css`.oe-grid-scroll {
  max-height: 24em;
  flex-grow: 1;
}`

/* Custom CSS, shared by the editor: text that starts its line even inside a button, whose own text is
   centered (the preview of a value, a menu item). elt/ui has no attribute for the text alignment of a
   button's content. Cutting a long text with "…" is `e-ellipsis`, not this. */
export const cls_start_text = css`.oe-start-text {
  text-align: start;
}`
