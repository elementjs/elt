import { css, node_append, type Renderable, $on } from "elt"
import { theme } from "./theme"
import { Future } from "./utils";
import { animate, animate_hide, animate_show } from "./animation";

export interface DialogOptions {
  clickOutsideToClose?: boolean
}

export type DialogCallback<T> = (fut: Future<T>) => Renderable

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
        pseudoElement: "::backdrop"
      }),
    ]).finally(() => {
      dialog.remove()
    })
  }

  const dialog = E("dialog",
    cbk(future),
    opts.clickOutsideToClose && $on("click", ev => {
      const rect = dialog.getBoundingClientRect()
        const clickedBackdrop =
          ev.clientX < rect.left  ||
          ev.clientX > rect.right ||
          ev.clientY < rect.top   ||
          ev.clientY > rect.bottom

      if (clickedBackdrop) {
        future.reject(new Error("canceled by user"))
      }
    }),
    $on("keydown", ev => {
      if (ev.key === "Escape") {
        ev.preventDefault()
        future.reject(new Error("canceled by user"))
      }
    })
  )
  node_append(document.body, dialog)
  animate(dialog, animate_show)
  dialog.showModal()

  return future.finally(() => {
    close_dialog()
  }).catch(e => {
    console.warn(e)
  })
}

css`
dialog {
  margin: 0;
  position: fixed;
  overflow: hidden;

  /* modern centering */
  inset: 0;
  margin: auto;

  gap: 1rem;

  color: ${theme.colors.text};

  border: none;
  border-radius: var(--e-frame-border-radius);
  border: 1px solid ${theme.colors.text.light};

  background: var(--e-color-bg);
  box-shadow: 0 10px 40px rgba(0,0,0,0.3);
  width: 400px;
  max-width: var(--e-dialog-max-width, 60vw);
  width: var(--e-dialog-width, fit-content);
  max-height: var(--e-dialog-max-height, 80vh);
  opacity: 0;

  transform-origin: center top;

  transition: opacity 0.25s ease, transform 0.25s ease;

  &:has(> header) > e-box {
    border-top: 1px solid ${theme.colors.text.light};
  }

  & > header {
    ${theme.css_light_colors}
    padding: ${theme.settings.paddingPanelVertical} ${theme.settings.paddingPanelHorizontal};
    background-color: ${theme.colors.tint};
    color: ${theme.colors.bg};
  }

  & > footer {
    border-top: 1px solid ${theme.colors.text.light};
    padding: var(--e-padding-panel, 10px 16px);
    background-color: ${theme.colors.text.ultra_light};

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
