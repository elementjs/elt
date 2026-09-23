import { css, o, If, $click } from "elt"
import { theme } from "elt/ui"

export type CodeExampleProps = {
  code: string
  language?: string
  /** Pre-highlighted HTML produced by Shiki at build time — set for every block, regardless of language. */
  highlightedHtml?: string
  /** `@inline-example` only — the block's own rendered output, already executed at page-module-load
   * time (see genPageSource in macro.ts) rather than by this component. */
  renderResult?: Node
  /** `@inline-example` only — set instead of `renderResult` when execution threw. */
  renderError?: string
  /** `@full-example` only — same-origin hash route this block runs at, embedded in an isolated iframe. */
  fullExampleUrl?: string
}

/** A code sample with a Typescript/Result toggle (defaults to Result) for runnable blocks
 * (`renderResult`/`renderError`/`fullExampleUrl` set); a plain highlighted block otherwise. */
function renderCode(code: string, highlightedHtml: string | undefined) {
  if (highlightedHtml != null) {
    const d = document.createElement("div")
    d.className = cls_code
    d.innerHTML = highlightedHtml
    return d
  }
  return <e-block border>
    <pre class={cls_code}><code>{code}</code></pre>
  </e-block>
}

export function CodeExample(props: CodeExampleProps) {
  const is_runnable = props.renderResult != null || props.renderError != null || props.fullExampleUrl != null

  if (!is_runnable) {
    return renderCode(props.code, props.highlightedHtml)
  }

  const o_showing_code = o(false)

  const result_view = () => {
    if (props.fullExampleUrl != null) {
      return <iframe class={cls_iframe} src={props.fullExampleUrl}></iframe>
    }
    if (props.renderError != null) {
      return <e-block class={cls_error}><pre>{props.renderError}</pre></e-block>
    }
    return props.renderResult ?? null
  }

  return <e-column touching>
    <e-row touching>
      <button class={o_showing_code.tf((v) => (!v ? cls_active : null))}>
        {$click(() => o_showing_code.set(false))}
        Result
      </button>
      <button class={o_showing_code.tf((v) => (v ? cls_active : null))}>
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

const cls_iframe = css`.iframe {
  width: 100%;
  min-height: 12rem;
  border: none;
}`
