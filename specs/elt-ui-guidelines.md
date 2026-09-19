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

Use an inverted container for toolbars and title rows (dialog headers, table header rows), or for parts of the application that convey semantically more important information. Inversion establishes a new background — per the padding/boundary rules (Axis 3), an inverted container must therefore pad itself, and must set `gap` too if it arranges more than one child.

Use the `inverted` button variant for the one action on a screen that needs outsized attention, in particular a heavy action that is hard to reverse. It draws the user's eye; do not use it for more than one action at a time in the same area.

Build an inverted container with `theme.colors.tint.as_inverted` (`ui/theme.tsx`). This already handles nesting: inside an inverted container, the inversion redefines `--e-color-tint` to the theme's plain background color for its own subtree. A nested inverted element therefore renders with that background color instead of tint-on-tint, with no separate rule to apply — it falls out of the normal CSS variable cascade.

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

Every named color (`tint`, `text`, `red`, …) mixes directly with `bg` and with `text` on its own — `Color.from_bg(intensity)` and `Color.from_text(intensity)` are independent methods, not two halves of one shared axis centered on `tint`. `text.mid`, for instance, is `text.from_bg(50%)` — a direct `bg`/`text` mix that never involves `tint` at all, already used throughout `ui/form.css.tsx` for borders. A "0% = `bg`, 100% = `tint`, 200% = `text`" single continuum only describes `tint`'s *own* range (`tint.from_bg(0..100%)` then `tint.from_text(0..100%)`, strung together) — it does not generalize to every color routing through `tint`.

The canonical helper set:

- `.surface1`, `.surface2`, … — the level stack (see Surfaces and borders, below).
- `.surface_current` — the level currently active.
- `.hover` — surface level *n+1*.
- `.separator` — surface level *n+2* (borders, dividers).
- `.mid` — a fixed 50% `bg`/`tint` mix. Not part of the level stack; a general-purpose value reached for wherever something moderate-but-legible is needed (a border, a focus ring, a disabled indicator).
- `.faded` — 80% hue.
- `.strong` / `.very_strong` — `from_text()` at increasing intensity, toward `text`.

Named steps never grow to cover a one-off need: anything outside the named steps goes through `.from_bg()`/`.from_text()` with an explicit percentage instead of adding a new name.

The text/border scale: `text`/`tint` are the raw values; `muted` = `.faded`; `disabled` reuses `.mid`. `selected_text` is not part of this scale — text selection stays its own manual `::selection` CSS rule (`ui/theme.tsx`), not part of the general `Color`/`Mix` system.

### Surfaces and borders

A surface has a **level**, starting at 0, which is the background color. Each subsequent level mixes more tint into the background, proportionally to the level number (level *n* ≈ *n* × one step of tint-into-`bg`), cascading from whichever level is ambient at that point — a panel that raises a new surface is level *n+1* relative to *its own* parent, not relative to the page.

Implemented in `ui/layout.css.tsx` as the `[surface]` attribute: it reads the ambient `--e-surface-level` custom property, increments it, sets its own background from `tint.from_bg(level × step)`, and passes the new level down to its children — so a border, divider, or hover fill can read "one level up from here" without knowing its own ancestor chain. The `[surface]` attribute is the one mechanism for raising a surface — layout elements only, no separate class-based API for arbitrary HTML.

Hover uses level *n+1*; a border or divider drawn on a surface at level *n* uses level *n+2*, relative to its own container — never a fixed named step. Splitting hover (*n+1*) from border/divider (*n+2*) is what makes them distinguishable when both appear on the same row at once.

> 🔨 **Todo**: `Theme` currently exposes color classes (`class_light`, `class_dark`, `class_dynamic`) as top-level properties. Move them under a `classes` namespace (`theme.classes.light_scheme`, `.dark_scheme`, `.dynamic_scheme`) for organization.

Border and divider stay two different concepts even though they may resolve to the same computed value: a **border** is the contour of one element (its own shape); a **divider** marks a boundary between elements (`<hr>`, a row separator).

