# Elt/ui guidelines

This document tries to define what giving an elt/ui application a common look and feel entails. Doing so will redefine parts of elt/ui. The result of the work happening in this file will be : a living spec that Agents and Humans alike can adhere to and changes to be applied to the elt/ui codebase.

The rules must let an agent make almost no layout or style decisions on its own when it builds a new screen.

## Scope

This document is the single source for rules and decisions (the "why", as axes). `docs/using-elt-ui-agent.md` stays pure API reference (the "how": tables of attributes/props) and links back here for rationale. The two documents stay separate.

## Axis 1: Color

### Status (recap)

Settled so far:

- **Five emphasis variants**, shared by buttons and containers: `link` (no border, no background — reads as a hyperlink) and `text` (no border, no background, tinted, no underline — a bare utility for icon-only/custom controls, not link semantics) sit at the bottom, both boundary-less; then `default` (bordered, neutral) → `tint` (bordered, tint-colored) → `inverted` (filled, tint as background). One word for both the button variant and the underlying `Color` mechanism where they overlap — one rung (`inverted`), reserved for the single action or region that should visually dominate.
- `Color.as_inverted` is the general primitive: given any color, it produces a new bg/text/tint combination — new `bg` = that color, new `text`/`tint` = old `bg`. The `inverted` variant is specifically `tint.as_inverted`, the loudest case; `.selected` uses `tint.faded.as_inverted`, one notch quieter; a soft structural inversion (table headers, status bars) uses `text.faded.as_inverted`, quieter still. One mechanism, three examples of "which color you invert" so far.
- **Surfaces have a level**, starting at `bg` (0), each level mixing more tint into `bg`, cascading from whichever level is ambient at that point (not from an absolute page-root count) — a panel that raises a new surface is level *n+1* relative to *its own* parent, not relative to the page. Implemented as the `[surface]` attribute in `ui/layout.css.tsx`.
- **Hover is level *n+1*; border/divider is level *n+2*, relative to the surface they sit on.** A panel/card that wants a background just uses `surface` — the same primitive, not a separate rule — which inherently makes it *n+1* relative to its own parent, matching hover's level (this is fine: a background fill isn't simultaneously visible with a hover state on the same box the way a divider and a hover fill can be).
- **Active/pressed** reuses the same absolute level stack, one step past hover (so at the same computed color a border/divider there would use). No requirement to stay visually distinct from a border at that level — press is a rapid, transient state, not a persistent one, so momentary overlap isn't a real collision.
- **Focus stays outside the level stack entirely** — a ring/outline drawn around an element, not a fill or a border replacing the element's own, so it isn't competing for a "level" the way backgrounds and borders do. Formalizes what's already in code (`tint.mid` + `focusRingSize`) as the actual rule, not an ad hoc choice.
- **`.mid` is a fixed 50%-bg/50%-tint mix, nothing more** — not a rung in the surface-level stack, not exclusively "the disabled color." It's a general-purpose moderate-intensity value, reached for wherever a border, a focus ring, or a disabled indicator needs *some* legible-but-quiet color — the earlier "overloaded meaning" concern dissolves once it's understood as a plain constant rather than a structural step that needs one canonical job.
- **Exception**: a focusable widget (button, input) gets a defined border from its own emphasis variant's color, at full text-level intensity — `.text` for the `default` variant, `.tint` for the `tint` variant — not from the surface-level stack. Its border is about the control's own identity, not its position in a surface stack. `link` and `text` have no border at all — nothing to define here for either.
- **`elt/ui` does not define panels or cards.** Any layout container becomes one via `border`/`border-radius`/`surface` attributes (now in `ui/layout.css.tsx`, unfinished). Border radius is derived, not separately maintained: an element's `border-radius` equals its own *vertical* padding step (the tighter of the horizontal/vertical pair) — see Surfaces and borders, below. This drops the earlier `borderRadius`/`frameBorderRadius` two-value system entirely.
- **Status/severity hues are not `elt/ui`'s call, as a hard rule** — the app picks which hue means what. As a convention (not a spec requirement), red/yellow/green for error/warning/success follows general consensus, worth stating as guidance an app can deviate from with reason, not enforcing it.
- `.intense` is dropped — no use case surfaced for a color strictly between `tint` and `text`, and the axis's own "don't name one-offs" rule says that's reason enough not to keep it.
- The bg/text/tint combination currently in effect is named **ColorScheme** (matches the renamed type in `ui/theme.tsx`).
- The WCAG floor: every tint needs contrast ≥ 3 against both `bg` and `text`, ideally ≥ 4.5.
- Overlay lift (Axis 2) is now codified: dialog gets a cast shadow *and* a dimmed/blurred backdrop; popup gets a cast shadow only, no backdrop — matching the "full vs. light interruption" split Axis 2 already draws. This needs its own shadow tokens (`shadow-cast`, name TBD-but-favored), distinct from the existing `--e-color-shadow-raise`/`-drop` pair, which is a *different* system (inset bevel shading for tactile controls like buttons/toggles, already in active use in `ui/form.css.tsx`) — not overlay elevation, and not being generalized into a rule; it stays scoped per-widget.

Bugs found by comparing this document against the actual code, and their status after this pass:

