import { css, o, If, $click } from "elt"
import { theme } from "./theme"

export type CodeExampleProps = {
  code: string
  language?: string
  /** Set for `ts`/`tsx` blocks — build-time type diagnostics from `tsgo` (see specs/markdown-docs.md). */
  typeErrors?: string[]
  /** Set for `ts`/`tsx` blocks — import-stripped, transpiled function body, run via `new Function` below. */
  compiledFnSource?: string
  /** Pre-highlighted HTML produced by Shiki at build time — set for every block, regardless of language. */
  highlightedHtml?: string
  /**
   * Module namespace objects available to `compiledFnSource`'s stripped-out imports, keyed by module
   * specifier (e.g. `{ "elt": <namespace>, "elt/ui": <namespace> }`). Supplied by the caller rather
   * than hardcoded here, since this widget lives inside `elt/ui` itself and can't import its own
   * package by name without a circular self-import.
   */
  imports?: Record<string, unknown>
}

/**
 * A code sample with a Typescript/Result toggle (defaults to Result). Runnable snippets
 * (`compiledFnSource` set) execute in the main page context via `new Function` — no sandbox, since
 * docs content is first-party and trusted (see specs/markdown-docs.md, "TypeScript code blocks").
 */
function renderCode(code: string, highlightedHtml: string | undefined) {
  if (highlightedHtml != null) {
    const d = document.createElement("div")
    d.className = cls_code
    d.innerHTML = highlightedHtml
    return d
  }
  return <pre class={cls_code}><code>{code}</code></pre>
}

export function CodeExample(props: CodeExampleProps) {
  const o_showing_code = o(false)
  const is_runnable = props.compiledFnSource != null

  const result_view = () => {
    if (!is_runnable) {
      return renderCode(props.code, props.highlightedHtml)
    }

    const o_error = o(null as string | null)
    let output: unknown
    try {
      const fn = new Function("__imports", props.compiledFnSource!)
      output = fn(props.imports ?? {})
    } catch (e: any) {
      o_error.set(String(e?.stack ?? e))
    }

    return <e-column>
      {props.typeErrors && props.typeErrors.length > 0
        ? <e-block class={cls_error}><pre>{props.typeErrors.join("\n")}</pre></e-block>
        : null}
      {If(o_error, err => <e-block class={cls_error}><pre>{err}</pre></e-block>)}
      {output instanceof Node ? output : null}
    </e-column>
  }

  return <e-column class={cls_example}>
    <e-row touching class={cls_tabs}>
      <button class={o_showing_code.tf(v => !v ? cls_active : null)}>
        {$click(() => o_showing_code.set(false))}
        Result
      </button>
      <button class={o_showing_code.tf(v => v ? cls_active : null)}>
        {$click(() => o_showing_code.set(true))}
        Typescript
      </button>
    </e-row>
    {If(o_showing_code,
      () => renderCode(props.code, props.highlightedHtml),
      result_view,
    )}
  </e-column>
}

const cls_example = css`.code-example {
  border: 1px solid ${theme.colors.text.mid};
  border-radius: ${theme.settings.borderRadius};
}`

const cls_tabs = css`.tabs {
  & button { border: none; border-radius: 0; }
}`

const cls_active = css`.active {
  ${theme.colors.tint.css.as_surface(1)}
}`

const cls_code = css`.code {
  margin: 0;
  padding: ${theme.settings.spacingWidget};
  overflow-x: auto;
}`

const cls_error = css`.error {
  ${theme.colors.red.css.as_surface(1)}
  padding: ${theme.settings.spacingWidget};

  & pre { margin: 0; white-space: pre-wrap; }
}`
