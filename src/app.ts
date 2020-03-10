
import { $Display } from './verbs'
import { Mixin, node_add_mixin } from './mixins'
import { Renderable } from './elt'
import { o } from './observable'

/**
 * An App is a collection of building blocks that all together form an application.
 * These blocks contain code, data and views that produce DOM elements.
 *
 * It is not meant to be instanciated directly, prefer using `#App.DisplayApp` instead.
 *
 * @include ../docs/app.md
 *
 * @category app, toc
 */
export class App extends Mixin<Comment>{

  /**
   * For a given name, get the block that defines it
   * @internal
   */
  o_view_blocks = o(new Map<string | Symbol, App.Block>())

  public __cache = new Map<typeof App.Block, App.Block>()

  active_blocks = new Set<App.Block>()

  /**
   * The currently active blocks, ie. the blocks that were specifically
   * given to [[#App.DisplayApp]] or [[App#activate]]
   */
  o_active_blocks = o(this.active_blocks)

  __children_app = new Set<App>()

  constructor(public main_view: string | Symbol, public __parent_app?: App) {
    super()
  }

  inserted() {
    // Tell our parent that we exist.
    // Now, when cleaning up, the parent will check that it doesn't remove a block
    // that the child needs.
    this.__parent_app?.__children_app.add(this)
  }

  removed() {
    // When removed, unregister ourselves from our parent app, the blocks we had registered
    // now no longer hold a requirement in the parent app's cache.
    if (this.__parent_app)
      this.__parent_app.__children_app.delete(this)
  }

  getBlock<B extends App.Block>(key: new (app: App) => B): B
  getBlock<B extends App.Block>(key: new (app: App) => B, init_if_not_found: false): B | undefined
  getBlock<B extends App.Block>(key: new (app: App) => B, init_if_not_found = true): B | undefined {
    // First try to see if we already own a version of this service.
    var cached = this.__cache.get(key as any) as B | undefined
    if (cached) return cached

    // Try our parent app before trying to init it ourselves.
    if (this.__parent_app) {
      // In the parent app however, we won't try to instanciate anything if it is not found
      cached = this.__parent_app.getBlock(key, false)
      if (cached) return cached
    }

    if (init_if_not_found) {
      if (key.length > 0) {
        // Blocks take no arguments in their constructors, so this is a bogus require.
        throw new Error(`Trying to instanciate a block that requires arguments without having provided it to activate first`)
      }
      var result = new key(this)

      if (!result.unique_across_all_apps) {
        this.__cache.set(key as unknown as typeof App.Block, result)
      } else {
        var _ap = this as App
        while (_ap.__parent_app) { _ap = _ap.__parent_app }
        _ap.__cache.set(key as unknown as typeof App.Block, result)
      }

      return result
    }
  }

  /**
   *
   * @internal
   */
  getBlocksInRequirementOrder(active_blocks: Set<App.Block>) {
    var blocks = new Set(active_blocks)

    for (var bl of blocks) {
      for (var ch of bl.__requirements) {
        blocks.add(ch)
      }
    }

    return blocks
  }

  /**
   * Get the views defined by our currently active blocks
   * @internal
   */
  getViews() {
    var res = new Map<string | Symbol, App.Block>()
    for (var block of this.getBlocksInRequirementOrder(this.o_active_blocks.get())) {
      const views = (block.constructor as typeof App.Block).views
      if (!views) continue
      for (var name of views) {
        if (!res.has(name)) res.set(name, block)
      }
    }
    return res
  }

  /**
   * Remove entries from the registry
   */
  protected cleanup() {
    var kept_blocks = new Set<App.Block>()

    function keep(b: App.Block) {
      if (kept_blocks.has(b)) return
      kept_blocks.add(b)
      for (var req of b.__requirements) {
        keep(req)
      }
    }

    // We start by tagging blocks to know which are the active ones
    // as well as their dependencies.
    for (var bl of this.active_blocks) {
      keep(bl)
    }

    for (var ch of this.__children_app) {
      for (var bl of ch.active_blocks)
        keep(bl)
    }

    // Once we know who to keep, we remove those that were not tagged.
    for (var [key, block] of this.__cache) {
      if (!kept_blocks.has(block) && !block.persistent) {
        this.__cache.delete(key)
        block.blockDeinit()
      }
    }
  }

