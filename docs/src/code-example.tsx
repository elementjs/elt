import { css, o, If, $click, type Renderable } from "elt"
import { theme } from "elt/ui"

export type CodeExampleProps = {
  /** Per-line, per-token colored spans, compiled to literal JSX by the macro at build time (see
   * tokensToJsx in macro.ts) — never an HTML string, so no `.innerHTML` is used to render it. */
  highlighted: Renderable
  /** `@inline-example` only — set via `{...runExample(...)}` by the generated page. */
  renderResult?: Node
  /** `@inline-example` only — set via `{...runExample(...)}` when execution threw. */
  renderError?: string
  /** `@full-example` only — same-origin hash route this block runs at, embedded in an isolated iframe. */
  fullExampleUrl?: string
}

/** Runs an `@inline-example` block's body, called directly from the generated page's JSX
 * (`{...runExample(() => {...})}`, spread onto `<CodeExample>`'s props) — replaces the old
 * JSON-tree `renderResult`/`__renderError` dance now that pages are real compiled JSX, not data
 * interpreted by a runtime tree-walker. Isolates one bad example from the rest of the page: a throw
 * here becomes `renderError`, not a crash of the whole page's `Content()`. */
export function runExample(fn: () => Node): { renderResult?: Node; renderError?: string } {
  try {
    return { renderResult: fn() }
  } catch (e: any) {
    return { renderError: String(e?.stack ?? e) }
  }
}

/** A code sample with a Typescript/Result toggle (defaults to Result) for runnable blocks
 * (`renderResult`/`renderError`/`fullExampleUrl` set); a plain highlighted block otherwise. */
function renderCode(highlighted: Renderable) {
  return <e-block border>
    <pre class={cls_code}><code>{highlighted}</code></pre>
  </e-block>
}

export function CodeExample(props: CodeExampleProps) {
  const is_runnable = props.renderResult != null || props.renderError != null || props.fullExampleUrl != null

  if (!is_runnable) {
    return renderCode(props.highlighted)
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
      () => renderCode(props.highlighted),
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
