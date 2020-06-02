import { o, If } from 'elt'

type A = If.NonNullableRO<o.Observable<string | null>> // -> o.Observable<string>
type B = If.NonNullableRO<o.RO<number | undefined | null>> // -> o.ReadonlyObservable<number> | number
type C = If.NonNullableRO<string> // -> string
