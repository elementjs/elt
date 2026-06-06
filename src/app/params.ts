export type ServiceParams = {
  [name: string]: string | number | boolean | null | undefined
}


/** @internal decode a param value */
export function _decode(s: string): string | boolean | undefined | number | null {
  let val: string | boolean | undefined | number | null = s
  if (/^[.0-9-]/.test(s[0])) {
    val = parseFloat(val)
  } else if (s[0] === "~") {
    if (s[1] === "n") {
      val = null
    } else if (s[1] === "u") {
      val = undefined
    } else if (s[1] === "f") {
      val = false
    } else if (s[1] === "t") {
      val = true
    } else {
      val = val.slice(1) // we have a string that started by a special character
    }
  }
  return val
}

/** @internal encode a value into a a param */
export function _encode(v: string | boolean | undefined | number | null): string {
  // encode value and its basic type in the URL
  if (typeof v === "string" && /[~.0-9-]/.test(v[0])) {
    // We only need to test for the ~ and numbers, since this is the only
    // way for a string to start with a forbidden character
    v = "~" + v
  } else if (typeof v === "number") {
    v = v.toString()
  } else if (v === true) {
    v = "~t"
  } else if (v === false) {
    v = "~f"
  } else if (v === null) {
    v = "~n"
  } else if (v === undefined) {
    v = "~u"
  }
  return v
}
