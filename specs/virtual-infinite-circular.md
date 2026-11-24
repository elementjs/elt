# Infinite scrolling, horizontal and circular virtual lists, wheel time picker — implementation spec

Decided in a grilling session on 2026-11-24. Temporary: each part moves into `docs/md/` (`verbs.md`, `ui-widgets.md`, `CHANGELOG.md`, `migrating.md` where behavior changes) and into the maintainer notes at the top of `src/virtual.ts` as it lands; the file is deleted once everything is done. Check items off as they land.

Order: one commit per section, each with its regression tests and docs. Each section depends on the ones before it.

## 1. `InitialPosition` / `setPosition` land on the row (bug)

Today neither scrolls: `setPosition` sets the window and the top padder but never writes `scrollTop`, so the scroll area shows the blank top padder, the next pass estimates index 0 from the scroll offset and repositions there. Checked in Chromium: 1000 rows of 64px, `InitialPosition(500)` then `setPosition(800)` both end with `scrollTop: 0`, first visible row `item-0`. No test covers it, and the docs say `InitialPosition` is "the row shown first".

- [x] `setPosition(n)` renders the window around `n`, measures row `n`, and writes `scrollTop` once so that row `n` is at the top of the visible area. Update `scroll_last_top` after the write, or `on_scroll` takes it for a jump and repositions from an estimate.
- [x] Negative indices count from the end, for both `InitialPosition` and `setPosition`: `InitialPosition(-1)` opens on the last row (a chat opened on its newest message).
- [x] Maintainer notes: the "never write `scrollTop`" rule gets its exceptions listed, each a single write outside any windowing pass: an explicit jump (here), a prepend (section 3), a ring's recentring (section 5).
- [x] Tests: `InitialPosition(k)` and `setPosition(k)` show row `k` first, for a positive and a negative `k`, with rows of varying heights.
- Landed with these choices: the default position (0, never asked for) doesn't scroll, so what comes before the list in the scroll area (a sticky header) stays shown; an explicit jump leaves the scroll area's `scroll-padding-top` uncovered (where a sticky header declares its room). The scroll is written in a microtask after the reposition: inside a transaction the rows and padders are only written at its end. The initial position also applies when the rows arrive after connection, or again after the list was empty.
- Out of scope: staying at the end while items are appended (a chat following its newest message). Possible follow-up.

## 2. A windowing base shared by `RepeatVirtual` and `RepeatCircular`, horizontal and right-to-left

- [x] Extract from `RepeatVirtual.Repeater` a base class holding what both verbs share: scroll area lookup, padders, the IntersectionObserver and ResizeObserver, measurement, anchoring through the start padder, the windowing pass. What differs between a list with true ends and a ring stays in the subclasses (sections 3 and 5). No mode flags.
- [x] An axis object, chosen once at connection, abstracts every direction-dependent read and write: `top`/`bottom` ↔ `left`/`right` of bounding rects, `scrollTop` ↔ `scrollLeft`, `clientHeight` ↔ `clientWidth`, `overflow-y` ↔ `overflow-x` in the scroll area lookup, the `rootMargin` sides, the padder's `height` ↔ `width` and `grid-column: 1 / -1` ↔ `grid-row: 1 / -1`. No branching inside per-row loops.
- [x] `.Horizontal()` option selects the horizontal axis (explicit: a scroll area that scrolls both ways makes detection ambiguous). The scroll area is then the nearest ancestor whose `overflow-x` scrolls.
- [x] Right-to-left (`direction: rtl` on the scroll area) in horizontal mode: the list's start is on the physical right, so start/end comparisons flip, and `scrollLeft` is 0 at the start and negative towards the end. Handled inside the axis object (sign flip), read at connection. elt is app-agnostic: supported even though no current app needs it.
- [x] `itemAt(px)` on the base: the index of the row at `px` from the start of the visible area. Reads layout once; meant to be called when scrolling stops (a wheel's centre line, section 6), not on every scroll frame (the maintainer notes: nothing is measured while the user scrolls within the margins).
- [x] Tests: the existing `tests/virtual.pw.ts` behaviors also pass horizontally (windowing, anchoring while rows change size, jumps), and in horizontal right-to-left; `itemAt` returns the row under a given offset.
- [x] Docs: `verbs.md#repeatvirtual-a-long-list` gets `.Horizontal()`, `itemAt`.
- Landed as `VirtualWindow` in `src/virtual-window.ts` (not exported from `elt`; the maintainer notes moved there). Right-to-left is read from the `direction` of the rows' parent at connection. Horizontally outside a flex or grid container, the padders are `inline-block`.

## 3. `RepeatVirtual`: `.OnEndReached(fn)` / `.OnStartReached(fn)`, and prepends

Infinite scrolling: a feed loading pages as the user scrolls down, a chat or history opened at its end loading older items as the user scrolls up, a timeline opened in the middle loading both ways. Plain `Repeat` doesn't get it (a growing plain list is what `RepeatVirtual` replaces; a sentinel element after a `Repeat` does it for a short list). Keeping the data array bounded (dropping far pages) is the app's business: shrinking the array already works.

The callbacks:

- [x] `.OnEndReached(fn: () => unknown)` / `.OnStartReached(fn: () => unknown)`, PascalCase like the other options.
- [x] "Reached" means the rendered window touches the true end: `pos_end === count` (`pos_start === 0` for the start). The window extends `Threshold` pixels beyond the visible area, so this fires about `Threshold` before the user sees the end. Not a pixel distance: at the end the bottom padder is hidden, nothing would run a pass to measure it.
- [x] Each side has its own guard. If `fn` returns a Promise, the side doesn't fire again until it settles. Once settled (or at once without a Promise), it is checked again on the next pass: the list grew and the window still touches the end (a page too short to fill the visible area) → fire again. The list did not grow → that side stays off (the source is exhausted, or failing: don't hammer it) until the list changes or the window leaves that end and touches it again.
- [x] At connection, an empty list fires the only callback set, or `OnEndReached` alone when both are set (the first page is loaded once). This happens outside `real_eval`, which returns early on an empty list.
- [x] A non-empty first window touching both ends (a short first page) fires both.

