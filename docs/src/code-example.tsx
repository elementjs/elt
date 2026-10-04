import { css, o, If, $click, $connected, $disconnected, type Renderable } from "elt"
import { theme } from "elt/ui"
import * as ph from "elt-phosphor"

export type CodeExampleProps = {
  /** Builds the per-line, per-token colored spans, compiled to a literal JSX-producing closure by
   * the macro at build time (see tokensToJsx in macro.ts) — never an HTML string, so no
   * `.innerHTML` is used to render it. A callback rather than a plain `Renderable`: the compiled
   * JSX wraps each line in a `<>` fragment, and appending a fragment's children to the DOM empties
   * it irrecoverably, so a single materialized node tree can only ever be inserted once. Calling
   * this fresh each time the "Code" button shows the source again rebuilds that tree from scratch. */
  highlighted: () => Renderable
  /** `@inline-example` only — the block's body, as a closure the generated page passes uncalled.
   * It runs once, when the result area first comes near the viewport (see `LazyResult`). */
  run?: () => Node
  /** `@full-example` only — same-origin route URL this block runs at, embedded in an isolated iframe. */
  fullExampleUrl?: string
}

/** How far outside the viewport a result starts rendering, so it is usually ready by the time it
 * scrolls into view. */
const LAZY_MARGIN = "50% 0px"

/** An `@inline-example`'s result, rendered only once it first comes near the viewport: a page with
 * many examples (some building large editors) doesn't render them all up front. The example runs
 * once and its node is kept, also when the reader switches to the code and back, and when it scrolls
 * away again. A throw is shown in place of the result, so one bad example doesn't break the page. */
function LazyResult(run: () => Node) {
  const o_result = o<{ node: Node } | { error: string } | null>(null)
  let observer: IntersectionObserver | null = null
  const stop = () => {
    observer?.disconnect()
    observer = null
  }

  return o_result.tf((result) => {
    if (result == null) {
      // Placeholder until visible: gives the area some height so it can intersect at all.
      return (
        <div class={cls_lazy}>
          {$connected((el: HTMLElement) => {
            observer = new IntersectionObserver(
              (entries) => {
                if (!entries.some((en) => en.isIntersecting)) return
                stop()
                try {
                  o_result.set({ node: run() })
                } catch (e: any) {
                  o_result.set({ error: String(e?.stack ?? e) })
                }
              },
              { rootMargin: LAZY_MARGIN },
            )
            observer.observe(el)
          })}
          {$disconnected(stop)}
        </div>
      )
    }
    if ("error" in result)
      return (
        <e-prose class={cls_error}>
          <pre>{result.error}</pre>
        </e-prose>
      )
    return result.node
  })
}

/** Maps a Shiki token's light-theme and dark-theme colors to a shared CSS class instead of a
 * per-span inline `style`, memoized so each distinct pair only ever inserts one stylesheet rule (the
 * two themes have on the order of a few dozen distinct pairs, however many thousands of tokens use
 * them) — see macro.ts's tokensToJsx, which calls this once per token at render time.
 *
 * The class follows the same thing the page's palette follows: the elt/ui scheme class on an
 * ancestor (on `<body>`, set from `o_force_theme`). The light color by default; the dark one under
 * the forced-dark class, or under the default (dynamic) class when the system prefers dark. Like any
 * ancestor selector, it takes the dark color inside a forced-light subtree nested in a dark one; the
 * docs never nest scheme classes. */
const tokenColorClasses = new Map<string, string>()
export function tokenColorClass(light: string, dark: string): string {
  const key = `${light} ${dark}`
  let cls = tokenColorClasses.get(key)
  if (cls == null) {
    cls = css`.tok {
      color: ${light};
      .${theme.class_dark_scheme} & { color: ${dark}; }
      @media (prefers-color-scheme: dark) { .${theme.class_dynamic_scheme} & { color: ${dark}; } }
    }`
    tokenColorClasses.set(key, cls)
  }
  return cls
}

/** A fresh `<pre><code>` of the highlighted source (see `CodeExampleProps.highlighted` for why it
 * is rebuilt on every call). */
function renderCode(highlighted: () => Renderable) {
  return (
    <pre>
      <code>{highlighted()}</code>
    </pre>
  )
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

/** A code sample with "Example" / "Code" buttons (showing the example first) for runnable blocks
 * (`run` or `fullExampleUrl` set); a plain highlighted block otherwise. */
export function CodeExample(props: CodeExampleProps) {
  const is_runnable = props.run != null || props.fullExampleUrl != null

  if (!is_runnable) {
    return renderCode(props.highlighted)
  }

  const o_showing_code = o(false)

  // Built once, and only hidden while the code shows, never taken out of the document: the example
  // keeps its node and state when the reader switches to the code and back — an iframe even reloads
  // its page whenever it is put back into a document.
  const result =
    props.fullExampleUrl != null ? (
      <iframe class={cls_iframe} src={props.fullExampleUrl} loading="lazy" title="Example"></iframe>
    ) : (
      LazyResult(props.run!)
    )

  return (
    <e-column packed align="stretch">
      <e-row
        packed="widget"
        border
        pad="none"
        align="stretch"
        surface="neutral-2"
        class={theme.colors.neutral.class_as_tint}
      >
        <button e-variant={o_showing_code.tf((v) => (!v ? "inverted" : ""))}>
          {$click(() => o_showing_code.set(false))}
          <ph.TelevisionSimple /> Example
        </button>
        <button e-variant={o_showing_code.tf((v) => v && "inverted")}>
          {$click(() => o_showing_code.set(true))}
          Code <ph.Code />
        </button>
        <e-row grow>&nbsp;</e-row>
      </e-row>
      {If(o_showing_code, () => (
        <e-prose border="neutral" pad="none" self-align="stretch">
          <div class={cls_pre_scroll}>{renderCode(props.highlighted)}</div>
        </e-prose>
      ))}
      {/* A plain div for `hidden`: e-prose sets its own `display`, which would override it. */}
      <div hidden={o_showing_code}>
        <e-prose border self-align="stretch">
          {result}
        </e-prose>
      </div>
    </e-column>
  )
}

const cls_error = css`.error {
  ${theme.colors.red.css_as_surface(1)}
  padding: ${theme.settings.spacingWidget};

  & pre { margin: 0; white-space: pre-wrap; }
}`

const cls_lazy = css`.lazy {
  min-height: 4rem;
}`

const cls_iframe = css`.iframe {
  width: 100%;
  min-height: 12rem;
  border: none;
}`
