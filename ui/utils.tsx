import { $click, } from "elt"

export class Future<T> implements Promise<T> {
  #promise!: Promise<T>
  #reject!: (reason: any) => void
  #resolve!: (value: T) => void
  #resolved = false
  constructor() {
    this.#promise = new Promise((resolve, reject) => {
      this.#reject = reject
      this.#resolve = resolve
    })
  }

  reject(reason: any) {
    if (this.#resolved) return
    this.#resolved = true
    this.#reject(reason)
  }

  resolve(value: T) {
    if (this.#resolved) return
    this.#resolved = true
    this.#resolve(value)
  }

  $clickResolve<N extends HTMLElement | SVGElement>(fn: (ev: MouseEvent & {currentTarget: N}) => T): (e: N) => void {
    return (e: N) => {
      $click<N>(ev => {
        const res = fn(ev)
        this.resolve(res)
      })(e)
    }
  }

  get [Symbol.toStringTag]() {
    return this.#promise[Symbol.toStringTag]
  }

  then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null | undefined, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null | undefined): Promise<TResult1 | TResult2> {
    return this.#promise.then(onfulfilled, onrejected)
  }

  catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null | undefined): Promise<T | TResult> {
    return this.#promise.catch(onrejected)
  }

  finally(onfinally?: (() => void) | null | undefined): Promise<T> {
    return this.#promise.finally(onfinally)
  }
}
