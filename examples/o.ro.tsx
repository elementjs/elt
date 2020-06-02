import { Attrs, o, Fragment as $ } from 'elt'

function MyComponent(attrs: { title: o.RO<string> } & Attrs<HTMLDivElement>) {
  return <div>
    Hello {attrs.title}
  </div>
}

const o_str = o('world observable !')
document.body.appendChild(<$>
  <MyComponent title='world str !'/>
  <MyComponent title={o_str}/>
</$>)
