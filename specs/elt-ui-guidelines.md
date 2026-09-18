# Elt/ui guidelines

This document tries to define what giving an elt/ui application a common look and feel entails. Doing so will redefine parts of elt/ui. The result of the work happening in this file will be : a living spec that Agents and Humans alike can adhere to and changes to be applied to the elt/ui codebase.

The rules must let an agent make almost no layout or style decisions on its own when it builds a new screen.

## Scope

This document is the single source for rules and decisions (the "why", as axes). `docs/using-elt-ui-agent.md` stays pure API reference (the "how": tables of attributes/props) and links back here for rationale. The two documents stay separate.

## Axis 1: Color

### Status (recap)

Settled so far:

- **Four emphasis variants**, shared by buttons and containers: `text` (no border) → `default` (bordered, neutral) → `tint` (bordered, tint-colored) → `inverted` (filled, tint as background). One word for both the button variant and the underlying `Color` mechanism — one rung, reserved for the single action or region that should visually dominate.

- `Color.as_inverted` is the general primitive (code already renamed from `as_background`, keeping the `as_` prefix): given any color, it produces a new bg/text/tint combination — new `bg` = that color, new `text`/`tint` = old `bg`. The `inverted` variant is specifically `tint.as_inverted`, the loudest case, not a separate mechanism.

- **Surfaces have a level**, starting at `bg` (0), each level mixing more tint into `bg`. Implemented as the `[surface]` attribute in `ui/layout.css.tsx`, tracked via a `--e-surface-level` custom property that increments and cascades to children — the level-tracking mechanism the previous pass asked for.

- **Hover is level *n+1*; border/divider is level *n+2*.** Splitting them resolves the earlier collision concern (a hover fill and its own divider no longer compute to the same color). A panel/card's own background fill level is unconfirmed against this split (open question, below).

- **Exception**: a focusable widget (button, input) gets a defined border from the text/border scale instead of *n+2* — about the control's own identity, not its position in a surface stack.
>> It gets text level intensity : .text or .tint depending on whether we're looking at the tint variant.

- **`elt/ui` does not define panels or cards.** Any layout container becomes one via `border`/`border-radius`/`surface` attributes (now in `ui/layout.css.tsx`, unfinished).
- **Inversion is tunable by which color goes in.** `tint` inverted = maximum attention. A softer color inverted = lower attention, for structural chrome (table headers, status bars, navs) — but see the Warning below, this has no working implementation yet.

- **Status/severity hues are not `elt/ui`'s call.** The palette exists; which hue means "error" vs. "success" is the app's decision.
>> Guidelines should be given to "respect the general consensus" - red meaning error, yellow warning and green success, but this is convention rather that specification

- The bg/text/tint combination currently in effect is named **ColorScheme** (matches the renamed type in `ui/theme.tsx`).
- The WCAG floor: every tint needs contrast ≥ 3 against both `bg` and `text`, ideally ≥ 4.5.

Real problems found by comparing this document against the actual code (`ui/theme.tsx`, `ui/layout.css.tsx`), not yet fixed in either:

- **The soft-inversion mechanism doesn't work as specified.** Mix helpers (`.mid`, `.faded`, …) return plain CSS strings, not chainable `Color`s — `text.mid.inverted`/`text.faded.inverted` calls a property on a string. `css_as_inverted` also only resolves a *named* palette color, not an arbitrary mix. This needs an API change, not just a rename.
>> These calls should probably return a Color themselves, since they define .valueOf() and thus can be used directly in css code. This is indeed a change that should be done.

- `ui/layout.css.tsx` calls `.css_inverted`, which doesn't exist under that name in `ui/theme.tsx` (`css_as_inverted` does) — the `header`/`footer` rules that use it are broken as written.
- The spec says soft inversion uses `text.faded`; the `footer` code rule uses `text.mid` instead. One of these is stale, and neither currently works (see above).
>> This will need fixing

- `--e-surface-step`, read by the `[surface]` rule, is never defined — the surface background currently resolves to nothing.
- The spacing scale's smallest three `:root` custom properties were renamed to `--e-spacing-1`/`-2`/`-4`, but the type/lookup array driving attribute values still says `3x-small`/`2x-small`/`x-small` — `gap="x-small"` resolves to nothing.
>> The :root properties are the better idea. Naming is not final ; I would need advising, and ideas for the large ones. Besides the fact that these are the ones that should stay, these values should go to the Theme

