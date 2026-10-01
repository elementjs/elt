---
title: Keymap
section: UI
order: 7
---

# Keymap

Keyboard shortcuts and key sequences, scoped to an element or to the whole document.

## Example

```tsx
import { $keymap } from "elt/ui/keymap"

// Active while focus is inside the column. Pass `{ target: document }` as second argument for app-wide shortcuts.
<e-column>
  {$keymap({
    "Mod+s": () => save(),               // Mod = Cmd on macOS, Ctrl elsewhere
    "Ctrl+k, s": () => open_settings(),  // a sequence: combinations separated by ","
    "j, k": { callback: leave_input, prevent_default: "last" }, // `j` still types into the input
  })}
</e-column>
```

## Vocabulary

A *combination* is one `keydown` with its modifiers (`Ctrl+k`). A *sequence* is one or more combinations (`Ctrl+k, s`). A *binding* is a sequence and its callback. A *keymap* is the bindings of one `$keymap` call.

## API

`$keymap(definition, options?)` — a decorator adding keyboard shortcuts while its node is connected. `keymap_used(event)` tells a plain `keydown` listener whether a keymap already used the event.

```ts
$keymap<N extends Node>(
  definition: o.RO<MaybeArray<ShortcutDefinition<N> | { [sequence: string]: KeymapCallback<N> | Omit<ShortcutDefinition<N>, "sequence"> }>>,
  options?: {
    timeout?: number                  // ms allowed between two steps of a sequence. Default 2000; Infinity = no limit
    target?: Element | Document       // listen here instead of on the decorated node
    state?: o.Observable<KeymapState<N>> // receives the current progress (written, never read)
  },
): Decorator<N>

interface ShortcutDefinition<N> {
  sequence: KeySequence | string
  callback: (sequence: KeySequence, node: N, event: KeyboardEvent) => void
  prevent_default?: boolean | "last" // default true; "last" = only the step completing the binding
  terminal?: boolean                 // default true; false = fire, then continue into longer sequences
}
```

## Writing sequences

Combinations are separated by `,`; modifiers are joined to the key with `+` (`"Ctrl+Shift+s"`, `"Ctrl+k, s"`, `"Ctrl+,"`, `"Ctrl++"`).

- Modifiers, case-insensitive: `Ctrl`/`Control`, `Alt`/`Option`, `Meta`/`Cmd`/`Super`/`Win`, `Shift`, and `Mod` (`Meta` on macOS, `Ctrl` elsewhere).
- `Space` means the space bar.
- A key starting with `Key` or `Digit` (`KeyS`, `Digit1`) matches the physical key (`KeyboardEvent.code`); anything else matches the produced character or key name (`KeyboardEvent.key`: `s`, `?`, `F1`, `ArrowUp`, `Escape`).
- An invalid sequence is reported with `console.error` and skipped.

## Matching

- Modifiers must match exactly; a modifier not written must not be pressed.
- A letter matches case-insensitively, but Shift must still match: `"Ctrl+s"` does not fire on Ctrl+Shift+S.
- A non-letter printable character ignores Shift (`"?"`, `"1"` on AZERTY), and also Ctrl/Alt when AltGr is held (`"@"` on AZERTY).
- Lone modifier presses, dead keys and IME composition never break a sequence in progress.
- Holding a key repeats the binding it just completed (holding `Ctrl+z` undoes repeatedly).

## Sequences

- A key that doesn't continue the sequence in progress resets it, then is tried again from the start.
- A sequence resets after `timeout`, when the definition observable changes, when the node disconnects, and when focus leaves the listening target.
- If one binding's sequence is the start of another's (`"Ctrl+k"` and `"Ctrl+k, s"`), the longer one is unreachable unless the shorter has `terminal: false` (a warning is logged). Two bindings with the same sequence: the last one wins (warning).
- Bindings fire in inputs and text areas too; use `prevent_default: "last"` for a sequence whose first keys must still type (`"j, k"`).

## Nested keymaps

A keymap on an inner element sees an event before one on its ancestor. The innermost keymap that completes a binding wins; outer keymaps then reset without firing. A keymap that only *advances* a sequence doesn't block outer keymaps sharing that prefix: with `"Ctrl+k, v"` inside and `"Ctrl+k, s"` outside, `Ctrl+k` then `s` fires the outer one. `$keymap` never stops propagation.

## State

With `options.state`, the keymap writes `{ sequence, candidates }`: the combinations typed so far, and the bindings still reachable (all bindings at the start) — enough to build a "pending shortcut" hint or a help panel. Extra fields you add to your `ShortcutDefinition` objects come back through `candidates[i].definition`.
