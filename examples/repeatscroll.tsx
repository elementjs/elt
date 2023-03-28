import { o, $scrollable, RepeatScroll, node_append } from 'elt'

var arr = [] as number[]
for (var i = 0; i < 1000; i++) arr.push(i)

const o_arr = o(arr)

node_append(document.body, <div style={{height: '240px'}}>
  {$scrollable}
  {RepeatScroll(o_arr, o_item => <div style={{padding: '16px'}}>
    {o_item}
  </div>)}
</div>)