- The boolean-only `[gap]`/`[pad]` default rule writes a single-dash `-e-…` property (invalid custom-property syntax) instead of `--e-…` — silently dropped.
>> This should be fixed for the default case I tried to define

- `ThemeSettings` still carries the parallel sizing system (`paddingPanel*`, `paddingCell*`, `formFontSize`) that Axis 3 says shouldn't exist, and `header`/`footer` use it directly instead of the spacing scale.
>> This needs to be updated to match the spec

Still open (real decisions, not implementation bugs):

- Where `.selected` lands now that hover is pinned to *n+1*.
- Focus and active/pressed states have no rule at all yet.
- `.mid`'s meaning is overloaded — "signals disabled" per the working model, but already used in `ui/form.css.tsx` for borders and the focus ring, neither of which is a disabled state.
- The text/border scale (`text`, `tint`, `muted`, `disabled`, `selected_text`) is still just named, never derived.
- Border radius: two settings (`borderRadius`, `frameBorderRadius`), no rule for which applies where.
- Overlay lift (popup/dialog vs. the page behind it): shadow, surface level, or both — no rule yet.
- Naming for the `x-large`-and-above spacing step (`page` rejected, no replacement chosen).
- `.intense`'s exact math and use case.
>> >100% is going towards text, so 50% tint 50% text. Unsure where this should be used ! Is there a use case for colors between tint and text, I'm unsure


### Emphasis and promotion

Every interactive control has one of four emphasis variants.

| Variant | Meaning |
| --- | --- |
| `text` | De-emphasized. No border. |
| `default` | Base. Bordered, neutral color. |
| `tint` | Accented secondary. Bordered, tint-colored, not filled. |
| `inverted` | Filled with tint as background - no borders |