  /**
   * Activate blocks to change the application's state.
   *
   */
  activate(...new_blocks: {new (app: App): App.Block}[]) {
    const active = this.active_blocks
    const new_active_blocks = new Set<App.Block>()
    var already_has_blocks = true

    // first check for the asked new_blocks if
    for (var b of new_blocks) {
      const instance = this.__cache.get(b as typeof App.Block)
      if (!instance || !active.has(instance)) {
        already_has_blocks = false
        break
      }
    }

    // do not activate if the active blocks are already activated
    if (already_has_blocks) return

    var previous_cache = new Map(this.__cache)
    try {
      for (var b of new_blocks) {
        var bl = this.getBlock(b)
        new_active_blocks.add(bl)
      }
    } catch (e) {
      // cancel activating the new block
      console.warn(e)
      this.__cache = previous_cache
      throw e
    }

    for (var block of new_active_blocks)
      block.blockActivate()

    this.active_blocks = new_active_blocks
    this.cleanup()

    o.transaction(() => {
      this.o_active_blocks.set(new_active_blocks)
      var views = this.getViews()
      this.o_view_blocks.set(views)
    })
  }

  /**
   * @internal
   *
   * Implementation of display
   */
  display(view_name: string | Symbol) {
    return $Display(this.o_view_blocks.tf(v => {
      return v.get(view_name)
    // we use another tf to not retrigger the display if the block implementing the view did
    // not change.
    }).tf(block => {
      if (!block) {
        console.warn(`view ${view_name} was not found, cannot display it`)
        return undefined
      }
      // unfortunately, we can't specify that view_name here accesses
      // a () => Renderable function, so we cheat.
      return (block as any)[view_name as any]()
    })) as Comment
  }

  /**
   * Display an App that depends on this one.
   *
   * Blocks in the sub app that require other blocks will query this app if their app
   * does not have the block defined and use it if found. Otherwise, they will instanciate
   * their own version.
   *
   * Activated blocks are reinstanciated in a subapp even if they already are instanciated
   * in the parent app.
   *
   * ```tsx
   * @include ../examples/app.subapp.tsx
   * ```
   */
  $DisplayChildApp(view_name: string | Symbol, ...blocks: {new (app: App): App.Block}[]) {
    var newapp = new App(view_name, this)
    var res = newapp.display(view_name)
    newapp.activate(...blocks)
    node_add_mixin(res, newapp)
    return res
  }

}


export namespace App {
  /**
   * Display an application with the specified `#App.Block`s as activated blocks, displaying
   * the `main_view` view.
   *
   * @param main_view The name of the property holding the view to display
   * @param blocks The blocks to activate
   *
   * ```tsx
   * import { App } from 'elt'
   *
   * class LoginBlock extends App.Block {
   *   @App.view
   *   Main() {
   *     return <div>
   *       <SomeLoginForm/>
   *     </div>
   *   }
   * }
   *
   * document.body.appendChild(
   *   App.$DisplayApp('Main', LoginBlock)
   * )
   * ```
   *
   * @category app, toc
   */
  export function $DisplayApp(main_view: string, ...blocks: (typeof App.Block)[]) {
    var app = new App(main_view)
    var disp = app.display(main_view)
    app.activate(...blocks)
    node_add_mixin(disp, app)
    return disp
  }

