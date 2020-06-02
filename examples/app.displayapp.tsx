import { App } from 'elt'

function SomeLoginForm() { return <div></div> }

class LoginService extends App.Service {
  @App.view
  Main() {
    return <div>
      <SomeLoginForm/>
    </div>
  }
}

document.body.appendChild(
  App.DisplayApp('Main', LoginService)
)
