/*
This file tests some typing contracts. It should never have errors
*/

import type { Renderable } from "../src"
import { o } from "../src/observable"
import type { ServiceHelper, ServiceHelperBase } from "../src/app/service"
import type { ObjectEditorShell } from "../editor/shell"

var _: any

export var t1: o.Observable<string> = o(_ as string)

export var t2: o.Observable<string | number> = o(_ as string | number)

// with a regular observable, it just gives itself back.
export var t3: o.Observable<number> = o(_ as o.Observable<number>)

// when mixed, a ReadonlyObservable absorbs the rest of the types.
export var t4: o.ReadonlyObservable<number | undefined> = o(_ as o.ReadonlyObservable<number> | undefined)

// whenever mixed with another type, an Observable becomes a Readonly Observable
export var t5: o.ReadonlyObservable<number | undefined> = o(_ as o.Observable<number> | undefined)

// mixing anything with Observable makes it a ReadonlyObservable anyway.
export var t6: o.ReadonlyObservable<number | string | undefined> = o(
  _ as o.Observable<number> | o.Observable<string> | undefined,
)

export var t7: o.Observable<number> = o(_ as o.Observable<number> | o.Observable<number>)

export var t8: o.ReadonlyObservable<number | string> = o(_ as o.Observable<number> | o.Observable<string>)

export type t9 = o.ReadonlyObservable<number> | undefined extends o.ReadonlyObservable<any> ? true : false

declare var __: any

{
  const rd: Renderable<HTMLDivElement> = __ as HTMLAnchorElement
  void rd
}

// .p() / o.prop() typing
{
  const obj = o({ a: 1, b: { c: "x" } })

  const tp1: o.Observable<number> = obj.p("a")
  const tp2: o.Observable<string> = obj.p((x) => x.b.c)
  const tp3: o.Observable<number> = obj.p(o<"a">("a"))
  // @ts-expect-error the property observable of "a" is invariant: it holds numbers only, not also the objects of "b"
  const tp3_wide: o.Observable<number | { c: string }> = obj.p(o<"a">("a"))
  const tp4: o.Observable<number | { c: string }> = obj.p(o<"a" | "b">("a"))

  // path arrays are runtime-only; type as unknown
  const tp5: o.Observable<unknown> = obj.p(["b", "c"])
  const tp6: o.Observable<unknown> = obj.p(["b", "c"] as const)
  const tp7: o.Observable<unknown> = obj.p(o(["b", "c"]))
  const tp8: o.Observable<unknown> = obj.p(o(["b", "c"] as const))

  const tprop1: o.Observable<number> = o.prop(obj, "a")
  const tprop2: o.Observable<string> = o.prop(obj, (x) => x.b.c)
  const tprop3: o.Observable<unknown> = o.prop(obj, ["b", "c"])
  const tprop4: o.Observable<unknown> = o.prop(obj, o(["b", "c"]))

  void [tp1, tp2, tp3, tp3_wide, tp4, tp5, tp6, tp7, tp8, tprop1, tprop2, tprop3, tprop4]
}

// An Out is writable, never readable: any observable accepting that value is one, but not the other way round.
{
  const out1: o.Out<string> = o("")
  const out2: o.Out<"a" | "b"> = o("")
  const out3: o.Out<string> = o("").tf({ transform: (s) => s, revert: (s) => s })
  // @ts-expect-error a narrower observable can't take every value an Out<string> may receive
  const out4: o.Out<string> = o<"a" | "b">("a")
  // @ts-expect-error an Out has no get(): it is not readable
  const out5: o.RO<string> = null as unknown as o.Out<string>
  void [out1, out2, out3, out4, out5]

  // o.tee gives an Out of the type that every target accepts, and skips undefined targets.
  const tee1: o.Out<"a"> = o.tee(o<"a" | "b">("a"), o("a"), undefined)
  // @ts-expect-error a narrower observable can't take every value of a wider Out
  const tee2: o.Out<string> = o.tee<string>(o<"a" | "b">("a"))
  void [tee1, tee2]
}

// The write type of an IObservable<Get, Set> is contravariant; the read type of any readonly observable is covariant.
{
  const wide_set = _ as o.IObservable<string, string>
  const narrow_set = _ as o.IObservable<string, "a" | "b">
  const s1: o.IObservable<string, "a" | "b"> = wide_set
  // @ts-expect-error narrow_set only accepts "a" | "b", but an IObservable<string, string> promises any string
  const s2: o.IObservable<string, string> = narrow_set
  const ro_narrow = _ as o.IReadonlyObservable<"a">
  const r1: o.IReadonlyObservable<string> = ro_narrow
  // @ts-expect-error reading a string where "a" is promised
  const r2: o.IReadonlyObservable<"a"> = null as unknown as o.IReadonlyObservable<string>
  // Only a writable observable can be given a Converter: from a read-only one, tf is read-only.
  const ro_num = _ as o.IReadonlyObservable<number>
  const conv = { transform: (n: number) => String(n), revert: (s: string) => Number(s) }
  const w2: o.Observable<string> = o(0).tf(conv)
  const w3: o.ReadonlyObservable<string> = (_ as o.ReadonlyObservable<number>).tf(conv)
  // @ts-expect-error a ReadonlyObservable has no Converter overload that would return a writable observable
  const w4: o.Observable<string> = (_ as o.ReadonlyObservable<number>).tf(conv)
  const r3: o.IReadonlyObservable<number | string> = ro_num
  void [s1, s2, r1, r2, w2, w3, w4, r3]
}

// An Observable<A> is invariant in A (it is read and written); a ReadonlyObservable<A> is covariant.
{
  const narrow = _ as o.Observable<"a" | "b">
  const wide = _ as o.Observable<string>
  // @ts-expect-error someone could set any string through the wider type
  const v1: o.Observable<string> = narrow
  // @ts-expect-error reading a string where "a" | "b" is promised
  const v2: o.Observable<"a" | "b"> = wide
  const v3: o.ReadonlyObservable<string | null> = wide
  const v4: o.ReadonlyObservable<unknown> = narrow
  // @ts-expect-error a ReadonlyObservable<unknown> cannot be written, and an Observable<unknown> can
  const v5: o.Observable<unknown> = _ as o.ReadonlyObservable<unknown>
  void [v1, v2, v3, v4, v5]
}

// A service seen through its declared params is the same object as the erased one the app state keeps, not the other way round.
{
  const typed = _ as ServiceHelper<{ page: number }>
  const erased: ServiceHelperBase = typed
  const o_page: o.Observable<number> = typed.param_soft("page")
  // @ts-expect-error the erased helper does not know the params of its service
  erased.param_soft("page")
  // @ts-expect-error a service that declares a number param is not one that declares a string param
  const other: ServiceHelper<{ page: string }> = typed
  void [erased, o_page, other]
}

// The editor takes the caller's typed model as it is; it handles it as unknown inside.
{
  type Model = ConstructorParameters<typeof ObjectEditorShell<{ name: string }>>[0]
  const typed: Model = o({ name: "Ada" })
  // @ts-expect-error a model of another type
  const other: Model = o("Ada")
  void [typed, other]
}
