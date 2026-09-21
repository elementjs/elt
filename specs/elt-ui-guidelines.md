# Elt/ui guidelines

This document tries to define what giving an elt/ui application a common look and feel entails. Doing so will redefine parts of elt/ui. The result of the work happening in this file will be : a living spec that Agents and Humans alike can adhere to and changes to be applied to the elt/ui codebase.

The rules must let an agent make almost no layout or style decisions on its own when it builds a new screen.

## Scope

This document is the single source for rules and decisions (the "why", as axes). `docs/using-elt-ui-agent.md` stays pure API reference (the "how": tables of attributes/props) and links back here for rationale. The two documents stay separate.

## Axis 1: Color

### Emphasis and promotion

Every interactive control has one of five emphasis variants.

| Variant | Meaning |
| --- | --- |
| `link` | De-emphasized, no border or background — reads as a hyperlink: `color: tint`, underlined, no padding. |
| `text` | Bare: no border, no background, `color: tint`, no underline, no padding — same padding/boundary rule as everything else, no exception. |
| `default` | Base. Bordered, neutral color. |
| `tint` | Accented secondary. Bordered, tint-colored, not filled. |
| `inverted` | Filled with tint as background - no borders |

A container can be **inverted**. An inverted container fills its background with tint and flips its foreground color to read against that fill.

Use an inverted container for toolbars and title rows (dialog headers, table header rows), or for parts of the application that convey semantically more important information. Inversion establishes a new background — per the padding/boundary rules (Axis 3), an inverted container must therefore pad itself, which implies `spacing` too if it arranges more than one child.

Use the `inverted` button variant for the one action on a screen that needs outsized attention, in particular a heavy action that is hard to reverse. It draws the user's eye; do not use it for more than one action at a time in the same area.

Build an inverted container with `theme.colors.tint.as_inverted` (`ui/theme.tsx`). Inversion always freezes its new `text`/`tint` to the *light* theme's `bg` (see Color theory, below) so an inverted band looks the same regardless of light/dark mode — deliberately not a live, cascade-following value. This means nesting the *same* color's `as_inverted` inside itself does not "un-invert" back to a plain background — it inverts the same color again. To nest visibly inside an inverted container, invert a *different* color, or use `as_tint` to change what "tint" means for the subtree first.

> 📜 **ADR**: "Inverted" was chosen over a Material-style "elevation" name. Elevation implies z-depth and shadow, which this rule does not have. "Inverted" names only the background-fill mechanic — the same word for the button variant and the `Mix` primitive it is built from, since they are the same mechanism, not two things to keep in sync.

### Color theory

There is no fixed palette ; the app may bring its own. At any given point in the UI, only three colors matter

- bg : the surface we're drawing on
- text : the color of regular text
- tint : the actual _color_ that has a hue

The only requirement to have good results is that all the tints must have a WCAG contrast of at least 3, but ideally 4.5 with both text and background.

All the different levels used to colorized aspects of the interface are derived by mixing them, considering an axis that goes from bg to text, with tint in between ; transparency is never used outside of shadows or voluntary transparency (the `::selection` highlight's 25% alpha in `ui/theme.tsx` is this rule's voluntary-transparency case, not an exception to it).

Anything between background and tint is mainly used to separate visual space ; backgrounds to make element pop, borders, dividers, while going from tint to text is mostly to provide textual visual alternatives.

Elt/ui also offers to derive a dark theme from a given theme, recalculating colors according to flipping text and bg, trying to keep light levels consistent. This is opt-in ; the app may give its own theme.

Every named color (`tint`, `text`, `red`, …) mixes directly with `bg` and with `text` on its own — `Mix.from_bg(intensity)` and `Mix.from_text(intensity)` are independent methods, not two halves of one shared axis centered on `tint`. `text.mid`, for instance, is `text.from_bg(50%)` — a direct `bg`/`text` mix that never involves `tint` at all, already used throughout `ui/form.css.tsx` for borders. A "0% = `bg`, 100% = `tint`, 200% = `text`" single continuum only describes `tint`'s *own* range (`tint.from_bg(0..100%)` then `tint.from_text(0..100%)`, strung together) — it does not generalize to every color routing through `tint`.

The canonical helper set:

- The level stack (see Surfaces and borders, below) is normally *relative*, not a fixed set of named steps — raised by nesting the `[surface]` attribute (`ui/layout.css.tsx`), which reads/increments an ambient CSS custom property. `[surface="1"]`…`[surface="6"]` are the escape hatch: a bounded set of *absolute* levels for content whose DOM position doesn't reflect its visual nesting (see Surfaces and borders, below).
- `.hover` — surface level *n+1*, relative to whatever level is ambient at the call site.
- `.separator` — surface level *n+2* (borders, dividers), relative to the same ambient level.
- `.mid` — a fixed 50% `bg`/`tint` mix. Not part of the level stack; a general-purpose value reached for wherever something moderate-but-legible is needed (a border, a focus ring, a disabled indicator).
- `.faded` — 80% hue.
- `.strong` / `.very_strong` — `from_text()` at increasing intensity, toward `text`.

