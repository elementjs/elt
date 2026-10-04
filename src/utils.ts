export class Deferred<T> implements Promise<T> {
  promise: Promise<T>
  resolve!: (value: T | PromiseLike<T>) => void
  reject!: (reason?: any) => void

  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve
      this.reject = reject
    })
  }

  [Symbol.toStringTag] = "Deferred"

  // biome-ignore lint/suspicious/noThenProperty: intentionally thenable, so instances can be awaited like a Promise
  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null | undefined,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null | undefined,
  ): Promise<TResult1 | TResult2> {
    return this.promise.then(onfulfilled, onrejected)
  }

  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null | undefined,
  ): Promise<T | TResult> {
    return this.promise.catch(onrejected)
  }

  finally(onfinally?: (() => void) | null | undefined): Promise<T> {
    return this.promise.finally(onfinally)
  }
}

/** Decorator to memoize the result of a class's get property, in old style and new style decorators */
export function memoize(target: any, key: string | symbol, descriptor: PropertyDescriptor): void
export function memoize<This, Value>(
  getter: (this: This) => Value,
  context: ClassGetterDecoratorContext<This, Value>,
): (this: This) => Value
export function memoize<This, Value>(
  target: any,
  key: string | symbol | ClassGetterDecoratorContext<This, Value>,
  descriptor?: PropertyDescriptor,
): any {
  if (typeof key === "symbol" || typeof key === "string") {
    // Legacy decorator: replace the getter of the descriptor
    const original = descriptor?.get
    if (descriptor == null || original == null) return descriptor
    descriptor.get = cached_getter(original, key.toString())
  } else {
    // Standard decorator: return the replacement getter
    return cached_getter(target, String(key.name))
  }
}

/** A getter that computes `original` once per instance and stores the result; `null` and `undefined` are not stored. */
function cached_getter(original: (this: any) => any, name: string) {
  const sym = Symbol(`memoize-${name}`)
  return function (this: any) {
    const cached = this[sym]
    if (cached != null) return cached
    const res = original.call(this)
    if (res != null) this[sym] = res
    return res
  }
}
