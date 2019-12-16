
import { Display } from './verbs'
import { Mixin } from './mixins'
import { o } from './observable'

/**
 * An App is a collection of building blocks that all together form an application.
 * These blocks contain code, data and views that produce DOM elements.
 *
 * @include ../docs/app.md
 *
 */
export class App extends Mixin<Comment>{

  registry: App.Registry = new App.Registry(this)

  o_views = new o.Observable<{[name: string]: App.View}>({})
  active_blocks = new o.Observable<Set<App.BlockInstantiator>>(new Set())

  constructor(public main_view: string, protected init_list: App.BlockInstantiator<any>[]) {
    super()
  }

  /**
   * Activate blocks to change the application's state.
   *
   * @param params The blocks to activate, some states to put in the
   * registry already initialized to the correct values, etc.
   */
  activate(...params: App.BlockInstantiator<any>[]) {
    var blocks = params.filter(p => typeof p === 'function') as App.BlockInstantiator[]
    const active = this.active_blocks.get()
    var not_present = false

    for (var b of blocks) {
      if (!active.has(b))
        not_present = true
    }

    // do not activate if the active blocks are already activated
    if (!not_present) return

    this.registry.activate(blocks)
    this.active_blocks.set(this.registry.active_blocks)
    this.o_views.set(this.registry.getViews())
  }

  /**
   *
   */
  init() {
    // Look for a parent app. If found, pick a subregistry and register it.
    // var parent_app = App.get(this.node.parentNode!, true)
    // this.registry.setParent(parent_app ? parent_app.registry : null)
    this.activate(...this.init_list)
  }

  /**
   *
   */
  deinit() {

  }

  display(sym: string) {
    return Display(this.o_views.tf((v, old, prev) => {
      var view = v[sym]
      // if (sym === 'MainView')
      //   console.log(sym, v, old, o.isValue(old) && view === old[sym])
      if (o.isValue(old) && view === old[sym] && o.isValue(prev)) {
        return prev
      }
      return view && view.fn()
    })) as Comment
  }

}


export namespace App {
  /**
   * Display the application.
   *
   * @param main_view The symbol of the view to display
   * @param params Initialisation parameters
   *
   * @category verb
   */
  export function DisplayApp(main_view: string, ...params: BlockInstantiator<any>[]) {
    var app = new App(main_view, params)
    var disp = app.display(main_view)
    app.addToNode(disp)
    return disp
  }

  /**
   * A Helper interface for a Block constructor.
   */
  export interface BlockInstantiator<B extends Block = Block> {
    new(app: App): B
  }


  export class View {
    constructor(public fn: () => Node) { }
  }


  /**
   * The base class to create services.
   *
   * Services are meant to be used by *composition*, and not through extension.
   * Do not subclass a service unless its state is the exact same type.
   */
  export class Block extends o.ObserverGroup {

    constructor(public app: App) {
      super()
      this.app.registry.cache.set(this.constructor as any, this)
    }

    registry: App.Registry = this.app.registry

    private block_init_promise = null as null | Promise<void>

    private block_requirements = new Set<Block | Object>()

    mark(s: Set<Function>) {
      s.add(this.constructor)
      this.block_requirements.forEach(req => {
        var proto = req.constructor
        if (req instanceof o.Observable) {
          s.add(req.get().constructor)
        } if (req instanceof Block && !s.has(proto)) {
          req.mark(s)
        } else {
          s.add(proto)
        }
      })
    }

    /**
     * Run `fn` on the requirements of this block, then on itself.
     *
     * @param fn The function to run on all blocks
     * @param mark A set containing blocks that were already visited
     */
    runOnRequirementsAndSelf(fn: (b: Block) => void, mark = new Set<Block>()) {
      mark.add(this)
      this.block_requirements.forEach(req => {
        if (req instanceof Block && !mark.has(req)) {
          req.runOnRequirementsAndSelf(fn, mark)
        }
      })
      fn(this)
    }

    view(fn: () => Node) {
      return new View(fn.bind(this))
    }

