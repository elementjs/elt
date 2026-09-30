# Borders reloaded

This document specifies changes to border and radius ownership for `packed` containers, and new theme helpers those changes need.

> 📜 **ADR**: implemented, including the `border`-value redesign under Theme helpers below (flat widget color for a bare family name, `-surface`/`-separator` suffixes for the level-stack offsets), the `[hover]` ambient-family fix, `packed`'s widened radius ownership (own `[radius]` as well as `[border]`), the removal of `overflow: clip` everywhere in favor of fixing radius mismatches at the source, and the `<pre>` radius/scrollbar fixes that fell out of that removal (Resolved follow-ups). `ui/theme.tsx`, `ui/layout.css.tsx`, `ui/typography.css.tsx`, `ui/selectors.ts`, `tests/browser/harness.ts`, `ui/select.tsx` (one existing call site used the removed `border="n+2"` value — updated to `border="tint-2"`, the exact equivalent). Tests: `tests/packed.pw.ts`, `tests/border.pw.ts`, `tests/theme.pw.ts`. Docs: this file, `specs/elt-ui-guidelines.md`, `docs/md/visual-test.md`. `bun run check-types` and the full Playwright suite (354 tests) pass.

## Current behavior

Today, `packed` finds bordered children through a fixed selector (`BORDERED_SELECTOR`, `ui/selectors.ts`) and removes the border on the shared seam between two bordered children (`ui/layout.css.tsx:343-351`). Interior seam radii are always zero, regardless of whether either child has a border (`ui/layout.css.tsx:324-341`). Tests for this behavior live in `tests/packed.pw.ts`.

> 📜 **ADR**: `BORDERED_SELECTOR` must list every element type that can render a border, and grows each time a new one appears. Border-declaring elements should know about `packed` themselves, instead of being discovered from a central list.

## Goal

Move border awareness from `packed` to each bordered element. A bordered element checks for a `packed` ancestor itself. `packed` no longer scans its children for borders.

Each bordered element's own ruleset carries a plain CSS descendant selector, e.g. `:where([packed]) > &:not(:last-child) { border-inline-end: none }`, written once per bordered element type. `BORDERED_SELECTOR` disappears. This keeps the existing `css_<name>` convention intact (a plain declaration string), and needs no new convention.

> 📜 **ADR**: as implemented, this needs no per-element-type ruleset at all. `border-right: none`/`border-bottom: none` on the trailing edge of every non-last `packed` child (bordered or not) is a no-op on an unbordered child — CSS doesn't complain about resetting a property that was never set. One pair of rules (row/column), unconditional on element type, replaces `BORDERED_SELECTOR` entirely. See `ui/layout.css.tsx`.

## Theme helpers

`surface` and `border` share one color-step value type: `"tint"`, `"neutral"`, `"tint-surface"`, `"neutral-surface"`, `"tint-separator"`, `"neutral-separator"`, `` `tint-${N}` ``, `` `neutral-${N}` ``, where `N` is a level number 1 through 6. `theme.css_border(value)` / `theme.class_border(value)` and the matching `surface` helpers read this type.