  /**
   * @category app, toc
   *
   * This is a method decorator. It marks a method of a block as a view that can be displayed with [[App.DisplayApp]]
   * or [[App.Block#display]].
   *
   * Views are always a function with no arguments that return a Renderable.
   *
   * Starting with the activated blocks, and going up the [[Block.require]] calls, [[App]]
   * uses the first view that matches the name it's looking for and uses it to display its
   * contents.
   *
   * ```tsx
   * @include ../examples/app.view.tsx
   * ```
   */
  export function view(object: Block, key: string | Symbol, desc: PropertyDescriptor) {
    const cons = object.constructor as typeof Block
    (cons.views = cons.views ?? new Set()).add(key)
  }

  /**
   * A base class to make application blocks.
   *
   * A block defines views through `this.view` and reacts to
   *
   * An ObserverHolder, Blocks can use `this.observe` to watch `#o.Observable`s and will
   * only actively watch them as long as they're either *activated* or in the *requirements* of
   * an activated block.
   *
   * Blocks are meant to be used by *composition*, and not through extension.
   * Do not subclass a Block unless its state is the exact same type.
   *
   * @category app, toc
   */
  export class Block extends o.ObserverHolder {

    // @internal
    static views?: Set<string | Symbol>

    /**
     * Set this property to `true` if the block should stay instanciated even if it is
     * not required anymore.
     *
     * ```tsx
     * import { App } from 'elt'
     *
     * class MyBlock extends App.Block {
     *   // this is enough to make a block persist in the current App.
     *   persist = true
     * }
     * ```
     *
     */
    persistent?: boolean

    /**
     * Set to `true` if this block should be
     */
    unique_across_all_apps?: boolean

    constructor(public app: App) {
      super()
    }

    /** @internal */
    private block_init_promise = null as null | Promise<void>

    /** @internal */
    __requirements = new Set<Block>()

    /**
     * Wait for all the required blocks to init
     * @internal
     */
    async blockInit(): Promise<void> {
      if (this.block_init_promise) {
        await this.block_init_promise
        return
      }

      var requirement_blocks = Array.from(this.__requirements)
      // This is where we wait for all the required blocks to end their init.
      // Now we can init.
      this.block_init_promise = Promise.all(requirement_blocks.map(b => b.blockInit())).then(() => this.init())
      await this.block_init_promise
      this.startObservers()
    }

    /** @internal */
    async blockActivate() {
      await this.blockInit()
      await this.activated()
    }

    /** @internal */
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
     * from the views was inserted.
     */
    async init(): Promise<void> { }

    /**
     * Extend this method to run code whenever the block is *activated* directly (ie: passed as an
     * argument to the `app.activate()` method).
     */
    async activated(): Promise<void> { }

    /**
     * Extend this method to run code whenever this block is removed from the app.
     *
     * A block is said to be removed from the app if it is not required by any other block.
     */
    async deinit(): Promise<any> { }

    /**
     * Require another block for this block to use. Mostly useful directly in the current block's
     * current properties definition.
     *
     * ```tsx
     * class MyBlock extends App.Block {
     *   // declare this block dependencies as properties
     *   auth = this.require(AuthBlock)
     *
     *   someMethod() {
     *     // since auth is now a property, I can use it as any object.
     *     console.log(this.auth.isLoggedIn())
     *   }
     * }
     * ```
     *
     * @param block_def another block's constructor
     */
    require<B extends Block>(block_def: new (app: App) => B): B {
      var result = this.app.getBlock(block_def)
      this.__requirements.add(result)
      return result as B
    }

    /**
     * Acts as a verb that displays the specified `view_name`
     *
     * ```tsx
     * // ... inside a Block subclass declaration.
     * ToolbarView = this.view(() => <div>
     *   <h3>My Title</h3>
     *   {this.display('MoreToolbar')}
     * </div>)
     *
     * // MoreToolbar can be redefined in other blocks, which will then be displayed
     * // by app.display if they come before the current block in the requirements.
     * MoreToolbar = this.view(() => <Button click={e => doSomething()}>Something</Button>)
     * // ...
     * ```
     * @param fn
     */
    display(v: string | Symbol): Node {
      return this.app.display(v)
    }

  }

}
