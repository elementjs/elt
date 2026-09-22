# Elt/ui migration: old forms → new forms

This document is the single old-name → new-name equivalence table promised by `specs/elt-ui-guidelines.md` (Axis 3, Spacing scale Todo). It exists so an agent can mechanically convert code written against an earlier form of `elt/ui` without re-deriving intent from `specs/elt-ui-guidelines.md` each time.

This is a living document. Each section covers one axis of `specs/elt-ui-guidelines.md`. Only the Color axis is filled in as of this pass — later passes add rows for Spacing/Layout/Typography renames as they're identified.

> Why: `specs/elt-ui-guidelines.md` documents the *current* rules, not how to get there from old code. Call sites written before a rule existed don't announce themselves — a mechanical table is what lets a low/medium-thinking agent convert them without re-deriving the rule's intent each time.

## Axis 1: Color

### `Mix` step renames

| Old | New | Formula change |
| --- | --- | --- |
| `Color` (class) | `Mix` (class) | none — `Color` was merged into `Mix`; only the class name changed. |
| `.ultra_light` | see "Choosing a replacement" below | `from_bg(10%)` — same formula, but the *role* it was standing in for determines the new expression. There is no direct one-to-one rename. |
| `.light` | see "Choosing a replacement" below | `from_bg(20%)` — same caveat as `.ultra_light`. |
| `.dark` / `.ultra_dark` | — | Never existed as `Mix` members. No call sites, nothing to migrate. |
| `.mid`, `.faded`, `.strong`, `.very_strong`, `.hover`, `.separator`, `.from_bg`, `.from_text` | unchanged | Already the current, spec-compliant names — do not touch call sites using these. |
| `.as_inverted`, `.as_tint` (class) | `.classes.as_inverted`, `.classes.as_tint` | Moved under `Mix`'s own `.classes` namespace — see "Surfaces and borders" in `specs/elt-ui-guidelines.md`. |
| `.css_as_inverted`, `.css_as_tint` | `.css.as_inverted`, `.css.as_tint` | Same move, `.css` namespace. |
| `.surface(n)` (class) | `.classes.as_surface(n)` | Same move ; `.surface(n)` itself now means something different (see next row). |
| `css_as_surface(n)` | `.css.as_surface(n)` | Same move. |
| *(did not exist)* | `.surface(n)` | New : a bare CSS color value for absolute surface level `n` (no `.css`/`.classes`, no `as_` prefix — it names the color, it doesn't apply a ruleset), for a one-off declaration like `border-top: 1px solid ${theme.colors.tint.surface(1)}`. Accepts `number \| \`n+${number}\` \| "background"` (e.g. `"n+1"`, `"n+2"`). |

`.ultra_light` and `.light` were removed outright rather than renamed, because they named a *lightness step* (a position on the bg→tint axis), not a *role*. The new API names roles (`.hover`, `.separator`, `.mid`, `.faded`) — a call site using the old getters has to be re-examined for what it was actually trying to express, not pattern-substituted.

### Choosing a replacement for `.light` / `.ultra_light`

Pick by what the mixed color was doing at that call site, not by which of the two old getters was used:

| Role at the call site | New expression |
| --- | --- |
| A `:hover`-state background | `.hover` |
| A container's own edge, or a divider between elements (`border`, `border-top`, `<hr>`-equivalent), on a non-focusable element | `.separator` |
| A table header / toolbar / title-row band ("Emphasis and promotion" → inverted soft chrome) | `text.faded.as_inverted` (see "Inversion" in `specs/elt-ui-guidelines.md`, line 125 — table headers are named explicitly) |
| The border of a focusable control (button, input) | The control's own emphasis-variant color at full text intensity — usually `text.mid`, matching the borders `ui/form.css.tsx` already draws elsewhere (not `.separator`; a focusable control's border is about its own identity, not the surface stack — see "Surfaces and borders" in `specs/elt-ui-guidelines.md`, line 91). |
| A static, non-interactive fill that isn't a header band and isn't a surface's own background (e.g. a footer strip, an idle list-item background) | No exact spec-sanctioned equivalent yet. Use an explicit `.from_bg(10%)` / `.from_bg(20%)` to preserve the old look, and leave a `//> Question:` marker at the call site naming the candidate roles (surface fill vs. flat tint) for a follow-up decision. |
| No semantic home at all (a shadow color, a scrollbar track) | An explicit `.from_bg(N%)` — sanctioned by `specs/elt-ui-guidelines.md` line 62 ("Named steps never grow to cover a one-off need"). |

> Why: collapsing every `.light`/`.ultra_light` call site onto `.hover` or `.separator` by rote would be wrong — those two are specifically levels *n+1*/*n+2* of the ambient surface stack, meant for elements that participate in `[surface]` nesting. A flat panel background or a shadow color isn't part of that stack and using `.hover`/`.separator` there would silently couple it to whatever surface level happens to be ambient, which is not what those old call sites meant.

### Known inconsistency in `specs/elt-ui-guidelines.md`

`specs/elt-ui-guidelines.md` line 273 (Axis 7 Todo/ADR, describing a past fix) says a table `<th>` background was corrected to `text.ultra_light`. Line 125 (§Inversion, a current binding rule) says table headers use `text.faded.as_inverted`. These disagree. Line 273 is status prose recording what a past pass actually did, not a current rule — treat it as not-yet-propagated: this migration moves table-header call sites to `text.faded.as_inverted` per the binding rule at line 125, and line 273's prose should be corrected to match once that move is confirmed (out of scope for this document to edit directly — flagged here, and in the conversation, for the redactor to reconcile in `specs/elt-ui-guidelines.md` itself).

### Other renames folded in from the same pass

| Old | New |
| --- | --- |
| `e-box` | `e-block` |
| `theme.settings.paddingPanelVertical` / `paddingPanelHorizontal` | `theme.settings.spacingComponentVertical` / `spacingComponentHorizontal` (or the `spacingComponent` shorthand) |
| `theme.settings.paddingCell*` | `theme.settings.spacingWidget*` |
| `theme.class_light` / `class_dark` / `class_dynamic` | Unchanged for now — `specs/elt-ui-guidelines.md` (line 87) has an open Todo to move these under `theme.classes.*`; do not rename ahead of that landing. |

> Question: this pass only inventoried Color-axis call sites. Spacing/Layout renames above are the ones already flagged by `specs/elt-ui-guidelines.md`'s own Todos, not a fresh audit — a dedicated pass is still needed to confirm there are no other stale references.
