# Keymap

This document describes the `$keymap` decorator.

The purpose of this decorator is to dynamically add keyboard shortcuts to an application, with the following features

- Shortcuts scoped to an element, or to another event target (for example `document`)
- Shortcut definition in observables that changes dynamically
- Key sequences (`Ctrl+k, s`)

`$keymap` is in `ui/keymap.tsx`. Import it from `elt/ui/keymap` (`ui/index.tsx` also re-exports it). It replaces the current stub in that file (`$keymap(...shortcuts: Shortcut[])`, `Shortcut.action`, `Shortcut.capture`). Remove the stub types.

> 📜 **ADR**: Name `$keymap` kept: the argument is a keymap (table of sequence → callback), as in Vim, Emacs, VS Code. `$key_sequence` rejected: `KeySequence` is the type of one sequence.

# Vocabulary

- **Combination**: one `keydown` with its modifier state. Type `KeyCombination`. Example: `Ctrl+k`.
- **Sequence**: an ordered list of one or more combinations. Type `KeySequence`. Example: `Ctrl+k, s`.
- **Binding**: a sequence and the callback that it activates. Type `ShortcutDefinition` (as written by the developer) or `KeymapBinding` (after parsing).
- **Keymap**: the list of bindings given to one `$keymap` call.
- **Start**: the state of the state machine when no sequence is in progress.
- **Listening target**: the `EventTarget` on which `$keymap` listens. It is `options.target` if given, else the decorated node.

# API

```typescript
type KeySequence = KeyCombination[]

// `sequence` is the parsed sequence of the binding, `node` is the decorated node (also when `options.target` is given).
type KeymapCallback<N extends Node> = (sequence: KeySequence, node: N, event: KeyboardEvent) => void

interface KeyCombination {
  ctrl?: boolean
  meta?: boolean
  alt?: boolean
  shift?: boolean
  code?: string
  key?: string
}

interface ShortcutDefinition<N extends Node> {
  sequence: KeySequence | string
  callback: KeymapCallback<N>
  // Default `true`. See "Event handling".
  prevent_default?: boolean | "last"
  // Default `true`. See "Sequences".
  terminal?: boolean
}

type SimplifiedDefinition<N extends Node> = {[sequence: string]: KeymapCallback<N> | Omit<ShortcutDefinition<N>, "sequence">}
type MaybeArray<T> = T | T[]

// A binding after parsing. `definition` is the object that the developer gave (for a SimplifiedDefinition entry, a new ShortcutDefinition built from the entry).
interface KeymapBinding<N extends Node> {
  sequence: KeySequence
  definition: ShortcutDefinition<N>
}

// See "State observable".
interface KeymapState<N extends Node> {
  // The combinations used so far. `[]` at the start.
  sequence: KeySequence
  // The bindings whose sequence starts with `sequence`, and that are longer than `sequence`.
  candidates: KeymapBinding<N>[]
}

interface KeymapOptions<N extends Node> {
  // Time limit between two steps of a sequence, in milliseconds. Default 2000. `Infinity` = no limit.
  timeout?: number
  // Listen on this target instead of the decorated node. Default: the decorated node.
  target?: Element | Document
  // `$keymap` writes its state to this observable. It never reads it.
  state?: o.Observable<KeymapState<N>>
}

function $keymap<N extends Node>(def: o.RO<MaybeArray<ShortcutDefinition<N> | SimplifiedDefinition<N>>>, options: KeymapOptions<N> = {}): Decorator<N>

// `true` if a `$keymap` advanced or completed a binding with this event. See "Nested keymaps".
function keymap_used(event: KeyboardEvent): boolean

// example invocation
<input>
  {$bind.string(o_some_input)}
  {$keymap({
    "Ctrl+s": () => perform_save(),
    "Ctrl+k, s": () => perform_something_else(),
  })}
</input>
```

> 📜 **ADR**: `description` and `context` are removed. A closure gives the context. A help panel is the job of the app: the app can add its own fields to its definition objects (a type that extends `ShortcutDefinition`) and read them back through `KeymapBinding.definition` in the state observable.

# Parsing

A sequence string is a list of combinations separated by `,`, with optional whitespace around each combination. A combination is zero or more modifiers, each followed by `+`, then one key. The key is:

