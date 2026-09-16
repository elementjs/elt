/*
Root snapshot undo/redo ring (Layer 5). Watches the shell root observable and
records immutable snapshots on each commit after the initial state.
*/

import { o } from "elt"

export interface UndoRingOptions {
  /** Regular history depth — spec default range 30–50. */
  depth?: number
  /** Cap for import-tagged snapshots — spec suggests ~5. */
  import_undo_depth?: number
}

const DEFAULT_DEPTH = 50
const DEFAULT_IMPORT_DEPTH = 5

interface RingEntry {
  snapshot: unknown
  import_tag: boolean
}

export class RootUndoRing {
  readonly o_can_undo = o(false)
  readonly o_can_redo = o(false)

  private entries: RingEntry[] = []
  private cursor = -1
  private recording = true

  constructor(
    private readonly o_root: o.Observable<unknown>,
    private readonly opts: UndoRingOptions = {},
  ) {}

  private depth_limit() {
    return this.opts.depth ?? DEFAULT_DEPTH
  }

  private import_limit() {
    return this.opts.import_undo_depth ?? DEFAULT_IMPORT_DEPTH
  }

  /** Seed history and start watching root writes. */
  attach() {
    this.push(o.clone(this.o_root.get()), false, false)
    this.o_root.addObserver((value, old) => {
      if (old === o.NoValue) return
      if (!this.recording) return
      this.push(o.clone(value), false, true)
    })
  }

  /** Tag the most recent entry as an import snapshot (Layer 6 hook). */
  mark_last_import() {
    const entry = this.entries[this.cursor]
    if (entry) entry.import_tag = true
    this.trim()
    this.sync_flags()
  }

  undo(): boolean {
    if (this.cursor <= 0) return false
    this.recording = false
    this.cursor--
    this.o_root.set(o.clone(this.entries[this.cursor]!.snapshot))
    this.recording = true
    this.sync_flags()
    return true
  }

  redo(): boolean {
    if (this.cursor >= this.entries.length - 1) return false
    this.recording = false
    this.cursor++
    this.o_root.set(o.clone(this.entries[this.cursor]!.snapshot))
    this.recording = true
    this.sync_flags()
    return true
  }

  private push(snapshot: unknown, import_tag: boolean, truncate_redo: boolean) {
    if (truncate_redo) {
      this.entries = this.entries.slice(0, this.cursor + 1)
    }
    this.entries.push({ snapshot, import_tag })
    this.cursor = this.entries.length - 1
    this.trim()
    this.sync_flags()
  }

  private trim() {
    const depth = this.depth_limit()
    while (this.entries.length > depth) {
      this.entries.shift()
      this.cursor--
    }

    let import_count = 0
    for (let i = this.entries.length - 1; i >= 0; i--) {
      if (this.entries[i]!.import_tag) import_count++
      if (import_count > this.import_limit()) {
        this.entries = this.entries.slice(i + 1)
        this.cursor = this.entries.length - 1
        break
      }
    }

    if (this.cursor < 0 && this.entries.length > 0) this.cursor = 0
  }

  private sync_flags() {
    this.o_can_undo.set(this.cursor > 0)
    this.o_can_redo.set(this.cursor >= 0 && this.cursor < this.entries.length - 1)
  }
}
