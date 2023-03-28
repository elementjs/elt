import { Attrs, node_append, o } from 'elt'

function MyComponent(attrs: { title: o.RO<string> } & Attrs<HTMLDivElement>) {
  return <div>
    Hello {attrs.title}
  </div>
}

const o_str = o('world observable !')
node_append(document.body, <>
  <MyComponent title='world str !'/>
  <MyComponent title={o_str}/>
</>)
