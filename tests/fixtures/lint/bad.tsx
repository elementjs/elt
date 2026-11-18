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
