import { css, o, If, $click, type Renderable } from "elt"
import { theme } from "elt/ui"
import * as ph from "elt-phosphor"

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

/** Maps a Shiki token color to a shared CSS class instead of a per-span inline `style`, memoized so
 * each distinct color only ever inserts one stylesheet rule (a theme has on the order of a few dozen
 * distinct colors, however many thousands of tokens use them) — see macro.ts's tokensToJsx, which
 * calls this once per token at render time. */
const tokenColorClasses = new Map<string, string>()
export function tokenColorClass(color: string): string {
  let cls = tokenColorClasses.get(color)
  if (cls == null) {
    cls = css`.tok { color: ${color}; }`
    tokenColorClasses.set(color, cls)
  }
  return cls
}

/** A code sample with a Typescript/Result toggle (defaults to Result) for runnable blocks
 * (`renderResult`/`renderError`/`fullExampleUrl` set); a plain highlighted block otherwise. */
function renderCode(highlighted: () => Renderable) {
  return <pre><code>{highlighted()}</code></pre>}

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
      return <e-prose class={cls_error}><pre>{props.renderError}</pre></e-prose>
    }
    return props.renderResult ?? null
  }

  return <e-column packed align="stretch">
    <e-row packed="widget" border pad="none" align="stretch" surface="neutral-2" class={theme.colors.neutral.class_as_tint}>
      <button e-variant={o_showing_code.tf(v => !v ? "inverted" : "")}>
        {$click(() => o_showing_code.set(false))}
        <ph.TelevisionSimple/> Example
      </button>
      <button e-variant={o_showing_code.tf(v => v && "inverted")}>
        {$click(() => o_showing_code.set(true))}
        Code <ph.Code/>
      </button>
      <e-row grow>&nbsp;</e-row>
    </e-row>
    {If(o_showing_code,
      () => <e-prose border="neutral" pad="none" self-align="stretch">
        <div class={cls_pre_scroll}>{renderCode(props.highlighted)}</div>
      </e-prose>,
      () => <e-prose border self-align="stretch">{result_view()}</e-prose>,
    )}
  </e-column>
}

const cls_error = css`.error {
  ${theme.colors.red.css_as_surface(1)}
  padding: ${theme.settings.spacingWidget};

  & pre { margin: 0; white-space: pre-wrap; }
}`

const cls_iframe = css`.iframe {
  width: 100%;
  min-height: 12rem;
  border: none;
}`
