# What is ELT

ELT is a [typescript](https://typescriptlang.org) library for building user interfaces in a web environment. It is not meant to build websites ; its purpose is to write applications.

Weighing less than 15kb minified and gziped, it is meant as an alternative to React, Angular and the likes. Unlike several of them, it does *not* make use of any kind of virtual DOM. Instead, it provides the developper with an [`Observable`](#o.Observable) class and a few easy to use hooks on the node life cycle to react to their presence in the document. It also provides a [`Mixin`](#Mixin) class for those cases when writing extensible code is required.

It makes use of fairly modern standards, such as `Map`, `Set`, `Symbol` and `WeakMap`. As such, it probably won't run on IE without using polyfills. In general, support is limited to less than two years old browser versions.

While it is of course usable with plain javascript, its real intended audience is [Typescript](https://www.typescriptlang.org/) users.

It is built with three objectives in mind :
 * Writing and reading code using it **must** be pleasant
 * All overheads induced by its use **should** be kept as low as possible
 * Everything **must** be typed correctly. This library **must** be refactoring-friendly.

Join the [discord](https://discord.gg/A8tKA7q) for questions or use the tags `#typescript` and `#elt` on stack overflow, go to the [repository](https://github.com/elementjs/elt) to file issues.

## Why use it

  * **You use typescript** and don't want a javascript library that use patterns that the typing system doesn't always gracefully support. Everything is Element was built with *type inference* in mind. The [`Observable`](#o.Observable) ecosystem tries hard to keep that valuable typing information without getting in your way and have you type everything by hand.

  * **You are strict about typing** and do not like to cheat with `any`. The recommended way to enjoy this library is with `"strict": true` in your `tsconfig.json`.

  * **You like the Observer pattern** but you're afraid your app is going to leak as this pattern is prone to do. Element solves this elegantly by tying the observing to the presence of a Node in the DOM, removing the need to un-register observers that would otherwise leak. See [`node_observe`](#node_observe) and [`$observe()`](#$observe). Also, the [`Observables`](#o.Observable) are **buffed** ; they can be transformed and combined, which makes for very fun data pipelines.

  * **You like to manipulate the DOM directly**. In ELT, all the `<jsx>code</jsx>` return DOM Elements that can be manipulated with vanilla javascript. In general, the library makes use of standards and tries as much as possible not to deviate from them.

  * **You like expliciteness**. The "moving parts" of your application should be identifiable just by scanning the source code visually ; the Observables and Verbs are a clear giveaway of what parts of your application are subject to change. Also, every symbol you use should be reachable with the go-to definition of your code editor ; html string templates are just plain evil.

  * **You're tired of packages with dozens of dependencies**. Element has none. It uses plain, vanilla JS, and doesn't shy away from reimplementing simple algorithms instead of polluting your node_modules, all the while trying to provide enough batteries to not have to import dozens of packages to get work done.

## In a Nutshell

ELT offers the following concepts to get this done :

 * For binding data to the document in an MVVM manner, there is an [`Observable`](#o.Observable) class, which is essentially a wrapper around an immutable object that informs [`Observer`](#o.Observer)s whenever its value is changed. Observables can also be combined together or transformed to get new observables whose value change whenever their base Observable change.

 * Since observing an observable makes them keeps a reference to their observers in the memory, observers have to be deregistered properly when they're not used anymore. To alleviate the burden on the programmer and avoid forgetting to stop the observers -- and thus create memory leaks, ELT associates observing with nodes and whether they're in the document or not. See [`$observe()`](#$observe), [`node_observe()`](#node_observe) and [`Mixin.observe()`](#Mixin.observe).

 * Since the DOM does not offer a simple way to know *when* a node is added or removed from the document other than using a `MutationObserver`, ELT offers a way to react to these events by setting up the observer itself and registering callbacks directly on the `Node`s. See [`$inserted()`](#$inserted), [`$removed()`](#$removed), but also [`$init()`](#$init).

 * Instead of creating components that change what they render based on the values of Observables, such as an hypothetical `<If condition={...}>`, ELT uses "verbs" ; functions whose name starts with an **upper-case** letter. While a component-based approach would work perfectly, the "verb" approach is more explicit about where dynamicity is happening in the code. See [`If()`](#If), [`Repeat`](#Repeat), [`RepeatScroll`](#RepeatScroll) and [`Switch`](#Switch).

 * To avoid declaring a boatload of variables to modify nodes that are being created, ELT defines ["decorators"](#Decorator) which are callback functions that can be added as children of a node. See all the `$` prefixed functions followed by a **lower-case** letter. Their naming scheme was thought to differenciate them from function calls that actually *create* Nodes.

 * While most of the time it is simpler to use Function components and bind on `Node`s directly with decorators, it is sometimes preferable to adopt an object oriented approach. For those cases, there is the [`Mixin`](#Mixin) class, or even the [`Component`](#Component) class.

 * At last, ELT offers a simple way to build applications with the [`App`](#App) class and friends. While it is not mandatory to use it to get things done, it's small enough to not add much weight to the library, and convenient enough to build complex applications to justify its inclusion in the core library and not become "yet another package".


# Getting started

## About this documentation

All the examples should be runnable, testable and modifiable.

The documentation is set up to use the `E()` version of `e()`. They're the same, but ELT infects the global namespace and adds `E()` on `window` to make it more convenient (only if `E` did not exist before, of course). This saves `import` statements and hopefully makes for a less cluttered documentation.

Also, [`setup_mutation_observer`](#setup_setup_mutation_observer) is called automatically in the examples to reduce verbosity.


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
  "jsxNamespace": "E", // alternatively "jsxNamespace": "e", but you then have to
     // `import { e } from 'elt'` in all your .tsx files.
```

> **Note**: You can also use `"jsxFactory": "E"` instead of `jsxNamespace`, but to use fragments, you have to `import { Fragment } from 'elt'` and then use the `<Fragment></Fragment>` construct instead of `<></>`. You may of course rename it to something terser, such as `import { Fragment as $ }` and `<$></$>`. The plus side of this approach is that typescript will only generate `E()` calls instead of `E.createElement()`, resulting in smaller, easier to read compiled code.

At last, you need to setup the [`MutationObserver`](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver) which will call the life-cycle callbacks used extensively by elt. This has to be done only once *per document*, see [`setup_mutation_observer`](#setup_mutation_observer)

```jsx
import { setup_mutation_observer } from 'elt'
setup_mutation_observer(document)
// you
```

## Using it with a module loader

You can use the library through import statements. It is perfectly fine to use with webpack, rollup or parcel, although as of now no effort was put to make elt (tree-shakable)[https://webpack.js.org/guides/tree-shaking/].

```tsx
import { o, $bind, setup_mutation_observer } from 'elt'

setup_mutation_observer(document)

const o_says = o('hello world')

document.body.appendChild(<div>
  <p><input>{$bind.string(o_says)}</input></p>
  <p>Element says {o_says} !</p>
</div>)
```

## Using it as an umd module

ELT supports being used as an umd module in a regular `<script>` import, in which case its global name is elt.

```jsx
const { o, $bind, setup_mutation_observer } = elt
setup_mutation_observer(document)
// ... profit !
```

# Elt primer

## Creating nodes

### Using TSX

Use TSX (the typescript version of JSX) to build your interfaces. The result of a TSX expression is alwas a DOM `Node`.
This means that the result of a tsx expression (or a `e()` call) is directly insertable into the document.

```jsx
// You can write that.
import { setup_mutation_observer } from 'elt'
setup_mutation_observer(document)
document.body.appendChild(<div class='some-class'>Hello</div>)
```

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

### Creating nodes without tsx


It is possible to use `E()` (or `e()`) directly ; they use the correct types. The `e` function is made to be a target for tsx code generation, but its signature is a tad more flexible. Check its documentation for more informations.

```tsx
var div = E('div') // div is infered as HTMLDivElement, hurray !
var div2 = E('div', {class: 'my-class'}, 'Some text content')
```

ELT provides a few helper functions to work without tsx without too much pain ;

```tsx
import { o, $bind } from 'elt'

var o_contents = o('')
document.body.appendChild(
  E.DIV(
    E.SPAN('span contents !'),
    E.INPUT($bind.string(o_contents)),
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
 * Finally, an [`Observable`](#o.Observable) of all the previously mentionned types, which will then update the DOM whenever its value change.

This means that for any Observable that should be rendered into the dom, it first has to be converted to one of these types to appear.

```tsx
import { o } from 'elt'

// A small exemple which works
const o_txt = o('some text')
const o_date = o(new Date())
const date_format = new Intl.DateTimeFormat('fr')

document.body.appendChild(<div>
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

document.body.appendChild(E.DIV(
  E.SPAN(o_txt),
  1234,
  ['hello', 'world', ['hows', 'it', 'going?']],
  null,
  E.DIV(o_date.tf(d => date_format.format(d)))
))
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

```tsx
import { o } from 'elt'
const o_class = o('class2')
const o_bool = o(true)
<div class={['class1', o_class, {class3: o_bool}]}/>
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



## Dynamicity through Observables and Verbs

Verbs are simply functions whose name is a verb (hence the name), that usually start with an uppercase letter to add a visual emphasis on their presence.
The reason they're named "verbs" is to emphasise the fact they represent dynamicity, things that change.

While they could have been implemented as Components, the choice was deliberately made to make them regular function calls to insist on the fact that they're not just some html component that will sit in the document once rendered.

They usually work in concert with Observables to control the presence of nodes in the document.

For instance, [`If`](#If) will render its then arm only if the given observable is truthy, and the else otherwise.

[`Repeat`](#Repeat) repeats the contents of an array, with an optional separator. [`RepeatScroll`](#RepeatScroll) does the same, but stops rendering elements once they overflow past the bottom of the [`$scrollable`](#$scrollable) block they're in.

## Node Decorators

Decorators are a handy way of playing with a node without having to assign it to a variable first.

As the [`Renderable`](#Renderable) type controls what types can safely be appended to a node, the [`Insertable`](#Insertable) type controls what can be put as a child, without necessarily mean that it will have a visual representation.

Decorators are part of [`Insertable`](#Insertable), and are simply functions that take the current node as an argument.

```tsx
document.body.appendChild(
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

## Observables

Observables are the mechanism through which we achieve MVVM. They are not RxJS's Observable (see `src/observable.ts`).

Basically, an `Observable` holds a value. You can retrieve it with `.get()` or modify it with `.set()`.

```tsx
import { o } from 'elt'

const o_bool = o(true)
o_bool.get() // true
o_bool.set(false)
o_bool.get() // false
```

### Transformations

They can be transformed, and these transformations can be bidirectional.

```tsx
import { o, $click } from 'elt'

const o_obj = o({a: 1, b: 'hello'})
const o_a = o_obj.p('a') // o_a is a new Observable that watches the 'a' property. Its type is o.Observable<number>
o_a.set(3)

const o_tf = o_a.tf({transform: val => val * 2, revert: (nval: number) => nval / 2})
o_tf.get() // 6
o_tf.set(8) // o_a is now 4, and o_obj is {a: 4, b: '!!!'}

// A transform can also be unidirectionnal
const o_tf2 = o_a.tf(val => val * 3)
o_tf2.get() // 9
// But then, the resulting observable is read only !
o_tf2.set(3) // Compile error ! Runtime error too !

document.body.appendChild(<div>
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

```tsx
import { o } from 'elt'

const o_obj = o({a: 1, b: 'b'})
const prev = o_obj.get()
o_obj.p('b').set('something else')

document.body.appendChild(<span>{prev === o_obj.get() ? 'true' : 'false'}</span>)
```

They can do a **lot** more than these very simple transformations. Check the Observable documentation.

### Combining

Two or more observables can be joined together to make a new observable that will update when any of its constituents change. See [`o.combine`](#o.combine), [`o.join`](#o.join) and [`o.merge`](#o.merge).

A notable case is the `.p()` method on Observable, which creates a new Observable based on the property of another ; the property itself can be an Observable. If the base object or the property change, the resulting observable is updated.

```tsx
import { o, Fragment } from 'elt'

type SomeType = {a: string, b: number}
const o_obj = o({a: 'string !', b: 2} as SomeType)
const o_key = o('a' as keyof SomeType)
const o_prop = o_obj.p(o_key)

o_key.set('b') // o_prop now has 2 as a value
 // o_prop now has 3

document.body.appendChild(<Fragment>
  <div>o_obj: {o_obj.tf(v => JSON.stringify(v))}</div>
  <div>o_prop: {o_prop}</div>
  <div>
    <DemoBtn do={() => o_key.set('a')}/>
    <DemoBtn do={() => o_key.set('b')}/>
    <DemoBtn do={() => o_obj.set({a: 'world', b: 3})}/>
  </div>
</Fragment>)
```


## Mixins

A [`Mixin`](#Mixin) is an object that is tied to a node. Just like decorators, they are part of the [`Insertable`](#Insertable) type, which means that the way to add them to a `Node` is simply to put them somewhere in their children.

They serve as the basis for the `Component` class below, and have a few convenient methods, such as `.observe()` and `.listen()`, and have a way of defining `init()`, `inserted()` and `removed()` that work like their decorator counterparts.

Aside from creating components with the `Component` class, their utility resides in the fact they allow a developper to write extensible classes and to encapsulate code neatly when the component has a complex and lengthy implementation.

```tsx
import { Mixin } from 'elt'

// This mixin can be added on just any node.
class MyMixin<N extends Node> extends Mixin<N> {
  inserted(node: N) {
    console.log(`I was inserted on`, parent)
  }

  removed(node: N, parent: Node) {
    console.log(`I was removed from the document`)
    console.log(`My parent was`, parent)
  }
}

document.body.appendChild(<div>{new MyMixin()}</div>)
```

## Components

Use components when you want to reuse dom structures without hassle.

There are two ways of building components ; as a simple function or as a class.

### Component Functions

A component function takes two arguments and return a Node.

The first argument is always an [`Attrs`](#Attrs) type, with the returned node type as a template argument. The second argument is always [`Renderable[]](#Renderable) and are the children that are to be added to this component.

The `attrs` argument represents what attributes can be set on the component. In simple cases, it is enough to give the arguments with the `&` operator.

```tsx
import { Attrs, Renderable } from 'elt'

function MyComponent(attrs: Attrs<HTMLDivElement> & {title: string}, children: Renderable[]) {
  return <div>
      <h1>{attrs.title}</h1>
      {/* children will be inserted in the body div. */}
      <div class='body'>{children}</div>
    </div> as HTMLDivElement
}

document.body.appendChild(<MyComponent title='Some title'>
  Content <span>that will be</span> appended.
</MyComponent>)
```

If the attributes are complex, then it is advisable to define an interface.

```tsx
import { Attrs } from 'elt'

interface MyComponentAttrs extends Attrs<HTMLDivElement> {
  title: string
  more_content?: Renderable
}

function MyComponent(attrs: MyComponentAttrs, children: Renderable[]) {
  /// ...
}
```

### Component class

A component is a subclass of `Mixin`. A custom Component must define a `.render()` method that returns the node type specified in its `Attrs` type and takes renderables as its only argument.

By default, the attributes are accessible as `this.attrs` in the component methods.

```tsx
class MyComponent extends Component<Attrs<HTMLDivElement> & {title: string}> {

  render(children: Renderable[]) {
    return E.DIV(
      E.H1(this.attrs.title),
      E.DIV($class('body'), children)
    )
  }

}
```

### `class`, `style` and `id`

Since these three attributes are ubiquitous on just any element type, they are handled separately.

They're still passed along the `attrs` objects given to the components, but they don't have to be handled. They're applied automatically to the root node returned by the component.

```tsx
const o_cls = o('some_class')

// this is valid and works on any component
<MyComponent class={o_cls} id='some-id' style={{width: '350px'}}/>

```

### Components and other Mixins or Decorators

Decorators and Mixins can be added to components ; the node they act upon is always the root node returned by the component, as is specified in their `Attrs` definition.

```tsx
<MyComponent>
  {$click(ev => {
    console.log('the component was clicked on !')
  })}
  {$class('another_class', o_observable_classname)}
</MyComponent>
```

