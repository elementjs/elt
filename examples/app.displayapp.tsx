import { App, o, $bind, $click } from 'elt'

class AppMain extends App.Service {
  @App.view
  Main() {
    return <div>Logged in !</div>
  }
}

class LoginService extends App.Service {
  @App.view
  Main() {
    const o_user = o('user')
    return <div>
      <input placeholder='username'>
        {$bind.string(o_user)}
      </input>
      <button>
        Login
        {$click(_ => {
          // validate the login or display an error.
          // if the credentials are correct, we can change the current active service.
          this.app.activate(AppMain)
        })}
      </button>
    </div>
  }
}

document.body.appendChild(
  // We display the Main view from the first activated service that has it.
  App.DisplayApp('Main', LoginService)
)