Named steps never grow to cover a one-off need: anything outside the named steps goes through `.from_bg()`/`.from_text()` with an explicit percentage instead of adding a new name.

The text/border scale: `text`/`tint` are the raw values; `muted` = `.faded`; `disabled` reuses `.mid`. `selected_text` is not part of this scale — text selection stays its own manual `::selection` CSS rule (`ui/theme.tsx`), not part of the general `Mix` system.

### Surfaces and borders

A surface has a **level**, starting at 0, which is the background color. Each subsequent level mixes more tint into the background, proportionally to the level number (level *n* ≈ *n* × one step of tint-into-`bg`), cascading from whichever level is ambient at that point — a panel that raises a new surface is level *n+1* relative to *its own* parent, not relative to the page.

Implemented in `ui/layout.css.tsx` as the `[surface]` attribute: it reads the ambient `--e-surface-level` custom property, increments it, sets its own background from `tint.from_bg(level × step)`, and passes the new level down to its children — so a border, divider, or hover fill can read "one level up from here" without knowing its own ancestor chain.

`[surface]` accepts more than the bare relative case:

| Value | Meaning |
| --- | --- |
| *(bare)* / `"increment"` | Raise one level relative to whatever's ambient — the default case, above. |
| `"1"`…`"6"` | Set an *absolute* level, ignoring whatever's ambient. For content whose DOM position doesn't reflect its visual nesting — a dialog or popup portaled to `document.body` still needs to render "as if" at a specific level, since the CSS custom property cascade doesn't reach it there through the DOM it was triggered from. |
| `"background"` | Absolute level 0 — "the background color" is level 0's own definition (above) — with the reset propagated to children too. Always a real, visible boundary against any nonzero ambient level; it must not simply repaint whatever's already ambient, since that would produce the exact same color as the parent that set it — no boundary at all, and padding with no boundary is forbidden (Padding and boundaries, Axis 3). |
| `"none"` | A true no-op: no paint, no level change — the same as `[surface]` being absent entirely. The escape hatch to cancel a default `surface` a wrapping component might apply, mirroring `spacing="none"`/`pad="none"` (Axis 3) rather than inventing a distinct "reset but don't repaint" behavior. Because it paints nothing, an element using `surface="none"` needs its own `border` (or some other boundary) if it also pads itself — `surface="none"` alone does not satisfy the padding/boundary rule. |

