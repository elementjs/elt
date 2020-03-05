# What is ELT

ELT is a [typescript](https://typescriptlang.org) library for building user interfaces in a web environment. It is not meant to build websites ; its purpose is to write applications.

Weighing less than 15kb minified and gziped, it is meant as an alternative to React, Angular and the likes. Unlike several of them, it does *not* make use of any kind of virtual DOM. Instead, it provides the developper with an [`Observable`](#Observable) class and a few easy to use hooks on the node life cycle to react to their presence in the document. It also provides a [`Mixin`](#Mixin) class for those cases when writing extensible code is required.

It makes use of fairly modern standards, such as `Map`, `Set`, `Symbol` and `WeakMap`. While it will probably work with some versions of IE, support is limited to less than two year old versions of Safari (+ iOS), Firefox, Chrome (+ Android Browser) and Edge.

It is of course usable in plain javascript. Howeveer, its real intended audience is typescript users.

# Why use it

  * **You use typescript** and don't want a javascript library that use patterns that the typing system doesn't always gracefully support. Everything is Element was built with *type inference* in mind. The [`Observable`](#Observable) ecosystem tries hard to keep that valuable typing information without getting in your way and have you type everything by hand. It also tries to be as strict as possible, which is why the recommended way to enjoy this library is with `"strict": true` in your `tsconfig.json`.

  * **You like the Observer pattern** but you're afraid your app is going to leak as this pattern is prone to do. Element solves this elegantly by tying the observing to the presence of a Node in the DOM, removing the need to un-register observers that would otherwise leak. See [`node_observe`](#node_observe) and [`$observe()`](#$observe). Also, the Observables are **buffed** ; they can be transformed and combined, which makes for very fun data pipelines.

  * Virtual-DOM appears brilliant to you, but **you'd rather manipulate the DOM directly**. This is a philosophical point ; Virtual DOM is extremely efficient, probably more so than manipulating the document directly, but it also adds a layer of abstraction that is not always needed. In Element, all the `<jsx>code</jsx>` return DOM Elements that can be manipulated with vanilla javascript.

  * **You like expliciteness**. The Observables and Verbs are a clear giveaway of what parts of your application are subject to change. Also, every symbol you use should be reachable with the go-to definition of your code editor ; html string templates are just plain evil.

  * **You're tired of packages with dozens of dependencies**. Element has none. It uses plain, vanilla JS, and doesn't shy away from reimplementing simple algorithms instead of polluting your node_modules, all the while trying to provide enough batteries to not have to import dozens of packages to get work done.

# Getting started

## Installation

First, install elt in your project

```bash
npm install elt
# Alternatively
yarn add elt
```

In your `tsconfig.json`, you will need to add the following :

```json
  "strict": true, // not needed, but strongly advised
  "lib": ["es6", "dom"], // elt uses some es6 specific classes, and of course a lot of the DOM api
  "jsx": "react",
  "jsxNamespace": "E", // alternatively "jsxNamespace": "e", but you then have to import { e } from 'elt' in all your .tsx files.
```

You can also use `"jsxFactory": "E"` instead of `jsxNamespace`, but to use fragments, you have to `import { $Fragment } from 'elt'` and then use the `<$Fragment></$Fragment>` construct instead of `<></>`. You may of course rename it to something terser, such as `import { $Fragment as $ }` and `<$></$>`. The plus side of this approach is that typescript will only generate `E()` calls instead of `E.createElement()`, resulting in smaller, easier to read compiled code.

Last, to add a Node created with this library, you will need to use [`append_child_and_init`](#append_child_and_init) (or [`insert_before_and_init`](#insert_before_and_init)) instead of the regular `.appendChild()` or `.insertBefore()`, and [`node_remove`](#node_remove) instead of `.remove()` or `.removeChild()`, as the vanilla methods will not call the life cycle hooks elt provides (and thus not start or stop [`Observable`](#Observable)s). This should be the **only** deviation from using the dom.

## Using a module loader such as webpack or rollup, or <script type="module">

```tsx
import { o, $bind, append_child_and_init } from 'elt'

const o_says = o('hello world')

append_child_and_init(document.body, <div>
  <p><input>{$bind.string(o_says)}</input></p>
  <p>Element says {o_says} !</p>
</div>)
```

## Using it as a umd module

ELT supports being used as an umd module in a regular `<script>` import, in which case its global name is elt.

```tsx
const { o, $bind, append_child_and_init } = elt

// ... !
```

# About this documentation - `e()` vs `E()`

Throughout this documentation, a `demo_display()` function is used. All it does is just `append_child_and_init(document.body, ...whatever_was_provided)`. This is just to make examples a little more terse.

Also, the `E()` function is used almost exclusively over `e()`. They're the same, but ELT infects the global namespace to make it more convenient (only if `E` did not exist before, of course). This saves `import` statements and hopefully makes for a less cluttered documentation.

# ELT In a Nutshell ; the core concepts

All UI libraries basically do the same thing : display data and provide a way to modify it.

In Element, this is achieved by using the [`Observable`](#o.Observable) class, which is essentially a wrapper around an immutable object that informs [`Observer`](#o.Observer)s whenever the object changes.

All the library is built on this basis. Of course, Observables can do *much* more than just observing an object.

## Creating nodes

Use TSX (the typescript version of JSX) to build your interfaces. The result of a TSX expression is alwas a DOM `Node`.

```jsx
// You can write that.
import { append_child_and_init } from 'elt'
append_child_and_init(document.body, <div class='some-class'>Hello</div>)
```

### Creating nodes without tsx

Typescript's TSX is awesome. Unfortunately, as of today (version 3.8), its system still considers a TSX element as the type defined as the `JSX.Element` type, which is why as far as the type system is concerned, `var div = <div/>` will always have the type `Node`.

```tsx
// This is correct, as ELT will create an HTMLDivElement, but unfortunately, typescript won't allow it.
var div: HTMLDivElement = <div/>
// This works
var div = <div/> as HTMLDivElement
// But so does this, which is incorrect
var div = <input/> as HTMLDivElement // this should be HTMLInputElement
// when using the as keyword, Typescript allows a cast as a subtype without complaining.
```

It is possible to use `E()` (or `e()`) directly ; they use the correct types.

```tsx
var div = E('div') // div is infered as HTMLDivElement, hurray !
```

ELT provides a few helper functions to work without tsx without too much pain ;

```tsx
import { o, $bind } from 'elt'

var o_contents = o('')
demo_display(
  E.$DIV(
    E.$SPAN('span contents !'),
    E.$INPUT($bind.string(o_contents)),
    o_contents
  )
)
```

## Adding children

Nodes can of course have children. ELT defines a [`Renderable`](#Renderable) type which defines which types can safely rendered as a child to a node.

You may thus add variables of type :
 * `string`, which will be rendered as is
 * `number`, which will be converted using `.toString()`
 * `null` and `undefined`, which render nothing
 * `Node`, which will be added as-is
 * An array of all of them. Arrays may be nested ; ELT will traverse through them and flatten them when rendering.
 * Finally, an [`Observable`](#Observable) of all the previously mentionned types, which will then update the DOM whenever its value change.

This means that for any Observable that should be rendered into the dom, it first has to be converted to one of these types to appear.

```tsx
import { o } from 'elt'

// A small exemple which works
const o_txt = o('some text')
const o_date = o(new Date())
const date_format = new Intl.DateTimeFormat('fr')

demo_display(<div>
  <span>{o_txt}</span>
  {1234}
  {['hello', 'world', ['hows', 'it', 'going?']]}
  {null}

  {/* here, o_date is transformed (tf) to another observable that holds a string, which can then be rendered. */}
  <div>{o_date.tf(d => date_format.format(d))}</div>
</div>)
```

The non-jsx version works by adding children as arguments.

```tsx
import { o } from 'elt'
const o_txt = o('observable')
const o_date = o(new Date())
const date_format = new Intl.DateTimeFormat('fr')

demo_display(E.$DIV(
  E.$SPAN(o_txt),
  1234,
  ['hello', 'world', ['hows', 'it', 'going?']],
  null,
  E.$DIV(o_date.tf(d => date_format.format(d)))
))
```

## Dynamicity through Observables and Verbs

Verbs are simply functions whose name is a verb (hence the name), that usually start prefixed with `$`, to add a visual emphasis on their presence.
The fact they're verbs is to mean they represent dynamicity, things that change.

While they could have been implemented as Components, the choice was deliberately made to make them regular function calls to insist on the fact that they're not just some html component that will sit in the document once rendered.

They usually work in concert with Observables to control the presence of nodes in the document.

For instance, [`$If`](#$If) will render its then arm only if the given observable is truthy, and the else otherwise.

```tsx
import { o, $If, $click } from 'elt'

const o_some_obj = o({prop: 'value!'} as {prop: string} | null)

demo_display(<div>
  <h1>An $If example</h1>
  <div><button>
    {$click(() => {
      o_some_obj.mutate(v => !!v ? null : {prop: 'clicked'})
    })}
    Inverse
  </button></div>
  {$If(o_some_obj,
    // Here, o_truthy is of type Observable<{prop: string}>, without the null
    // We can thus safely take its property, which is a Renderable (string), through the .p() method.
    o_truthy => <div>We have a {o_truthy.p('prop')}</div>,
    () => <div>Value is null</div>
  )}
</div>)
```

[`$Repeat`](#$Repeat) repeats the contents of an array, with an optional separator.

```tsx
import { $Repeat, o, append_child_and_init } from 'elt'

const o_arr = o([{a: 'p'}, {a: 'q'}, {a: 'r'}])

append_child_and_init(document.body, <div>
  <h1>A $Repeat example</h1>
  {$Repeat(o_arr,
    // o_item is Observable<{a: string}>
    (o_item, idx) => <div>{idx}: {o_item.p('a')}</div>
  )}
</div>)

```

## Node Decorators

Decorators are a handy way of playing with a node without having to assign it to a variable first.

As the [`Renderable`](#Renderable) type controls what types can safely be appended to a node, the [`Insertable`](#Insertable) type controls what can be put as a child, without necessarily mean that it will have a visual representation.

Decorators are part of `Insertable`, and are simply functions that take the current node as an argument.

```tsx
demo_display(
  <div>
    <input>
      {inp => {
        // here, inp is of type HTMLInputElement
        inp.value = 'some value'
      }}
    </input>

    <div>
      This div is all uppercase
      {div => {
        div.style.textTransform = 'uppercase'
      }}
    </div>
  </div>
)
```

> **Note**: The above warning about <jsx></jsx> returning Node and having to be cast to their correct type does not affect the functionnality of decorators.
> Declaring a function in a child will work with the type inferer ;

Decorators may return any [`Insertable`](#Insertable), even if it is another decorator.

See the existing decorators to see what they can do.

# Observables

Observables are the mechanism through which we achieve MVVM. They are not RxJS's Observable (see `src/observable.ts`).

Basically, an `Observable` holds a value. You can retrieve it with `.get()` or modify it with `.set()`.

```jsx
const o_bool = o(true)
o_bool.get() // true
o_bool.set(false)
o_bool.get() // false
```

## Observable transformations

They can be transformed, and these transformations can be bidirectional.

```jsx
import { o, $click } from 'elt'

const o_obj = o({a: 1, b: 'hello'})
const o_a = o_obj.p('a') // o_a is a new Observable that watches the 'a' property. Its type is o.Observable<number>
o_a.set(3)

const o_tf = o_a.tf({get: val => val * 2, set: nval => nval / 2})
o_tf.get() // 6
o_tf.set(8) // o_a is now 4, and o_obj is {a: 4, b: '!!!'}

// A transform can also be unidirectionnal
const o_tf2 = o_a.tf(val => val * 3)
o_tf2.get() // 9
// But then, the resulting observable is read only !
o_tf2.set(3) // Compile error ! Runtime error too !

demo_display(<div>
  <div>
    o_obj is: <code>{o_obj.tf(value => JSON.stringify(value))}</code> and o_a is: <code>{o_a}</code>
    <button>{$click(() => o_a.set(3))}
      Set o_a
    </button>
    <button>
      {$click(() => o_obj.p('b').set('!!!'))}
      Set o_b
    </button>
  </div>

</div>)
```

The value in an observable is **immutable**. Whenever a modifying method is called, the object inside it is cloned.

```jsx
import { o } from 'elt'

const o_obj = o({a: 1, b: 'b'})
const prev = o_obj.get()
o_obj.p('b').set('something else')

demo_display(prev === o_obj.get() ? 'true' : 'false') // true
```

They can do a **lot** more than these very simple transformations. Check the Observable documentation.

## Observable combination

Two or more observables can be joined together to make a new observable that will update when any of its constituents change. See [`o.combine`](#o.combine), [`o.join`](#o.join) and [`o.merge`](#o.merge).

A notable case is the `.p()` method on Observable, which creates a new Observable based on the property of another ; the property itself can be an Observable. If the base object or the property change, the resulting observable is updated.

```tsx
import { o, $Fragment } from 'elt'

type SomeType = {a: string, b: number}
const o_obj = o({a: 'string !', b: 2} as SomeType)
const o_key = o('a' as keyof SomeType)
const o_prop = o_obj.p(o_key)

o_key.set('b') // o_prop now has 2 as a value
 // o_prop now has 3

demo_display(<$Fragment>
  <div>o_obj: {o_obj.tf(v => JSON.stringify(v))}</div>
  <div>o_prop: {o_prop}</div>
  <div>
    <DemoBtn do={() => o_key.set('a')}/>
    <DemoBtn do={() => o_key.set('b')}/>
    <DemoBtn do={() => o_obj.set({a: 'world', b: 3})}/>
  </div>
</$Fragment>)
```

## Attributes

All attributes on `HTMLElement` can have observables passed as value, in which case the attribute is updated as the observable changes.
If the observable is boolean, then the value of the attribute will be `''`.

```tsx
<div contenteditable={o_boolean}/>
```

## Classes and Styles

`class` and `style` on elements can receive `Observable` as well as regular values.

`class` can be a `o.RO<string>` or an object of class definitions, where the properties are the class name and their values the potentially observable condition that will determine if the class is attributed. On top of that, class can receive an array of the two former to build complex classes.

```jsx
const o_class = o('class2')
const o_bool = o(true)
<Elt class={['class1', o_class, {class3: o_bool}]}/>
// -> <div class='class1 class2 class3'/>

// ... some later code runs the following :
o_bool.set(false)
// -> <div class='class1 class2'/>
o_class.set('another-class')
// -> <div class='class1 another-class'>
```

The `style` attribute does not accept text. Since it is considered good practice to not use this attribute, only its object form is supported for those cases where you can't do without.

```jsx
const o_width = o('432px')
<Elt style={ {width: o_width} }>
```

## Mixins

A [`Mixin`](#Mixin) is an object that is tied to a node. Just like decorators, they are part of the [`Insertable`](#Insertable) type, which means that the way to add them to a `Node` is simply to put them somewhere in their children.

They serve as the basis for the `Component` class below, and have a few convenient methods, such as `.observe()` and `.listen()`, and have a way of defining `init()`, `inserted()`, `deinit()` and `removed()` that work like their decorator counterparts.

Aside from creating components with the `Component` class, their utility resides in the fact they allow a developper to write extensible classes and to encapsulate code neatly when the component has a complex and lengthy implementation.

```jsx
// This mixin can be added on just any node.
class MyMixin extends Mixin<Node> {
  inserted(node: Node) {
    console.log(`I was inserted on`, parent)
  }

  removed(node: Node, parent: Node) {
    console.log(`I was removed from the document`)
    console.log(`My parent was`, parent)
  }
}

document.body.appendChild(<div>{new MyMixin()}</div>)
```

# Components

Use components when you want to reuse dom structures without hassle.

There are two ways of building components ; as a simple function or as a class.

## Component Functions

A component function takes two arguments and return a Node.

The first argument is always an [`Attrs`](#Attrs) type, with the returned node type as a template argument. The second argument is always [`Renderable[]](#Renderable) and are the children that are to be added to this component.

The `attrs` argument represents what attributes can be set on the component. In simple cases, it is enough to give the arguments with the `&` operator.

```tsx
function MyComponent(attrs: Attrs<HTMLDivElement> & {title: string}, children: Renderable[]) {
  return <div>
      <h1>{attrs.title}</h1>
      {/* children will be inserted in the body div. */}
      <div class='body'>{children}</div>
    </div> as HTMLDivElement
}

<MyComponent title='Some title'>
  Content <span>that will be</span> appended.
</MyComponent>
```

If the attributes are complex, then it is advisable to define an interface.

```tsx
interface MyComponentAttrs extends Attrs<HTMLDivElement> {
  title: string
  more_content?: Renderable
}

function MyComponent(attrs: MyComponentAttrs, children: Renderable[]) {
  /// ...
}
```

## Component class

A component is a subclass of `Mixin`. A custom Component must define a `.render()` method that returns the node type specified in its `Attrs` type and takes renderables as its only argument.

By default, the attributes are accessible as `this.attrs` in the component methods.

```tsx
class MyComponent extends Component<Attrs<HTMLDivElement> & {title: string}> {

  render(children: Renderable[]) {
    return E.$DIV(
      E.$H1(this.attrs.title),
      E.$DIV($class('body'), children)
    )
  }

}
```

## Components and `class`, `style` and `id`

Since these three attributes are ubiquitous on just any element type, they are handled separately.

They're still passed along the `attrs` objects given to the components, but they don't have to be handled. They're applied automatically to the root node returned by the component.

```tsx
const o_cls = o('some_class')

// this is valid and works on any component
<MyComponent class={o_cls} id='some-id' style={{width: '350px'}}/>

```

## Components and other Mixins or Decorators

Decorators and Mixins can be added to components ; the node they act upon is always the root node returned by the component, as is specified in their `Attrs` definition.

```tsx
<MyComponent>
  {$click(ev => {
    console.log('the component was clicked on !')
  })}
  {$class('another_class', o_observable_classname)}
</MyComponent>
```

