import { node_append, Attrs, e } from 'elt'

function MyComponent(a: Attrs<HTMLDivElement> & {some_attribute: string}) {
  return e("div", a.some_attribute)
}

// With Attrs, all the basic elements are available.
node_append(document.body, <MyComponent
  id='some_id'
  class='css_class_1'
  some_attribute='World !'
>Hello </MyComponent>)
