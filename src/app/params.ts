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
    v = `~${v}`
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

/**
 * @internal parse a route query (`a=1&b=~t`, without the leading `?`) into params.
 * Items split at their first `=`, `+` is kept as-is. Throws URIError on malformed percent-encoding.
 */
export function _parseQuery(query: string): ServiceParams {
  const res: ServiceParams = {}
  if (!query) return res
  for (const item of query.split("&")) {
    if (!item) continue
    const eq = item.indexOf("=")
    const key = eq < 0 ? item : item.slice(0, eq)
    const value = eq < 0 ? "" : item.slice(eq + 1)
    res[decodeURIComponent(key)] = _decode(decodeURIComponent(value))
  }
  return res
}

/** @internal format params into a route query (without the leading `?`), skipping `undefined` values. */
export function _formatQuery(params: ServiceParams): string {
  const parts: string[] = []
  for (const key in params) {
    const v = params[key]
    if (v === undefined) continue
    const enc = _encode(v)
    parts.push(enc ? `${encodeURIComponent(key)}=${encodeURIComponent(enc)}` : encodeURIComponent(key))
  }
  return parts.join("&")
}

/** @internal URL key : route path and route query, as used to detect that the URL did not change */
export function _urlKey(path: string, query: string): string {
  return query ? `${path}?${query}` : path
}