- **Fixed.** Mix helpers (`.mid`, `.faded`, …) now return a `Mix` instance (`ui/theme.tsx`), not a plain string — `text.faded.as_inverted` works. `Mix.css_as_inverted` uses the mix's own live expression as the new `bg`, so (unlike a named color's inversion) it stays correct across light/dark mode automatically.
- **Fixed.** `ui/layout.css.tsx`'s `header`/`footer` rules now call `.css_as_inverted` (matching the name actually defined in `ui/theme.tsx`), not `.css_inverted`.
- **Fixed, as a judgment call — flagging it rather than treating it as obviously settled.** `footer` now uses `text.faded` for its soft inversion, not `text.mid`. Reasoning: the working model above states `.mid` signals disabled, which doesn't fit a footer's normal (non-disabled) chrome; `.faded` ("alternative to the full color... stays legible") fits the "soft, still-legible inversion" intent this document already describes. Revert if this reasoning is wrong.
- **Fixed.** `--e-surface-step` is now defined (`10%` in `:root`, `ui/layout.css.tsx`) — a first-guess placeholder, not a tuned value; the surface stack now produces visible backgrounds instead of nothing.
- **Fixed.** The single-dash `-e-${att}-vertical`/`-horizontal` in the boolean `[gap]`/`[pad]` default rule is now `--e-${att}-…` — a bare `gap`/`pad` attribute sets spacing again.
- **Fixed, narrower than the smallest-three rename this Warning originally described.** `SpacingValues` and the `spaces` array now say `"1"`/`"2"`/`"4"`, matching the `:root` custom properties (`--e-spacing-1`/`-2`/`-4`) that were already renamed — `gap="1"`/`gap="2"`/`gap="4"` work again (old `gap="x-small"` etc. do not; every call site using the old words needed updating too — none were found in the codebase for these three, only for `small`/`medium`/`large`, which were already fixed separately, below).
- **Not done — moving spacing values into `Theme`/`ThemeSettings` turned out not to be unambiguous.** Tried following the existing `_set()` pattern (used for `borderRadius`, the intensity settings, etc.), which auto-generates each CSS custom property name from the field name by inserting a dash before every uppercase letter. That works for `spacingWidget` → `--e-spacing-widget`, but breaks for the still-unnamed large end: a field like `spacing2XLarge` would generate `--e-spacing2-x-large`, not `--e-spacing-2x-large` — there is no uppercase letter marking the boundary the existing convention needs. Left as a `:root` block in `ui/layout.css.tsx`, unchanged from before this pass, pending either a large-end naming that doesn't have this problem or a change to `_set()` itself.
- **Not done — wider than "clear and unambiguous."** `ThemeSettings`'s `paddingPanel*`/`paddingCell*`/`formFontSize` are used across `ui/dialog.tsx`, `ui/date.tsx`, `ui/form.css.tsx`, `ui/select.tsx`, `ui/nav.tsx`, `ui/timepicker.tsx`, `ui/typography.css.tsx`, and `specs/object-editor.tsx` — not just `header`/`footer` as this Warning first suggested. Migrating all of that to the spacing scale is the sizing-system unification Axis 3 already calls for, but it is a real cross-cutting change, not a bug fix; left as a Todo rather than attempted here.
- **Also fixed while in the area, not previously flagged**: `<e-row>`/`<e-column>` were already styled in CSS but not declared in `declare module "elt"`'s `ElementMap` — using them in JSX would have been a type error. Added.
- **Also fixed**: `e-variant="full"` → `e-variant="inverted"` (the button-variant rename this document already decided) executed across `ui/form.css.tsx` and every call site (`demo/src/screen-visual-test.tsx`); `grey` removed from the default palette (`ui/theme.tsx`) — both were previously just Todos, not bugs, but were unambiguous and small enough to close alongside everything else.
- **Also fixed**: every `gap="small"`/`pad="small"` call site (`ui/timepicker.tsx`, `ui/date.tsx`, `demo/src/screen-object-editor.tsx`, `editor/composite-toolbar.tsx`, `editor/shell.tsx`, `editor/schema.tsx`) updated to `gap="widget"`/`pad="widget"`, matching the spacing rename already committed in `ui/layout.css.tsx`. These had gone silently broken (the old words no longer generate any CSS rule) the moment the rename landed — not previously flagged, found while checking the blast radius of the spacing rename.

Still open (real decisions, not implementation bugs):