- a word: a letter followed by letters or digits (`k`, `F1`, `ArrowUp`, `KeyS`, `Space`),
- else exactly one character that is not whitespace (`,`, `+`, `1`, `é`, `?`).

The parser uses one sticky regular expression, applied in a loop. Do not write a character-by-character parser.

```typescript
// 1: modifiers ("Ctrl+Shift+"), 2: key, 3: separator ("," = another combination follows, "" = end of string)
const RE_COMBINATION = /\s*((?:[A-Za-z]+\+)*)([A-Za-z][A-Za-z0-9]*|\S)\s*(,|$)/y

// Loop: set lastIndex to 0, exec while the previous separator is ",".
// The string is valid when the last separator is "" and there is at least one combination.
// Modifiers of a combination: match[1].split("+").slice(0, -1)
```

Results:

| String | Combinations |
| ------ | ------------ |
| `"Ctrl+k, s"` | `Ctrl`+`k`, then `s` |
| `"Ctrl+,"` | `Ctrl`+`,` |
| `"Ctrl++"` | `Ctrl`+`+` |
| `"Ctrl+k, ,"` | `Ctrl`+`k`, then `,` |
| `"Ctrl+Space"` | `Ctrl`+`" "` |
| `"Ctrl+k,"` | invalid (separator at the end) |
| `"Ctrl+k s"` | invalid (no separator) |
| `"a+b"` | invalid (unknown modifier `a`) |

The key `Space` maps to `key === " "`. It is the only key name that the parser changes.

> 📜 **ADR**: No other key names (`Comma`, `Plus`): they collide with `KeyboardEvent.code` values. `Space` is safe because `code === "Space"` and `key === " "` are the same physical key on all layouts.

Modifiers are case-insensitive. The parser accepts:

| Written | Modifier |
| ------- | -------- |
| `Ctrl`, `Control` | `ctrl` |
| `Alt`, `Option` | `alt` |
| `Meta`, `Cmd`, `Super`, `Win` | `meta` |
| `Shift` | `shift` |
| `Mod` | `meta` on macOS, `ctrl` on other platforms |

`Mod` detection: the platform is macOS when `navigator.userAgentData?.platform ?? navigator.platform` matches `/mac|iphone|ipad/i`. Detect it one time, when the module loads.

If `<key>` starts with `Key` or `Digit`, the combination compares it with `KeyboardEvent.code`. Else, it compares it with `KeyboardEvent.key`. Thus `Numpad1`, `F1`, `ArrowUp`, `Escape` and `Enter` compare with `key`.

A sequence string is invalid when the regular expression loop fails, when it has an unknown modifier, or when the key is a modifier name (`Ctrl`, `Shift`, ...). A `KeySequence` is invalid when it is empty, or when one of its combinations has no `key` and no `code`. For an invalid sequence, `$keymap` calls `console.error` with the string and skips that binding. The other bindings stay active. This applies each time the definition observable gives a new value.

# Matching

A `keydown` matches a combination when all these conditions are true:

- The key matches: `event.code === combination.code`, or `event.key === combination.key`, as the combination gives.
- For each modifier (`ctrl`, `alt`, `meta`, `shift`): the modifier state of the event is equal to the value in the combination. `undefined` in the combination means `false`.

Exceptions:

- When `combination.key` is one character and that character is a letter (`char.toLowerCase() !== char.toUpperCase()`), compare `key` case-insensitive. Shift must still match. Thus `"Ctrl+s"` does not match Ctrl+Shift+S, and `"Ctrl+Shift+s"` and `"Ctrl+Shift+S"` both match it.
- When `combination.key` is one printable character that is not a letter, ignore Shift. Thus `"?"` matches `?` with or without Shift, and `"1"` matches `1` on AZERTY (where `1` needs Shift).
- When `combination.key` is one printable character that is not a letter and `event.getModifierState("AltGraph")` is `true`, ignore `ctrl`, `alt` and `shift`. Thus `"@"` matches AltGr+0 on AZERTY, also on Windows, which reports AltGr as Ctrl+Alt.
- Combinations that use `code` are not affected by these exceptions.

# Sequences

