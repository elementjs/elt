// None of these may be reported: each button has a name, from its text or an attribute.
export {}
declare function X(): Node
declare function $click(fn: () => void): unknown
declare const go: () => void
declare const o_label: string

const a = <button title="Close">{X()}</button>
const b = <button aria-label="Close"><X /></button>
const c = <button>{X()} Close</button>
const d = <button>{X()}{o_label}</button>
const e = <button>{$click(go)}<span>Close</span></button>
