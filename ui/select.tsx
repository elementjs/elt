import { type Attrs, o, type Renderable, $click, css, Repeat } from "elt"
import { popup } from "./popup"
import { theme } from "./theme"
const colors = theme.colors
import { CaretDown, Check } from "./icons"

/**
 * A select component that does not use the native select element for custom rendering of options.
 */

export interface SelectAttributes<T, T2 = T> extends Attrs<HTMLButtonElement> {
  model?: o.Observable<T>
  options: o.RO<Iterable<T2>>
  convert_fn?: (opt: T2) => T
  label_fn?: (opt: T2) => Renderable
  disabled?: o.RO<boolean>
  placeholder?: o.RO<Renderable>
}

export function Select<T, T2 = T>(at: SelectAttributes<T, T2>) {
  const convert_fn = at.convert_fn ?? ((opt: T2) => opt as unknown as T)
  const oo_values_map = o.tf(at.options, opts => new Map([...opts].map(opt => [convert_fn(opt), opt])))
  const o_open = o(false)

  return <button class={cls_select_button} disabled={at.disabled}>
    {"\u200c"}

    {/* Display the current value */}
    {o.expression(get => {
      const val = get(at.model)
      const map_val = get(oo_values_map)
      const opt = map_val.get(val!)
      if (opt == null) {
        return <span class={cls_placeholder}>{get(at.placeholder)}</span>
      }
      return at.label_fn ? at.label_fn(opt) : opt?.toString()
    })}

    {$click(async ev => {
      o_open.set(true)
      try {
        await popup(ev.currentTarget, fut => <>
          {Repeat(o(at.options).tf(opts => [...opts]), o_option => {
            const oo_option_value = o_option.tf(opt => convert_fn(opt))
            const oo_is_selected = o.expression(get => get(at.model) === get(oo_option_value))
            return <e-flex class={[cls_item, oo_is_selected.tf(selected => selected && "selected")]}>
              {$click(() => {
                at.model?.set(o.get(oo_option_value))
                fut.resolve(o.get(oo_option_value))
              })}
              <e-box class="selected-icon">{oo_is_selected.tf(selected => selected && Check())}</e-box>
              {o_option.tf(opt => at.label_fn ? at.label_fn(opt) : opt?.toString())}
            </e-flex>
          })}
        </>
        , { parent: ev.currentTarget.parentElement!, arrow: true })
      } finally {
        o_open.set(false)
      }
    })}
    <e-box class={[cls_indicator, o_open.tf(open => open ? "open" : "")]}>
      {CaretDown()}
    </e-box>

  </button> as HTMLButtonElement
}

const cls_placeholder = css`.placeholder {
  color: ${colors.text.faded};
}`

const cls_select_button = css`.select-button {
  display: inline-flex;
  align-items: center;
}`

const cls_indicator = css`.indicator {
  width: 16px;
  font-weight: bold;
  margin-left: 4px;
  rotate: 0deg;
  transition: rotate 0.2s ease;
  transform-origin: center;
  &.open {
    rotate: -90deg;
  }
}`

const cls_item = css`.item {
  padding: ${theme.settings.cellPadding};
  cursor: pointer;
  user-select: none;
  font-size: ${theme.settings.formFontSize};

  & .selected-icon {
    color: ${colors.tint};
    padding: 0 4px;
    text-align: center;
    width: 16px;
  }

  &.selected {
    background-color: ${colors.tint.ultra_light};
  }

  &:hover, &:hover .selected-icon {
    background-color: ${colors.tint.light};
  }

}`