Each `$keymap` call builds its bindings into one state machine. The state of the machine is a position `pos` (the number of steps done) and the list of candidate bindings (the bindings whose first `pos` combinations matched the last `pos` events). At the start, `pos` is 0 and all bindings are candidates. For each `keydown`, the state machine tests combination number `pos` of each candidate.

More than one candidate can match the same event (example: `"?"` and `"Shift+?"`, or `"s"` and `{ code: "KeyS" }`). The candidates that match and have more steps continue. Of the candidates that match on their last step, only the last one in definition order fires.

"Passive" keys: `event.key` is one of `Alt`, `AltGraph`, `CapsLock`, `Control`, `Fn`, `FnLock`, `Hyper`, `Meta`, `NumLock`, `ScrollLock`, `Shift`, `Super`, `Symbol`, `SymbolLock`, `Dead`, `Process`. When a passive key does not match a combination from the current state, the state machine ignores it: no reset, no `preventDefault`. When it matches (only possible with a `code` combination, for example `{ code: "BracketLeft" }`), the state machine handles it as a normal key.

> 📜 **ADR**: `Dead` is a dead key (for example `^` on AZERTY, which waits for the next key to make `ê`). Its `keydown` has `key === "Dead"`, never `key === "^"`, so the string `"^"` cannot match it on AZERTY, with or without this rule. On US layouts, `^` is Shift+6, not a dead key: `"^"` matches. To bind the AZERTY dead key, use `{ code: "BracketLeft" }`; the "match first, else ignore" rule keeps this possible. `Process` is an IME key in progress. Without this rule, pressing `Ctrl` before `k` resets each `Ctrl+k` sequence.

The state machine also ignores a `keydown` when:

- `event.isComposing` is `true`.
- `event.repeat` is `true`, except in this case: the state machine is at the start, and the previous `keydown` fired a binding, and the event matches the last combination of that binding. Then that binding fires again. Example: holding `Ctrl+z` fires undo again and again; holding the `s` of `"Ctrl+k, s"` fires it again.

When a `keydown` does not continue a binding from the current state, the state machine resets to the start. It does not call `preventDefault` for that event. Then it tests the same event again from the start. Example: the keymap has `"Ctrl+k, s"` and `"x"`. The user presses `Ctrl+k` then `x`: the sequence resets, then `"x"` fires.

When a `keydown` completes a binding, the callback fires and the state machine resets to the start, except when the binding has `terminal: false` (below).

In one keymap, when a sequence is the start of a longer sequence (`"Ctrl+k"` and `"Ctrl+k, s"`):

- If the short binding has `terminal: false`: on `Ctrl+k`, its callback fires and the state machine goes to the next step. `s` then fires `"Ctrl+k, s"`.
- Else: on `Ctrl+k`, its callback fires and the state machine resets to the start. `"Ctrl+k, s"` is never reachable. `$keymap` calls `console.warn` with both sequences when it builds the state machine.

A binding with `terminal: false` and no longer sequence behaves as a binding with `terminal: true`.

In one keymap, when two bindings have the same sequence, the last one wins. `$keymap` calls `console.warn` with the sequence.

Two sequences are "the same" when their combinations match the same events: same modifiers, same `code`, same `key` (letters compared case-insensitive). The same rule finds the sequences that a terminal binding hides.

When the time between two steps of a sequence is more than `options.timeout`, the state machine resets to the start. The time starts at the `keydown` that advanced the state.

The state machine resets to the start when:

- the definition observable gives a new value (the state machine is built again),
- the node disconnects,
- the time limit expires,
- a `focusout` event on the listening target has a `relatedTarget` that is `null` or not in the listening target.

# State observable

When `options.state` is given, `$keymap` writes a `KeymapState` to it:

- when the state machine is built (first time and each new definition value),
- each time the state changes (advance, reset, time limit).

At the start, `sequence` is `[]` and `candidates` is the list of all bindings. Write the same start object each time, so that the observable does not notify when the state machine is already at the start. After an advance, `sequence` is the first `pos` combinations of the first candidate.

> 🔎 **Assumption**: At the start, `candidates` contains all bindings (not an empty list). This lets an app show a full help panel from the same observable.

# Event handling

