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
