import { o } from 'elt'

function dostuff() {
  console.log('!')
}
const throttled = o.throttle(dostuff, 40)

class MyClass {
  @o.throttle(400)
  dostuff() {
    console.log('stuff')
  }
}
