/** Some default icons taken from phosphor icons (thank you !), but copied here to avoid dependencies */

import { css } from "elt"

export const cls_icon = css`.icon {
  & > svg {
    height: 1em;
    vertical-align: -.155em;
  }
  & > svg path[opacity] {
    fill: var(--e-color-fg, currentColor);
  }
}`

let c = "circle"
let cc = "currentColor"
let cx = "cx"
let cy = "cy"
let d = "d"
let e = "ellipse"
let f = "fill"
let g = "g"
let h = "height"
let l = "line"
let n = "none"
let o = "opacity"
let p = "path"
let ps = "points"
let pl = "polygon"
let py = "polyline"
let r = "r"
let rt = "rect"
let ro = "round"
let rx = "rx"
let ry = "ry"
let sc = "stroke-linecap"
let sj = "stroke-linejoin"
let sl = "stroke-miterlimit"
let sw = "stroke-width"
let st = "stroke"
let v = "svg"
let t = "transform"
let vb = "viewBox"
let vd = "0 0 256 256"
let w = "width"
let x = "x"
let x1 = "x1"
let x2 = "x2"
let y = "y"
let y1 = "y1"
let y2 = "y2"

// const _
function _(...args: (string | Element)[]) {
  const sp = document.createElement("span")
  sp.classList.add(cls_icon)
  const svg = s(v, ...args)
  sp.appendChild(svg)
  return sp
}

function s(tag: string, ...args: (string | Element)[]) {
  const e = document.createElementNS("http://www.w3.org/2000/svg", tag)
  for (let i = 0, l = args.length; i < l; i++) {
    const key = args[i]
    if (typeof key === "string") {
      const value = args[++i]
      e.setAttribute(key, value as string)
    } else {
      e.appendChild(key as Element)
    }
  }
  return e
}

export const CaretDown = /** @__PURE__ */ () => _(vb,vd,s(rt,w,"256",h,"256",f,n),s(py,ps,"208 96 128 176 48 96",f,n,st,cc,sc,ro,sj,ro,sw,"16"))

export const Calendar = /** @__PURE__ */ () => _(vb,vd,s(rt,w,"256",h,"256",f,n),s(rt,x,"40",y,"40",w,"176",h,"176",rx,"8",f,n,st,cc,sc,ro,sj,ro,sw,"16"),s(l,x1,"176",y1,"24",x2,"176",y2,"56",f,n,st,cc,sc,ro,sj,ro,sw,"16"),s(l,x1,"80",y1,"24",x2,"80",y2,"56",f,n,st,cc,sc,ro,sj,ro,sw,"16"),s(l,x1,"40",y1,"88",x2,"216",y2,"88",f,n,st,cc,sc,ro,sj,ro,sw,"16"),s(py,ps,"88 128 104 120 104 184",f,n,st,cc,sc,ro,sj,ro,sw,"16"),s(p,d,"M138.14,128a16,16,0,1,1,26.64,17.63L136,184h32",f,n,st,cc,sc,ro,sj,ro,sw,"16"))

export const Clock = /** @__PURE__ */ () => _(vb,vd,s(rt,w,"256",h,"256",f,n),s(c,cx,"128",cy,"128",r,"96",f,n,st,cc,sc,ro,sj,ro,sw,"16"),s(py,ps,"128 72 128 128 184 128",f,n,st,cc,sc,ro,sj,ro,sw,"16"))

export const MagnifyingGlass = /** @__PURE__ */ () => _(vb,vd,s(rt,w,"256",h,"256",f,n),s(c,cx,"112",cy,"112",r,"80",f,n,st,cc,sc,ro,sj,ro,sw,"16"),s(l,x1,"168.57",y1,"168.57",x2,"224",y2,"224",f,n,st,cc,sc,ro,sj,ro,sw,"16"))

export const X = /** @__PURE__ */ () => _(vb,vd,s(rt,w,"256",h,"256",f,n),s(l,x1,"200",y1,"56",x2,"56",y2,"200",st,cc,sc,ro,sj,ro,sw,"16"),s(l,x1,"200",y1,"200",x2,"56",y2,"56",st,cc,sc,ro,sj,ro,sw,"16"))

export const Check = /** @__PURE__ */ () => _(vb,vd,s(rt,w,"256",h,"256",f,n),s(py,ps,"40 144 96 200 224 72",f,n,st,cc,sc,ro,sj,ro,sw,"16"))