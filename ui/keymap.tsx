/**
 * @module ui/keymap
 * Keyboard shortcuts and key sequences scoped to a node. See docs/md/ui-keymap.md.
 */

import { type Decorator, node_add_event_listener, node_observe, node_on_disconnected, type o } from "elt"

/** One `keydown` with its modifier state. `undefined` modifiers mean "must be up". */
export interface KeyCombination {
  ctrl?: boolean
  meta?: boolean
  alt?: boolean
  shift?: boolean
  code?: string
  key?: string
}

/** An ordered list of one or more combinations, like `Ctrl+k, s`. */
export type KeySequence = KeyCombination[]

/** `sequence` is the parsed sequence of the binding, `node` is the decorated node (also when `options.target` is given). */
export type KeymapCallback<N extends Node> = (sequence: KeySequence, node: N, event: KeyboardEvent) => void

export interface ShortcutDefinition<N extends Node> {
  sequence: KeySequence | string
  callback: KeymapCallback<N>
  /** Default `true`. `"last"` only prevents the default action of the step that completes the binding. */
  prevent_default?: boolean | "last"
  /** Default `true`. When `false`, the callback fires and the sequence continues into longer bindings. */
  terminal?: boolean
}

export type SimplifiedDefinition<N extends Node> = {
  [sequence: string]: KeymapCallback<N> | Omit<ShortcutDefinition<N>, "sequence">
}

type MaybeArray<T> = T | T[]

/** A binding after parsing. `definition` is the object that the developer gave. */
export interface KeymapBinding<N extends Node> {
  sequence: KeySequence
  definition: ShortcutDefinition<N>
}

export interface KeymapState<N extends Node> {
  /** The combinations used so far. `[]` at the start. */
  sequence: KeySequence
  /** The bindings whose sequence starts with `sequence`, and that are longer than `sequence`. */
  candidates: KeymapBinding<N>[]
}

