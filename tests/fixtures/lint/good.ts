// None of these may be reported: other objects share the names of `append` and `remove`, and a documented exception is
// disabled on its line.
export {}
declare const body: HTMLElement
declare function node_append(...args: unknown[]): void

body.classList.remove("a")
const data = new FormData()
data.append("a", "b")
body.append("text")
body.remove()
// biome-ignore lint/plugin: the root of a page with no App
node_append(body, "root")
