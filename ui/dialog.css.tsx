import { css } from "elt"

export const dialog = css`
dialog {
  margin: 0;
  position: fixed;
  overflow: hidden;

  /* modern centering */
  inset: 0;
  margin: auto;

  gap: 1rem;

  border: none;
  border-radius: var(--e-frame-border-radius);
  background: var(--e-color-bg);
  box-shadow: 0 10px 40px rgba(0,0,0,0.3);
  width: 400px;
  max-width: 90vw;
  opacity: 0;

  transform-origin: center top;

  transition: opacity 0.25s ease, transform 0.25s ease;
}

dialog[open] {
  opacity: 1;
}

dialog::backdrop {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(3px);
  transition: opacity 0.25s ease;
  opacity: 0;
}

dialog[open]::backdrop {
  opacity: 1;
}

dialog > header {
  font-weight: bolder;
}

dialog > footer {
  display: flex;
  gap: 1rem;
  justify-content: end;
}

dialog button.close {
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

/* Keyframes */
@keyframes dialog-pop {
  from {
    opacity: 0;
    transform: scale(0.92);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes backdrop-fade {
  from { opacity: 0; }
  to   { opacity: 1; }
}
`