Prepends (needed by `OnStartReached`): the window is index-based, so prepending `d` items makes it show other items, and `overflow-anchor: none` keeps the browser from compensating.

- [x] In `updateChildrenPre`, **before** the existing append branch (when the window touches the end, `pos_end === old.length` is true and the append branch would take a prepend for an append): with `d = new.length - old.length > 0`, a pure prepend is detected when the first rendered row's key is now at `new_lst[pos_start + d]`. One key computation, no scan.
- [x] On a pure prepend: shift both window ends by `d` (the reconcile then finds every rendered row in the common head and only rewrites indices), read the pinned row's position, write `scrollTop` once by its measured shift, update `scroll_last_top`. A `scrollTop` write is unavoidable: content above the pinned row grows, the start padder can't take a negative shift, and at `pos_start === 0` there is no padder at all.
- [x] Anything else (a prepend and an append in one update, a reorder, a replacement) keeps today's behavior.
- [ ] Check in WebKit (`just test-webkit`) that the write doesn't stop momentum scrolling, keeping in mind that this is not real iOS. Not done: WebKit doesn't launch on the development machine, and `just test-webkit` fails in Docker because `node_modules` links point outside the mounted folder. The new tests pass in Chromium and Firefox.
- [x] Tests: each side fires once when the window touches it; not again while its Promise is pending; again after a short page; not again after a page that added nothing, until the window leaves and comes back; the empty-list rules; a prepend while scrolled keeps the visible rows in place (rows of varying heights); a prepend at `pos_start === 0` too.
- [x] Docs: `verbs.md` gets an infinite scrolling example (a feed, and a chat opened with `InitialPosition(-1)` loading older items with `OnStartReached`).
- Landed with these additions, found while testing with rows of varying sizes:
  - A side rendered more than 1.5 × `Threshold` past the visible area is trimmed back to the threshold even when nothing grows (the append branch grows the window by a screenful: without the trim, the window kept touching the end and `OnEndReached` loaded the whole source with nothing scrolled). Only for a list reaching into the zone, never down to an empty window.
  - A data change no longer resets the measured start padder to `pos_start * estimate` (the visible rows jumped on every append when scrolled deep): the row pinned before the change is put back where it was, through the padder.
  - The start padder's estimate falling short is made up by the scroll: rows rendered before the pinned row larger than the padder, and the padder's leftover once the window reaches the list's start, where it hides (the view jumped by the estimate's error, which prepends made visible). Only when the pinned row is in view: a list entirely out of view would otherwise move another list sharing its scroll area.
  - On a prepend, the rendered rows' indices are shifted with the window before the reconciliation, which drops rows whose index is outside the window.

## 4. Index mapping hooks in the `Repeat` core

A ring shows `lst[mod(i, n)]` at absolute index `i`, and the same item may be rendered several times at once.

- [x] Overridable hooks in `Repeat.Repeater`, used by `updateChildren` and `resolve_view`: the item at an index (`item_at(lst, i)`), its key (`key_at(lst, i)`), the window's clamping (today `clamp_view` to `[0, length)`). `RepeatObservable` maps its absolute index to a data index for reads and writes (writing through `o_item`).
- [x] `just bench` before and after: these become method calls in plain `Repeat`'s hot loop, polymorphic across the class hierarchy. If plain `Repeat` regresses, come back to this decision (the alternative was a second copy of `updateChildren`).
- Landed as `clamp_view`, `item_at`, `data_index` and `render_index` on `Repeat.Repeater` (`key_at` came with section 3). `item_at` and `data_index` are public, since `RepeatObservable` calls them. Bench (`just bench`, the new `Repeat` cases in Chromium): no difference beyond run-to-run noise; to check again once `RepeatCircular` overrides them.

