import { App } from 'elt'

class Service1 extends App.Service {
  @App.view
  Content() {
    return <div>
      Service 1
    </div>
  }
}

class Service2 extends App.Service {

  @App.view
  Content() {
    return <div>Service 2</div>
  }

}

class RootService extends App.Service {

  // try inverting the require
  bl1 = this.require(Service1)
  bl2 = this.require(Service2)

  @App.view
  Main() {
    return <div>{this.app.display('Content')}</div>
  }
}

document.body.appendChild(App.$DisplayApp('Main', RootService))
