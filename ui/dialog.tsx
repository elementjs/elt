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

  // show_dialog(cbk) or show_dialog(opts, cbk)
  const options: DialogOptions = typeof opts === "function" ? {} : opts
  const callback = typeof opts === "function" ? opts : cbk
  if (callback == null) throw new Error("show_dialog(opts, cbk): cbk is required")

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

  const content = callback(future)

  const dialog = E(
    "dialog",
    content.header != null && (
      <header>
        <h1>{content.header}</h1>
      </header>
    ),
    <e-prose pad="component" class="e-dialog-body">
      {content.body}
    </e-prose>,
    content.footer != null && <footer>{content.footer}</footer>,
    options.clickOutsideToClose &&
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
    .catch((_e) => {
      // console.warn(_e)
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

  color: ${theme.colors.text};

  border: none;
  /* The dialog panel doesn't pad itself (its header/body/footer do), so its radius can't derive
     from its own padding like [radius] normally does — "component" is a deliberate, named
     override matching the step its children pad at (see "Borders and radius" in
     docs/md/ui-layout.md). */
  ${theme.css_radius("component")}
  border: 1px solid ${theme.colors.neutral.faded};

  background: var(--e-color-bg);
  box-shadow: 0 10px 40px rgba(0,0,0,0.3);
  width: 400px;
  max-width: var(--e-dialog-max-width, 60vw);
  width: var(--e-dialog-width, fit-content);
  max-height: var(--e-dialog-max-height, 80vh);
  opacity: 0;

  transform-origin: center top;

  transition: opacity 0.25s ease, transform 0.25s ease;

  & > e-prose.e-dialog-body {
    flex: 1 1 auto;
    overflow-y: auto;
    min-height: 0;
  }

  &:has(> header) > e-prose.e-dialog-body {
    border-top: 1px solid ${theme.colors.neutral.surface("n+3")};
  }

  &[open] {
    display: flex;
    flex-direction: column;
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