## 5. `RepeatCircular`

A separate verb on the base of section 2: a ring has no ends, so `PrefixBy`/`SuffixBy` and the end callbacks would mean nothing on it. Same requirements on rows as `RepeatVirtual`: any height, heights may change after render; any number of items; vertical or `.Horizontal()`.

- [x] Rows are keyed by absolute index (unique per occurrence). The render function receives the data index (`i mod n`) as its index.
- [x] The two padders are fixed runways of about 1,000,000 px each (below every browser's maximum element size), not estimates: a ring's scrollbar means nothing. When scrolling stops (`scrollend`, or a timer after the last `scroll` event where `scrollend` isn't supported — check Safari's support rather than trust memory), recentre: shift both padders and `scrollTop` by the same amount in one write, invisible, and never during momentum since a fling can't cross a runway.
- [x] Recentring keeps scroll snap alignment (section 6): the shift is exact, not estimated.
- [x] When the data changes, the anchor row keeps its item: its key still at the same data index → nothing moves; moved by exactly `d = new.length - old.length` (a pure prepend) → absolute indices shift to follow it; otherwise absolute indices stay and the content under the visible area changes. When `n` changes, `mod` remaps every row: the shift is computed so the anchor row keeps its item. No scan, as in section 3.
- [x] `InitialPosition(i)` / `setPosition(i)` take a data index (negative from the end); `setPosition` lands on the nearest occurrence.
- [x] An empty list shows `DisplayWhenEmpty`. `SeparateWith` puts a separator between every pair, the wrap seam included.
- [x] Tests: scrolls past the last item into the first and back; recentring while idle leaves the visible rows in place; rows changing height; `n` smaller than a screenful (the same item shown several times); data change keeps the anchor row; `setPosition` nearest occurrence; horizontal.
- [x] Docs: `verbs.md` gets a `RepeatCircular` section.
- Landed in `src/circular.ts`. `withKeyFunction` on a ring only identifies items across data changes (rows are keyed by index). Indices start around 2^40, so they stay positive. The initial position is always scrolled to (a ring has no first rows laid out before anything). A jump (a scroll farther than the visible area) moves the start padder by the estimated size of the rows it skipped. Recentring happens when the padder is more than a quarter of its runway off. Bench after it: no difference beyond noise.

## 6. Wheel time picker

`ScrollColumn` (`ui/timepicker.tsx`) is rewritten in place as a wheel: the ▲/▼ buttons, wheel stepping and touch drag go, native scrolling replaces them. Same options (`label`, `name`, `min`, `max`, `loop`, `step_size`, `format`, `value`, `on_change`). `TimePickerPanel` and `DateTimePicker` keep their attributes, plus `hour_step`.

- [ ] The value is the row on the column's centre line, with CSS scroll snap; rows above and below stay visible and faded. The value is committed when scrolling stops (`itemAt`, section 2). A click on a row scrolls it to the centre, which selects it.
- [ ] `loop: true` uses `RepeatCircular`; `loop: false` a plain `Repeat`. The AM/PM column is a two-row, non-looping column with the same look.
- [ ] Keyboard and assistive technology unchanged: one `spinbutton` per column, one Tab stop, `aria-valuenow`/`valuetext`/`min`/`max`; Up/Down step and scroll the wheel smoothly, PageUp/PageDown by 5 steps, Home/End.
- [ ] `hour_step` option on `DateTimePicker` and `TimePickerPanel`, like `minute_step`/`second_step`, also driving Up/Down on the hour part of the text field. It applies on the 24-hour grid; in 12-hour mode the hour column shows the 12-hour values of that grid, the same for both periods.
- [ ] Steps limited to divisors, so every column is a regular ring: `hour_step` in {1, 2, 3, 4, 6, 12}, `minute_step`/`second_step` in {1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30}. Anything else is rounded down to the nearest allowed divisor (`normalize_step`). Behavior change (7 becomes 6): `CHANGELOG.md`, and `migrating.md` if needed.
- [ ] A model value off the step grid (10:07 with `minute_step` 15): the column centres on the nearest grid value without changing the model until the user scrolls or clicks. Opening the popup never edits the data; the text field still shows 07.
- [ ] Tests: scrolling a column and stopping commits the centred value; a click centres and commits a row; minutes wrap from the last grid value to 00; `hour_step` in 24-hour and 12-hour modes; a step that isn't a divisor is rounded down; an off-grid value isn't changed by opening; keyboard stepping still works (existing `tests/date.pw.ts` cases).
- [ ] Docs: `ui-widgets.md` (`ScrollColumn` row, `TimePickerPanel` options, the `DateTimePicker` attributes table with `hour_step` and the divisor rule, the "time popup's columns" sentence).
