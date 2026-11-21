// Every line that ends with the word error in a comment must be reported by the plugins of lint/.
export {}
declare function X(): Node
declare function $click(fn: () => void): unknown
declare const go: () => void

const a = <button type="button">{X()}</button> // error
const b = <button><X /></button> // error
// Reported on the <button> line, where a comment would be text: the marker is in an attribute.
const c = (
  <button type="button" data-marker="// error">
    {$click(go)}
    {X()}
  </button>
)
declare function $observe(...a: unknown[]): unknown
const d = <>{$observe(go)}<div /></> // error
declare const o: { get(v: unknown): unknown; tf(v: unknown, f: unknown): unknown }
declare const attrs: { out_picked: { set(v: string): void } }
const e = o.get(attrs.out_picked) // error
const f = $observe(attrs.out_picked, go) // error
const g = <div>{attrs.out_picked}</div> // error
