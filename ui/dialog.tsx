import { css, node_append, type Renderable, $on } from "elt"
import { theme } from "./theme"
import { Future } from "./utils"
import { animate, animate_hide, animate_show } from "./animation"

export interface DialogOptions {
  clickOutsideToClose?: boolean
}

export interface DialogContent {
  header?: Renderable
  body: Renderable
  footer?: Renderable
}

export type DialogCallback<T> = (fut: Future<T>) => DialogContent

export function show_dialog<T>(cbk: DialogCallback<T>): Promise<Future<T>>
export function show_dialog<T>(opts: DialogOptions, cbk: DialogCallback<T>): Promise<Future<T>>

export function show_dialog<T>(opts: DialogOptions | DialogCallback<T>, cbk?: DialogCallback<T>) {
  const future = new Future<T>()

  if (arguments.length === 1) {
    cbk = opts as DialogCallback<T>
    opts = {}
  } else {
    cbk = cbk!
    opts = opts as DialogOptions
  }

  function close_dialog() {
    Promise.all([
      animate(dialog, animate_hide, { duration: 100 }),
      animate(dialog, animate_hide, {
        duration: 100,
        pseudoElement: "::backdrop",
      }),
    ]).finally(() => {
      dialog.remove()
    })
  }

  const content = cbk(future)

  const dialog = E(
    "dialog",
    content.header != null && <header>{content.header}</header>,
    <e-block typographic pad="component" class="e-dialog-body">{content.body}</e-block>,
    content.footer != null && <footer>{content.footer}</footer>,
    opts.clickOutsideToClose &&
      $on("click", (ev) => {
        const rect = dialog.getBoundingClientRect()
        const clickedBackdrop =
          ev.clientX < rect.left || ev.clientX > rect.right || ev.clientY < rect.top || ev.clientY > rect.bottom

        if (clickedBackdrop) {
          future.reject(new Error("canceled by user"))
        }
      }),
    $on("keydown", (ev) => {
      if (ev.key === "Escape") {
        ev.preventDefault()
        future.reject(new Error("canceled by user"))
      }
    }),
  )
  node_append(document.body, dialog)
  animate(dialog, animate_show)
  dialog.showModal()

  return future
    .finally(() => {
      close_dialog()
    })
    .catch((e) => {
      // console.warn(e)
    })
}

css`
dialog {
  margin: 0;
  position: fixed;
  overflow: hidden;

  display: flex;
  flex-direction: column;

  /* modern centering */
  inset: 0;
  margin: auto;

  color: ${theme.colors.text};

  border: none;
  border-radius: var(--e-frame-border-radius);
  border: 1px solid ${theme.colors.text.separator};

  background: var(--e-color-bg);
  box-shadow: 0 10px 40px rgba(0,0,0,0.3);
  width: 400px;
  max-width: var(--e-dialog-max-width, 60vw);
  width: var(--e-dialog-width, fit-content);
  max-height: var(--e-dialog-max-height, 80vh);
  opacity: 0;

  transform-origin: center top;

  transition: opacity 0.25s ease, transform 0.25s ease;

  & > e-block.e-dialog-body {
    flex: 1 1 auto;
    overflow-y: auto;
    min-height: 0;
  }

  &:has(> header) > e-block.e-dialog-body {
    border-top: 1px solid ${theme.colors.text.separator};
  }

  & > header {
    ${theme.colors.tint.css_as_inverted}
    padding: ${theme.settings.spacingComponent};
  }

  & > footer {
    padding: ${theme.settings.spacingComponent};
    //> Question: footer fill — surface band or flat tint? Kept old look via explicit from_bg for now.
    background-color: ${theme.colors.text.from_bg("10%")};

  }

  &[open] {
    opacity: 1;
    transform: scale(1);
  }

  &::backdrop {
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(3px);
    transition: opacity 0.25s ease;
    opacity: 0;
  }

  &[open]::backdrop {
    opacity: 1;
  }

  & > header {
    font-weight: bolder;
  }

  & > footer {
    display: flex;
    gap: 1rem;
    justify-content: space-between;
  }

  & button.close {
    position: absolute;
    top: 0;
    right: 0;
    border: none;
    background: none;
    cursor: pointer;
    font-size: 1.5rem;
    color: var(--fg);
    opacity: 0.5;
  }
}
`
