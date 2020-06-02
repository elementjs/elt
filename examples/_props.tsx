import { $props } from 'elt'

<div>
  {$props<HTMLDivElement>({dir: 'left'})}
</div>
E.DIV(
  $props<HTMLDivElement>({dir: 'left'})
)
