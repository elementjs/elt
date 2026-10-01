/*
Composite grid (Layer 3): every composite (Object, Array, Set, Map, Table) is one packed, bordered
`e-grid`, one `e-grid-row` per entry, whose cells are the widgets' own elements (Layer 4 "a widget
renders one element: its cell"). The packed border draws the seams; cells take no border of their
own (see "Grids" in docs/md/ui-layout.md).

Column widths: the grid first lays out as its content wants (each track's `initial` template), then
each track is locked to the width it got, as soon as the grid has a body row and a size
(`observe_layout`, shared with the `<table>` freeze of `$resizable`). Rows come
and go as the list scrolls (RepeatVirtual); a locked width never follows them. A track that appears
later (a new table column) is locked the same way on the next layout.
*/

import { $connected, $disconnected, $on, css, If, o, RepeatVirtual, type Renderable } from "elt"
import { theme } from "elt/ui"
import { observe_layout } from "./table-resize"

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
 * The scroll area and grid of a composite. Entries then transient rows are one RepeatVirtual: a
 * scroll area holds a single one, and transient rows must sit after the list's true end, not after
 * the rows currently rendered.
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

  // Grid width beyond its tracks (seams, outer border), measured once at the first lock: with it, the
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

  return (
    <e-virtual-scroll class={cls_grid_scroll}>
      <e-grid
        packed="widget"
        border
        align="stretch"
        class={cls_grid}
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
        {RepeatVirtual(o_rows, (o_row) =>
          If(
            o_row.tf((row) => "entry" in row),
            () => props.render_entry(o_row.tf((row) => (row as { entry: K }).entry)),
            () => o_row.tf((row) => render_transient((row as { transient: string }).transient)),
          ),
        ).withKeyFunction((row) =>
          // A symbol per transient id can't be equal to any entry key, whatever its type.
          "entry" in row ? row.entry : Symbol.for(`object-editor:transient:${row.transient}`),
        )}
      </e-grid>
    </e-virtual-scroll>
  ) as HTMLElement
}

/** The text cell of a grid's label column (a key, an index): ellipsis when it's wider than the column. */
export function render_label_cell(text: o.RO<string>): Renderable<HTMLElement> {
  return (
    <span class={cls_text_fill} title={text}>
      {text}
    </span>
  ) as HTMLElement
}

export interface RowControl {
  label: string
  title: string
  on_click: () => void
}

/**
 * The row-controls cell. `slots` has one entry per control the composite can show; `null` where
 * this row doesn't have it, which keeps an invisible placeholder of the same size: every row's cell
 * is then as wide, and so is the column, whatever rows are rendered.
 */
export function render_row_controls(slots: (RowControl | null)[]): Renderable<HTMLElement> {
  return (
    <e-row align="center">
      {slots.map((slot) =>
        slot == null ? (
          <button type="button" e-variant="text" class={cls_row_control_placeholder} disabled>
            −
          </button>
        ) : (
          <button type="button" e-variant="text" title={slot.title} aria-label={slot.title}>
            {$on("click", slot.on_click)}
            {slot.label}
          </button>
        ),
      )}
    </e-row>
  ) as HTMLElement
}

/** Template of the label column before it locks: its content, capped (long keys get `…`). */
export const LABEL_TRACK = "fit-content(16em)"

/* Custom CSS: a scroll area needs a bounded height to scroll; no layout attribute gives one. It also
   takes the column's free height, from its content's height up (\`grow\` would start from 0 and
   collapse it in a column of no set height), so no seam color shows under a short grid. */
const cls_grid_scroll = css`.oe-grid-scroll {
  max-height: 24em;
  flex-grow: 1;
}`

/* Custom CSS: every cell the same font size and line height, form controls included (they set their
   own), on top of the same padding (packed="widget", the form controls' own padding): the first
   lines of all cells line up. Cells stretch to the row's height (align="stretch"): a shorter one
   would leave the seam color showing under it. */
const cls_grid = css`.oe-grid {
  & > e-grid-row > * {
    font-size: ${theme.settings.formFontSize};
    line-height: 1.5;
  }
}`

/**
 * Custom CSS, shared by the editor: text that takes the free space of its line and truncates with
 * `…` (a header label, a key, a preview, the filter field). `elt/ui` has no truncation attribute.
 */
export const cls_text_fill = css`.oe-text-fill {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  /* Start-aligned even inside a button, whose own text is centered. */
  text-align: start;
}`

/* Custom CSS: an absent control keeps its size (see render_row_controls); `hidden` would drop it. */
const cls_row_control_placeholder = css`.oe-row-control-placeholder {
  visibility: hidden;
}`