- Bare `surface` (boolean `true`, no value): the `neutral` family, one level up from ambient (matching today's bare-`[surface]` relative-offset behavior, `ui/layout.css.tsx:135-141`).
- `surface="tint"` / `surface="neutral"`: that family, one level up from ambient — same offset as bare, family forced.
- `surface="tint-surface"` / `surface="neutral-surface"`: an explicit synonym for the previous line — that family, one level up from ambient.
- `surface="tint-separator"` / `surface="neutral-separator"`: that family, two levels up from ambient.
- `surface="tint-N"` / `surface="neutral-N"`: that family, at the absolute level `N`, ignoring ambient.
- Bare `border` (boolean `true`, no value): the flat "widget" color for the `neutral` family — `neutral.faded` — a clear, defined boundary, independent of ambient surface nesting.
- `border="tint"` / `border="neutral"`: the flat "widget" color for that family — `tint.mid` for `tint`, `neutral.faded` for `neutral`. Not level-relative.
- `border="tint-surface"` / `border="neutral-surface"`: that family, one level up (`+1`) from whatever `surface` resolved to on the same element (own `[surface]` if set, else ambient) — the level-stack offset `.hover` uses.
- `border="tint-separator"` / `border="neutral-separator"`: that family, two levels up (`+2`) from the same base — the level-stack offset `.separator` uses.
- `border="tint-N"` / `border="neutral-N"`: that family, at the absolute level `N`, ignoring the element's own `surface` value.
- This replaces `SurfaceValues`'s `"n+1"`/`"n+2"`/absolute `"1"`-`"6"` (`ui/layout.css.tsx:38-42`) and `BorderValues`'s `"tint"`/`"n+1"`-`"n+6"` (`ui/layout.css.tsx:33-35`). It also replaces the hardcoded `theme.colors.tint` in today's `[surface]`/`[border="n+K"]` rules (`ui/layout.css.tsx:151-158,166`) — `neutral` becomes reachable from the `surface`/`border` attributes for the first time.

> 📜 **ADR**: the first implementation made `border`'s bare family name (`"tint"`/`"neutral"`) level-relative, the same as `surface`'s — `border="tint"` meant "tint, one level up from this element's own/ambient surface." That surprised two real call sites (`ui/select.tsx`'s popup listbox, `ui/popup.tsx`'s popup content) expecting a plain, defined "widget" boundary, not a subtle level-stack mix. `border`'s bare family name now gives the flat widget color instead (restoring the exact pre-redesign default, `neutral.faded`/`tint.mid`), and the level-stack offsets move to explicit `-surface`/`-separator` suffixes — named after `.hover`/`.separator`, the two `Mix` members that already use exactly these offsets. `surface`'s own bare-family behavior is unchanged: a surface is a level by definition, so there was no "flat" meaning to restore there — this is a deliberate asymmetry between the two attributes, not an inconsistency.

> 🔎 **Assumption**: the resolved family and level may be carried through CSS custom properties, matching the existing pattern (`--e-current-surface-level`, `--e-surface-level`). This is an implementation choice, not part of the public interface this document specifies.

The `surface`/`border` attributes precompile `tint-N`/`neutral-N` for `N` 1 through 6 only, matching today's `[surface="1"]`-`[surface="6"]` and `[border="n+1"]`-`[border="n+6"]` ranges. The `theme.css_border(value)`/`theme.colors.<mix>.surface(level)` helpers accept any `N`, uncapped — matching how `Mix.surface()` already accepts an arbitrary `` `n+${number}` `` today (`ui/theme.tsx:614`) even though the `[surface]` attribute only precompiles a fixed set (`ui/layout.css.tsx:135-141`).

`border="tint-surface"`/`"neutral-surface"`/`"tint-separator"`/`"neutral-separator"`, with no `surface` value of its own on the same element, resolves the `+1`/`+2` against the ambient surface (nearest ancestor's surface level) — the same fallback `Mix.surface()` already uses (`ui/theme.tsx:614-616`).

`[hover]:hover` (`ui/layout.css.tsx`) reads `ambient_surface_mix` (`ui/theme.tsx`) — the same ambient-family `Mix` `border`'s level-relative suffixes above use — instead of a hardcoded `theme.colors.tint`, so a hover fill matches whichever family the surface it sits on actually used.

- `theme.css_radius()` / the `radius` attribute already exist (`ui/theme.tsx:87-94`, `ui/layout.css.tsx:64`, commit `ee6d2fe`). No change needed there.
- Add `theme.class_radius(step?)`, the class-name counterpart to `theme.css_radius()`. It does not exist yet (`ui/theme.tsx:311` has only `css.radius`).

> 📜 **ADR**: every `theme.css_<name>` helper needs a matching `theme.class_<name>` helper, so library consumers who need a class name (not an inline declaration) are covered.

`--e-current-spacing` is not a rename of `--e-pad` — it is a separate, ambient (inheriting) custom property holding the "outer" spacing level currently in effect, the same level today's `--e-spacing` already carries (set by `[pad]`, `[spacing]`, `[packed]`, `ui/layout.css.tsx:209-220,305-313`). `--e-pad` stays exactly what it is today: an element's own explicitly specified padding value, set only when that element itself has `[pad]`/`[pad="X"]`.

`theme.css_radius()`'s default (an unspecified radius step) reads `--e-pad` first — this element's own specified padding, when set — and falls back to `--e-current-spacing` — the ambient spacing level — when this element has no `[pad]` of its own. This replaces today's `var(--e-pad, var(--e-spacing-widget))` fallback chain (`ui/theme.tsx:89`).

> 🔎 **Assumption**: `--e-current-spacing` may be implemented as a rename of `--e-spacing` itself, or as a separate property kept in sync with it — both give `radius` the same resolved value. This is an implementation choice, not part of the interface this document specifies.

> 📜 **ADR**: the pad-first priority is not a change to `--e-current-spacing`'s own cascade — that property keeps following the existing rule where an explicit `[spacing]` wins over whatever `[pad]` implied (`ui/layout.css.tsx:200-201,218-220`, rule 3). The priority is specific to `theme.css_radius()`'s own two-step fallback: this element's own explicit padding, if any, before the ambient spacing level.

- Add `theme.css_current_surface`, `theme.class_current_surface`, emitting `background: var(--e-current-surface);` alone. Backed by `var(--e-current-surface)`. Default at `:root` is the page background.

> 🔎 **Assumption**: `--e-current-surface-level` already exists (`ui/layout.css.tsx:227-231`), holds a number, and is registered `inherits: false`. `--e-current-surface` must hold a resolved color — packed children read it as their own `background` — so it must inherit; it cannot be the same property as the level. `Mix.css_as_surface()` (`ui/theme.tsx:627-643`) writes it alongside the level, so the two never drift apart.

## Packed containers own their children's radius, whenever they themselves have one

Whenever a `packed` container has a radius in effect — its own `[border]` (which implies radius) or an explicit `[radius]` (and not `radius="none"`), whether or not it also draws its own border — that radius is the group's true outer shape:

- The `:first-child`'s leading outer corners, and the `:last-child`'s trailing outer corners, inherit the container's own radius exactly (`border-*-radius: inherit`), not whatever radius that child would otherwise resolve to on its own.
- Every interior seam (a corner touching a neighboring child) has border-radius zero, regardless.

When `packed` has *neither* `[border]` nor `[radius]` of its own, none of this applies: each child keeps whatever radius it resolved on its own, at every corner, interior seams included — this is the one case where `packed` stays out of the question entirely, matching today's tested behavior (`tests/packed.pw.ts:118-148`).

> 📜 **ADR**: not all children go through the theme's radius system the same way — a form control's radius (`theme.css_radius("widget")`, `ui/form.css.tsx`) is a fixed named step, unrelated to any ambient or container radius; a plain child with none of its own defaults to `0`. Relying on each child to independently arrive at a radius that happens to match its siblings and the container is fragile. Once `packed` has asked for a radius at all, it owns the whole group's shape, the same way it owns the border and background in `packed[border]` mode. `inherit` on each corner longhand forces that one declaration to read the container's computed value, regardless of whether `border-radius` normally inherits (it doesn't).

## Packed containers without their own border

A `packed` container that does not set `border`:

- Each bordered child disables its own trailing-edge border (`border-right` in a row, `border-bottom` in a column), unless it is the `:last-child`.
- "Row" means `e-row`, or `e-flex` without the `column` attribute. "Column" means `e-column`, or `e-flex[column]`.

> 📜 **ADR**: this drops today's `:has(+ bordered-sibling)` check (`ui/layout.css.tsx:346-351`) — today a bordered child keeps its trailing border when the next sibling has no border of its own. Per-element self-detection strips the trailing border on every non-last bordered child instead, regardless of whether the next child is bordered, with no cross-element lookahead. `tests/packed.pw.ts:87-98` ("only one side bordered: it already shows through, nothing is suppressed") changes accordingly.

## Packed containers that set their own `border`

- `packed[border]` draws the border itself: sets a `1px` gap between children, and sets its own background to the same color as its border. That gap becomes the visible border between children.
- Every child gets `background: var(--e-current-surface)`, applied through `:where(...)` so this rule's specificity never overrides a background a child set on itself.
- Every child sets `border: none` on every side — in this mode, `packed` alone owns the border.

`packed[border]`'s own `padding`, if set, is left as-is. It is not a supported combination — the border color fills the padding, producing a thick frame — but nothing blocks it.

`packed`'s own step argument (`packed="<step>"`) sets only children's own padding (`ui/layout.css.tsx:305-313`); it never sets a gap. A bare `[spacing]` on a `[packed]` element is excluded from the gap rule too (`ui/layout.css.tsx:299-303`, the selector requires `:not([packed])`) — today, a `packed` container never has a `gap` from any existing source. `packed[border]`'s `1px` gap is the first gap `packed` ever gets; there is nothing existing for it to conflict with.

## No `overflow: clip` anywhere in this document

`[surface]`, `[border]`, and `packed[border]` do not set `overflow` at all — none of the code below should add it back.

> 📜 **ADR**: an earlier pass of this document had `[surface]`/`[border]`/`packed[border]` all set `overflow: clip` with `overflow-clip-margin: theme.settings.focusRingSize`, specifically to clip a plain rectangular child's corners so they would not poke out past a rounded container corner — a workaround for exactly the radius mismatch the section above now fixes at the source (the child's own corner is made to match the container's radius directly, instead of being drawn wrong and then clipped). With the mismatch impossible by construction, the clip achieves nothing there. It also carried real cost: it required the `overflow-clip-margin` sizing exercise (tuned to fit a focus ring without letting a square corner through) and the accepted small-radius sliver regression, both now moot. Removing it also means a `<select>` dropdown or `position: fixed` popover anchored inside one of these elements is never at risk of being clipped by it.

> 📜 **ADR**: this also uncovered `<pre>` (`ui/typography.css.tsx`) as a concrete, real instance of the mismatch — `docs/src/code-example.tsx` wraps code samples in `<e-prose border pad="none"><pre>...`, and `<pre>` had no radius of its own at all, square corners sitting inside the wrapper's rounded ones. Fixed the same way as `packed`: `<pre>` now has `border-radius: inherit`, taking its immediate parent's radius directly (resolves to `0`, unchanged, when that parent has none — plain prose is unaffected).

> 📜 **ADR**: found investigating `<pre>` — it always showed a vertical scrollbar, even on content nowhere near its own natural height. Cause: `<pre>` only set `overflow-x: auto`; CSS's used-value rule forces the other axis to `auto` too whenever one axis is non-`visible`, and with both axes non-`visible`, `<pre>`'s reported `scrollHeight` exceeds its `clientHeight` by a small, fixed amount (confirmed: the gap exists with `overflow-y` at `auto`, `hidden`, or `clip` alike, and disappears entirely with `overflow: visible` on both axes — `clientHeight` itself never changes, so nothing is actually being clipped in any variant, only whether the phantom gap surfaces as a scrollbar). `<pre>` now pins `overflow-y: clip` explicitly, keeping the intentional horizontal scroll (`overflow-x: auto`, unchanged) without the coercion.

## Known limitations

Flex wrapping can put the first and last child of a `packed` row or column on different visual lines. When that happens, the leading/trailing radius kept by the rules above does not read as intended. This is a documented caveat, not a defect.

## Tests

> 📜 **ADR**: implemented — `tests/packed.pw.ts`, `tests/border.pw.ts`, `tests/theme.pw.ts`. Covers: per-element seam suppression (no `BORDERED_SELECTOR`); the `surface`/`border` value type including the flat-widget-vs-level-stack-suffix split; `theme.css_radius()`'s own-`[pad]`-vs-ambient-spacing priority; `theme.class_radius`/`class_current_surface`; every `packed[border]` behavior (own border/background, `1px` gap, child background/border reset, first/last child radius inheritance); `packed[radius]` without `border` owning radius the same way; plain `packed` (neither `border` nor `radius`) leaving children's radius untouched; `[surface]`/`[border]` no longer setting `overflow`; `<pre>`'s `border-radius: inherit` and `overflow-y: clip` fix. Also fixed a pre-existing, unrelated bug this work exposed: `[pad]:not([pad="none"])` outranked `[pad="X"]` by specificity, so any named `pad` step silently fell back to `component`'s value — fixed the same way `[radius]` already guards against this (`:where(:not(...))`).

## Documents to update

> 📜 **ADR**: implemented — `specs/elt-ui-guidelines.md` (packed/border section, "Surfaces and borders", including this radius-ownership and `overflow` round), the `packed` doc comment in `ui/layout.css.tsx`, and `docs/md/visual-test.md` (the "Surfaces" example's `surface="1"`.."4" updated to `surface="tint-1"`.."tint-4"`/`"neutral-2"`; "Hover and separator" rewritten as a `packed[border]` example — see the follow-up below for why). `docs/md/using-elt-ui-agent.md`, missed in an earlier pass, was fixed separately (it claimed `packed[border]` never draws a border — see git history) and needs no further change for this round; it never mentioned `overflow`.

## Resolved follow-ups

> 📜 **ADR**: `[hover]:hover` was hardcoded to `theme.colors.tint.surface("n+1")` — inconsistent once `surface`'s default family became `neutral`. Fixed: it now reads `ambient_surface_mix` (`ui/theme.tsx`, exported for this purpose), the same ambient-family `Mix` `border`'s `-surface`/`-separator` suffixes use, so a hover fill always matches whichever family the surface it sits on actually used.

> 📜 **ADR**: `ui/select.tsx`'s popup listbox used `packed="widget" border="n+2"` — the removed relative-separator value. Updated to `border="tint-2"`, the exact color this resolved to before (absolute level 2, `tint` family, since the popup has no ambient surface of its own). This also puts it in `packed[border]` mode for the first time, which it was not in before (the old CSS never special-cased `packed` + `border` together) — worth a visual check.

> 📜 **ADR**: `ui/popup.tsx`'s popup content (`surface="background" border`, bare `border`) does not change appearance after all, once `border`'s bare family name reverted to the flat widget color (see the ADR under Theme helpers, above): bare `border` is `neutral.faded`, exactly what it was before this document. The visual regression flagged in an earlier pass of this document does not apply to the implementation as it now stands.
