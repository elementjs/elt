import { o } from 'elt'

function dostuff() {
  console.log('!')
}
const debounced = o.debounce(dostuff, 40)

class MyClass {
  @o.debounce(400)
  dostuff() {
    console.log('stuff')
  }
}
