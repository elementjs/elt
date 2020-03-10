
import { $Display } from './verbs'
import { Mixin, node_add_mixin } from './mixins'
import { Renderable } from './elt'
import { o } from './observable'

/**
 * An App is a collection of building blocks that altogether form an application.
 * These blocks contain code, data and views that produce DOM elements.
 *
 * Use [[App.$DisplayApp]] to instanciate an App and [[App#$DisplayChildApp]] for child apps.
 *
 * An `App` needs to be provided a view name (see [[App.view]]) which will be the main
 * view that the `App` displays, and one or several block classes (not objects), that are
 * to be "activated", which means they will be instanciated and serve as the base blocks
 * that will be searched for the main view to render it. As Blocks can require other blocks,
 * and those blocks also can define views, `App` will look in them as well for the main view
 * and will stop at the first one it finds.
 *
 * Blocks are singletons ; once required, any subsequent [[Block#require]] on a same block
 * class will return the same instance (not always true for child apps).
 *
 * During the life of the application, the list of activated blocks can change using [[App#activate]],
 * in which case the views will be reevaluated using the same "first one that has it" rule.
 *
 * As the activated blocks change, so do their requirements. Blocks that were instanciated
 * but are not required anymore are thus removed. See [[Block#deinit]].
 *
 * **Why the app class**
 *
 * While [[Component]]s and their functional counterparts are a nice way of displaying data and
 * somewhat handling some simple states, they should never perform network calls or in general even be *aware* of any kind of network,
 * or query `localStorage`, or do anything other than just do what it was meant to do ; create
 * DOM Nodes to render some data, and signal the program that some user interaction has taken place.
 *
 * More precisely ; Components should not deal with anything that has side effects.
 *
 * The `App` class and its [[App.Block]] friend are a proposal to separate pure presentation from *business logic*.
 * Blocks can still have a visual role, but it is more about *layout* than display. They don't even have
 * to do anything visual ; a Block could for instance handle network calls exclusively for instance.
 *
 * The idea is that an `App` is created *by composition* ; it is the sum of its blocks, and they can change
 * during its life time.
 *
 * In a way, Blocks are *modules*, except they are loaded and unloaded dynamically as the application
 * is used. They also encapsulate state neatly, and it is perfectly possible to have several `Apps` on the
 * same page that never share data, or several that do using "child" apps.
 *
 * @category app, toc
 */
export class App extends Mixin<Comment>{

  /**
   * For a given name, get the block that defines it
   * @internal
   */
  o_view_blocks = o(new Map<string | Symbol, App.Block>())

  /** @internal */
  public __cache = new Map<typeof App.Block, App.Block>()

  /** @internal */
  active_blocks = new Set<App.Block>()

  /**
   * The currently active blocks, ie. the blocks that were specifically
   * given to [[#App.$DisplayApp]] or [[App#activate]]
   */
  o_active_blocks = o(this.active_blocks)

  /** @internal */
  __children_app = new Set<App>()

  /** @internal */
  constructor(public main_view: string | Symbol, public __parent_app?: App) {
    super()
  }

  /** @internal */
  inserted() {
    // Tell our parent that we exist.
    // Now, when cleaning up, the parent will check that it doesn't remove a block
    // that the child needs.
    this.__parent_app?.__children_app.add(this)
  }

  /** @internal */
  removed() {
    // When removed, unregister ourselves from our parent app, the blocks we had registered
    // now no longer hold a requirement in the parent app's cache.
    if (this.__parent_app)
      this.__parent_app.__children_app.delete(this)
  }

  /** @internal */
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
   * Remove blocks that are not required anymore by the current activated blocks
   * or any of their requirements. Call deinit() on the blocks that are removed.
   * @internal
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
   * See [[App.view]] for an example.
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

    this.active_blocks = new_active_blocks

    for (var block of new_active_blocks)
      block.blockActivate()

    // remove dead blocks
    this.cleanup()

    o.transaction(() => {
      this.o_active_blocks.set(new_active_blocks)
      var views = this.getViews()
      this.o_view_blocks.set(views)
    })
  }

  /**
   * Display the specified `view_name`.
   *
   * ```tsx
   * @include ../examples/app.display.tsx
   * ```
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
   * Display an App that depends on this one, displaying `view_name` as its main view
   * and activating the block classes passed in `blocks`.
   *
   * Blocks in the child app that require other blocks will query this app if their app
   * does not have the block defined and use it if found. Otherwise, they will instanciate
   * their own version.
   *
   * Activated blocks in a child app are instanciated even if they already exist
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
   * The app will look for the first block that implements the asked view in the requirement chain. See [[App.view]] for details.
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
  export function $DisplayApp(main_view: string, ...blocks: ({new (app: App): App.Block })[]) {
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
  export function view<T extends Renderable>(object: Block, key: string | Symbol, desc: TypedPropertyDescriptor<() => T>) {
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
   * Do not subclass a subclass of Block unless its state is the exact same type.
   *
   * @category app, toc
   */
  export class Block extends o.ObserverHolder {

    /** @internal */
    static views?: Set<string | Symbol>

    /**
     * Set this property to `true` if the block should stay instanciated even if it is
     * not required anymore.
     *
     * See [[App.view]] for an example.
     */
    persistent?: boolean

    /**
     * Set to `true` if this block should be instanciated only once across this app and
     * its child apps.
     *
     * See [[App.$DisplayChildApp]] for an example.
     */
    unique_across_all_apps?: boolean

    /**
     * A block is not meant to be instanciated by hand. Also, classes that subclass [[Block]]
     *  should never have any other arguments than just an [[App]] instance.
     */
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
     * Extend this method to run code whenever after the `init()` methods
     * of the its requirements have returned. If it had no requirements, then this method is
     * run shortly after the Block's instanciation.
     *
     * The `init` chain is started on [[App#activate]]. However, the views start displaying immediately,
     * which means that in all likelyhood, `init()` for a block will terminate **after** the DOM
     * from the views was inserted.
     *
     * If you need to run code **before** the views are displayed, overload the `constructor`.
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
    async deinit(): Promise<void> { }

    /**
     * Require another block for this block to use.
     *
     * If the requested block does not already exist within this [[App]], instanciate it.
     *
     * See [[App.$DisplayChildApp]] and [[App.view]] for examples.
     */
    require<B extends Block>(block_def: new (app: App) => B): B {
      var result = this.app.getBlock(block_def)
      this.__requirements.add(result)
      return result as B
    }

  }

}