- **The padding/boundary/gap rule** is now settled (Axis 3, Spacing → Padding and boundaries): padding requires a boundary; a padded container must set `gap`; an un-padded container with more than one child neither pads nor gaps itself, and every child earns its own boundary instead.
- **A new `link` button variant** sits alongside `text`, not replacing it: `color: tint`, underlined, no padding, no border, no background. This falls directly out of the padding rule above — a boundary-less button can't have padding either, so it needs *some* other way to read as clickable, which can only be the label itself (color + underline), the same way a hyperlink does. `text` stays as the plainer variant it already was (`color: tint`, no border, no background, no underline) — but it now has **no padding either, no exception**. Anything that was relying on `text` having padding was a layout that wasn't respecting the rule, not a reason to carve one out. Fixed at the call sites that assumed otherwise: `ui/timepicker.tsx`'s step buttons now size themselves with `min-width`/`line-height` instead of padding; `ui/date.tsx`'s calendar day cells now use a fixed `height`/`line-height` instead of padding.
- The text/border scale: `muted` = `.faded`, `text`/`tint` = the raw values, `disabled` reuses `.mid`. `selected_text` is dropped from this scale — `::selection` stays its own manual CSS rule (already in `ui/theme.tsx`), unrelated to the general `Color`/`Mix` system.
- **Code Todo**: implement the derived border-radius rule (`border-radius` = own vertical padding step) — not yet done; `borderRadius`/`frameBorderRadius` still exist as-is in `ui/theme.tsx`.
- **Code Todo**: name and add the `shadow-cast` tokens (see Axis 2), and apply them to `ui/dialog.tsx`/`ui/popup.tsx`, replacing their current hardcoded `rgba(...)` shadow/backdrop values.
- **Code Todo**: migrate `ui/dialog.tsx`'s internal header to `tint.as_inverted` (currently `background: tint; color: bg` set manually — same visual result, one code path instead of two). Its footer stays a plain fill, not inverted — that was a deliberate choice, not an inconsistency.
- **Demo Todo**: add a layout section to the demo with a few worked examples using `surface`.
- Naming for the `x-large`-and-above spacing step: resolved as `stage1`–`stage4` (see Axis 3) — numbered, not individually named, since fine distinctions between "very large" steps don't carry much individual meaning.
- Moving `paddingPanel*`/`paddingCell*`/`formFontSize` onto the spacing scale (Axis 3) — real, cross-cutting, committed to as a separate follow-up pass, not attempted this pass.


### Emphasis and promotion

Every interactive control has one of four emphasis variants.

| Variant | Meaning |
| --- | --- |
| `link` | De-emphasized, no border or background — reads as a hyperlink: `color: tint`, underlined, no padding. |
| `text` | Bare: no border, no background, `color: tint`, no underline, no padding — same padding/boundary rule as everything else, no exception. |
| `default` | Base. Bordered, neutral color. |
| `tint` | Accented secondary. Bordered, tint-colored, not filled. |
| `inverted` | Filled with tint as background - no borders |

> Done: `e-variant="link"` added (`ui/form.css.tsx`, `color: tint` + underline + `padding: 0`). `e-variant="text"` kept as the bare/no-underline variant (also `ui/form.css.tsx`), now also `padding: 0` — no exception. `ui/date.tsx`'s day-cell buttons and `ui/timepicker.tsx`'s two step buttons stayed `text` (never link-like) but had their own padding removed and replaced with explicit sizing (`height`/`line-height`, `min-width`) instead, since they still need a consistent size without relying on padding they're no longer allowed to have. Demo (`demo/src/screen-visual-test.tsx`) shows both variants.

> Done: `full` → `inverted` renamed in `ui/form.css.tsx` (`e-variant` type and CSS rules) and every call site (`demo/src/screen-visual-test.tsx`). The `Color` side keeps the `as_` prefix — `as_inverted`/`css_as_inverted`, not `.inverted`/`css_inverted` as first proposed here — matching the code's own naming.

A container can be **inverted**. An inverted container fills its background with tint and flips its foreground color to read against that fill.

Use an inverted container for toolbars and title rows (dialog headers, table header rows), or for parts of the application that convey semantically more important information.

Use the `inverted` button variant for the one action on a screen that needs outsized attention, in particular a heavy action that is hard to reverse. It draws the user's eye; do not use it for more than one action at a time in the same area.

