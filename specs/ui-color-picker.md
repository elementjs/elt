# Color Picker (elt/ui)

A stylable color-input widget for `elt/ui`. Not object-editor-specific — a general-purpose component the object editor's color widget happens to be the first consumer of (`specs/ui-object-editor.md` Layer 4, `elt/ui` control inventory).

> Why: native `<input type="color">` isn't stylable enough for a consistent look across browsers — a live color preview, in particular, isn't achievable with the native control alone.

This spec is **under discussion** — most of it is open `> Question:` blocks, not locked rules. Don't implement from this file yet.

## Scope tension (the thing to resolve first)

Two very differently sized projects share this name:

1. **Thin wrapper**: a styled swatch/trigger showing a live preview, backed by a **hidden** native `<input type="color">` that still does the actual color picking (the browser/OS's own picker UI). Small, unblocks the object editor immediately.
2. **Full picker**: an `elt/ui`-rendered picker UI (hue/saturation/lightness area, sliders, format switching, presets) that replaces the native picker's role, not just its styling. A real, general-purpose `elt/ui` feature in its own right — genuinely useful beyond the object editor, and (per the redactor) an area that's "sorely lacking in general."

> Question: Ship (1) as the real v1 and treat (2) as a separate, later `elt/ui` feature — or invest in (2) now and make it the v1 default? These aren't a small-vs-large version of the same task; (2) is a UI design project (a whole picker surface), (1) is a wrapper.
> Thoughts: Leaning (1) now, unblocking the object editor, with (2) explicitly scoped as its own follow-up rather than folded into "the color widget." Splitting them also means (1)'s shape (a swatch + hidden input) doesn't have to guess at what (2)'s eventual props look like.

## If a full picker (2) gets built

> Question: Does it **replace** the native picker's role entirely (own hue/sat/lightness UI, own popup), or **coexist** — native input kept around for OS-level integration (eyedropper, OS color history) while the `elt/ui` popup is the primary interaction?
> Question: Which color models matter for v1 of the picker itself? sRGB (hex / `rgb()` / `rgba()`) is a given. HSL for a friendlier hue/saturation/lightness slider set is the obvious second. Is **OKLCH/OKLab** (perceptually uniform, increasingly used in modern CSS, but less familiar to most users) in scope for a first version, or later?
> Question: Presets / recently-used swatches — does the picker take a `presets` prop (brand colors, etc.)? If "recently used" is wanted, who owns persisting it — the calling app via a prop it manages itself, or the widget reaching for `localStorage`? `elt/ui` reaching for storage APIs would be new territory for the library (worth flagging per AGENTS.md if it comes to that) — leaning the app owns it, the widget just takes/emits a list.
> Question: Alpha channel — native `<input type="color">` has no alpha support at all, so alpha is only available once (2) exists with its own picker surface. Does v1 of (2) include alpha, or is that a later addition too?

## Plugging into the object editor (once (1) exists)

> Question: When/if (2) exists, how does an app "swap in the fuller picker" for the object editor's color widget? Two shapes: (a) a side-effect import that globally registers a replacement (mirrors the object editor's constructor→schema registry, `ui-object-editor.md` Layer 5) — implicit, but tree-shakes the heavier picker away when not imported; (b) explicit factory injection — the app passes a different `Factory` instance into its schema's `color` slot (`color({ widget: advanced_color_picker })` or similar), no registration machinery at all.
> Thoughts: (b) probably makes the whole "override mechanism" question moot. The object editor's `color()` factory already just needs *some* `elt/ui` component to render — if `ColorFactory.render` is parameterized by which component it mounts, "use the fuller picker" is already just "construct `color()` with a different component reference," which tree-shakes on its own (nothing imports the heavier module unless that app's code does). No new registration mechanism to design. If this holds up, the real design work is 100% in the picker itself, not in how it plugs in.

## v1 floor — thin wrapper (1), regardless of the above

Enough to unblock the object editor's color widget without committing to any of the open questions above:

- Component (name/module TBD — see below): an `e-box` showing the current color as its own background — a live preview, which is the one thing the native input can't give us — and acting as the click/keyboard trigger.
- Activating it (click, or Enter/Space when focused) opens the **native** color picker: `input.showPicker()` where supported, `.click()` as a fallback, on a `<input type="color">` kept in the DOM but visually hidden (not `display: none` — needs to stay focusable/clickable for the fallback path; visually hidden via the usual sr-only-style technique).
- Bound to a plain `o.Observable<string>` in the native input's own format (`#rrggbb`, no alpha — inherited limitation of (1) until/unless (2) exists).
- Commits on the native input's **`change`** event, not `input` — avoids writing on every drag step inside the OS-level picker, consistent with "structural/immediate" controls elsewhere (not a staged multi-keystroke edit like a text field).

## Naming / location

> Question: Module name — `ui/color.tsx`, matching the existing `ui/date.tsx` pattern? Exported component name — `ColorSwatch`, `ColorPicker` (reserved for (2) instead?), something else?
