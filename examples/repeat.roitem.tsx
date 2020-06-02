import { o, Repeat } from 'elt'
// string
type A = Repeat.RoItem<string[]>
// o.Observable<string | number>
type B = Repeat.RoItem<o.Observable<(string | number)[]>>
// o.ReadonlyObservable<Date>
type C = Repeat.RoItem<o.ReadonlyObservable<Date[]>>