export interface KeymapOptions<N extends Node> {
  /** Time limit between two steps of a sequence, in milliseconds. Default 2000. `Infinity` = no limit. */
  timeout?: number
  /** Listen on this target instead of the decorated node. */
  target?: Element | Document
  /** `$keymap` writes its state to this observable. It never reads it. */
  state?: o.Observable<KeymapState<N>>
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

const _nav =
  typeof navigator !== "undefined" ? (navigator as Navigator & { userAgentData?: { platform?: string } }) : null
const IS_MAC = /mac|iphone|ipad/i.test(_nav?.userAgentData?.platform ?? _nav?.platform ?? "")

type Modifier = "ctrl" | "alt" | "meta" | "shift"

// Written modifier names, lowercased, to the KeyCombination field they set.
const MODIFIERS = new Map<string, Modifier>([
  ["ctrl", "ctrl"],
  ["control", "ctrl"],
  ["alt", "alt"],
  ["option", "alt"],
  ["meta", "meta"],
  ["cmd", "meta"],
  ["super", "meta"],
  ["win", "meta"],
  ["shift", "shift"],
  ["mod", IS_MAC ? "meta" : "ctrl"],
])

// 1: modifiers ("Ctrl+Shift+"), 2: key (a word, or exactly one non-whitespace character), 3: separator ("," = another combination follows, "" = end of string)
const RE_COMBINATION = /\s*((?:[A-Za-z]+\+)*)([A-Za-z][A-Za-z0-9]*|\S)\s*(,|$)/y
const RE_CODE_KEY = /^(Key|Digit)./

/** Parse a sequence string. Returns `null` and logs an error when the string is invalid. */
function parse_sequence(str: string): KeySequence | null {
  const result: KeySequence = []
  let separator = ","
  RE_COMBINATION.lastIndex = 0
  while (separator === ",") {
    const match = RE_COMBINATION.exec(str)
    if (match == null) break
    separator = match[3]

    const combination: KeyCombination = {}
    // "Ctrl+Shift+".split("+") gives ["Ctrl", "Shift", ""]
    const modifiers = match[1].split("+")
    for (let i = 0, l = modifiers.length - 1; i < l; i++) {
      const mod = MODIFIERS.get(modifiers[i].toLowerCase())
      if (mod == null) {
        console.error(`$keymap: unknown modifier "${modifiers[i]}" in "${str}"`)
        return null
      }
      combination[mod] = true
    }

    const key = match[2]
    if (MODIFIERS.has(key.toLowerCase())) {
      console.error(`$keymap: the key "${key}" is a modifier in "${str}"`)
      return null
    }
    if (key === "Space") combination.key = " "
    else if (RE_CODE_KEY.test(key)) combination.code = key
    else combination.key = key

    result.push(combination)
  }

  if (separator !== "" || result.length === 0) {
    console.error(`$keymap: invalid sequence "${str}"`)
    return null
  }
  return result
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

const MATCH_EXACT = 0 // compare `key` as is, all modifiers must match
const MATCH_LETTER = 1 // one letter: compare `key` case-insensitive, all modifiers must match
const MATCH_SYMBOL = 2 // one printable non-letter: ignore Shift, and ignore Ctrl/Alt when AltGr is down

/** A KeyCombination prepared for fast comparison. Computed once per build. */
interface Step {
  ctrl: boolean
  alt: boolean
  meta: boolean
  shift: boolean
  code: string | undefined
  // Lowercased for MATCH_LETTER
  key: string | undefined
  mode: number
}

function is_one_character(key: string) {
  // A surrogate pair (emoji, rare scripts) is one character but two UTF-16 units.
  return key.length === 1 || (key.length === 2 && (key.codePointAt(0) ?? 0) > 0xffff)
}

function make_step(c: KeyCombination): Step {
  let mode = MATCH_EXACT
  let key = c.key
  if (c.code == null && key != null && is_one_character(key)) {
    const lower = key.toLowerCase()
    if (lower !== key.toUpperCase()) {
      mode = MATCH_LETTER
      key = lower
    } else {
      mode = MATCH_SYMBOL
    }
  }
  return { ctrl: !!c.ctrl, alt: !!c.alt, meta: !!c.meta, shift: !!c.shift, code: c.code, key, mode }
}

/** `key_lower` is `ev.key.toLowerCase()`, computed once per event by the caller. */
function step_matches(ev: KeyboardEvent, key_lower: string, s: Step): boolean {
  if (s.code != null && ev.code !== s.code) return false
  if (s.key != null && (s.mode === MATCH_LETTER ? key_lower : ev.key) !== s.key) return false
  if (ev.metaKey !== s.meta) return false
  if (s.mode !== MATCH_SYMBOL) return ev.ctrlKey === s.ctrl && ev.altKey === s.alt && ev.shiftKey === s.shift
  // The modifier was needed to type the character: `?` needs Shift on US layouts, `@` needs AltGr on AZERTY,
  // and Windows reports AltGr as Ctrl+Alt.
  if (ev.getModifierState("AltGraph")) return true
  return ev.ctrlKey === s.ctrl && ev.altKey === s.alt
}

// `keydown` of these keys comes before the key they modify (or compose). They never reset a sequence.
const PASSIVE_KEYS = new Set([
  "Alt",
  "AltGraph",
  "CapsLock",
  "Control",
  "Fn",
  "FnLock",
  "Hyper",
  "Meta",
  "NumLock",
  "ScrollLock",
  "Shift",
  "Super",
  "Symbol",
  "SymbolLock",
  "Dead",
  "Process",
])

// ---------------------------------------------------------------------------
// Nested keymaps
// ---------------------------------------------------------------------------

type Mark = "advanced" | "completed"

// The only data that keymaps share. An inner keymap marks the events it used, outer keymaps read the mark.
const marks = new WeakMap<KeyboardEvent, Mark>()

/** `true` if a `$keymap` advanced or completed a binding with this event. */
export function keymap_used(event: KeyboardEvent): boolean {
  return marks.has(event)
}

// ---------------------------------------------------------------------------
// $keymap
// ---------------------------------------------------------------------------

interface CompiledBinding<N extends Node> extends KeymapBinding<N> {
  steps: Step[]
}

function wants_prevent(b: CompiledBinding<any>, pos: number) {
  const p = b.definition.prevent_default ?? true
  return p === "last" ? pos === b.steps.length - 1 : p
}

// A string that is equal for two sequences that match the same events. Used for the duplicate and unreachable warnings.
function step_id(s: Step) {
  return `${+s.ctrl}${+s.alt}${+s.meta}${+s.shift}${s.code ?? ""}\u0002${s.key ?? ""}`
}

function is_definition(item: object): item is ShortcutDefinition<any> {
  const d = item as ShortcutDefinition<any>
  return typeof d.callback === "function" && (typeof d.sequence === "string" || Array.isArray(d.sequence))
}

function compile<N extends Node>(
  def: MaybeArray<ShortcutDefinition<N> | SimplifiedDefinition<N>>,
): CompiledBinding<N>[] {
  // Keyed by the sequence id. delete + set moves a duplicate to the end, so that the last one wins everywhere.
  const by_id = new Map<string, CompiledBinding<N>>()

  const add = (definition: ShortcutDefinition<N>) => {
    let sequence: KeySequence | null
    if (typeof definition.sequence === "string") {
      sequence = parse_sequence(definition.sequence)
    } else {
      sequence = definition.sequence
      if (sequence.length === 0 || sequence.some((c) => c.key == null && c.code == null)) {
        console.error("$keymap: invalid sequence", sequence)
        sequence = null
      }
    }
    if (sequence == null) return

    const steps = sequence.map(make_step)
    const id = steps.map(step_id).join("\u0001")
    if (by_id.has(id)) {
      console.warn(`$keymap: duplicate sequence`, definition.sequence, "- the last one wins")
      by_id.delete(id)
    }
    by_id.set(id, { sequence, definition, steps })
  }

  for (const item of Array.isArray(def) ? def : [def]) {
    if (is_definition(item)) {
      add(item)
      continue
    }
    // The type guard cannot narrow `item`: a SimplifiedDefinition could have "sequence" and "callback" keys.
    const simplified = item as SimplifiedDefinition<N>
    for (const sequence in simplified) {
      const v = simplified[sequence]
      add(typeof v === "function" ? { sequence, callback: v } : { ...v, sequence })
    }
  }

  // Warn about sequences that a shorter terminal binding hides. O(n²), but only on build and keymaps are small.
  for (const [short_id, short] of by_id) {
    if (short.definition.terminal === false) continue
    for (const [long_id, long] of by_id) {
      if (long_id.startsWith(`${short_id}\u0001`)) {
        console.warn(
          "$keymap:",
          long.definition.sequence,
          "is not reachable, because",
          short.definition.sequence,
          "is terminal",
        )
      }
    }
  }

  return [...by_id.values()]
}

/**
 * Add keyboard shortcuts and key sequences to a node.
 *
 * ```tsx
 * <div>
 *   {$keymap({
 *     "Mod+s": () => perform_save(),
 *     "Ctrl+k, s": () => perform_something_else(),
 *   })}
 * </div>
 * ```
 */
export function $keymap<N extends Node>(
  def: o.RO<MaybeArray<ShortcutDefinition<N> | SimplifiedDefinition<N>>>,
  options: KeymapOptions<N> = {},
): Decorator<N> {
  return function $keymap_apply(node: N) {
    const timeout = options.timeout ?? 2000
    const target: Node = options.target ?? node
    const o_state = options.state

    let bindings: CompiledBinding<N>[] = []
    let start_state: KeymapState<N> = { sequence: [], candidates: bindings }

    // The state machine: the bindings whose first `pos` steps matched the last `pos` events.
    let pos = 0
    let candidates = bindings
    let timer: ReturnType<typeof setTimeout> | undefined
    // For `event.repeat`: the binding that the previous keydown fired.
    let last_fired: CompiledBinding<N> | null = null

    function reset() {
      if (timer !== undefined) clearTimeout(timer)
      timer = undefined
      pos = 0
      candidates = bindings
      // Same object each time, so the observable does not notify when already at the start.
      o_state?.set(start_state)
    }

    function advance(next: CompiledBinding<N>[]) {
      pos++
      candidates = next
      if (timer !== undefined) clearTimeout(timer)
      timer = timeout === Infinity ? undefined : setTimeout(reset, timeout)
      o_state?.set({ sequence: next[0].sequence.slice(0, pos), candidates: next })
    }

    /**
     * Test `ev` against the current state. Returns the mark to write, or `null` when nothing matched.
     * When `may_fire` is `false` (an inner keymap already used the event), only advancing is allowed.
     */
    function step(ev: KeyboardEvent, key_lower: string, may_fire: boolean): Mark | null {
      const continuing: CompiledBinding<N>[] = []
      let fire: CompiledBinding<N> | null = null
      let prevent = false

      for (let i = 0, l = candidates.length; i < l; i++) {
        const b = candidates[i]
        if (!step_matches(ev, key_lower, b.steps[pos])) continue
        if (b.steps.length > pos + 1) {
          continuing.push(b)
          prevent ||= wants_prevent(b, pos)
        } else if (may_fire) {
          // Several bindings can match the same event (`"?"` and `"Shift+?"`): the last one in definition order wins.
          fire = b
          prevent ||= wants_prevent(b, pos)
        }
      }

      if (fire == null && continuing.length === 0) return null
      if (prevent) ev.preventDefault()

      if (fire != null && (fire.definition.terminal !== false || continuing.length === 0)) {
        // Update the state before the callback, so that an exception in it does not leave a stale state.
        reset()
        last_fired = fire
        fire.definition.callback(fire.sequence, node, ev)
        return "completed"
      }

      advance(continuing)
      fire?.definition.callback(fire.sequence, node, ev)
      return "advanced"
    }

    function on_keydown(ev: KeyboardEvent) {
      if (ev.isComposing) return
      const mark = marks.get(ev)

      if (ev.repeat) {
        // A held key repeats the binding it completed, and nothing else.
        const b = last_fired
        if (
          mark == null &&
          pos === 0 &&
          b != null &&
          step_matches(ev, ev.key.toLowerCase(), b.steps[b.steps.length - 1])
        ) {
          if (wants_prevent(b, b.steps.length - 1)) ev.preventDefault()
          marks.set(ev, "completed")
          b.definition.callback(b.sequence, node, ev)
        }
        return
      }

      last_fired = null
      if (mark === "completed") {
        reset()
        return
      }

      const key_lower = ev.key.toLowerCase()
      let result = step(ev, key_lower, mark == null)
      if (result == null) {
        if (pos === 0 || PASSIVE_KEYS.has(ev.key)) return
        reset()
        // An event marked by an inner keymap is not tested again from the start.
        if (mark != null) return
        result = step(ev, key_lower, true)
        if (result == null) return
      }
      if (mark == null) marks.set(ev, result)
    }

    function on_focusout(ev: FocusEvent) {
      const related = ev.relatedTarget as Node | null
      if (related == null || !target.contains(related)) {
        last_fired = null
        reset()
      }
    }

    node_add_event_listener(node, target, "keydown", on_keydown)
    node_add_event_listener(node, target, "focusout", on_focusout)
    node_on_disconnected(node, () => {
      last_fired = null
      reset()
    })
    node_observe(node, def, (d) => {
      bindings = compile(d)
      start_state = { sequence: [], candidates: bindings }
      last_fired = null
      reset()
    })
  }
}
