/**
 * @internal
 */
export interface Indexable {
  idx: number | null
}

/**
 * An array wrapper that infects its elements with their indexes for faster deletion.
 * @internal
 */
export class IndexableArray<T extends Indexable> {
  arr = [] as (T | null)[]
  real_size = 0

  add(a: T) {
    const arr = this.arr
    if (a.idx != null) {
      // will be put to the end
      arr[a.idx] = null
    } else {
      this.real_size++
    }
    a.idx = arr.length
    arr.push(a)
  }

  actualize() {
    const arr = this.arr
    if (this.real_size !== arr.length) {
      let j = 0
      for (let i = 0, l = arr.length; i < l; i++) {
        const item = arr[i]
        if (item == null) continue
        if (i !== j) {
          arr[j] = item
          item.idx = j
        }
        j++
      }
      arr.length = j
    }
  }

  delete(a: T) {
    if (a.idx != null) {
      this.arr[a.idx] = null
      a.idx = null
      this.real_size--
    }
  }

  /**
   * Delete by moving the last item into the hole: O(1), and the array never holds holes.
   * Only for arrays whose order has no meaning, and that are never iterated while items are deleted.
   */
  swap_delete(a: T) {
    const idx = a.idx
    if (idx == null) return
    const arr = this.arr
    // biome-ignore lint/style/noNonNullAssertion: `a` is in the array, so it is not empty
    const last = arr.pop()!
    if (last !== a) {
      arr[idx] = last
      last.idx = idx
    }
    a.idx = null
    this.real_size--
  }

  /** Compact when more than half the slots are holes, so that the cost of deletions stays amortized O(1). */
  compact_if_sparse() {
    const len = this.arr.length
    if (len > 8 && this.real_size < len >> 1) this.actualize()
  }

  clear() {
    const a = this.arr
    for (let i = 0; i < a.length; i++) {
      const item = a[i]
      if (item == null) continue
      item.idx = null
    }
    this.arr = []
    this.real_size = 0
  }
}
