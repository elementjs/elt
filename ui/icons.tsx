/** Some default icons taken from phosphor icons (thank you !), but copied here to avoid dependencies */

import { cls_icon } from "./css/icon"

let cc = "currentColor"
let f = "fill"
let h = "height"
let n = "none"
let ps = "points"
let py = "polyline"
let rt = "rect"
let ro = "round"
let sc = "stroke-linecap"
let sj = "stroke-linejoin"
let sw = "stroke-width"
let st = "stroke"
let v = "svg"
let vb = "viewBox"
let vd = "0 0 256 256"
let w = "width"

// const _
function _(...args) {
  const sp = document.createElement("span")
  sp.classList.add(cls_icon)
  const svg = s(v, ...args)
  sp.appendChild(svg)
  return sp
}

function s(tag, ...args) {
  const e = document.createElementNS("http://www.w3.org/2000/svg", tag)
  for (let i = 0, l = args.length; i < l; i++) {
    const key = args[i]
    if (typeof key === "string") {
      const value = args[++i]
      e.setAttribute(key, value)
    } else {
      e.appendChild(key)
    }
  }
  return e
}

export const CaretDown = /** @__PURE__ */ () => _(vb,vd,s(rt,w,"256",h,"256",f,n),s(py,ps,"208 96 128 176 48 96",f,n,st,cc,sc,ro,sj,ro,sw,"16"))
