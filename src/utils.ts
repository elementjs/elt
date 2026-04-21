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

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?:
      | ((value: T) => TResult1 | PromiseLike<TResult1>)
      | null
      | undefined,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | null
      | undefined
  ): Promise<TResult1 | TResult2> {
    return this.promise.then(onfulfilled, onrejected)
  }

  catch<TResult = never>(
    onrejected?:
      | ((reason: any) => TResult | PromiseLike<TResult>)
      | null
      | undefined
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
  context: ClassGetterDecoratorContext<This, Value>
): (this: This) => Value
export function memoize<This, Value>(
  target: any,
  key: string | symbol | ClassGetterDecoratorContext<This, Value>,
  descriptor?: PropertyDescriptor
): any {
  if (typeof key === "symbol" || typeof key === "string") {
    if (descriptor == null) {
      return
    }
    const sym = Symbol(`memoize-${key.toString()}`)
    const original = descriptor.get
    if (original == null) {
      return descriptor
    }
    descriptor.get = function (this: any) {
      if (this[sym] != null) {
        return this[sym]
      }
      const res = original.apply(this)
      if (res == null) {
        return res
      }
      this[sym] = res
      return res
    }
  } else {
    // New-style decorator
    const context = key
    const sym = Symbol(`memoize-${String(context.name)}`)

    return function (this: This): Value {
      if ((this as any)[sym] != null) {
        return (this as any)[sym]
      }
      const res = target.call(this)
      if (res == null) {
        return res
      }
      (this as any)[sym] = res
      return res
    }
  }
}