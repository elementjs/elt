import { $title, Attrs, e, node_append } from 'elt'

function MyComponent(a: Attrs<HTMLDivElement>) {
  return <div>Hello, world.</div>
}

node_append(document.body,
  <MyComponent>{$title('Some title ! It generally appears on hover.')}</MyComponent>
)

node_append(document.body,
  e("div", $title('hello there !'))
)