`[surface]` is layout elements only (`e-flex`/`e-grid`/`e-block`/`e-row`/`e-column`) — CSS attribute selectors can't be scoped to arbitrary HTML. The same values are available as a class for any other element: `theme.colors.tint.classes.as_surface(2)` (`ui/theme.tsx`) returns a class name built from the exact same formula the `[surface]` attribute itself uses internally, for a plain `<div>`, an SVG element, or anything else outside the blessed `e-*` set. `theme.colors.tint.as_surface(2)` (no `.classes`) is different: a bare CSS color value for the same absolute level — usable directly in a declaration (`border-top: 1px solid ${theme.colors.tint.as_surface(1)}`), not a class, and it can't propagate the level to children the way the class/attribute form does (there's no scalar color that also resets an ambient custom property) — so it only accepts a number or `"increment"`, never `"background"`/`"none"`, which are meaningless outside the class/attribute form.

**Every `Mix` member that produces a class has a `.css.<name>`/`.classes.<name>` pair**, not just `as_surface`: `.css.as_tint`/`.classes.as_tint` and `.css.as_inverted`/`.classes.as_inverted` follow the same split. `.css.<name>` is the raw CSS declaration string (private/internal, not usually called directly — it's what `.classes.<name>` wraps into a ruleset); `.classes.<name>` is the cached, stable class name. This mirrors `Theme.css`/`Theme.classes` (declaration-string vs. class-name, same idea one level up, for the spacing scale) but is a *separate* pair of namespaces scoped to one color instance — `theme.colors.tint.css.as_inverted` and `theme.css.pad(step)` are not the same `.css`. Any new parameterized `Mix` method that needs both forms follows this shape: a bare top-level name for the value (when one exists — not every class-producing thing reduces to a single color; `as_tint`/`as_inverted` don't, so they exist only as `.classes.*`, no bare top-level counterpart), `.css.<name>` for the raw declaration, `.classes.<name>` for the class.

Hover uses level *n+1*; a border or divider drawn on a surface at level *n* uses level *n+2*, relative to its own container — never a fixed named step. Splitting hover (*n+1*) from border/divider (*n+2*) is what makes them distinguishable when both appear on the same row at once.

Implemented as `.hover`/`.separator` on `Mix` (`ui/theme.tsx`): both read the same `--e-surface-level`/`--e-surface-step` custom properties `[surface]` sets, at `+1`/`+2` respectively, so a call site never needs to know its own ambient level — only that `theme.colors.tint.hover`/`.separator` mean "one/two levels up from wherever this rule ends up applying."

Color classes (`class_light`, `class_dark`, `class_dynamic`) move under a `classes` namespace (`theme.classes.light_scheme`, `.dark_scheme`, `.dynamic_scheme`), alongside the spacing classes below — one place for every class-name-producing helper on `Theme`.

Border and divider stay two different concepts even though they may resolve to the same computed value: a **border** is the contour of one element (its own shape); a **divider** marks a boundary between elements (`<hr>`, a row separator).

The *n+2* rule is for visual separation only (a container's own edge, a divider between elements). A focusable widget (button, input, and similar interactable controls) instead gets a defined border from its own emphasis variant's color, at full text-level intensity — `.text` for the `default` variant, `.tint` for the `tint` variant — not from the surface-level stack. Its border is about the control's own identity, not its position in a surface stack. `link` and `text` have no border at all.

`elt/ui` does not define a panel or a card as such. Any layout container (`e-flex`, `e-grid`, `e-block`) becomes a panel-like surface simply by carrying a border, a radius, and/or a background — whether a panel or card has its own background at all, or only a border, is an app decision, not something `elt/ui` mandates. When a background is used, it's just `surface` — the same primitive as everything else, which makes a panel's own fill *n+1* relative to its own parent, the same level hover uses (not a collision: a permanent fill and a hover state aren't simultaneously visible on the same box).

`e-flex`/`e-grid`/`e-block` have attribute-level `border`, `border-radius`, and `surface` attrs in `ui/layout.css.tsx` (unfinished — `border` currently only accepts `"widget"`).

**Border radius is derived, not a separately maintained scale.** An element's `border-radius` equals its own *vertical* padding step (the tighter of the horizontal/vertical pair — spacing is deliberately asymmetric, and a radius bigger than the tighter dimension would visibly cut into the content box). A rounded corner is a quarter-circle whose arc is centered at (R, R) from the true corner; when padding P equals R, the content box's own corner sits exactly at that arc's center, equidistant from the curve in every direction — a visibly "nested" look, not a coincidence of matching numbers. A bigger visual radius is an emergent consequence of choosing a bigger padding step (`component`, `section`, …) for that surface, not a second thing to track.

Implemented: `[border-radius]` (`ui/layout.css.tsx`) reads `var(--e-pad-vertical, var(--e-spacing-widget-horizontal))` on the same element, rather than a separately chosen value. `borderRadius`/`frameBorderRadius` (`ui/theme.tsx`) still exist for controls/dialogs that don't go through the attribute system, aligned to `8px`/`16px` (`widget`/`component`) instead of their old `6px`/`12px`.

> ❓ **Open**: the dialog panel itself is the one clear case this doesn't cover — it's a boundary (border + cast shadow) but, per the padding/boundary rules, does *not* pad itself (its header/content/footer do). "Radius = own vertical padding step" has nothing to read from on the panel. It currently keeps `frameBorderRadius` as a fixed fallback; is that the right call, or should an un-padded boundary derive its radius from its *children*'s padding instead?

The demo (`demo/src/screen-layout.tsx`, "Surfaces" section) has worked examples of `surface`, nested surface levels, and derived `border-radius`; its "Absolute levels, and non-standard elements" subsection shows `surface="1"`…`"6"`, `"background"`, `"none"`, and `theme.colors.tint.classes.as_surface(2)` applied to a plain `<div>`; its "Hover and separator" subsection shows `.hover`/`.separator` on a real hoverable row inside a level-1 surface.

### State

`.hover` is a further mix layered on top of whichever surface level is currently active — level *n+1* (see Surfaces and borders, above).

`.selected` is not a level-stack step at all — it applies inversion, using `tint.faded` rather than full `tint`: one notch quieter than the `inverted` variant's maximum-attention case, reusing the same mechanism (Inversion, below) rather than a separate value. A multi-select list showing several inverted rows at once is fine — selection is a different kind of emphasis than "the one dominant action" the `inverted` restraint rule (Emphasis and promotion) is about, since selected rows aren't competing with each other for the user's next action.

> ❓ **Open**: worth a second look once a real multi-select widget exists to eyeball — "reads fine in principle" isn't guaranteed to survive five selected rows on screen.

`.active`/pressed reuses the level stack, one step past hover (the same computed color a border/divider there would use). No requirement to stay distinguishable from a border at that level — press is rapid and transient, not persistent, so momentary overlap isn't a real collision.

Focus stays outside the level stack entirely: a ring/outline drawn around an element (`tint.mid` + `focusRingSize`, already in `ui/form.css.tsx`), not a fill or a border replacing the element's own.

Disabled reuses `.mid` for text/fills where needed.

### Inversion

Inversion is one mechanism, not several named variants: given a color, it produces a new bg/text/tint triad — new `bg` = that color, new `text` = old `bg`, new `tint` = old `bg`. `Mix.as_inverted` is the primitive; how attention-grabbing the result looks depends entirely on which color goes in, not on a separate mode. `elt/ui` has one class (`Mix`, `ui/theme.tsx`) for both a named palette entry and any color computed from one — a named color is just a `Mix` whose expression is a palette variable reference, with a stable label for its generated class names; there is no separate `Color` class to keep in sync.

- Inverting `tint` gives the maximum-attention result — toolbars, heavy actions. This is what the `inverted` button variant and inverted containers use (Axis 1, Emphasis and promotion).
- Inverting `tint.faded` gives one notch less: this is what `.selected` uses (Axis 1, State) — loud enough to read as selected, quiet enough not to compete with a genuinely dominant `inverted` action elsewhere on the same screen.
- Inverting a softer, less saturated color gives a lower-attention result for structural-but-secondary framing elements (toolbars, headers, and similar chrome, not the content they frame) — table headers, status bars, navs. `text.faded` is used for this.

Inversion sets the new `text`/`tint` to the *light* theme's `bg` specifically (`--e-light-color-bg`), not "whichever theme is currently active." This is deliberate: an inverted band looks the same regardless of light/dark mode.

The bg/text/tint combination currently in effect (which changes under inversion) is called a **ColorScheme** — the name already used for this shape as a generic type parameter on `Theme` in `ui/theme.tsx`.

Spelling out the soft-inverted form (`text.faded.as_inverted`) at each call site (table header, status bar, nav) is acceptable — a named shortcut may be added later if it turns out to be repeated often enough to be worth it, but that is not blocking.

The demo (`demo/src/screen-layout.tsx`, "Inversion" section) has a worked example of the same-color-nested-inside-itself case above, next to a different-color-nested case for comparison.

Status/severity hues stay outside `elt/ui`'s remit as a hard rule: the palette exists (`red`, `orange`, `green`, …), but which hue means "error" vs. "success" is an app decision, not something this document prescribes. As a convention, not a requirement: red/error, yellow/warning, green/success follows general consensus and is worth stating as a default an app can deviate from with reason.

> 📜 **ADR**: Every color in `ui/theme.tsx`'s default palette (`tint`, `red`, `orange`, `yellow`, `green`, `cyan`, `blue`, `purple`, `magenta`, …) is a `Mix` instance with the same methods. The rules above are written generically ("a color," not "tint") because the mechanism already works that way in code.

## Axis 2: Overlay and interruption

`elt/ui` offers two overlay mechanisms, placed on one interruption axis:

- **Popup** — light interruption. Anchored to a trigger element. Content is small and only makes sense in reference to that trigger. Dismiss lightly (click away, `Esc`). No independent title row.
- **Dialog** — full interruption. Not anchored to a single element. The user must pause, act, and explicitly leave before returning to the page. Content is large or structured enough to act as its own screen, and may itself use an inverted title row and the layout/spacing axes below, the same as any other screen.

Pick the lowest level on this axis that still gives the action enough room and keeps the user's place on the page. Escalate to a dialog only when the interaction cannot be trusted to happen safely or clearly without a pause — heavy, hard-to-reverse actions almost always deserve a dialog, and are also good candidates for an inverted surface inside it (see Axis 1).

`elt/ui` does not hide or collapse content by default. Build collapsible or hidden content only when the widget's own task expects it structurally — a tree, a code gutter (fold markers), and similar cases where collapse is the content's normal behavior, not a space-saving add-on.

> 📜 **ADR**: A generic inline expansion mechanism (accordion-style disclosure) was considered and dropped. Every candidate use case collapses into an existing pattern: long reference content is better served by a table of contents than a collapsed section; optional settings are better as a separate screen than hidden by default; a table row needing more detail is master-detail or a dialog; a field that only applies sometimes is conditional rendering (`If`/`Switch` in core elt), not a layout concern at all. `elt/ui` does not offer an accordion widget.

**Overlay lift**: a dialog separates from the page behind it with a cast shadow *and* a dimmed/blurred backdrop; a popup gets a cast shadow only, no backdrop. This matches the interruption split above — full interruption (dialog) gets more visual weight than light interruption (popup).

This needs its own shadow tokens, distinct from `--e-color-shadow-raise`/`-drop` (`ui/theme.tsx`) — those are a different system entirely: an inset bevel used to give buttons/toggles a tactile raised/pressed look (already in active use in `ui/form.css.tsx`), not overlay elevation. Reusing that pair for cast shadows would be a real naming collision, not just an unfortunate echo.

> 🔨 **Todo**: Add `shadow-cast` tokens (name favored, not fully locked) for overlay lift, and migrate `ui/dialog.tsx`/`ui/popup.tsx` off their current hardcoded `rgba(...)` shadow/backdrop values onto them — both currently ignore the theme entirely for this. The existing bevel system (`shadow-raise`/`-drop`) stays scoped to individual widgets, not generalized into a rule.

## Axis 3: Spacing and density

Unless the need explicitely calls for it, **never** set a margin. Spacing between elements is entirely handled by layout containers.

### Spacing scale

Pick a step by the semantic distance between what it separates, not by eye. Step names are semantic, not size words.

Two attributes: `pad` (an element's own inset, between its content and its boundary) and `spacing` (distance between an element's children — the attribute-level expression of the Spacing concept: `gap` in flex/grid contexts). `pad="X"` implies `spacing="X"` at the same step automatically — a padded container is exactly the kind of container that must space its own children (Padding and boundaries, below) — so writing `pad` alone is normally enough. `spacing` never implies `pad`: an un-padded container may still set its own `spacing` to separate children that aren't meant to touch, without thereby becoming a boundary (see rule 3, below).

A bare `pad`/`spacing` (no value — `true` in the type, `false` isn't accepted, since it renders as an absent attribute indistinguishable from never having set it) falls back to `component`. An explicit `spacing="Y"` on a padded element overrides the step `pad` implied, for the rare case where padding and inter-child spacing genuinely need to differ. `pad="none"` implies no spacing at all (there's no padding for the implication to apply to); `spacing="none"` explicitly zeroes it, overriding whatever `pad` implied.

| Step | Use for |
| --- | --- |
| `1` / `2` / `4` (px) | Pixel-level nudges only. Never a default choice. Symmetric — no vertical/horizontal pair. |
| `widget` (4px vertical / 8px horizontal) | Inside one atomic cluster: an icon and its label in a button, a control and its inline suffix. Also the default control padding. |
| `component` (8px vertical / 16px horizontal) | Between distinct but related groups: one form group to the next, panel content to its border. The default — most used. |
| `section` (16px vertical / 32px horizontal) | Between major sections of one view or panel. |
| `stage-1`–`stage-4` (32–256px vertical / 64–512px horizontal) | Between independent regions of a page. Numbered rather than individually named — fine distinctions between "very large" steps don't carry much individual meaning past a certain point. |

The `1ch`, font-relative `inline` step this axis considered is dropped — the small end stays entirely on the plain px-doubling scale (`1`, `2`, `4`, `widget`).

At a given step, vertical spacing is half its horizontal value — a tuned optical compensation, not a formula derived from any specific font's metrics.

> Why: line-height always adds real vertical space above and below text (its "half-leading") that horizontal padding has no equivalent of, so equal vertical/horizontal padding reads as visibly bottom-and-top-heavy compared to the sides. Halving the vertical value compensates for that by eye. `text-box-trim`/`text-box-edge` were tried as a way to remove the half-leading at the source instead (making equal values correct) and then dropped: they're a silent no-op on `display: flex`/`grid` containers — the property still computes as set, but doesn't trim anything — which makes them unsafe as the sole mechanism for anything that might ever need flex/grid layout internally (an icon next to a label, for instance). Plain padding has no such gap: it applies identically under block, inline-block, flex, grid, and table-cell layout, so a tuned constant is the version that actually holds everywhere.

`e-row`/`e-column` are semantic aliases over `e-flex` (already its two directions); `e-flex` stays available underneath for the grid-adjacent or direction-agnostic cases or when row/columns need to change dynamically.

The spacing scale lives in `Theme`/`ThemeSettings` (`ui/theme.tsx`: `spacing1`/`spacing2`/`spacing4`/`spacingWidgetVertical`/`spacingWidgetHorizontal`/`spacingComponentVertical`/`spacingComponentHorizontal`/`spacingSectionVertical`/`spacingSectionHorizontal`/`spacingStage1Vertical`–`spacingStage4Horizontal`), emitted through the theme class like every other setting, not a static `:root` block. `spacingWidget`/`spacingComponent`/`spacingSection`/`spacingStage1`–`spacingStage4` are shorthands combining their pair — `"<vertical> <horizontal>"`, ready to use directly as a `padding`/`gap` value. `_set()`'s naming helper inserts a dash before digit runs as well as uppercase letters, so `spacing1` → `--e-spacing-1` correctly — the tradeoff is that `spacingStage1Vertical` → `--e-spacing-stage-1-vertical` (a dash before the digit there too), so the step names themselves are `stage-1`–`stage-4`, not `stage1`–`stage4`. Adopted as the standard rather than special-cased, since nothing depended on the no-dash form yet.

Old-name → new-name equivalence table, for mechanically converting existing code: [`specs/ui-migration.md`](./ui-migration.md). Started with the Color axis (Axis 1) during the removal of the obsolete `.light`/`.ultra_light` steps; still open for the remaining axes as their renames get settled.

Controls use this same scale for their own internal padding (typically `widget`), scaled by density like any other spacing value. There is no separate control-sizing system to keep in sync by hand — `paddingPanel*`/`paddingCell*` are gone from `ThemeSettings`. "Cell" padding wasn't kept as a separate, smaller concept — it collapsed into `widget`-level padding; "panel" padding collapsed into `component`-level.

Every `padding`/`gap`/`border-radius` declaration in `ui/` reads a named step, never a literal px value — `theme.settings.spacingWidget` (etc., the `"<vertical> <horizontal>"` shorthand) or `theme.settings.spacingWidgetVertical`/`Horizontal` (etc., for the single-axis case) for code with direct settings access, or `theme.css.pad(step)`/`theme.css.spacing(step)` (`ui/theme.tsx`) for the declaration-string form that `layout.css.tsx`'s attribute rules, and any standalone element outside the `e-*` set, both consume — a single source of truth `layout.css.tsx` calls into rather than re-deriving its own copy of the same rules. `theme.classes.pad(step)`/`theme.classes.spacing(step)` return the equivalent as a class name, for elements that can't use CSS attribute selectors — the same split `theme.classes.light_scheme`/`.dark_scheme`/`.dynamic_scheme` (Surfaces and borders, above) and `theme.colors.tint.classes.as_surface(2)` already use elsewhere in `Theme`. The `pad`-implies-`spacing` link itself is a CSS custom-property cascade (`--e-spacing-vertical`/`-horizontal`, read by a single `gap` declaration), the same ambient-inheritance mechanism `[surface]` already uses — not a source-order-dependent pair of literal `gap` declarations. `margin` is deliberately not part of this helper set — it stays the discouraged escape hatch it already is (see above), not a first-class spacing mechanism.

> 🔨 **Todo**: `ui/form.css.tsx` still has two hardcoded, scale-independent paddings (`fieldset > legend`: `0 6px`; `fieldset`: `8px 16px`) that predate the `paddingCell*`/`paddingPanel*` migration and were out of scope for it — not touched, flagged here so they're not lost.

### Padding and boundaries

Three rules:

1. **Padding requires a boundary** (a border or a background). Padding is only ever visible in the presence of one — with neither, it has nothing to show itself against and does nothing perceptible. Padding with no boundary is therefore not a style choice, it's a contradiction: forbidden, not merely discouraged. This rule is about *content*, not boundaries — two boundaries (e.g. two bordered buttons) may sit directly against each other and share a seam; it's only an element's own content that must never touch a boundary unpadded.
2. **A container with more than one child must set `spacing` between them, unless its children are meant to touch directly** (rule 3). `pad` implies `spacing` automatically (Spacing scale, above), so a padded container satisfies this for free; an un-padded container can still set `spacing` explicitly when it needs to separate children without becoming a boundary itself (a row nested inside an already-padded ancestor that just needs a bit more room between two of its own children, for instance).
3. **A container's children may touch directly instead of being spaced apart, provided it sets no spacing and every child carries the same padding.** The children then separate only by their own backgrounds/borders — visual uniformity is paramount here, so a container relying on this must not let its children choose their own padding independently. Each touching child does *not* need its own separate border/background to satisfy rule 1: padding shown against the parent's own boundary is enough (a menu with borderless, padded, hoverable rows inside a bordered/backgrounded menu container, for instance) — a child only needs a distinct boundary of its own when it must stand out from that shared backdrop (a hover or selected state). Whether the container *also* pads itself is a separate, independent choice — nothing about touching children requires the container to stay unpadded; it may pad its own edge as well as its children's, at a different step if the two need to differ (a popup's own edge inset next to its rows' tighter click-target padding, for instance).

Tested against every case this document has walked through — a plain spaced row of already-bordered buttons, an inverted top-of-screen toolbar, a cobbled-together button group (no pad, no spacing, adjacent full borders collapsed into shared lines rather than doubling), the dialog's header/content/footer (the panel itself is the un-padded, un-spaced boundary; each row independently earns its own boundary and padding) — three rules cover all of it without a special case for any one of them.

**Rule 3 is implemented, not just a discipline to remember**: the `touching` attribute on `<e-flex>`/`<e-row>`/`<e-column>` (`ui/layout.css.tsx`). `pad` always keeps its ordinary meaning — it pads the container itself, touching or not. Bare `touching`/`"bare"`/`"border"` (no step of their own) additionally reuse whatever `pad` resolves to for every child too, uniformly, overriding a child's own native padding rather than leaving it to chance ; an explicit step (`touching="widget"`, or `touching="border-widget"` for the bordered variant) pads the children at that step instead, independently of whatever `pad` is set to — the mechanism a menu/popup uses to give its own edge one step and its rows another. `touching="border"`/`touching="border-X"` additionally draw a real divider on the touching seam (`tint.separator`, `border-left` for a row / `border-top` for a column), replacing — not doubling — a child's own border there, and zeroes the corner radii on that seam. `touching` never implies `spacing`; a touching container is always gap-less by construction.

Checked against `ui/dialog.tsx`, compliant with rule 3: the dialog element is a real `display: flex; flex-direction: column` boundary (border + background + shadow) with no padding and no spacing of its own; header/content/footer touch directly, separated only by their own background/border differences (header: inverted background; content: a `border-top`; footer: a tinted background), each carrying the same `spacingComponent` padding — which `show_dialog`'s `{ header?, body, footer? }` callback shape enforces structurally, the caller can no longer choose or omit it. `<e-button-box>` and the global `<menu>`/`<nav>` styling (`ui/form.css.tsx`, `ui/menu.tsx`, `ui/nav.tsx`) are gone, replaced by `touching` at every former call site (`ui/select.tsx`, `demo/src/base.tsx`, `ui/search.tsx`, `ui/date.tsx`, `editor/composite-toolbar.tsx`) — they didn't earn their keep once the attribute existed to express the same shape generically.

> 🔨 **Todo**: migrating off `<menu>` means the left nav (`demo/src/base.tsx`) and the property browser (`specs/object-editor.tsx`) lost the icon/column alignment `menu.tsx`'s grid/subgrid layout gave them for free — `touching` is a flex mechanism, it doesn't replace CSS grid. Not rebuilt in this pass; each row still lays out correctly, just without cross-row column alignment.

> 🔨 **Todo**: the `<menu>`/popup rows now carry `role="menu"`/`role="menuitem"` (action lists) or `role="listbox"`/`role="option"` (`ui/select.tsx`) as appropriate, and the left nav is a real `<nav aria-label="…">`. These are ARIA APG *composite widget* roles, which formally require roving-tabindex arrow-key navigation and focus management to be fully correct — not implemented here. The roles/labels are accurate about what the widget *is*; the keyboard interaction model that goes with them is a separate, larger piece of work.

`ui/date.tsx`'s `cls_dow` padding-with-no-boundary violation is fixed (`line-height` instead of `padding`).

Rule 2 depends on `spacing` actually doing something: `gap` (the CSS property `spacing` maps to) is a flex/grid property and is a no-op on `e-block` (`display: block`, per `ui/layout.css.tsx`) — setting `pad`/`spacing` on an `e-block` sets the custom property but nothing ever reads it into an actual `gap` CSS declaration for a plain block container. An `e-block` that pads itself therefore only stays rule-2-compliant with exactly one child (the lone-child exemption) or with a single flex/grid child that does its own spacing internally — never with several loose children counting on the `e-block`'s own (inert) implied `spacing` to separate them. Reach for `e-column`/`e-row`/`e-flex` instead of `e-block` wherever a padded container has more than one child that needs real separation.

`demo/src/screen-layout.tsx`'s "Surfaces" and "Hover and separator" sections were caught doing exactly this (an `e-block` padding itself around several loose children, relying on inert `gap`) and around `surface="background"`/`surface="none"` painting no perceptible boundary of their own — both fixed: the padded multi-child wrappers are now `e-column`, and `surface="background"`/`"none"` were corrected to the definitions above (which resolved the boundary issue as a side effect).

### Density

`elt/ui` exposes one density setting, entirely driven by the theme: `"compact" | "default" | "comfortable"` (naming to confirm), alongside `o_force_theme`. It applies one multiplier to the whole spacing scale and to control height/font size together. Widgets never branch on density; they only read the scaled CSS variables.

## Axis 4: Layout

`e-flex` and its siblings `e-column` and `e-row` cover flexbox row/column layouts. `e-grid` covers CSS grid layouts, with a `css` rule for the grid template when attributes are not enough. `e-block` (renamed from `e-box`, for naming consistency — all three name their CSS `display` value) covers block containers, including typographic mode.

> 🔨 **Todo**: the rename landed across every `.tsx`/`.ts` file (21 files, plus the two DOM-querying test files), but not the prose docs that still say `e-box` (`docs/using-elt-ui.md`, `docs/using-elt-ui-agent.md`, `specs/ui-color-picker.md`) — not touched this pass.

`ui/layout.css.tsx`'s selectors were missing `e-row`/`e-column` in several places — `[inline]`, `[max-width]`/`[max-height]`/`[full-screen]`/`[full-width]`/`[full-height]`, `[relative]`, `[grow]`, `[pad]`, and `[spacing]` — some checked against `:is(e-flex,e-grid,e-block)` only, others against bare `e-flex`. Fixed, using the already-declared `_all`/`_flex` selector groups (`_flex` had been defined but never actually used anywhere). Every plain `<e-flex>` in the demo (no dynamic direction) is now `<e-row>` or `<e-column>` as appropriate; `e-flex` itself is reserved for the grid-adjacent or genuinely direction-agnostic cases, none of which showed up in the demo.

CSS never collapses margins on a flex or grid item, whether the container is `display: flex`/`grid` or `display: inline-flex`/`inline-grid` — the `inline-` prefix only changes how the container itself sits in its parent's layout, not whether its own children's margins collapse. Margin collapsing is exclusively a block-formatting-context behavior between block-level boxes.

This matters directly for `typographic` mode: `<e-block typographic>` gives its direct children `margin-block: 1em` (with adjacent margins collapsing down to 1em between two block-level children, per normal CSS flow). An `e-flex`/`e-grid` container placed as one of those children does not collapse its own margin against a neighboring paragraph's margin — the two add up instead (1em + 1em = 2em), breaking the zone's vertical rhythm at that boundary.

An `e-flex`/`e-grid` container does not sit as a direct, top-level child of a typographic zone. It sits inside an ordinary block element (a `p`, a `div`, or similar) instead, the way the zone already treats any unrecognized child as paragraph-like (`margin-block: 1em`, per `typography.css.tsx`). The wrapping block element is what participates in the zone's margin collapsing; the `e-flex`/`e-grid` content inside it needs no margin of its own.

### Adjacency-aware spacing

Typographic mode varies spacing by sibling type on its own (a heading before a paragraph gets different spacing than paragraph-before-paragraph) — that stays specific to `typographic` content.

Outside typographic content, siblings at the same level are spaced uniformly, by a single `spacing` step — adjacency-aware spacing does not generalize beyond typographic mode. A header/content/footer split, and similar cases, are already fully explained by Padding and boundaries (above), with no per-sibling `spacing` variation involved.

## Axis 5: Typography

Typographic mode is the source of correct typography in `elt/ui`; content inside `<e-block typographic>` should read well by default, following established typesetting conventions rather than app-specific hand-styling.

`typography.css.tsx` already fixes, inside `<e-block typographic>`:

- Body line-height 1.7; heading line-height 1.2.
- Heading scale: h1 2rem, h2 1.5rem, h3 1.25rem, h4 1.1rem, h5 1rem (italic), h6 0.9rem (italic, faded color).
- Vertical rhythm: 1em margin between block siblings by default; headings get 1.5em above, 0.4em below.
- `text-wrap: balance` on headings, `text-wrap: pretty` on paragraphs.

No measure (line-length limit) is set on `<e-block typographic>` by design — constraining width is an application choice, not `elt/ui`'s. `elt/ui` governs visual flow (rhythm, hierarchy); visual identity choices like a line-length limit are left to the app's own layout.

## Axis 6: Motion

`elt/ui` wants a generic rule for elements appearing and disappearing (not limited to dialogs), plus dialog-specific motion on top of it.

Realistic scope for this axis: appear/disappear (mount/unmount, already needed for popup/dialog), and page/route-level transitions (navigating between screens). List reordering and drag feedback are not needed yet — no widget in `elt/ui` currently supports reordering or dragging; add a rule if and when one does, not ahead of it. The "no hidden content by default" rule (Axis 2) also removes most of the expand/collapse motion a UI kit would otherwise need.

The browser View Transitions API names elements (`view-transition-name`) and animates changes between DOM states, including route changes — it covers page-level transitions in a way the current `animate`/`animate_show`/`animate_hide` keyframe helpers do not attempt.

Route/page-level transitions go through the View Transitions API, with `animate`/`animate_show`/`animate_hide` staying for small, local appear/disappear (popup, dialog, individual widgets). Graceful absence is acceptable where the browser does not support it — no fallback needed. The transition is triggered by the app itself, inside its route `activate()`, not by a generic `elt/ui` helper — an automatic, blanket transition on every route change is explicitly rejected (see ADR below).

> 📜 **ADR**: `src/app/app.ts` had a commented-out call to `document.startViewTransition` that wrapped every route change automatically. That approach created transitions indiscriminately and took the decision of when/how to transition away from the app. The `activate()`-triggered, opt-in design replaces it.

Building the transition wrapper is the app's job, not `elt/ui`'s: the app wraps its own `route.activate()` calls in `document.startViewTransition`, opting in per route. `elt/ui` documents the pattern; it does not ship a generic helper for it — the earlier commented-out attempt in `app.ts` failed specifically because it tried to make this automatic instead of an app-level choice (see ADR above).

> 🔨 **Todo**: Write the local appear/disappear rule (trigger conditions, duration/easing tokens, reduced-motion handling — already partly covered by `prefers_reduced_motion()` in `ui/animation.tsx`).

## Axis 7: Component selection

`elt/ui`'s native-first rule and promotion threshold (native HTML first; promote an app pattern to a dedicated `ui/` widget only once a second app needs it, per `using-elt-ui-agent.md`) is the generic rule for building any new component, including complex ones. Complex widgets such as the date/time picker and the object editor must follow it the same as any other widget.

Overall app layout (page shell, navigation placement, and so on) is out of scope for this document. It is left to `e-flex`/`e-grid`/`e-block` and app-level judgment. The demo contains reference patterns for this, but none of them are binding.

> 🔨 **Todo**: `editor/schema.tsx`, `editor/shell.tsx`, and `editor/composite-toolbar.tsx` were built entirely against guessed CSS custom property names (`--e-color-background`, `--e-color-text-light`, `--e-color-text-mid`, `--e-color-warning`) that were never actually defined anywhere in the theme — none of them imported `theme` at all. Every fallback value (`#fff`, `#ccc`, `#888`, `#b8860b`) was therefore the one always rendering, regardless of light/dark mode — this is why the object editor's table headers stayed white in dark mode. Fixed: all three files now import `theme` from `elt/ui` and use real `theme.colors.*`/`theme.settings.*` values. Also fixed while in the area: the array-table view's search/filter toolbar was a sibling above the table, not inside it — moved into the table's own sticky `<thead>` (a second header row, spanning all columns via `colspan`) so it's genuinely part of the header rather than floating outside it; the shell's global undo/redo bar was a separate strip stacked above the root column's own header — merged into that header instead, since a column's header already exists and having a second, differently-styled bar on top of it for the same "this is the editor's controls" purpose was the "sits outside" feeling being reported. Table `<th>` background now matches the typographic table example (`text.faded.css.as_inverted`, per Inversion above — not a guessed page-background var), and container border-radius follows `theme.settings.borderRadius`/`frameBorderRadius` instead of scattered hardcoded pixel values.
