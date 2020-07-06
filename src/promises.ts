
export type Deferred<T> = Promise<T> & { resolve: (value: T) => void, reject: (err: any) => void }

export namespace Deferred {

  export function create<T>(pro?: Promise<T>) {
    var _resolve!: (value: T) => void, _reject!: (err: any) => void
    var res = new Promise<T>((resolve, reject) => {
      _resolve = resolve
      _reject = reject
      if (pro) pro.then(resolve).catch(reject)
    }) as Deferred<T>
    res.reject = _reject
    res.resolve = _resolve
    return res
  }

}
