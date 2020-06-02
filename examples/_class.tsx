import { $class, o, Fragment as $, $bind } from 'elt'

const o_cls = o('class2')
const o_bool = o(false)

document.body.appendChild(<$>
  <style>
    {`.class1 {
       text-decoration: underline;
    }
    .class2 {
       background: #f99;
    }
    .class3 {
       font-weight: bold;
    }
    .class4 {
       background: #99f;
    }
  `}
  </style>

  <input id='class3' type="checkbox">
    {$bind.boolean(o_bool)}
  </input> <label for='class3'>Class 3</label>
  {' / '}
  <input type='text'>
    {$bind.string(o_cls)}
  </input>

  <div>
    {$class('class1', o_cls, {class3: o_bool})}
    content 1
  </div>
  <div>$class and class= are equivalent</div>
  <div class={['class1', o_cls, {class3: o_bool}]}>
    content 2
  </div>
  {E.DIV(
    $class('class1', o_cls, {class3: o_bool}),
    'content 3'
  )}
</$>)
