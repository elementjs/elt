/**
 * @internal
 */
export interface Indexable {
  idx: number | null
}


/**
 * Does a naive foreach on an IndexableArray
 * @param _arr the array
 * @param fn the function to apply
 * @internal
 */
export function EACH<T extends Indexable>(_arr: IndexableArray<T>, fn: (arg: T) => void) {
  for (var i = 0, arr = _arr.arr; i < arr.length; i++) {
    var item = arr[i]
    if (item == null) continue
    fn(item)
  }
  _arr.actualize()
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
      var newarr = new Array(this.real_size)
      for (var i = 0, j = 0, l = arr.length; i < l; i++) {
        var item = arr[i]
        if (item == null) continue
        newarr[j] = item
        item.idx = j
        j++
      }
      this.arr = newarr
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
    for (var i = 0; i < a.length; i++) {
      var item = a[i]
      if (item == null) continue
      item.idx = null
    }
    this.arr = []
    this.real_size = 0
  }
}
