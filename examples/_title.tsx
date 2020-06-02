import { $title, Attrs } from 'elt'

function MyComponent(a: Attrs<HTMLDivElement>) {
  return <div>Hello, world.</div>
}

document.body.appendChild(
  <MyComponent>{$title('Some title ! It generally appears on hover.')}</MyComponent>
)

document.body.appendChild(
  E.DIV($title('hello there !'))
)