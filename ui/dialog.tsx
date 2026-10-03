import { $enter, $leave, $on, animate, css, node_append, node_remove } from "elt"
import { theme } from "./theme"
import { Future, sym_closed } from "./utils"
import { fade_in, fade_out, zoom_in, zoom_out } from "./motion"

export interface DialogOptions {
  /** A click on the backdrop dismisses the dialog (resolves it with {@link sym_closed}). */
  clickOutsideToClose?: boolean
}

/** Returns the dialog's content: one element, drawing its own frame. Typed `Node` because that is what JSX gives. */
export type DialogCallback<T> = (fut: Future<T | typeof sym_closed>) => Node

/**
 * Open a modal dialog and return a `Future` resolved by `fut.resolve(value)` from the content, or
 * with {@link sym_closed} when the user dismisses it (`Escape`, or a backdrop click with
 * `clickOutsideToClose`).
 *
 * The `<dialog>` is an unstyled box — no border, padding, background or radius: the element `render`
 * returns draws the frame (`<e-column surface border packed>…`). The dialog adds the backdrop,
 * centering, a shadow, the size limits (`--e-dialog-max-width`, `--e-dialog-max-height`; the content
 * scrolls itself when it can be taller) and the animation.
 */
export function show_dialog<T>(render: DialogCallback<T>): Future<T | typeof sym_closed>
export function show_dialog<T>(opts: DialogOptions, render: DialogCallback<T>): Future<T | typeof sym_closed>

export function show_dialog<T>(opts: DialogOptions | DialogCallback<T>, cbk?: DialogCallback<T>) {
  const future = new Future<T | typeof sym_closed>()

  // show_dialog(cbk) or show_dialog(opts, cbk)
  const options: DialogOptions = typeof opts === "function" ? {} : opts
  const render = typeof opts === "function" ? opts : cbk
  if (render == null) throw new Error("show_dialog(opts, cbk): cbk is required")

  const return_focus = document.activeElement instanceof HTMLElement ? document.activeElement : null

  const content = render(future)
  if (!(content instanceof Element)) throw new Error("show_dialog(): render must return a single element")

  const dialog = E(
    "dialog",
    content,
    options.clickOutsideToClose &&
      $on("click", (ev) => {
        const rect = dialog.getBoundingClientRect()
        const clickedBackdrop =
          ev.clientX < rect.left || ev.clientX > rect.right || ev.clientY < rect.top || ev.clientY > rect.bottom

        if (clickedBackdrop) future.resolve(sym_closed)
      }),
    // The native `cancel` (Escape) would close the dialog on its own, behind the future's back.
    $on("cancel", (ev) => {
      ev.preventDefault()
      future.resolve(sym_closed)
    }),
    // Browsers may refuse to let `cancel` be prevented (a second Escape without user activation in
    // between): the dialog then closes anyway, and the future must still settle.
    $on("close", () => future.resolve(sym_closed)),
    $enter((d) => {
      animate(d, zoom_in)
      // The backdrop only exists once showModal() ran, right after the insertion that runs this.
      queueMicrotask(() => animate(d, { ...fade_in, duration: zoom_in.duration }, { pseudoElement: "::backdrop" }))
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

  const give_focus_back = () => {
    if (return_focus?.isConnected) return_focus.focus({ preventScroll: true })
  }

  node_append(document.body, dialog)
  dialog.showModal()

  future.then(() => {
    node_remove(dialog)
    // Gone at once (motion off, or already closed by the browser): no exit gives focus back.
    if (dialog.parentNode == null) give_focus_back()
  })

  return future
}

export namespace show_dialog {
  /** Alias of {@link sym_closed}. */
  export const closed: typeof sym_closed = sym_closed
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

  &[open] {
    display: flex;
    flex-direction: column;
  }

  /* The content fills the box and shrinks to its height limit; it scrolls itself (scroll). */
  & > * {
    flex: 1 1 auto;
    min-height: 0;
    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
  }

  &::backdrop {
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(3px);
  }
}
`
