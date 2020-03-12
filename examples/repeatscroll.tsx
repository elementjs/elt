import { o, $scrollable, $RepeatScroll } from 'elt'

const o_arr = o(['one', 'two', 'three', 'four', 'five', 'six'])

document.body.appendChild(<div style={{height: '90px'}}>
  {$scrollable}
  {$RepeatScroll(o_arr, o_item => <div style={{padding: '16px'}}>
    {o_item}
  </div>)}
</div>)