The *n+2* rule is for visual separation only (a container's own edge, a divider between elements). A focusable widget (button, input, and similar interactable controls) instead gets a defined border from its own emphasis variant's color, at full text-level intensity — `.text` for the `default` variant, `.tint` for the `tint` variant — not from the surface-level stack. Its border is about the control's own identity, not its position in a surface stack. `link` and `text` have no border at all.

`elt/ui` does not define a panel or a card as such. Any layout container (`e-flex`, `e-grid`, `e-box`) becomes a panel-like surface simply by carrying a border, a radius, and/or a background — whether a panel or card has its own background at all, or only a border, is an app decision, not something `elt/ui` mandates. When a background is used, it's just `surface` — the same primitive as everything else, which makes a panel's own fill *n+1* relative to its own parent, the same level hover uses (not a collision: a permanent fill and a hover state aren't simultaneously visible on the same box).

`e-flex`/`e-grid`/`e-box` have attribute-level `border`, `border-radius`, and `surface` attrs in `ui/layout.css.tsx` (unfinished — `border` currently only accepts `"widget"`).

**Border radius is derived, not a separately maintained scale.** An element's `border-radius` equals its own *vertical* padding step (the tighter of the horizontal/vertical pair — spacing is deliberately asymmetric, and a radius bigger than the tighter dimension would visibly cut into the content box). A rounded corner is a quarter-circle whose arc is centered at (R, R) from the true corner; when padding P equals R, the content box's own corner sits exactly at that arc's center, equidistant from the curve in every direction — a visibly "nested" look, not a coincidence of matching numbers. A bigger visual radius is an emergent consequence of choosing a bigger padding step (`component`, `section`, …) for that surface, not a second thing to track.

> 🔨 **Todo**: Implement the derived border-radius rule above. Not yet done — `borderRadius`/`frameBorderRadius` still exist as two independently maintained values in `ui/theme.tsx`.
>> This should be changed

> 🔨 **Demo Todo**: add a layout section to the demo with a few worked examples using `surface`.
>> Do that

### State

`.hover` is a further mix layered on top of whichever surface level is currently active — level *n+1* (see Surfaces and borders, above).

`.selected` is not a level-stack step at all — it applies inversion, using `tint.faded` rather than full `tint`: one notch quieter than the `inverted` variant's maximum-attention case, reusing the same mechanism (Inversion, below) rather than a separate value. A multi-select list showing several inverted rows at once is fine — selection is a different kind of emphasis than "the one dominant action" the `inverted` restraint rule (Emphasis and promotion) is about, since selected rows aren't competing with each other for the user's next action.

> ❓ **Open**: worth a second look once a real multi-select widget exists to eyeball — "reads fine in principle" isn't guaranteed to survive five selected rows on screen.

`.active`/pressed reuses the level stack, one step past hover (the same computed color a border/divider there would use). No requirement to stay distinguishable from a border at that level — press is rapid and transient, not persistent, so momentary overlap isn't a real collision.

Focus stays outside the level stack entirely: a ring/outline drawn around an element (`tint.mid` + `focusRingSize`, already in `ui/form.css.tsx`), not a fill or a border replacing the element's own.

Disabled reuses `.mid` for text/fills where needed.

### Inversion

Inversion is one mechanism, not several named variants: given a color, it produces a new bg/text/tint triad — new `bg` = that color, new `text` = old `bg`, new `tint` = old `bg`. `Color.as_inverted` is the primitive; how attention-grabbing the result looks depends entirely on which color goes in, not on a separate mode.

- Inverting `tint` gives the maximum-attention result — toolbars, heavy actions. This is what the `inverted` button variant and inverted containers use (Axis 1, Emphasis and promotion).
- Inverting `tint.faded` gives one notch less: this is what `.selected` uses (Axis 1, State) — loud enough to read as selected, quiet enough not to compete with a genuinely dominant `inverted` action elsewhere on the same screen.
- Inverting a softer, less saturated color gives a lower-attention result for structural-but-secondary framing elements (toolbars, headers, and similar chrome, not the content they frame) — table headers, status bars, navs. `text.faded` is used for this.

Inversion sets the new `text`/`tint` to the *light* theme's `bg` specifically (`--e-light-color-bg`), not "whichever theme is currently active." This is deliberate: an inverted band looks the same regardless of light/dark mode.

The bg/text/tint combination currently in effect (which changes under inversion) is called a **ColorScheme** — the name already used for this shape as a generic type parameter on `Theme` in `ui/theme.tsx`.

Spelling out the soft-inverted form (`text.faded.as_inverted`) at each call site (table header, status bar, nav) is acceptable — a named shortcut may be added later if it turns out to be repeated often enough to be worth it, but that is not blocking.

Status/severity hues stay outside `elt/ui`'s remit as a hard rule: the palette exists (`red`, `orange`, `green`, …), but which hue means "error" vs. "success" is an app decision, not something this document prescribes. As a convention, not a requirement: red/error, yellow/warning, green/success follows general consensus and is worth stating as a default an app can deviate from with reason.

> 📜 **ADR**: Every color in `ui/theme.tsx`'s default palette (`tint`, `red`, `orange`, `yellow`, `green`, `cyan`, `blue`, `purple`, `magenta`, …) is a `Color` instance with the same methods. The rules above are written generically ("a color," not "tint") because the mechanism already works that way in code.

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

Pick a step by the semantic distance between what it separates, not by eye. Step names are semantic, not size words: `<e-flex spacing="component" gap pad>` — `gap` and `pad` are plain booleans (do I space between children? do I pad my own boundary?), and `spacing` carries the one named step shared by both.

`gap`/`pad` without a value take the container's `spacing`. Either can still be given an explicit step directly (`pad="widget"`) to override `spacing` for that one side.

| Step | Use for |
| --- | --- |
| `1` / `2` / `4` (px) | Pixel-level nudges only. Never a default choice. |
| `inline` (`1ch`) | Reads as a text space — a row that should visually separate the way a space character would. Font-relative, not on the px-doubling scale. Finer values (`0.75ch`, `0.5ch`, `0.25ch`) exist for visual alignment only, used directly via `.from_bg()`/`.from_text()`-style raw values, not named. |
| `widget` | Inside one atomic cluster: an icon and its label in a button, a control and its inline suffix. Also the default control padding. |
| `component` | Between distinct but related groups: one form group to the next, panel content to its border. The default — most used. |
| `section` | Between major sections of one view or panel. |
| `stage1`–`stage4` | Between independent regions of a page. Numbered rather than individually named — fine distinctions between "very large" steps don't carry much individual meaning past a certain point. |

At a given step, horizontal spacing is one step larger than vertical spacing (a deliberate squashed look — text lines are already dense vertically).

`e-row`/`e-column` are semantic aliases over `e-flex` (already its two directions); `e-flex` stays available underneath for the grid-adjacent or direction-agnostic cases or when row/columns need to change dynamically.

> 🚧 **Warning**: the small end of this scale has two definitions that may conflict. `ui/layout.css.tsx`'s `:root` renames the old `3x-small`/`2x-small`/`x-small` px steps to literal `--e-spacing-1`/`-2`/`-4`, keeping them on the px-doubling scale. Separately, this document defines `inline` as `1ch` — explicitly *not* on that px-doubling scale, font-relative instead. Is `inline` a fourth, separate step below `widget` (as stated above), or was it meant to replace one of `1`/`2`/`4`? These were resolved in different passes and haven't been checked against each other.
>> Forget the 1ch, we'll go with 8px (widget) 4px 2px 1px

> 🔨 **Todo**: moving the spacing scale's values from a static `:root` block into `Theme`/`ThemeSettings` (matching how every other setting works) hit a real blocker: the existing `_set()` helper auto-generates each CSS custom property name from the field name by inserting a dash before every uppercase letter, which works for `spacingWidget` → `--e-spacing-widget` but can't produce `--e-spacing-2x-large` from any field name (no uppercase letter marks that boundary). Needs either a naming scheme without this problem or a change to `_set()` itself.
>> Not possible to simply add a rule to leave numbers alone ?

> 🔨 **Todo**: Once every rename in this document is settled, produce a single old-name → new-name equivalence table so an agent can mechanically convert existing code.

Controls use this same scale for their own internal padding (typically `widget`), scaled by density like any other spacing value. There is no separate control-sizing system to keep in sync by hand — `paddingPanel*`/`paddingCell*` are gone from `ThemeSettings`; every call site (`ui/dialog.tsx`, `ui/date.tsx`, `ui/form.css.tsx`, `ui/select.tsx`, `ui/nav.tsx`, `ui/timepicker.tsx`, `ui/typography.css.tsx`, `specs/object-editor.tsx`) now uses `var(--e-spacing-widget)`/`var(--e-spacing-component)` directly. "Cell" padding wasn't kept as a separate, smaller concept — it collapsed into the same values as "panel" padding.

### Padding and boundaries

Three rules:

1. **Padding requires a boundary** (a border or a background). Padding is only ever visible in the presence of one — with neither, it has nothing to show itself against and does nothing perceptible. Padding with no boundary is therefore not a style choice, it's a contradiction: forbidden, not merely discouraged.
2. **A container that pads itself must also set `gap`.** Padding on a container means that container is a boundary-holder; once it is, `gap` — not the children's own padding — is what keeps its children apart from each other. This is what rules out double-padding: a container can't be a boundary and also leave separation to its children.
3. **A container that doesn't pad itself doesn't set `gap` either.** When it has more than one child, nothing then separates them but themselves — each must establish its own boundary and pad. A border marks the seam between adjacent children, skipped only where a background difference between them already makes it obvious. (A lone child never triggers this: with nothing to touch, there's nothing to separate — it just inherits whatever boundary already exists further up the chain, or none.)

Tested against every case this document has walked through — a plain gapped row of already-bordered buttons, an inverted top-of-screen toolbar, a cobbled-together button group (no pad, no gap, adjacent full borders collapsed into shared lines rather than doubling), the dialog's header/content/footer (the panel itself is the un-padded, gap-less container; each row independently earns its own boundary and padding) — three rules cover all of it without a special case for any one of them.

> 🔨 **Todo**: `ui/dialog.tsx`'s header/content/footer and any button-group CSS (`<e-button-box>`, `ui/form.css.tsx`) should be checked against these three rules directly — not verified line-by-line against the actual code yet, only against the *reasoning* that produced them.
>> Fix it

> 🔨 **Todo**: `ui/date.tsx`'s `cls_dow` (the weekday header labels, plain `<span>`) has its own `padding: 2px 0` with no border or background — the same violation the `text` button variant was fixed for. Found but not fixed, since it's a label, not a variant.
>> Fix it too

### Density

`elt/ui` exposes one density setting, entirely driven by the theme: `"compact" | "default" | "comfortable"` (naming to confirm), alongside `o_force_theme`. It applies one multiplier to the whole spacing scale and to control height/font size together. Widgets never branch on density; they only read the scaled CSS variables.

## Axis 4: Layout

`e-flex` and its siblings `e-column` and `e-row` cover flexbox row/column layouts. `e-grid` covers CSS grid layouts, with a `css` rule for the grid template when attributes are not enough. `e-box` covers block containers, including typographic mode.

> 🔨 **Todo (big)**: rename `e-box` to `e-block`, for naming consistency with `e-flex`/`e-grid` (all three would name their CSS `display` value). Wide blast radius, not attempted here.
>> Do it

CSS never collapses margins on a flex or grid item, whether the container is `display: flex`/`grid` or `display: inline-flex`/`inline-grid` — the `inline-` prefix only changes how the container itself sits in its parent's layout, not whether its own children's margins collapse. Margin collapsing is exclusively a block-formatting-context behavior between block-level boxes.

This matters directly for `typographic` mode: `<e-box typographic>` gives its direct children `margin-block: 1em` (with adjacent margins collapsing down to 1em between two block-level children, per normal CSS flow). An `e-flex`/`e-grid` container placed as one of those children does not collapse its own margin against a neighboring paragraph's margin — the two add up instead (1em + 1em = 2em), breaking the zone's vertical rhythm at that boundary.

An `e-flex`/`e-grid` container does not sit as a direct, top-level child of a typographic zone. It sits inside an ordinary block element (a `p`, a `div`, or similar) instead, the way the zone already treats any unrecognized child as paragraph-like (`margin-block: 1em`, per `typography.css.tsx`). The wrapping block element is what participates in the zone's margin collapsing; the `e-flex`/`e-grid` content inside it needs no margin of its own.

### Adjacency-aware spacing

Typographic mode varies spacing by sibling type on its own (a heading before a paragraph gets different spacing than paragraph-before-paragraph) — that stays specific to `typographic` content.

> ❓ **Open**: this section originally generalized that idea to non-typographic containers (varying `gap` by sibling role, e.g. a header/content/footer split). Does that generalization still earn its place now that Padding and boundaries (above) governs multi-child spacing more precisely — header/content/footer, for instance, is fully explained by those three rules already, with no adjacency-aware `gap` involved. Keep this section for a case that isn't typographic and isn't covered by Padding and boundaries, or drop it as superseded?

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

Realistic scope for this axis: appear/disappear (mount/unmount, already needed for popup/dialog), and page/route-level transitions (navigating between screens). List reordering and drag feedback are not needed yet — no widget in `elt/ui` currently supports reordering or dragging; add a rule if and when one does, not ahead of it. The "no hidden content by default" rule (Axis 2) also removes most of the expand/collapse motion a UI kit would otherwise need.

The browser View Transitions API names elements (`view-transition-name`) and animates changes between DOM states, including route changes — it covers page-level transitions in a way the current `animate`/`animate_show`/`animate_hide` keyframe helpers do not attempt.

Route/page-level transitions go through the View Transitions API, with `animate`/`animate_show`/`animate_hide` staying for small, local appear/disappear (popup, dialog, individual widgets). Graceful absence is acceptable where the browser does not support it — no fallback needed. The transition is triggered by the app itself, inside its route `activate()`, not by a generic `elt/ui` helper — an automatic, blanket transition on every route change is explicitly rejected (see ADR below).

> 📜 **ADR**: `src/app/app.ts` had a commented-out call to `document.startViewTransition` that wrapped every route change automatically. That approach created transitions indiscriminately and took the decision of when/how to transition away from the app. The `activate()`-triggered, opt-in design replaces it.

Building the transition wrapper is the app's job, not `elt/ui`'s: the app wraps its own `route.activate()` calls in `document.startViewTransition`, opting in per route. `elt/ui` documents the pattern; it does not ship a generic helper for it — the earlier commented-out attempt in `app.ts` failed specifically because it tried to make this automatic instead of an app-level choice (see ADR above).

> 🔨 **Todo**: Write the local appear/disappear rule (trigger conditions, duration/easing tokens, reduced-motion handling — already partly covered by `prefers_reduced_motion()` in `ui/animation.tsx`).

## Axis 7: Component selection

`elt/ui`'s native-first rule and promotion threshold (native HTML first; promote an app pattern to a dedicated `ui/` widget only once a second app needs it, per `using-elt-ui-agent.md`) is the generic rule for building any new component, including complex ones. Complex widgets such as the date/time picker and the object editor must follow it the same as any other widget.

Overall app layout (page shell, navigation placement, and so on) is out of scope for this document. It is left to `e-flex`/`e-grid`/`e-box` and app-level judgment. The demo contains reference patterns for this, but none of them are binding.
