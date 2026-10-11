// Every line that ends with the word error in a comment must be reported by the plugins of lint/.
declare const obs: any
declare const body: HTMLElement
declare function node_append(...args: unknown[]): void
declare function node_remove(...args: unknown[]): void
declare function node_clear(...args: unknown[]): void

const ob = obs.addObserver(() => {}) // error
obs.removeObserver(ob) // error
node_append(body, "x") // error
node_remove(body) // error
node_clear(body) // error
body.appendChild(document.createElement("p")) // error
body.insertBefore(document.createElement("p"), null) // error
body.removeChild(body.firstChild as Node) // error
body.replaceChildren() // error
body.replaceWith("x") // error
body.insertAdjacentElement("beforeend", document.createElement("p")) // error
body.insertAdjacentHTML("beforeend", "<p></p>") // error
body.innerHTML = "<p></p>" // error
body.outerHTML = "<p></p>" // error