    /**
     * Wait for all the required blocks to init
     */
    async blockInit(): Promise<void> {
      if (this.block_init_promise) {
        await this.block_init_promise
        return
      }

      var requirement_blocks = Array.from(this.block_requirements).filter(b => b instanceof Block) as Block[]
      // This is where we wait for all the required blocks to end their init.
      // Now we can init.
      this.block_init_promise = Promise.all(requirement_blocks.map(b => b.blockInit())).then(() => this.init())
      await this.block_init_promise
      this.startObservers()
    }

    async blockActivate() {
      await this.blockInit()
      await this.activate()
    }

    async blockDeinit() {
      this.stopObservers()
      this.deinit()
    }

    /**
     * Extend this method to run code whenever the block is created after the `init()` methods
     * of the requirements have returned.
     *
     * The `init` chain is started on activation. However, the views start displaying immediately,
     * which means that in all likelyhood, `init()` for a block will terminate **after** the DOM
     * is in place.
     */
    async init(): Promise<void> { }

    /**
     * Extend this method to run code whenever the block is *activated* directly (ie: passed as an
     * argument to the `app.activate()` method).
     */
    async activate(): Promise<void> { }

    /**
     * Extend this method to run code whenever this block is removed from the app.
     *
     * A block is said to be removed from the app if it is not required by any other block.
     */
    async deinit(): Promise<any> { }

    isActive() {
      return this.app.registry.active_blocks.has(this.constructor as BlockInstantiator<this>)
    }

    /**
     *
     * @param block_def
     */
    require<B extends Block>(block_def: BlockInstantiator<B>): B {
      var result = this.registry.get(block_def)
      this.block_requirements.add(result)
      return result
    }

    /**
     * Display the contents of a block
     * @param fn
     */
    // v should be AllowedNames<this, View> ! but it is a bug with ts 3.6.2
    display(v: string): Node {
      return this.app.display(v as string)
    }

  }

  /**
   * A registry that holds types mapped to their instance.
   */
  export class Registry {

    public cache = new Map<BlockInstantiator<any>, Block>()
    public persistents = new Set<Block>()
    public init_list: Set<Block> = new Set()

    active_blocks = new Set<BlockInstantiator>()

    constructor(public app: App) {
    }

    get<B extends Block>(creator: BlockInstantiator<B>): B
    get(key: any): any {
      // First try to see if we own a version of this service.
      var first_attempt = this.cache.get(key)

      if (first_attempt) return first_attempt

      // If neither we nor the parent have the instance, create it ourselve.
      // We just check that the asked class/function has one argument, in which
      // case we give it the app as it *should* be a block (we do not allow
      // constructors with parameters for data services)
      var result = new key(this.app)
      if (result instanceof Block)
        this.init_list.add(result)
      if (result.persist)
        this.persistents.add(result)
      return result
    }

    getViews() {
      var views = {} as {[name: string]: View}
      this.active_blocks.forEach(inst => {
        var block = this.get(inst)
        block.runOnRequirementsAndSelf(b => {
          for (var name of Object.getOwnPropertyNames(b)) {
            var fn = (b as any)[name]
            if (fn instanceof View) {
              views[name] = fn
            }
          }
        })
      })
      return views
    }

    /**
     * Activate the given blocks with the given data
     * If all the blocks were already active, then only the data will be set,
     * but the views won't be refreshed (as they're the same).
     *
     * @param blocks: The blocks to activate
     * @param data: The data to preload
     */
    activate(blocks: BlockInstantiator[]) {
      this.active_blocks = new Set(blocks)
      var insts = Array.from(this.active_blocks).map(b => this.get(b))
      insts.forEach(i => i.blockActivate())
      this.cleanup()
      this.initPending()
    }

    /**
     * Remove entries from the registry
     */
    protected cleanup() {
      var mark = new Set<Function>()

      this.persistents.forEach(b => b.mark(mark))
      this.active_blocks.forEach(bl => {
        var b = this.cache.get(bl) as Block
        b.mark(mark)
      })

      // now, we sweep
      this.cache.forEach((value, key) => {
        if (!mark.has(key)) {
          this.cache.delete(key)
          value.blockDeinit()
        }
      })
    }

    initPending() {
      for (var block of this.init_list) {
        this.init_list.delete(block)
        block.blockInit()
      }
    }

  }

}
