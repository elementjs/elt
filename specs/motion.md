# Motion, scoped to verbs (elt, elt/ui)

Revision of the motion model shipped in `docs/md/motion.md` (commits `6f8ce40`…`d59fb5d`): entering and leaving become the business of **verbs**. A verb is anything rendering between two markers through a `CommentHolder`: `If` / `Switch` / `DisplayPromise`, any observable shown as a child (`{o_x.tf(...)}`), `Repeat` / `RepeatVirtual`, App views, a raw `Promise` child. Motion plays when a verb **updates**, never on its first render, and stops at nested verbs.

## Rules

| | Entering | Leaving |
| ---- | ---- | ---- |
| Plays on | a verb's update, or `node_append(…, motion = true)` | a verb's update removing content, or `node_remove` / `node_clear` / `node_remove_range(…, motion = true)` |
| Never on | a verb's first render (including catching up while being connected: the "connecting" bit); moves; a detached parent | moves; a detached node; a node without a box, unless descendants with a box play |
| Who plays | every inserted node and its descendants having `$enter`, up to nested verbs' content | the removed node if it has an applicable `$leave`, then its descendants' `$leave`, up to nested verbs' content. Without its own, it goes at once with everything in it |
| `always` | plays even when not its verb's update: nested verb's first render, arriving with an ancestor, insertion without the flag. Implemented as a connected callback | plays even when not its verb's update: inside nested verb content, a removal without the flag. Never holds an ancestor: only when it is the removed node, or inside a removed node that stays anyway |
| Removed node | — | stays until all exits (its own and descendants') are done; floats unless a hook asks `flow`; stays in flow if it has no box itself; `e-leaving` + `inert` |
| `null` | not accepted (no `e-entering` for now) | `$leave(null)`: no exit of its own, waits for its descendants' |
| Off | `motion_enabled(false)`, `without_motion` | same |

Infinite exits: a keyframes / spec exit whose computed end is infinite plays nothing, warns, and the node goes at once. A function's promise must settle; in development builds a warning names a node still waiting after 5s.

## Implementation

**Status bits** (`sym_connected_status`): `NODE_IS_VERB` (permanent, set by the `CommentHolder` constructor; not on `RepeatItemElement`, which is the Repeat's own unit), `NODE_IS_CONNECTING` (during `_apply_connected`, while observers start). `_apply_connected` / `_apply_disconnected` keep `VERB` (and `LEAVING`).

**Boundaries**: walks over siblings (connection, removal collection, the top of removal ranges) read the status word they already read; on `NODE_IS_VERB`, the nodes up to that marker's `end` are another verb's content.

**Sibling walks re-read `nextSibling`** after connecting a node, unless it was removed (a cut leaving node): a verb catching up replaces its content during the walk. Fixes the bug introduced in `6f8ce40` (nodes after a catching-up verb were never connected).

**API**:
- `node_append(parent, renderable, refchild?, motion = false)`; `is_basic_node` moves to an internal function used by `E()` and the recursion. `motion` passes through arrays, fragments, function results, not into appenders (a verb's own first render).
- `node_remove(node, motion = false)`, `node_clear(parent, motion = false)`, `node_remove_range(first, last, motion = false)`.
- `CommentHolder.updateRenderable(renderable, motion = false)`, `empty(motion = false)`.
- Verbs compute `motion` = "this is an update": observable children (If, Switch, DisplayPromise, App views): previous value exists and the holder is not connecting; Repeat: not its first reconciliation and the list holder is not connecting; a raw `Promise` child becomes a `CommentHolder`, its resolution an update when connected.
- `ElseIf` chains become one verb: the first truthy condition picks the branch; re-render when the picked branch changes (same truthiness reuse as today for the single `If`).
- Keyed `Repeat` reuse: unchanged rule (removed items whose top-level nodes have a leave hook are not reused) — consistent, since descendants only play under a node with `$leave`.
- `popup` / `show_dialog`: `node_append(…, true)` / `node_remove(…, true)`.

## Docs

`motion.md` rewritten around the rules above (examples: updates vs first render, nested verb boundary, children entering, `$leave` on the removed node and `$leave(null)`, `always`, manual `node_append` / `node_remove` with `motion`, ElseIf, RepeatVirtual, infinite exits). `verbs.md` (functions table), `elt-rules.md`, `ui-overlays.md` follow.

## Tests

Rewrite `tests/motion.pw.ts` around the rules table (each row), plus: catching up is initial, sibling after a catching-up verb connected (regression), nested verb boundary at the top of fragments / removal ranges, ElseIf branch switch enters, Repeat items enter (transparent item markers), infinite exits.
