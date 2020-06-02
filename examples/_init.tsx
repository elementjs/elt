import { o, $init, $inserted, $removed, Fragment as $, If, $click } from 'elt'

var the_div = <div>
  {$init(() => console.log('init'))}
  {$inserted(() => console.log('inserted'))}
  {$removed(() => console.log('removed'))}
  I AM HERE.
</div>

var o_is_inside = o(false)

// here, we reuse the_div and are not recreating it all the time.
// notice in the console how init was only called once.
document.body.appendChild(<$>
  <button>
    {$click(() => o_is_inside.mutate(b => !b))}
    Toggle the div
  </button>
  {If(o_is_inside, () => the_div)}
</$>)
