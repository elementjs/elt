
import { Display } from './verbs'
import { Mixin } from './mixins'
import { o } from './observable'


export interface BlockInstantiator<B extends Block = Block> {
  new(app: App): B
}


/**
 * The base class to create services.
 *
 * Services are meant to be used by *composition*, and not through extension.
 * Do not subclass a service unless its state is the exact same type.
 */
export class Block {

  constructor(public app: App) { }

  registry = this.app.registry

  /**
   * Set to true if this block should persist even if it is no longer in
   * the requirements.
   */
  persist = false

  private blockInitPromise = null as null | Promise<void>

  private blockRequirements = new Set<Block | Object>()
  observers = new o.ObserverGroup()

  mark(s: Set<Function>) {
    s.add(this.constructor)
    this.blockRequirements.forEach(req => {
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

  runOnRequirementsAndSelf(fn: (b: Block) => void, mark = new Set<Block>()) {
    mark.add(this)
    this.blockRequirements.forEach(req => {
      if (req instanceof Block && !mark.has(req)) {
        req.runOnRequirementsAndSelf(fn, mark)
      }
    })
    fn(this)
  }

  addViews(views: {[name: string]: () => Node}) {
    this.runOnRequirementsAndSelf(() => {

    })
  }

  /**
   * Wait for all the required blocks to init
   */
  async blockInit(): Promise<void> {
    if (this.blockInitPromise) {
      await this.blockInitPromise
      return
    }

    var requirement_blocks = Array.from(this.blockRequirements).filter(b => b instanceof Block) as Block[]
    // This is where we wait for all the required blocks to end their init.
    // Now we can init.
    this.blockInitPromise = Promise.all(requirement_blocks.map(b => b.blockInit())).then(() => this.init())
    await this.blockInitPromise
    this.observers.start()
  }

  async blockActivate() {
    await this.blockInit()
    await this.activate()
  }

  async blockDeinit() {
    this.observers.stop()
    this.deinit()
  }

  /**
   * Extend this method to run code whenever the block is created and
   * integrated.
   */
  async init(): Promise<void> { }

  async activate(): Promise<void> { }

  /**
   * Extend this method to run code whenever this block is cleared from the app.
   */
  async deinit(): Promise<any> { }

  isActive() {
    return this.app.registry.active_blocks.has(this.constructor as BlockInstantiator<this>)
  }

  /**
   *
   * @param block_def
   */
  require<B extends Block>(block_def: BlockInstantiator<B>): B
  /**
   *
   * @param klass
   * @param defaults
   */
  require<T>(klass: new () => T, defaults?: Partial<T>): o.Observable<T>
  require(
    // this: Partial<>,
    def: new (...a: any[]) => any,
    defaults?: any
  ): unknown {

    var result = this.registry.get(def, defaults)
    this.blockRequirements.add(result)
    return result
  }

  /**
   * Display the contents of a block
   * @param fn
   */
  display(
    v: Symbol
  ): Node {
    return this.app.display(v)
  }

}


export const MainView = Symbol('main-view')


/**
 * A registry that holds types mapped to their instance.
 */
export class Registry {

  private cache = new Map<BlockInstantiator<any> | (new () => any), any>()
  private persistents = new Set<Block>()
  private init_list: Block[] = []

  parent: Registry | null = null
  children = new Set<Registry>()
  active_blocks = new Set<BlockInstantiator>()

  constructor(public app: App) { }

  setParent(parent: Registry | null) {
    if (parent != null) {
      parent.children.add(this)
    } else if (this.parent != null) {
      this.parent.children.delete(this)
    }
    this.parent = parent
  }

  get<T>(klass: new () => T, defaults?: any): o.Observable<T>
  get<B extends Block>(creator: BlockInstantiator<B>): B
  get(key: any, defaults?: any): any {
    // First try to see if we own a version of this service.
    var first_attempt = this.cache.get(key)

    if (first_attempt) return first_attempt

    // If we didn't and we have a parent, then we try to ask it
    // if it holds a value
    if (this.parent) {
      var second_attempt = this.parent.cache.get(key)
      if (second_attempt) return second_attempt
    }

    // If neither we nor the parent have the instance, create it ourselve.
    // We just check that the asked class/function has one argument, in which
    // case we give it the app as it *should* be a block (we do not allow
    // constructors with parameters for data services)
    var result = key.prototype instanceof Block || key === Block ? new key(this.app) : o(new key())
    this.cache.set(key, result)
    if (result instanceof Block)
      this.init_list.push(result)
    if (result.persist)
      this.persistents.add(result)
    return result
  }

  getViews() {
    var views = new Map<Symbol, () => Node>()
    this.active_blocks.forEach(inst => {
      var block = this.get(inst)
      block.runOnRequirementsAndSelf(b => {
        for (var sym of Object.getOwnPropertySymbols(b)) {
          var fn = (b as any)[sym]
          if (typeof sym === 'symbol' && typeof fn === 'function' && fn.length === 0) {
            views.set(sym, fn)
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
  activate(blocks: BlockInstantiator[], data: Object[]) {
    for (var d of data) {
      this.setData(d)
    }

    // FIXME check that the blocks are not the same
    this.active_blocks = new Set(blocks)
    var insts = Array.from(this.active_blocks).map(b => this.get(b))
    insts.forEach(i => i.blockActivate())
    this.cleanup()
    this.initPending()
  }

  setData(v: any) {
    var prev = this.cache.get(v.constructor) as o.Observable<any>
    if (prev) {
      prev.set(v)
    } else {
      this.cache.set(v.constructor, o(v))
    }
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
        if (value instanceof Block) {
          value.blockDeinit()
        }
      }
    })
  }

  initPending() {
    var i = 0
    try {
      for (var block of this.init_list) {
        block.blockInit()
        i++
      }
    } finally {
      this.init_list = this.init_list.slice(i)
    }
  }

}


/**
 * An App is a collection of building blocks that all together form an application.
 * These blocks contain code, data and views that produce DOM elements.
 *
 * At its simplest, the App is activated on one or several blocks. These block in turn
 * can require other blocks or data classes to access them.
 *
 * When changing main blocks, blocks that are no longer needed are de-inited.
 *
 * A block may only exist once in an App.
 *
 * An App may have "sub" Apps, which can contain their own specific versions of blocks.
 *
 * When the App is mounted, it looks for a parent App and takes a subregistry
 * from it if it was found. Otherwise, it will just create its own registry.
 *
 */
export class App extends Mixin<Comment>{

  registry = new Registry(this)

  // o_views really has symbol keys, typescript just does not support
  // this as of now.
  o_views = new o.Observable<Map<Symbol, () => Node>>(new Map)
  active_blocks = new o.Observable<Set<BlockInstantiator>>(new Set())


  constructor(public main_view: Symbol, protected init_list: (BlockInstantiator<any> | Object)[]) {
    super()
  }

  /**
   * Activate blocks to change the application's state.
   *
   * @param params The blocks to activate, some states to put in the
   * registry already initialized to the correct values, etc.
   */
  activate(...params: (BlockInstantiator<any> | Object)[]) {
    var data = params.filter(p => typeof p !== 'function')
    var blocks = params.filter(p => typeof p === 'function') as BlockInstantiator[]
    this.registry.activate(blocks, data)
    this.active_blocks.set(this.registry.active_blocks)
    this.o_views.set(this.registry.getViews())
  }

  /**
   *
   */
  inserted() {
    // Look for a parent app. If found, pick a subregistry and register it.
    var parent_app = App.get(this.node.parentNode!, true)
    this.registry.setParent(parent_app ? parent_app.registry : null)
    this.activate(...this.init_list)
  }

  /**
   *
   */
  removed() {
    this.registry.setParent(null)
    // should probably deinit ?
  }

  displaySubApp(main_view: Symbol, ...params: (BlockInstantiator<any> | Object)[]) {
    const app = new App(main_view, params)
    app.registry.setParent(this.registry)
    const disp = app.display(main_view)
    app.addToNode(disp)
    return disp
  }

  display(sym: Symbol) {
    return Display(this.o_views.tf(v => {
      var view = v.get(sym)
      return view && view()
    })) as Comment
  }

}


/**
 * Display the application.
 *
 * @param main_view The symbol of the view to display
 * @param params Initialisation parameters
 */
export function DisplayApp(main_view: Symbol, ...params: (BlockInstantiator<any> | Object)[]) {
  var app = new App(main_view, params)
  var disp = app.display(main_view)
  app.addToNode(disp)
  return disp
}