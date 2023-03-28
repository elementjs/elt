import { o, If } from 'elt'
// o_obj is nullable.
const o_obj = o({a: 'hello'} as {a: string} | null)

If(o_obj,
  // o_truthy here is o.Observable<{a: string}>
  // which is why we can safely use .p('a') without typescript complaining
  o_truthy => <>{o_truthy.p('a')}</>
)
