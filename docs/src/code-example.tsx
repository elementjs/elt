import { css, o, If, $click, type Renderable } from "elt"
import { theme } from "elt/ui"

export type CodeExampleProps = {
  /** Builds the per-line, per-token colored spans, compiled to a literal JSX-producing closure by
   * the macro at build time (see tokensToJsx in macro.ts) — never an HTML string, so no
   * `.innerHTML` is used to render it. A callback rather than a plain `Renderable`: the compiled
   * JSX wraps each line in a `<>` fragment, and appending a fragment's children to the DOM empties
   * it irrecoverably, so a single materialized node tree can only ever be inserted once. Calling
   * this fresh each time the "Typescript" tab (re)activates rebuilds that tree from scratch. */
  highlighted: () => Renderable
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
function renderCode(highlighted: () => Renderable) {
  return <e-block border pad="none" self-align="stretch">
    <div class={cls_pre_scroll}><pre><code>{highlighted()}</code></pre></div>
  </e-block>
}

/** The real vertical scroll boundary for a code block: capped at half the viewport height so one
 * long example can't push the rest of the page out of reach, and scrollable past that cap. Kept on
 * a wrapper around `<pre>` rather than on `<pre>` itself: `<pre>` already needs `overflow-x: auto`
 * for its own horizontal scroll, and pairing that with a real `overflow-y: auto` on the same
 * element reintroduces the phantom-scrollbar measurement quirk `overflow-y: clip` on `<pre>` exists
 * to avoid (ui/typography.css.tsx) — confirmed empirically to be specific to `<pre>`'s own box, not
 * a general side effect of scroll containers, so it does not reappear here on this plain wrapper. */
const cls_pre_scroll = css`.pre-scroll {
  max-height: 50vh;
  overflow-y: auto;
  border-radius: inherit;
}`

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

  return <e-column packed>
    <e-row packed border pad="none">
      <button class={o_showing_code.tf((v) => (!v ? cls_active : null))}>
        {$click(() => o_showing_code.set(false))}
        ⏵ Example
      </button>
      <button class={o_showing_code.tf((v) => (v ? cls_active : null))}>
        {$click(() => o_showing_code.set(true))}
        Code {"\ueac4"}
      </button>
    </e-row>
    {If(o_showing_code,
      () => renderCode(props.highlighted),
      () => <e-block border self-align="stretch">{result_view()}</e-block>,
    )}
  </e-column>
}

const cls_active = css`.active {
  ${theme.colors.tint.css.as_surface(1)}
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
