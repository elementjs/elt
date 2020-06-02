import { Attrs } from 'elt'

function MyComponent(a: Attrs<HTMLDivElement> & {some_attribute: string}, ch: DocumentFragment) {
  return E.DIV(ch, a.some_attribute)
}

// With Attrs, all the basic elements are available.
document.body.appendChild(<MyComponent
  id='some_id'
  class='css_class_1'
  some_attribute='World !'
>Hello </MyComponent>)
