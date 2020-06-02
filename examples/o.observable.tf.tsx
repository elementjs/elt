import { o } from 'elt'

const o_obs = o(3)
const o_transformed = o_obs.tf(v => v * 4) // 12 right now
o_transformed.addObserver(t => console.log(t))
o_obs.set(6) // o_transformed will hold 24

// Right now, the inference in typescript can't guess the argument types to revert.
// This may be fixed in the futured, but right now we have to type them.
const o_transformed_2 = o_obs.tf({ transform: (v, _, _2) => v * 4, revert: (v: number) => v / 4})
o_transformed_2.set(8) // o_obs now holds 2