> 🔨 **Todo**: Rename the `full` variant to `inverted` in `ui/form.css.tsx` (`e-variant` type and CSS rules), and update every call site that uses `e-variant="full"` (demo, specs, docs). The `Color` side of this rename is already partly done in `ui/theme.tsx` — `as_background`/`css_as_background` are now `as_inverted`/`css_as_inverted` (kept the `as_` prefix, unlike this document's earlier `.inverted`/`css_inverted` Todo). Match this document to the code's naming, not the other way around, and finish the call sites that still say `.css_inverted` (see the Warning under Inversion, below) — they don't match either name consistently right now.

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
- `.mid` — midpoint between hue and `bg`. Used with `.text` to signal disabled.
- `.faded` — 80% hue.
- `.intense` — 150% hue, toward `text`. Used in text for accenting.

> 💡 **Idea**: `.intense` (150% toward text) plays the role `.very_strong` used to play, and `.strong` was already flagged as the one nobody reached for. Drop `.strong`, keep `.intense` as the one strong-emphasis step — one name instead of two for the same job.

> ❓ **Question**: What does `.intense` apply to, concretely? A 150%-toward-text mix goes past `text` itself (150% is outside the 0–100% range the other helpers use) — worth double-checking that's the intended math, and naming one or two real use cases (a strongly emphasized inline error word? an active tab label?) before this is locked in.
>> Yes : 0% would be bg, 200% text, tint as the middle.

In the living code, the surface stack (level *n+1*/*n+2*) replaces `.ultra_light` and `.light`.

### Surfaces and borders

A surface has a **level**, starting at 0, which is the background color. Each subsequent level mixes more tint into the background, proportionally to the level number (level *n* ≈ *n* × one step of tint-into-`bg`).

Implemented in `ui/layout.css.tsx` as the `[surface]` attribute: it reads the ambient `--e-surface-level` custom property, increments it, sets its own background from `tint.from_bg(level × step)`, and passes the new level down to its children — so a border, divider, or hover fill can read "one level up from here" without knowing its own ancestor chain. This resolves the level-tracking Todo from the previous pass.

> 🚧 **Warning**: `--e-surface-step`, read by the `[surface]` rule above, is never defined anywhere (checked `ui/layout.css.tsx` and `ui/theme.tsx`) — the surface background currently resolves to nothing. Needs a `:root` value before this mechanism works.

Hover uses level *n+1*; a border or divider drawn on a surface at level *n* uses level *n+2*, relative to its own container — never a fixed named step. Splitting hover (*n+1*) from border/divider (*n+2*) is what makes them distinguishable when both appear on the same row at once — a hover fill and its own bottom divider no longer compute to the same color, which a flat "both are one step up" rule (the previous pass's assumption) would have collapsed together.

Two ways of setting a surface: the `theme.classes.surface_background` and `theme.classes.surface_increment` class properties.

> ❓ **Question**: The code currently implements surface-level stacking as a `[surface]` HTML attribute on layout elements (`ui/layout.css.tsx`), not as `theme.classes.surface_background`/`surface_increment` class properties as described here. Is the attribute the actual mechanism and this prose stale, or is the plan to expose both — the attribute for `e-flex`/`e-grid`/`e-box`, the classes for arbitrary elements that aren't layout elements?

> 🔨 **Todo**: `Theme` currently exposes color classes (`class_light`, `class_dark`, `class_dynamic`) as top-level properties. Move them under a `classes` namespace (`theme.classes.light_scheme`, `.dark_scheme`, `.dynamic_scheme`) for organization.

Border and divider stay two different concepts even though they may resolve to the same computed value: a **border** is the contour of one element (its own shape); a **divider** marks a boundary between elements (`<hr>`, a row separator).

The *n+2* rule is for visual separation only (a container's own edge, a divider between elements). A focusable widget (button, input, and similar interactable controls) instead gets a defined border from the text/border scale (strong, matching text color) — its border marks the control's own shape and identity, not its position in a surface stack, so it does not follow *n+2*.

`elt/ui` does not define a panel or a card as such. Any layout container (`e-flex`, `e-grid`, `e-box`) becomes a panel-like surface simply by carrying a border, a radius, and/or a background — whether a panel or card has its own background at all, or only a border, is an app decision, not something `elt/ui` mandates.

> ❓ **Question**: A panel/card background was previously stated to follow level *n+1* relative to its container, but the general rule above (just confirmed) puts border/divider at *n+2* and hover at *n+1*. Is a panel's own background fill also *n+1* — i.e., the same level as hover would use, just applied as a permanent fill instead of a state — or does *n+1*-for-background predate the *n+2* split and need to move to match it?

`e-flex`/`e-grid`/`e-box` now have attribute-level `border`, `border-radius`, and `surface` attrs in `ui/layout.css.tsx` (unfinished — `border` currently only accepts `"widget"`), covering the previous Todo asking for exactly this.

> 🔨 **Todo**: `ThemeSettings` has two radius values, `borderRadius` (6px) and `frameBorderRadius` (12px), with no stated rule for which applies where. The new `border-radius` attr needs to pick one of them (or both, as named values) before it is usable.

### State

`.hover` and `.selected` are a further mix layered on top of whichever surface level is currently active. Hover is level *n+1* (see Surfaces and borders, above).

> ❓ **Question**: Where does `.selected` land now that hover is pinned to *n+1*? Same level as hover (the two states would need to be mutually exclusive on any one element to stay distinguishable), or its own level/mix?

> 🔨 **Todo (interaction states)**: Beyond hover/selected, this axis has no rule yet for: **focus** (currently `tint.mid` + `focusRingSize` in `ui/form.css.tsx`, unconnected to the level stack), **active/pressed** (no rule at all), and **disabled** (only `text.mid`/`tint.mid` used ad hoc for text/fills — no bg/border rule). `.mid` is described above as the disabled signal, but `ui/form.css.tsx` already uses `text.mid`/`tint.mid` for borders and the focus ring too — those are not disabled states, so `.mid`'s meaning is currently overloaded across at least three different purposes. Settle what `.mid` actually means before more code depends on it.

### Inversion

Inversion is one mechanism, not several named variants: given a color, it produces a new bg/text/tint triad — new `bg` = that color, new `text` = old `bg`, new `tint` = old `bg`. `Color.inverted` is the primitive; how attention-grabbing the result looks depends entirely on which color goes in, not on a separate mode.

> 🚧 **Warning**: `ui/theme.tsx` renamed the getter to `css_as_inverted` (not `css_inverted`), but `ui/layout.css.tsx` calls `.css_inverted` on both `theme.colors.tint` and `theme.colors.text.mid` — that property does not exist under either name consistently, and the `header`/`footer` rules that call it are broken as written. Separately: `.mid` (like every mix helper — `.faded`, `.strong`, etc.) returns a plain CSS string from `from_bg()`/`from_text()`, not a chainable `Color`. `text.mid.css_inverted` (and the spec's own `text.faded.inverted`, below) call a property on a string, which is `undefined` — **the soft-inversion mechanism this axis describes has no working implementation path with the current `Color` API.** `css_as_inverted` also hardcodes `var(--e-light-color-${this.name})`, which only resolves for a *named palette color* (`tint`, `red`, …), not an arbitrary mix expression. This needs an API change (mix helpers returning something invertible, or `inverted()` taking a raw color value) before "invert a soft color" can be built at all, not just renamed.

- Inverting `tint` or a color from the theme gives the maximum-attention result — toolbars, heavy actions. This is what the `inverted` button variant and inverted containers use (Axis 1, Emphasis and promotion).
- Inverting a softer, less saturated color gives a lower-attention result for structural-but-secondary framing elements (toolbars, headers, and similar chrome, not the content they frame) — table headers, status bars, navs.

> ❓ **Question**: This document says the soft-inversion color is `text.faded`; `ui/theme.tsx`'s `footer` rule uses `text.mid` instead (`header` uses full `tint`). Which is right — and given the Warning above that neither currently works, which was the intended target once the API is fixed?

> 🔨 **Todo**: Remove `grey` from the default theme's palette in `ui/theme.tsx`. It was the one named hue without a real hue (achromatic), which made it an outlier among `tint`/`red`/`orange`/etc.; a soft-inverted `text`-derived color covers the neutral-inversion need instead, staying inside the percent-mix system rather than adding a fixed color.

> 🔎 **Assumption**: Inversion sets the new `text`/`tint` to the *light* theme's `bg` specifically (`--e-light-color-bg`), not "whichever theme is currently active." In dark mode this means an inverted band's foreground is always the light-mode background color, not the dark one — likely intentional (an inverted band should look the same regardless of light/dark mode), but currently implicit in the code rather than stated as a rule. Worth one sentence confirming this is deliberate.

The bg/text/tint combination currently in effect (which changes under inversion) is called a **ColorScheme** — the name already used for this shape as a generic type parameter on `Theme` in `ui/theme.tsx`.

Spelling out the soft-inverted form at each call site (table header, status bar, nav) is acceptable once it exists (see the API Warning above) — a named shortcut may be added later if it turns out to be repeated often enough to be worth it, but that is not blocking.

Status/severity hues stay outside `elt/ui`'s remit: the palette exists (`red`, `orange`, `green`, …), but which hue means "error" vs. "success" is an app decision, not something this document prescribes.

> 📜 **ADR**: Every color in `ui/theme.tsx`'s default palette (`tint`, `red`, `orange`, `yellow`, `green`, `cyan`, `blue`, `purple`, `magenta`, …) is a `Color` instance with the same methods. The rules above are written generically ("a color," not "tint") because the mechanism already works that way in code — this is a documentation gap, not a new capability to build.

> 🔨 **Todo**: The text/border scale (`text`, `tint`, `muted`, `disabled`, `selected_text`) from the raw inventory still needs the same settling pass the surface/inversion model above just got — current status: named, not yet derived or precisely defined.


## Axis 2: Overlay and interruption

`elt/ui` offers two overlay mechanisms, placed on one interruption axis:

- **Popup** — light interruption. Anchored to a trigger element. Content is small and only makes sense in reference to that trigger. Dismiss lightly (click away, `Esc`). No independent title row.
- **Dialog** — full interruption. Not anchored to a single element. The user must pause, act, and explicitly leave before returning to the page. Content is large or structured enough to act as its own screen, and may itself use an inverted title row and the layout/spacing axes below, the same as any other screen.

Pick the lowest level on this axis that still gives the action enough room and keeps the user's place on the page. Escalate to a dialog only when the interaction cannot be trusted to happen safely or clearly without a pause — heavy, hard-to-reverse actions almost always deserve a dialog, and are also good candidates for an inverted surface inside it (see Axis 1).

`elt/ui` does not hide or collapse content by default. Build collapsible or hidden content only when the widget's own task expects it structurally — a tree, a code gutter (fold markers), and similar cases where collapse is the content's normal behavior, not a space-saving add-on.

> 📜 **ADR**: A generic inline expansion mechanism (accordion-style disclosure) was considered and dropped. Every candidate use case collapses into an existing pattern: long reference content is better served by a table of contents than a collapsed section; optional settings are better as a separate screen than hidden by default; a table row needing more detail is master-detail or a dialog; a field that only applies sometimes is conditional rendering (`If`/`Switch` in core elt), not a layout concern at all. `elt/ui` does not offer an accordion widget.

> 🔨 **Todo (overlay lift)**: No rule yet says how a popup or dialog visually separates from the page behind it — shadow (`--e-color-shadow-raise`/`-drop`, already defined in `ui/theme.tsx`), the surface-level stack (Axis 1), or both together. Settle this once the surface-level mechanism (Axis 1, Surfaces and borders) is working.

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
| `x-large` and above | not yet named — "page" fits the existing description ("between independent regions of a page") but is not confirmed |

`e-row`/`e-column` become semantic aliases over `e-flex` (already its two directions); `e-flex` stays available underneath for the grid-adjacent or direction-agnostic cases.

Below `inline`: `inline` itself is redefined as `1ch` — sized to read as a text space, not a step on the px-doubling scale used from `widget` up. Finer values (`0.75ch`, `0.5ch`, `0.25ch`) exist for visual alignment only, a case rare enough that it does not need named steps — same principle as the color axis's "no naming one-offs," reached through `.from_bg()`/`.from_text()`: a raw `ch` value is used directly rather than adding named sub-`inline` steps.

The `1ch`-and-below split from the px-doubling scale is deliberate: at that level of nit-picking, the scale is relative to whatever it is being compared to (the font), not an absolute step.

> ❓ **Question**: `page` was rejected for the `x-large`-and-above step, no replacement given yet. Alternatives: `layout` (matches Axis 4's name for the containment axis, may be confusing for that reason), `canvas`, `macro`. Any of these, or something else?

> 🚧 **Warning**: `ui/layout.css.tsx` already renamed the `:root` custom properties for the smallest three steps to `--e-spacing-1`/`--e-spacing-2`/`--e-spacing-4` (raw pixel values), but the `SpacingValues` type and the `spaces` array driving the CSS generation still use the old words `3x-small`/`2x-small`/`x-small` — the generated rule looks up `--e-spacing-x-small`, which no longer exists. `gap="x-small"`/`pad="x-small"` currently resolve to nothing.

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

> 🔨 **Todo**: Once every rename in this document is settled (spacing step names above; `full`→`inverted`, `as_background`→`.inverted`, and the color role names still pending in Axis 1), produce a single old-name → new-name equivalence table so an agent can mechanically convert existing code.

### Responsibility

Padding and gap are each owned by exactly one layout container: the one currently arranging the content in question. A container answers two separate questions on its own:

- Does it have a visual boundary worth padding — a border or a background (a level step or an inversion)? If yes, set `pad`. A container with neither never sets `pad`: there is nothing for the padding to visually belong to.
- Does it have children that need arranging? If yes, set `gap`.

A purely structural wrapper, with no visual boundary of its own, still sets `gap` to arrange its children, but does not set `pad`. Never let a parent and a child both add spacing for the same visual gap.

Controls use this same scale for their own internal padding (typically `x-small`/`small`), scaled by density like any other spacing value. There is no separate control-sizing system to keep in sync by hand.

> 🚧 **Warning**: `ThemeSettings` still carries `paddingPanelVertical`/`paddingPanelHorizontal`/`paddingCellVertical`/`paddingCellHorizontal`/`formFontSize` — exactly the separate sizing system this rule says shouldn't exist — and `ui/layout.css.tsx`'s `header`/`footer` rules use them directly instead of the spacing scale. Migrate `header`/`footer` to `spacing`/`gap`/`pad` and retire these settings, or explain why panel/cell padding is a deliberate exception to "controls use this same scale."

> 🚧 **Warning**: The boolean-only default rule in `ui/layout.css.tsx` (`[gap]`/`[pad]` with no value, meant to fall back to `component`) writes `-e-${att}-vertical` — a single leading dash, not a valid custom property name (`--`). The declaration is silently dropped; a bare `gap`/`pad` attribute currently sets nothing.

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