`$keymap` listens to `keydown` and `focusout` on the listening target, in the bubble phase. It registers the listeners with `node_add_event_listener(node, target, ...)`, so they are active only while the decorated node is connected. It observes the definition with `node_observe`.

Bindings match for all `event.target` values, also for `<input>`, `<textarea>`, `<select>` and `contenteditable` elements.

> 📜 **ADR**: No special case for editable elements. The developer does not bind unmodified printable keys where the user types text; `prevent_default: "last"` covers the sequences that must type through (`"j, k"`).

`prevent_default` of a binding says, for each step of that binding, whether the step "wants" `preventDefault`:

- `true` (default): all steps want it.
- `false`: no step wants it.
- `"last"`: only the last step wants it. Example: `"j, k"` with `"last"`: `j` goes into the input, `k` does not.

When a `keydown` advances the state machine or completes a binding, `$keymap` calls `preventDefault` if one or more of the bindings that this step matches want it. Example: `"Ctrl+k, s"` (`true`) and `"Ctrl+k, v"` (`false`): `Ctrl+k` is prevented, `v` is not.

`$keymap` never calls `stopPropagation`. The event continues to bubble to the keymaps of the parent nodes and to other listeners.

# Nested keymaps

Keymaps do not know each other. There is no registry and no reference from one keymap to another. The only data that keymaps share is a module-level `WeakMap<KeyboardEvent, "advanced" | "completed">` (the "mark" of an event). The order in which keymaps see an event is the order of the browser's event dispatch.

An "inner" keymap is a keymap that receives the event before another keymap. In the bubble phase, a keymap on a descendant element is inner to a keymap on an ancestor. Two keymaps on the same listening target receive the event in the order of `addEventListener` calls: the first registered is inner. A reconnect registers the listener again, at the end.

`$keymap` marks each `keydown` that it used:

- `"advanced"`: after this event, the state machine of the keymap is in the middle of a sequence. This includes a binding with `terminal: false` that fired and continues.
- `"completed"`: a binding fired and the state machine is back at the start.

A keymap writes the mark only if the event has no mark yet.

When a keymap receives an event that has a mark:

- `"advanced"`: if the event takes the keymap to a step that has longer sequences after it, the keymap advances and applies its own `preventDefault` rule. Else, the keymap resets to the start (no second test from the start). In both cases, it never fires a callback for this event.
- `"completed"`: the keymap resets to the start. It does not fire a callback and does not call `preventDefault`.

A repeated `keydown` (`event.repeat`) that fires a binding again is marked `"completed"`. A repeated `keydown` that has a mark never fires.

`keymap_used(event)` returns `true` when the event has a mark.

Examples (inner keymap on a child element, outer keymap on its parent):

| Inner | Outer | Keys | Result |
| ----- | ----- | ---- | ------ |
| `Ctrl+k, v` | `Ctrl+k, s` | `Ctrl+k`, `s` | Both advance on `Ctrl+k`. On `s`, the inner resets (no mark), the outer fires. |
| `Ctrl+k, v` | `Ctrl+k, s` | `Ctrl+k`, `v` | Both advance on `Ctrl+k`. On `v`, the inner fires (`"completed"`), the outer resets. |
| `Ctrl+k, s` | `Ctrl+k` | `Ctrl+k`, `s` | On `Ctrl+k`, the inner advances (`"advanced"`), the outer resets and does not fire. On `s`, the inner fires. |
| `Ctrl+k` | `Ctrl+k, s` | `Ctrl+k`, `s` | On `Ctrl+k`, the inner fires (`"completed"`), the outer resets. `s` does nothing. |
| `Ctrl+k` (`terminal: false`) and `Ctrl+k, v` | `Ctrl+k, s` | `Ctrl+k`, `s` | On `Ctrl+k`, the inner fires and advances (`"advanced"`), the outer advances. On `s`, the inner resets, the outer fires. |

> 📜 **ADR**: An inner keymap that only advances must not "eat" the combination: inner and outer can share a prefix (`Ctrl+k, s` and `Ctrl+k, v`). The mark is a `WeakMap` because `defaultPrevented` cannot tell "advanced" from "completed", and a single module variable fails when a callback dispatches a synthetic `keydown` synchronously.
