# Motion: enter and leave (elt, elt/ui)

Nodes can animate when they enter and when they leave the page, whoever inserts or removes them: a verb (`If`, `Switch`, `Repeat`, an observable child), a popup, a direct `node_append` / `node_remove`. Leaving is the hard part: the node has to stay in the page while it animates, yet be dead for everything else. This spec covers the core protocol (`elt`), the standard motions and tokens (`elt/ui`), and the docs.

> Why: until now, appearing was done with `$connected` + `animate`, and disappearing only worked where the code owns the removal (popup, dialog: animate, then remove). A `Repeat` item or an `If` branch could animate in but never out.

**Already done** (prerequisites):
- `node_remove_range` / `node_move_range` (`src/dom.ts`) are the only removal and move paths; `node_remove`, `node_clear`, `Repeat` and `CommentHolder` go through them. Nodes are disconnected while still in place, then detached.
- Immediate observers compute a derived observable nobody watches yet (`Observer.refreshImmediate`), so verb content is rendered while its tree is offscreen. Entering (below) depends on it.

## Vocabulary

- **Leaving node**: a node that was removed but stays in the page while its exit animation runs. elt has disconnected it; it is condemned and never comes back.
- **Entering node**: a node inserted directly into a live parent (see [Entering](#entering)), as opposed to one that arrives in the page with an ancestor.
- **Motion**: what `$enter` / `$leave` play (see [Motion](#motion)).
- **Floating**: a leaving node taken out of the layout at once, kept visually where it was.

## Core (`elt`)

### API

```ts
type Motion =
  | Keyframe[]                                    // keyframes; duration and easing from motion_defaults
  | MotionSpec                                    // data: what presets are
  | ((node: Element) => Promise<unknown> | void)  // anything else

interface MotionSpec {
  keyframes: Keyframe[]
  duration?: number            // ms
  easing?: string              // any CSS easing function (same string in CSS and in el.animate)
  reduced?: Keyframe[] | null  // played under reduced motion; null: instant. Default: see Reduced motion
}

function $enter(motion?: Motion, opts?: { always?: boolean }): Decorator
function $leave(motion?: Motion, opts?: { flow?: boolean }): Decorator

function node_on_enter(node: Node, fn: (node: Element) => Promise<unknown> | void, opts?: { always?: boolean }): void
function node_on_leave(node: Node, fn: (node: Element) => Promise<unknown> | void, opts?: { flow?: boolean }): void

function motion_enabled(enabled: boolean): void   // false: every enter / leave is instant
function motion_reduced(reduced: boolean | null): void  // force reduced motion on / off; null: follow the OS (default)
const motion_defaults: { enter: MotionSpec; leave: MotionSpec }
```

- `$enter` / `$leave` are one-line decorators over `node_on_enter` / `node_on_leave`, like `$connected` over `node_on_connected`.
- With no argument they play `motion_defaults.enter` / `.leave`. Core defaults: an opacity fade, 120ms, `ease-out`. `elt/ui`'s theme overwrites them with its tokens.
- A function receives the node. For `$leave`, returning a promise means "wait for it", returning nothing means "remove now". A promise that rejects removes the node too. For `$enter`, the return value is ignored.
- A spec or keyframes run through `el.animate(keyframes, { duration, easing, fill: "forwards" })` (forwards: a leaving node must not flash back to its full opacity before removal).
- Several leave hooks on one node all run; the node waits for every promise they return. A hook that throws is logged and counts as "remove now".

### Leaving

`node_remove_range(first, last)` considers leave hooks only on the nodes from `first` to `last` (every node of the range, never their descendants).

A node of the range **leaves** (instead of being removed in the same call) when all of these hold:
1. it is in the document and connected according to elt (`node_is_connected`); removing a detached node is always instant;
2. it has a leave hook;
3. motion is enabled (`motion_enabled`) and the motion is not reduced to nothing (see [Reduced motion](#reduced-motion));
4. one of its hooks returns a promise.

Everything else in the range is removed in the same call, synchronously, batched as today (runs are split around leaving nodes).

`node_remove_range`, in order:
1. One walk over the range: disconnect each node (observers stop, `$disconnected` runs, so a leaving node is a frozen snapshot); note the candidates (conditions 1–3).
2. On each candidate: set the attribute `e-leaving` and `inert` (no focus, no clicks, out of the accessibility tree), then call its hooks. Candidates whose hooks return no promise join the nodes to delete.
3. Floating (see [Floating](#floating)) for the leaving nodes that are not `flow`, measured while everything is still in place.
4. Set the leaving bit (`NODE_IS_LEAVING` in `sym_connected_status`, after the disconnect walk, which resets the status to 0).
5. Delete the other nodes.
6. When a leaving node's promises settle: if it still has the leaving bit and a parent, `removeChild`. Otherwise nothing (it was already cut).

The status bit is the truth; `e-leaving` and `inert` are side effects for CSS, selectors and assistive technology. `inert` stays an ordinary attribute users can set: elt never reads it.

### Condemned nodes

A leaving node never comes back and is never moved. Anything other than its own final removal that runs into it removes it at once ("cuts" it):

| Where | Result |
| ---- | ---- |
| `node_remove_range` (an `If` flipping twice quickly, `CommentHolder.empty()`, `node_clear`, …) | deleted with the rest of the range |
| `node_move_range` | removed, not moved |
| `node_do_connected` (a detached ancestor put back, `node_append` of the node itself, a mutation observer's late "added" record) | removed, never reconnected |

Also:
- `CommentHolder.hasContent` ignores leaving nodes.
- An ancestor removed without a hook takes its leaving descendants with it; their final removal then does nothing.
- A leaving node's own animation may be cut short by the browser (WebKit has no `moveBefore`: moving an ancestor with `insertBefore` cancels CSS animations, not `el.animate` ones). A cancelled animation counts as finished.

> Why condemned: a disconnected node may depend on things that no longer exist (an item removed from its list, a closed service). Bringing it back means restarting observers on stale state; cutting it is always safe.

### Floating

Default for a leaving node: it leaves the layout at once (the page lays out as if it were already gone) and stays visually in place. `{ flow: true }` keeps it in the layout until removed (needed to animate its height for a collapse).

For the floating nodes of one `node_remove_range` call, batched:
1. read: `getBoundingClientRect()` and `offsetTop` / `offsetLeft` / `offsetWidth` / `offsetHeight` of each (one forced layout);
2. write: `position: absolute; box-sizing: border-box; margin: 0; top/left = offsetTop/offsetLeft; width/height = offsetWidth/offsetHeight`;
3. read: the rects again (second forced layout);
4. write: shift `top` / `left` by the difference, if any. `offsetTop` is measured from the `offsetParent`, but absolute positioning is relative to the containing block; they differ under an ancestor with `transform`, `filter`, `contain: layout/paint`, `will-change: transform`, a size container, or a `<td>` offsetParent.

This all happens before the other nodes are deleted.

Fallbacks:
- Real table parts (`display: table-row`, `table-cell`, `table-row-group`, …) and inline content spanning several lines (`getClientRects().length > 1`) stay in flow.
- A node without a box (`display: none` or `contents`, `getClientRects().length === 0`) is removed instantly: nothing would be visible.

Known limits: a floating node is positioned against its containing block. If that is beyond its scroll container, it doesn't scroll or clip with it; elt does not make ancestors positioned to fix this.

### Entering

A node **enters** when it is the root of an insertion into a live parent: the node `node_append` passes to `node_do_connected` itself (a single node), or each top-level node of an inserted fragment. Its descendants, and anything connected because an ancestor was inserted, do not enter.

Measured cases (Chromium, with the offscreen render fix):

| Case | Enters |
| ---- | ---- |
| a tree built offscreen with verbs inside, then mounted | its root only |
| `If` / `Switch` branch change | the new branch's root nodes |
| `Repeat` adds items | the new items' root nodes (one fragment per run) |
| content that is a fragment | each of its top-level nodes |
| a `Promise` renderable resolving while live | the resolved content |
| a verb appended directly into a live parent | its initial content |
| a value changed while the tree was offscreen, then mounted | the changed branch |
| a move (`node_move_range`, `moveBefore` or the `insertBefore` fallback) | nothing |
| insertion into a detached parent | nothing |
| nodes inserted with raw DOM calls or reconnected by `setup_mutation_observer` | nothing |

Implementation: `node_append`'s two live branches pass `entering = true` to `node_do_connected` for the root only; enter hooks run after the root's whole subtree is connected. `{ always: true }` registers the hook as a connected callback instead (every connection, never moves).

If a node starts leaving while its enter animation (spec or keyframes form) is still running, elt cancels it first, so the exit starts from where the entry was. For the function form, elt cancels nothing.

### Reduced motion

When reduced motion applies (`motion_reduced(true)`, or `prefers-reduced-motion: reduce` matching while `motion_reduced` is `null`; read per call):
- a spec with `reduced` plays those keyframes (`null`: instant);
- otherwise elt drops the movement properties from the keyframes (`transform`, `translate`, `rotate`, `scale`, `offsetPath`, `offsetDistance`, `offsetRotate`) and plays the rest (opacity, colors, …). If no animated property is left, the motion is instant;
- a function is called as is: it is the author's job.

> Why not instant: reduced motion is about movement (WCAG 2.3.3, platform guidance); fades are fine and cheap (compositor-only).

`motion_enabled(false)` makes every enter and leave instant, functions included. The Playwright harness sets it by default; motion tests turn it back on.

### Verbs

- `If` / `Switch`: the new branch is inserted at once, while the old one floats out. No "wait for the exit" mode.
- `Repeat`: removed items whose root has `$leave` float out; the others move around them (a leaving item belongs to no item range: its comment markers were deleted).
- **Windowed lists** (`Repeat(...).ForView`, `RepeatVirtual`): rows dropped because they left the view window must not play their exit, and rows rendered because they scrolled into the window must not play their entry. Eviction (`evict_outside_view`) and view-driven reconciliations (`reconcile_view`, `reconcileView`) run without motion (an internal flag around those calls; `node_remove_range` / `node_append` read it). Data-driven updates keep their motion. To check during implementation: `RepeatVirtual`'s row measurements must ignore floating rows (`e-leaving`).

### Other changes in the core

- Remove the core's duplicate `animate` (`src/dom.ts`, end of file); `elt/ui` keeps its own.
- Document in the rules: code that runs later (animation frame, timeout, promise) checks `node_is_connected`, not `isConnected`; a leaving node is still in the document. `ui/list-nav.tsx`'s `focus_when_shown` already does (commit `0b18331`).

## `elt/ui`

### Tokens

Theme settings (numbers for durations, CSS strings for easings), also written as CSS custom properties (`--e-duration-fast: 100ms`, …):

| Setting | Default | For |
| ---- | ---- | ---- |
| `durationFast` | 100 | hovers, small controls |
| `durationMedium` | 150 | popups, menus |
| `durationSlow` | 250 | dialogs, page-level changes |
| `easingEnter` | `cubic-bezier(0.22, 1, 0.36, 1)` | entering |
| `easingLeave` | `cubic-bezier(0.4, 0, 1, 1)` | leaving |

- The theme writes them into `motion_defaults` (fade, `durationFast`, `easingEnter` / `easingLeave`).
- Presets read the JS values: a CSS override of the custom properties on a subtree changes ui's CSS transitions but not the presets. To be stated in the docs.
- ui's hardcoded CSS transitions move to the tokens: `ui/form.css.tsx`, `ui/popup.tsx` (background transition), `ui/select.tsx` (chevron rotation), `ui/dialog.tsx`.

### Presets

`MotionSpec` constants, one export each (tree-shaken when unused): fades, small slides (the current `animate_show` / `animate_hide`: opacity + 3px translate), and whatever popup and dialog need. Presets that move fall back to a fade under reduced motion (their `reduced`). Names to settle during implementation.

### Popup and dialog

- `popup` uses `$enter` / `$leave` with presets instead of `animate` + `stop_animations` + `node_remove` in `_popup_resolve`. Its `transform-origin` handling stays.
- `show_dialog` uses `$enter` / `$leave`; its exit also animates `::backdrop`, so it uses the function form (two `el.animate` calls, one with `pseudoElement: "::backdrop"`).
- `stop_animations`: fix its no-op listeners (they return a requestAnimationFrame id instead of resolving), or remove it if nothing uses it once popup is migrated.
- `animate`, `prefers_reduced_motion` stay. `animate`'s "duration 0 under reduced motion" changes to the reduced-motion rule above (the docs in `ui-overlays.md § Animation` must follow).

### Sibling-position selectors

Left as they are. A leaving node is still a sibling: when the first or last child of a packed container leaves, the new first / last child lacks its first / last styling (rounded corners, seams in `ui/layout.css.tsx`) until the leaving node is removed. Middle items are unaffected.

The fix, documented but not applied: `:nth-child(1 of :not([e-leaving]))` for `:first-child`, `:nth-last-child(1 of :not([e-leaving]))` for `:last-child` (no equivalent for `:first-of-type` / `:last-of-type`: use `:nth-child(1 of tag:not([e-leaving]))`).

> Why not applied: measured cost (style recalculation, one container, Chromium; Firefox about half). With these selectors every insertion or removal restyles all the container's children, animating or not: 2,000 children, 5.1ms per insert + remove vs 0.93ms; 10,000 children, 25ms vs 4.6ms. Wrapping them in `:has(> [e-leaving])` doesn't help (4.3ms). Limiting them to opted-in containers (`.c[motion] > …`) keeps other containers at the plain cost, but was not adopted.

## Docs

- New topic page `docs/md/motion.md`: `$enter` / `$leave`, `Motion`, entering vs. arriving with an ancestor, leaving (floating, `flow`, condemned nodes, `e-leaving`, `inert`), reduced motion, `motion_enabled`, `motion_defaults`, windowed lists, the sibling-selector trick and its measured cost, the WebKit `insertBefore` note.
- `motion.md` shows motion live: `//@inline-example` blocks (run on the page, exercised by `tests/docs-code-example.pw.ts`), each small, with buttons driving the observable. Together they cover every verb and the common usages:
  - `$enter()` / `$leave()` with no argument on an `If` branch; then `If` with both branches animated (the new one entering while the old one floats out), and a fast double toggle (the first exit is cut);
  - `Switch` cycling through cases with a slide preset;
  - `Repeat`: add, remove, reorder and shuffle buttons on a keyed list, items with `$enter` / `$leave` (neighbours take their final place at once, the removed item fades on top);
  - `Repeat` with `$leave(spec, { flow: true })` animating `height` to 0: the collapse, next to the floating default for comparison;
  - `Repeat` with `DisplayWhenEmpty`: the empty placeholder entering and leaving;
  - `RepeatVirtual`: a long list where scrolling never animates rows in or out, while adding and removing items in view does;
  - `DisplayPromise`: the waiting state leaving and the result entering;
  - an observable used directly as a child (its rendered content swapped with motion);
  - entering vs. arriving with an ancestor: a box mounted with its children (only the box animates), then items added inside it (they animate); `$enter(..., { always: true })` for comparison;
  - the `MotionSpec` forms side by side: keyframes only, a spec with duration / easing / `reduced`, a function (e.g. animating a color, or waiting on something);
  - a direct `node_remove` of an element with `$leave` (outside any verb);
  - `elt/ui` presets in a small gallery (one button per preset), and popup / dialog opening and closing, on `ui-overlays.md`;
  - reduced motion: a toggle calling `motion_reduced`, showing a slide becoming a fade.
- `elt-rules.md`: the `node_is_connected` rule for code that runs later.
- `decorators.md` (lifecycle section): `$enter` / `$leave` next to `$connected` / `$disconnected`, linking to `motion.md`.
- `ui-overlays.md § Animation`: tokens, presets, the new reduced-motion behaviour; `elt-ui-rules.md`: use the presets and tokens, not hand-written `animate` calls or durations.
- `ui/AGENTS.md`: a pointer to the sibling-selector trick, naming the packed-layout rules as the first candidates.
- Page transitions stay View Transitions, opt-in per route (`ui-overlays.md § Page transitions`); a route view with `$leave` on its root would also animate out, which the docs should mention.

## Tests

Core (Playwright, `tests/motion.pw.ts`; motion enabled for these):
- a node without a hook is removed synchronously; a hook returning nothing too; reduced motion with only movement properties too; `motion_enabled(false)` too; removing a detached node never calls the hook;
- a hooked node stays until its promise settles, is disconnected (observers stopped) from the start, has `e-leaving` and `inert`, and is then removed;
- only the nodes of the removed range run their hooks, not descendants;
- a rejected promise and a throwing hook remove the node;
- condemned: removed again → cut; moved by `node_move_range` → cut; detached ancestor re-inserted → cut and never reconnected; final removal after a cut does nothing;
- floating: the layout after the call matches an instant removal; the node keeps its on-screen position (also under a `transform`ed ancestor); table rows and multi-line inline content stay in flow; `flow: true` keeps the space; a node without a box is removed instantly;
- entering: each row of the measured-cases table, including fragments and moves; `always`; entry cancelled when leaving starts;
- reduced motion: `reduced` keyframes, movement stripped, `null`;
- `If` flip with `$leave` + `$enter`: both nodes present during the exit, old one floating; `Repeat` removal with `$leave`: neighbours already in their final place;
- windowed lists: scrolling evicts and renders rows without motion; data updates in view still animate.

ui: popup and dialog open / close with their presets (and the existing focus / Escape tests still pass), tokens in `motion_defaults` and CSS custom properties.

## Order

1. Core leaving (status bit, `node_remove_range` / `node_move_range` / `node_do_connected` / `hasContent`, floating) + tests.
2. Core entering (`node_append`'s live branches) + tests.
3. `Motion`, specs, defaults, reduced motion, `motion_enabled`; harness sets motion off.
4. Windowed lists.
5. `elt/ui`: tokens, presets, popup, dialog, transitions on tokens.
6. Docs; then delete this spec.