Build an inverted container with `theme.colors.tint.as_inverted` (`ui/theme.tsx` — see the naming Todo above for why it's `as_inverted`, not `.inverted`). This already handles nesting: inside an inverted container, the inversion redefines `--e-color-tint` to the theme's plain background color for its own subtree. A nested inverted element therefore renders with that background color instead of tint-on-tint, with no separate rule to apply — it falls out of the normal CSS variable cascade

> 📜 **ADR**: "Inverted" was chosen over a Material-style "elevation" name. Elevation implies z-depth and shadow, which this rule does not have. "Inverted" names only the background-fill mechanic — the same word for the button variant and the `Color` primitive it is built from, since they are the same mechanism, not two things to keep in sync.

Pick the emphasis variant relative to the surface a control sits on, not in isolation. On an inverted surface, an `inverted` button competes with the surface itself; use `tint` or `default` for other actions on that surface.

### Color theory

There is no fixed palette ; the app may bring its own. At any given point in the UI, only three colors matter

- bg : the surface we're drawing on
- text : the color of regular text
- tint : the actual _color_ that has a hue

The only requirement to have good results is that all the tints must have a WCAG contrast of at least 3, but ideally 4.5 with both text and background.

All the different levels used to colorized aspects of the interface are derived by mixing them, considering an axis that goes from bg to text, with tint in between ; transparency is never used outside of shadows or voluntary transparency (the `::selection` highlight's 25% alpha in `ui/theme.tsx` is this rule's voluntary-transparency case, not an exception to it).

Anything between background and tint is mainly used to separate visual space ; backgrounds to make element pop, borders, dividers, while going from tint to text is mostly to provide textual visual alternatives.

Elt/ui also offers to derive a dark theme from a given theme, recalculating colors according to flipping text and bg, trying to keep light levels consistent. This is opt-in ; the app may give its own theme.

`elt/ui` currently names each mix by visual intensity (below). This naming is under review — see the working model and questions after the raw inventory.

**Current**

| Helper (current) | Mix | Use |
| --- | --- | --- |
| `.ultra_light` | 10% hue / 90% `bg` | Very faint background: dividers, subtle contrast |
| `.light` | 20% hue / 80% `bg` | Hover background |
| `.mid` | 50% hue / 50% `bg` | Borders, dividers |
| `.faded` | 80% hue / 20% `bg` | Alternative to the full color: muted text or fill that stays legible |
| `.slightly_faded` | 90% hue / 10% `bg` | Barely muted, close to full color |
| `.strong` | 10% hue / 90% `text` | Emphasis close to text strength |
| `.very_strong` | 50% hue / 50% `text` | Bold emphasis, still reads as text-strength |

Named steps never grow to cover a one-off need: anything outside the named steps goes through `.from_bg()`/`.from_text()` with an explicit percentage instead of adding a new name.

**Working model**, settled from the discussion above — this list is canonical; the "Current" table above and the recap at the top of this axis both describe the same ground and will be retired once this settles:

- `.surface1`, `.surface2`, … — the level stack (see Surfaces and borders, below).
- `.surface_current` — the level currently active.
- `.hover` — surface level *n+1*.
- `.separator` — surface level *n+2* (borders, dividers).
- `.mid` — a fixed 50% `bg`/`tint` mix. Not part of the level stack; a general-purpose value reached for wherever something moderate-but-legible is needed (a border, a focus ring, a disabled indicator).
- `.faded` — 80% hue.

The mixing axis is a single continuous range, not two separate 0–100% scales: 0% = `bg`, 100% = `tint`, 200% = `text`. `.strong`/`.very_strong` and the dropped `.intense` all sit somewhere on this same range, toward `text`.

In the living code, the surface stack (level *n+1*/*n+2*) replaces `.ultra_light` and `.light`.

### Surfaces and borders

A surface has a **level**, starting at 0, which is the background color. Each subsequent level mixes more tint into the background, proportionally to the level number (level *n* ≈ *n* × one step of tint-into-`bg`).

Implemented in `ui/layout.css.tsx` as the `[surface]` attribute: it reads the ambient `--e-surface-level` custom property, increments it, sets its own background from `tint.from_bg(level × step)`, and passes the new level down to its children — so a border, divider, or hover fill can read "one level up from here" without knowing its own ancestor chain. This resolves the level-tracking Todo from the previous pass.

> Done: `--e-surface-step` is now defined (`10%`, `:root` in `ui/layout.css.tsx`) — a first-guess placeholder value, not tuned.

Hover uses level *n+1*; a border or divider drawn on a surface at level *n* uses level *n+2*, relative to its own container — never a fixed named step. Splitting hover (*n+1*) from border/divider (*n+2*) is what makes them distinguishable when both appear on the same row at once — a hover fill and its own bottom divider no longer compute to the same color, which a flat "both are one step up" rule (the previous pass's assumption) would have collapsed together.

The `[surface]` attribute (`ui/layout.css.tsx`) is the one mechanism for raising a surface — layout elements only, no separate class-based API for arbitrary HTML. Every real case so far (panels, table headers, toolbars) is a layout element or can trivially become one; a second parallel API isn't worth the maintenance cost for a case that hasn't shown up.

> 🔨 **Todo**: `Theme` currently exposes color classes (`class_light`, `class_dark`, `class_dynamic`) as top-level properties. Move them under a `classes` namespace (`theme.classes.light_scheme`, `.dark_scheme`, `.dynamic_scheme`) for organization. Small and mechanical, but worth doing — every surface/inversion primitive added this session makes `Theme`'s top level more crowded.

Border and divider stay two different concepts even though they may resolve to the same computed value: a **border** is the contour of one element (its own shape); a **divider** marks a boundary between elements (`<hr>`, a row separator).

The *n+2* rule is for visual separation only (a container's own edge, a divider between elements). A focusable widget (button, input, and similar interactable controls) instead gets a defined border from the text/border scale (strong, matching text color) — its border marks the control's own shape and identity, not its position in a surface stack, so it does not follow *n+2*.

`elt/ui` does not define a panel or a card as such. Any layout container (`e-flex`, `e-grid`, `e-box`) becomes a panel-like surface simply by carrying a border, a radius, and/or a background — whether a panel or card has its own background at all, or only a border, is an app decision, not something `elt/ui` mandates. When a background is used, it's just `surface` — the same primitive as everything else, which makes a panel's own fill *n+1* relative to its own parent, the same level hover uses (not a special case: a permanent fill and a hover state aren't simultaneously visible on the same box, so sharing a level isn't a collision the way hover/divider was).

`e-flex`/`e-grid`/`e-box` now have attribute-level `border`, `border-radius`, and `surface` attrs in `ui/layout.css.tsx` (unfinished — `border` currently only accepts `"widget"`), covering the previous Todo asking for exactly this.

**Border radius is derived, not a separately maintained scale.** An element's `border-radius` equals its own *vertical* padding step (the tighter of the horizontal/vertical pair — spacing is deliberately asymmetric, and a radius bigger than the tighter dimension would visibly cut into the content box). This is a real design choice, not just a convenience: a rounded corner is a quarter-circle whose arc is centered at (R, R) from the true corner; when padding P equals R, the content box's own corner sits exactly at that arc's center, equidistant from the curve in every direction — a visibly "nested" look, not a coincidence of matching numbers. It replaces `borderRadius`/`frameBorderRadius` as two independently maintained values — a bigger visual radius is now an emergent consequence of choosing a bigger padding step (`component`, `section`, …) for that surface, not a second thing to track. Not yet implemented in code.

### State

`.hover` is a further mix layered on top of whichever surface level is currently active — level *n+1* (see Surfaces and borders, above).

`.selected` is not a level-stack step at all — it applies inversion, using `tint.faded` rather than full `tint`: one notch quieter than the `inverted` variant's maximum-attention case, reusing the same mechanism (Inversion, below) rather than a separate value. A multi-select list showing several inverted rows at once is fine — selection is a different kind of emphasis than "the one dominant action" the `inverted` restraint rule (Emphasis and promotion) is about, since selected rows aren't competing with each other for the user's next action. Worth a second look once a real multi-select widget exists to eyeball, since "reads fine in principle" isn't guaranteed to survive five selected rows on screen.

`.active`/pressed reuses the level stack, one step past hover (the same computed color a border/divider there would use). No requirement to stay distinguishable from a border at that level — press is rapid and transient, not persistent, so momentary overlap isn't a real collision the way hover/divider's was.

Focus stays outside the level stack entirely: a ring/outline drawn around an element (`tint.mid` + `focusRingSize`, already in `ui/form.css.tsx`), not a fill or a border replacing the element's own. It doesn't compete for a "level" the way a background or a divider does, so it doesn't need one.

Disabled reuses `.mid` for text/fills where needed, as today — `.mid` is a general-purpose value (see Working model, above), not a structural step, so this isn't a conflict with its other uses (borders, focus ring).

### Inversion

Inversion is one mechanism, not several named variants: given a color, it produces a new bg/text/tint triad — new `bg` = that color, new `text` = old `bg`, new `tint` = old `bg`. `Color.inverted` is the primitive; how attention-grabbing the result looks depends entirely on which color goes in, not on a separate mode.

> Done: mix helpers (`.mid`, `.faded`, `.strong`, …) now return a `Mix` instance (`ui/theme.tsx`) instead of a plain string. `Mix` has its own `css_as_inverted`/`as_inverted`, built from the mix's own live expression rather than a named-palette lookup — `text.faded.as_inverted` now works. `ui/layout.css.tsx`'s `header`/`footer` rules call `.css_as_inverted` (matching the name `ui/theme.tsx` actually defines).

- Inverting `tint` gives the maximum-attention result — toolbars, heavy actions. This is what the `inverted` button variant and inverted containers use (Axis 1, Emphasis and promotion).
- Inverting `tint.faded` gives one notch less: this is what `.selected` uses (Axis 1, State) — loud enough to read as selected, quiet enough not to compete with a genuinely dominant `inverted` action elsewhere on the same screen.
- Inverting a softer, less saturated color gives a lower-attention result for structural-but-secondary framing elements (toolbars, headers, and similar chrome, not the content they frame) — table headers, status bars, navs. `footer` now uses `text.faded` for this (was `text.mid`) — a judgment call made because `.mid` is a general-purpose value (Axis 1, Working model), not specifically a soft-inversion color; `.faded` ("alternative to the full color... stays legible") fits the intent better.

> Done: `grey` removed from the default theme's palette in `ui/theme.tsx`.

> 🔎 **Assumption**: Inversion sets the new `text`/`tint` to the *light* theme's `bg` specifically (`--e-light-color-bg`), not "whichever theme is currently active." In dark mode this means an inverted band's foreground is always the light-mode background color, not the dark one — likely intentional (an inverted band should look the same regardless of light/dark mode), but currently implicit in the code rather than stated as a rule. Worth one sentence confirming this is deliberate.

The bg/text/tint combination currently in effect (which changes under inversion) is called a **ColorScheme** — the name already used for this shape as a generic type parameter on `Theme` in `ui/theme.tsx`.

Spelling out the soft-inverted form at each call site (table header, status bar, nav) is acceptable once it exists (see the API Warning above) — a named shortcut may be added later if it turns out to be repeated often enough to be worth it, but that is not blocking.

Status/severity hues stay outside `elt/ui`'s remit as a hard rule: the palette exists (`red`, `orange`, `green`, …), but which hue means "error" vs. "success" is an app decision, not something this document prescribes. As a convention, not a requirement: red/error, yellow/warning, green/success follows general consensus and is worth stating as a default an app can deviate from with reason — an agent building a form with no other signal will reach for *some* mapping, and writing down the expected default prevents every app guessing a different one.

> 📜 **ADR**: Every color in `ui/theme.tsx`'s default palette (`tint`, `red`, `orange`, `yellow`, `green`, `cyan`, `blue`, `purple`, `magenta`, …) is a `Color` instance with the same methods. The rules above are written generically ("a color," not "tint") because the mechanism already works that way in code — this is a documentation gap, not a new capability to build.

The text/border scale, settled: `text`/`tint` are the raw values; `muted` = `.faded`; `disabled` reuses `.mid`. `selected_text` is dropped from this scale — text selection stays its own manual `::selection` CSS rule (`ui/theme.tsx`), not part of the general `Color`/`Mix` system.


## Axis 2: Overlay and interruption

`elt/ui` offers two overlay mechanisms, placed on one interruption axis:

- **Popup** — light interruption. Anchored to a trigger element. Content is small and only makes sense in reference to that trigger. Dismiss lightly (click away, `Esc`). No independent title row.
- **Dialog** — full interruption. Not anchored to a single element. The user must pause, act, and explicitly leave before returning to the page. Content is large or structured enough to act as its own screen, and may itself use an inverted title row and the layout/spacing axes below, the same as any other screen.

Pick the lowest level on this axis that still gives the action enough room and keeps the user's place on the page. Escalate to a dialog only when the interaction cannot be trusted to happen safely or clearly without a pause — heavy, hard-to-reverse actions almost always deserve a dialog, and are also good candidates for an inverted surface inside it (see Axis 1).

`elt/ui` does not hide or collapse content by default. Build collapsible or hidden content only when the widget's own task expects it structurally — a tree, a code gutter (fold markers), and similar cases where collapse is the content's normal behavior, not a space-saving add-on.

> 📜 **ADR**: A generic inline expansion mechanism (accordion-style disclosure) was considered and dropped. Every candidate use case collapses into an existing pattern: long reference content is better served by a table of contents than a collapsed section; optional settings are better as a separate screen than hidden by default; a table row needing more detail is master-detail or a dialog; a field that only applies sometimes is conditional rendering (`If`/`Switch` in core elt), not a layout concern at all. `elt/ui` does not offer an accordion widget.

**Overlay lift**: a dialog separates from the page behind it with a cast shadow *and* a dimmed/blurred backdrop; a popup gets a cast shadow only, no backdrop. This matches the interruption split above — full interruption (dialog) gets more visual weight than light interruption (popup), and this is just that same split applied to lift, not a new decision.

This needs its own shadow tokens, distinct from `--e-color-shadow-raise`/`-drop` (`ui/theme.tsx`) — those are a different system entirely: an inset bevel used to give buttons/toggles a tactile raised/pressed look (already in active use in `ui/form.css.tsx`), not overlay elevation. Reusing that pair for cast shadows would be a real naming collision, not just an unfortunate echo.

> 🔨 **Todo**: Add `shadow-cast` tokens (name favored, not fully locked) for overlay lift, and migrate `ui/dialog.tsx`/`ui/popup.tsx` off their current hardcoded `rgba(...)` shadow/backdrop values onto them — both currently ignore the theme entirely for this, so a dark theme gets the same fixed-black shadow a light theme does. The existing bevel system (`shadow-raise`/`-drop`) stays scoped to individual widgets, not generalized into a rule — it solves a different, per-widget problem.

## Axis 3: Spacing and density

Unless the need explicitely calls for it, **never** set a margin. Spacing between elements is entirely handled by layout containers.

### Spacing scale

Pick a step by the semantic distance between what it separates, not by eye:

Step names become semantic (matching the "Use for" column below) rather than size words. The `elt/ui` update: `<e-flex spacing="component" gap pad>` — `gap` and `pad` become plain booleans (do I space between children? do I pad my own boundary?), and `spacing` carries the one named step shared by both, replacing separately-valued `gap="small"`/`pad="medium"` attrs.

`gap`/`pad` without a value take the container's `spacing`. Either can still be given an explicit step directly (`pad="widget"`) to override `spacing` for that one side, even though doing so on a container that also sets `spacing` is rarely useful — the option stays available rather than closed off.

Names, `spacing="…"`:

| Step (current) | Proposed name |
| --- | --- |
| `x-small` | `inline` |
| `small` | `widget` |
| `medium` | `component` (the default — most used) |
| `large` | `section` |
| `x-large` | `stage1` |
| `2x-large` | `stage2` |
| `3x-large` | `stage3` |
| `4x-large` | `stage4` |

Numbered rather than individually named, since fine distinctions between "very large" steps don't carry much individual meaning past a certain point — the small end got its own words (`widget`, `component`, `section`) because those distinctions matter for grouping; the large end doesn't need the same treatment.

`e-row`/`e-column` become semantic aliases over `e-flex` (already its two directions); `e-flex` stays available underneath for the grid-adjacent or direction-agnostic cases.

Below `inline`: `inline` itself is redefined as `1ch` — sized to read as a text space, not a step on the px-doubling scale used from `widget` up. Finer values (`0.75ch`, `0.5ch`, `0.25ch`) exist for visual alignment only, a case rare enough that it does not need named steps — same principle as the color axis's "no naming one-offs," reached through `.from_bg()`/`.from_text()`: a raw `ch` value is used directly rather than adding named sub-`inline` steps.

The `1ch`-and-below split from the px-doubling scale is deliberate: at that level of nit-picking, the scale is relative to whatever it is being compared to (the font), not an absolute step.

> Done: `SpacingValues` and the `spaces` array now use `"1"`/`"2"`/`"4"`, matching the `:root` custom properties. `gap="1"`/`gap="2"`/`gap="4"` work again. No call sites used the old `3x-small`/`2x-small`/`x-small` words, so nothing else needed updating for this particular rename.

> 🔨 **Todo**: `stage1`–`stage4` (above) is a spec-level rename not yet applied to `ui/layout.css.tsx` — the `:root` custom properties and `SpacingValues`/`spaces` are still `x-large`/`2x-large`/`3x-large`/`4x-large`.

**Original scale**

| Step | Use for |
| --- | --- |
| `3x-small` / `2x-small` | Pixel-level nudges only. Never a default choice. |
| `x-small` | Inside one atomic cluster: an icon and its label in a button, a control and its inline suffix. Also the default control padding (see Density below). |
| `small` | Between members of the same group: fields in a row, list items, a label and its control. Default `gap`. |
| `medium` | Between distinct but related groups: one form group to the next, panel content to its border. Default `pad`. |
| `large` | Between major sections of one view or panel. |
| `x-large` and above | Between independent regions of a page. Rare in a toolbar, header, or other framing element. |

Each step has a horizontal and a vertical value that may differ. `elt/ui`'s default steps have a squashed look: for a given step, the horizontal value equals the vertical value of the next larger step. This applies everywhere, controls included: text lines are already dense vertically, and do not need as much horizontal room to stay legible.

> 🔨 **Todo**: Once every rename in this document is settled (spacing step names above; the color role names still pending in Axis 1 — `full`→`inverted` and `as_background`→`as_inverted` are already done), produce a single old-name → new-name equivalence table so an agent can mechanically convert existing code.

### Responsibility

Padding and gap are each owned by exactly one layout container: the one currently arranging the content in question. A container answers two separate questions on its own:

- Does it have a visual boundary worth padding — a border or a background (a level step or an inversion)? If yes, set `pad`. A container with neither never sets `pad`: there is nothing for the padding to visually belong to.
- Does it have children that need arranging? If yes, set `gap`.

A purely structural wrapper, with no visual boundary of its own, still sets `gap` to arrange its children, but does not set `pad`. Never let a parent and a child both add spacing for the same visual gap.

Controls use this same scale for their own internal padding (typically `x-small`/`small`), scaled by density like any other spacing value. There is no separate control-sizing system to keep in sync by hand.

> 🚧 **Warning, confirmed wider than one component**: `ThemeSettings` still carries `paddingPanelVertical`/`paddingPanelHorizontal`/`paddingCellVertical`/`paddingCellHorizontal`/`formFontSize` — exactly the separate sizing system this rule says shouldn't exist. Not just `header`/`footer`: `ui/dialog.tsx`, `ui/date.tsx`, `ui/form.css.tsx`, `ui/select.tsx`, `ui/nav.tsx`, `ui/timepicker.tsx`, `ui/typography.css.tsx`, and `specs/object-editor.tsx` all use these settings directly. Migrating all of it to the spacing scale is a real, cross-cutting change — left as a Todo, not attempted as a "fix the bug" edit.

> Done: the boolean-only default rule in `ui/layout.css.tsx` (`[gap]`/`[pad]` with no value, falling back to `component`) now writes `--e-${att}-vertical`/`-horizontal` (was a single leading dash, an invalid custom-property name that got silently dropped). A bare `gap`/`pad` attribute sets spacing again.

### Padding and boundaries

Three rules, replacing the two bullets above wherever they conflict:

1. **Padding requires a boundary** (a border or a background). Padding is only ever visible in the presence of one — with neither, it has nothing to show itself against and does nothing perceptible. Padding with no boundary is therefore not a style choice, it's a contradiction: forbidden, not merely discouraged.
2. **A container that pads itself must also set `gap`.** Padding on a container means that container is a boundary-holder; once it is, `gap` — not the children's own padding — is what keeps its children apart from each other. This is what rules out double-padding: a container can't be a boundary and also leave separation to its children.
3. **A container that doesn't pad itself doesn't set `gap` either.** When it has more than one child, nothing then separates them but themselves — each must establish its own boundary and pad. A border marks the seam between adjacent children, skipped only where a background difference between them already makes it obvious. (A lone child never triggers this: with nothing to touch, there's nothing to separate — it just inherits whatever boundary already exists further up the chain, or none.)

Tested against every case this document has walked through — a plain gapped row of already-bordered buttons, an inverted top-of-screen toolbar, a cobbled-together button group (no pad, no gap, adjacent full borders collapsed into shared lines rather than doubling), the dialog's header/content/footer (the panel itself is the un-padded, gap-less container; each row independently earns its own boundary and padding) — three rules cover all of it without a special case for any one of them.

> 🔨 **Todo**: `ui/dialog.tsx`'s header/content/footer and any button-group CSS (`<e-button-box>`, `ui/form.css.tsx`) should be checked against these three rules directly — not verified line-by-line against the actual code yet, only against the *reasoning* that produced them.

> 🔨 **Todo**: `ui/date.tsx`'s `cls_dow` (the weekday header labels, plain `<span>`) has its own `padding: 2px 0` with no border or background — the same violation the `text` button variant just got fixed for, found while in the file but not fixed, since it's a label, not a variant, and wasn't part of what was asked.

### Density

`elt/ui` exposes one density setting, entirely driven by the theme: `"compact" | "default" | "comfortable"` (naming to confirm), alongside `o_force_theme`. It applies one multiplier to the whole spacing scale and to control height/font size together. Widgets never branch on density; they only read the scaled CSS variables.

## Axis 4: Layout

`e-flex` covers row/column layouts. `e-grid` covers CSS grid layouts, with a `css` rule for the grid template when attributes are not enough. `e-box` covers block containers, including typographic mode.

CSS never collapses margins on a flex or grid item, whether the container is `display: flex`/`grid` or `display: inline-flex`/`inline-grid` — the `inline-` prefix only changes how the container itself sits in its parent's layout, not whether its own children's margins collapse. Margin collapsing is exclusively a block-formatting-context behavior between block-level boxes.

This matters directly for `typographic` mode: `<e-box typographic>` gives its direct children `margin-block: 1em` (with adjacent margins collapsing down to 1em between two block-level children, per normal CSS flow). An `e-flex`/`e-grid` container placed as one of those children does not collapse its own margin against a neighboring paragraph's margin — the two add up instead (1em + 1em = 2em), breaking the zone's vertical rhythm at that boundary.

An `e-flex`/`e-grid` container does not sit as a direct, top-level child of a typographic zone. It sits inside an ordinary block element (a `p`, a `div`, or similar) instead, the way the zone already treats any unrecognized child as paragraph-like (`margin-block: 1em`, per `typography.css.tsx`). The wrapping block element is what participates in the zone's margin collapsing; the `e-flex`/`e-grid` content inside it needs no margin of its own.

### Adjacency-aware spacing

A container's spacing between children is normally one flat `gap` step. A container may instead vary that spacing by what kind of sibling comes before or after, the way `typographic` mode already spaces a heading before a paragraph differently than paragraph-before-paragraph. This is still the container's own decision, expressed as CSS rules built into the container — never something a caller sets per instance with margins.

Only give a container this adjacency-aware behavior when its children have a recurring, distinct set of semantic roles (a header/content/footer split, for example). Use the same promotion threshold as widgets in general: build it when a real recurring need shows up, not ahead of one.

## Axis 5: Typography

Typographic mode is the source of correct typography in `elt/ui`; content inside `<e-box typographic>` should read well by default, following established typesetting conventions rather than app-specific hand-styling.

`typography.css.tsx` already fixes, inside `<e-box typographic>`:

- Body line-height 1.7; heading line-height 1.2.
- Heading scale: h1 2rem, h2 1.5rem, h3 1.25rem, h4 1.1rem, h5 1rem (italic), h6 0.9rem (italic, faded color).
- Vertical rhythm: 1em margin between block siblings by default; headings get 1.5em above, 0.4em below.
- `text-wrap: balance` on headings, `text-wrap: pretty` on paragraphs.

No measure (line-length limit) is set on `<e-box typographic>` by design — constraining width is an application choice, not `elt/ui`'s. `elt/ui` governs visual flow (rhythm, hierarchy); visual identity choices like a line-length limit are left to the app's own layout.

## Axis 6: Motion

`elt/ui` wants a generic rule for elements appearing and disappearing (not limited to dialogs), plus dialog-specific motion on top of it.

Realistic scope for this axis, given the rest of this document: appear/disappear (mount/unmount, already needed for popup/dialog), and page/route-level transitions (navigating between screens). List reordering and drag feedback are not needed yet — no widget in `elt/ui` currently supports reordering or dragging; add a rule if and when one does, not ahead of it. The "no hidden content by default" rule (Axis 2) also removes most of the expand/collapse motion a UI kit would otherwise need.

The browser View Transitions API names elements (`view-transition-name`) and animates changes between DOM states, including route changes — it covers page-level transitions in a way the current `animate`/`animate_show`/`animate_hide` keyframe helpers do not attempt.

Route/page-level transitions go through the View Transitions API, with `animate`/`animate_show`/`animate_hide` staying for small, local appear/disappear (popup, dialog, individual widgets). Graceful absence is acceptable where the browser does not support it — no fallback needed. The transition is triggered by the app itself, inside its route `activate()`, not by a generic `elt/ui` helper — an automatic, blanket transition on every route change is explicitly rejected (see ADR below).

> 📜 **ADR**: `src/app/app.ts` had a commented-out call to `document.startViewTransition` that wrapped every route change automatically. That approach created transitions indiscriminately and took the decision of when/how to transition away from the app. The `activate()`-triggered, opt-in design replaces it.

> 🔨 **Todo**: Delete the commented-out `document.startViewTransition` call in `src/app/app.ts` — it is dead code, not an experiment to finish.

> 🔨 **Todo**: Build the `activate()`-triggered transition helper described above — it does not exist yet.

> 🔨 **Todo**: Write the local appear/disappear rule (trigger conditions, duration/easing tokens, reduced-motion handling — already partly covered by `prefers_reduced_motion()` in `ui/animation.tsx`).

## Axis 7: Component selection

`elt/ui`'s native-first rule and promotion threshold (native HTML first; promote an app pattern to a dedicated `ui/` widget only once a second app needs it, per `using-elt-ui-agent.md`) is the generic rule for building any new component, including complex ones. Complex widgets such as the date/time picker and the object editor must follow it the same as any other widget.

Overall app layout (page shell, navigation placement, and so on) is out of scope for this document. It is left to `e-flex`/`e-grid`/`e-box` and app-level judgment. The demo may show patterns for reference, but none of them are a binding rule here.
