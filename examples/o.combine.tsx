import { o } from 'elt'
// prop is o.RO<K>, which allows us to write
// prop(o_obs, 'key')
// prop(o_obs, o_key) where o_key can be readonly
// -- this works because we never need to touch the key, just to know if it changes.
function prop<T, K extends keyof T>(obj: o.Observable<T> | T, prop: o.RO<K>) {
  return o.combine(
    o.tuple(obj, prop), // combine needs a tuple to not have all arguments as unions
    ([obj, prop]) => obj[prop], // the getter is pretty straightforward
    (nval, _, [orig, prop]) => { // we ignore the old value of the combined observable, which is why it's named _
      // clone the original value ; remember, observables deal with immutables
      const newo = o.clone(orig)
      // assign the new value to the clone
      newo[prop] = nval
      // here, combine will not update the prop since NOVALUE is given
      return o.tuple(newo, o.NoValue) // o.NOVALUE is any, so tsc won't complain
    }
  )
}
