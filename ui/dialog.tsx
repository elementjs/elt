import { $connected, $enter, $leave, $on, animate, css, type Future, show } from "elt"
import type { OverlayResult } from "./popup"
import { theme } from "./theme"
import { fade_in, fade_out, zoom_in, zoom_out } from "./motion"

export interface DialogOptions {
  /** A click on the backdrop dismisses the dialog (resolves it with `undefined`). */
  clickOutsideToClose?: boolean
}

/** Returns the dialog's content: one element, drawing its own frame. Typed `Node` because that is what JSX gives. */
export type DialogCallback<T extends OverlayResult> = (fut: Future<T | undefined>) => Node

/**
 * Open a modal dialog and return a `Future` resolved by `fut.resolve(value)` from the content, or
 * with `undefined` when it closes with no result: the user dismissed it (`Escape`, or a backdrop
 * click with `clickOutsideToClose`), or the content called `fut.resolve(undefined)` (a Cancel button, say). An
 * affirmative answer is always an explicit value, `T` being `boolean` unless given.
 *
 * The `<dialog>` is an unstyled box — no border, padding, background or radius: the element `render`
 * returns draws the frame (`<e-column surface border packed="component">…`). The dialog adds the backdrop,
 * centering, a shadow, the size limits (`--e-dialog-max-width`, `--e-dialog-max-height`; the content
 * scrolls itself when it can be taller) and the animation.
 */
export function show_dialog<T extends OverlayResult = boolean>(render: DialogCallback<T>): Future<T | undefined>
export function show_dialog<T extends OverlayResult = boolean>(
  opts: DialogOptions,
  render: DialogCallback<T>,
): Future<T | undefined>

export function show_dialog<T extends OverlayResult = boolean>(
  opts: DialogOptions | DialogCallback<T>,
  cbk?: DialogCallback<T>,
) {
  // show_dialog(cbk) or show_dialog(opts, cbk)
  const options: DialogOptions = typeof opts === "function" ? {} : opts
  const render = typeof opts === "function" ? opts : cbk
  if (render == null) throw new Error("show_dialog(opts, cbk): cbk is required")

  const return_focus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  const give_focus_back = () => {
    if (return_focus?.isConnected) return_focus.focus({ preventScroll: true })
  }

  let dialog!: HTMLDialogElement

  // Opening and closing are updates of `show`: the dialog plays its $enter / $leave, and goes when the
  // future ends, whatever the outcome.
  const future = show<T | undefined>(document.body, (future) => {
    const content = render(future)
    if (!(content instanceof Element)) throw new Error("show_dialog(): render must return a single element")

    dialog = E(
      "dialog",
      content,
      options.clickOutsideToClose &&
        $on("click", (ev) => {
          const rect = dialog.getBoundingClientRect()
          const clickedBackdrop =
            ev.clientX < rect.left || ev.clientX > rect.right || ev.clientY < rect.top || ev.clientY > rect.bottom

          if (clickedBackdrop) future.resolve(undefined)
        }),
      // The native `cancel` (Escape) would close the dialog on its own, behind the future's back.
      $on("cancel", (ev) => {
        ev.preventDefault()
        future.resolve(undefined)
      }),
      // Browsers may refuse to let `cancel` be prevented (a second Escape without user activity in
      // between): the dialog then closes anyway, and the future must still settle.
      $on("close", () => future.resolve(undefined)),
      // Modal once in the page, before $enter runs (connected callbacks come first): the backdrop exists
      // when the enter animation starts.
      $connected((d) => d.showModal()),
      $enter((d) => {
        animate(d, zoom_in)
        animate(d, { ...fade_in, duration: zoom_in.duration }, { pseudoElement: "::backdrop" })
      }),
      // Out of the flow already (fixed, top layer). While it plays, the dialog stays modal: focus can
      // only go back to the page once it is closed.
      $leave(
        (d) =>
          Promise.all([
            animate(d, zoom_out, { dir: "leave", fill: "forwards" }),
            animate(
              d,
              { ...fade_out, duration: zoom_out.duration },
              { dir: "leave", fill: "forwards", pseudoElement: "::backdrop" },
            ),
          ]).then(() => {
            ;(d as HTMLDialogElement).close()
            give_focus_back()
          }),
        { flow: true },
      ),
    )
    return dialog
  })

  // Gone at once (motion off, or already closed by the browser): no exit gives focus back. This runs
  // after the removal `show` does when the future ends.
  const settled = () => {
    if (dialog.parentNode == null) give_focus_back()
  }
  future.then(settled, settled)

  return future
}

/* An unstyled box: the content draws its own frame. The dialog keeps the backdrop, centering, the
   shadow (following the content's rounded corners through the radius it inherits), size limits. */
css`
dialog {
  position: fixed;
  inset: 0;
  margin: auto;
  padding: 0;
  border: none;
  background: transparent;
  color: ${theme.colors.text};
  overflow: visible;

  max-width: var(--e-dialog-max-width, 60vw);
  width: var(--e-dialog-width, fit-content);
  max-height: var(--e-dialog-max-height, 80vh);

  transform-origin: center top;
  ${theme.css_overlay_shadow_color}

  &[open] {
    display: flex;
    flex-direction: column;
  }

  /* The content fills the box and shrinks to its height limit; it scrolls itself (scroll). */
  & > * {
    flex: 1 1 auto;
    min-height: 0;
    box-shadow: ${theme
      .overlay_shadow_layers("dialog")
      .map((l) => l.join(" "))
      .join(", ")};
  }

  &::backdrop {
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(3px);
  }
}
`
