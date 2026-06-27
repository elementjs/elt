/*
This file tests some typing contracts. It should never have errors
*/

import type { Renderable } from '../src';
import { o } from '../src/observable'

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
export var t6: o.ReadonlyObservable<number | string | undefined> = o(_ as o.Observable<number> | o.Observable<string> | undefined)

export var t7: o.Observable<number> = o(_ as o.Observable<number> | o.Observable<number>)

export var t8: o.ReadonlyObservable<number | string> = o(_ as o.Observable<number> | o.Observable<string>)

export type t9 = o.ReadonlyObservable<number> | undefined extends o.ReadonlyObservable<any> ? true : false

declare var __: any

{
  var rd: Renderable<HTMLDivElement> = __ as HTMLAnchorElement
  void rd
}

// .p() / o.prop() typing
{
  const obj = o({ a: 1, b: { c: "x" } })

  var tp1: o.Observable<number> = obj.p("a")
  var tp2: o.Observable<string> = obj.p((x) => x.b.c)
  var tp3: o.Observable<number | { c: string }> = obj.p(o<"a">("a"))
  var tp4: o.Observable<number | { c: string }> = obj.p(o<"a" | "b">("a"))

  // path arrays are runtime-only; type as unknown
  var tp5: o.Observable<unknown> = obj.p(["b", "c"])
  var tp6: o.Observable<unknown> = obj.p(["b", "c"] as const)
  var tp7: o.Observable<unknown> = obj.p(o(["b", "c"]))
  var tp8: o.Observable<unknown> = obj.p(o(["b", "c"] as const))

  var tprop1: o.Observable<number> = o.prop(obj, "a")
  var tprop2: o.Observable<string> = o.prop(obj, (x) => x.b.c)
  var tprop3: o.Observable<unknown> = o.prop(obj, ["b", "c"])
  var tprop4: o.Observable<unknown> = o.prop(obj, o(["b", "c"]))

  void tp1, tp2, tp3, tp4, tp5, tp6, tp7, tp8, tprop1, tprop2, tprop3, tprop4
}
