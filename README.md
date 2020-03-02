# What is ELT

ELT is a [typescript](https://typescriptlang.org) library for building user interfaces in a web environment. It is not meant to build websites ; its purpose is to write applications.

Weighing less than 15kb minified and gziped, it is meant as an alternative to React, Angular and the likes. Unlike several of them, it does *not* make use of any kind of virtual DOM. Instead, it provides the developper with an `#Observable` class and a few easy to use hooks on the node life cycle to react to their presence in the document. It also provides a `#Mixin` class for those cases when writing extensible code is required.

It makes use of fairly modern standards, such as `Map`, `Set`, `Symbol` and `WeakMap`. While it will probably work with some versions of IE, support is limited to less than two year old versions of Safari (+ iOS), Firefox, Chrome (+ Android Browser) and Edge.

It is of course usable in plain javascript. Howeveer, its real intended audience is typescript users.

# Why use it

  * **You use typescript** and don't want a javascript library that use patterns that the typing system doesn't always gracefully support. Everything is Element was built with *type inference* in mind. The `#Observable` ecosystem tries hard to keep that valuable typing information without getting in your way and have you type everything by hand. It also tries to be as strict as possible, which is why the recommended way to enjoy this library is with `"strict": true` in your `tsconfig.json`.

  * **You like the Observer pattern** but you're afraid your app is going to leak as this pattern is prone to do. Element solves this elegantly by tying the observing to the presence of a Node in the DOM, removing the need to un-register observers that would otherwise leak. See [`node_observe`](#node_observe) and [`$observe()`](#$observe).

  * Virtual-DOM appears brilliant to you, but **you'd rather manipulate the DOM directly**. This is a philosophical point ; Virtual DOM is extremely efficient, probably more so than manipulating the document directly, but it also adds a layer of abstraction that is not always needed. In Element, all the `<jsx>code</jsx>` return DOM Elements that can be manipulated with vanillay javascript.

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

Last, to add a Node created with this library, you will need to use [`append_child_and_init`](#append_child_and_init) (or [`insert_before_and_init`](#insert_before_and_init)) instead of the regular `.appendChild()` or `.insertBefore()`, and `#node_remove` instead of `.remove()` or `.removeChild()`, as the vanilla methods will not call the life cycle hooks elt provides (and thus not start or stop `#Observable`s). This should be the **only** deviation from using the dom.

## Using a module loader such as webpack or rollup, or <script type="module">

```tsx
import { o, $bind, append_child_and_init } from 'elt'

const o_says = o('hello world')

append_child_and_init(document.body, <div>
  <p><input>{$bind(o_says)}</input></p>
  <p>Element says {o_says} !</p>
</div>)
```

## Using it as a umd module

ELT supports being used as an umd module in a regular `<script>` import, in which case its global name is elt.

```tsx
const { o, $bind, append_child_and_init } = elt

// ... !
```

# ELT In a Nutshell ; the core concepts

All UI libraries basically do the same thing : display data and provide a way to modify it.

In Element, this is achieved by using the [`Observable`](#o.Observable) class, which is essentially a wrapper around an immutable object that informs [`Observer`](#o.Observer)s whenever the object changes.

All the library is built on this basis. Of course, Observables can do *much* more than just observing an object.

## Creating nodes

Use TSX (the typescript version of JSX) to build your interfaces. The result of a TSX expression is alwas a DOM `Node`.

```jsx
// You can write that.
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
var div = <input/> as HTMLDivElement // this should be HTMLInputElement.
```

It is possible to use `E()` (or `e()`) directly ; they use the correct types.

```tsx
var div = e('div') // div is infered as HTMLDivElement, hurray !
```

ELT provides a few helper functions to work without tsx without too much pain ;

```tsx
var o_contents = o(')
var root = E.$DIV(
  E.$SPAN('span contents !'),
  E.$INPUT($bind(o_contents)),
  o_contents
)
```

## It has an Observable class

Observables are the mechanism through which we achieve MVVM. They are not RxJS's Observable (see `src/observable.ts`).

Basically, an `Observable` holds a value. You can retrieve it with `.get()` or modify it with `.set()`.

```jsx
const o_bool = o(true)
o_bool.get() // true
o_bool.set(false)
o_bool.get() // false
```

They can be transformed, and these transformations can be bidirectional.

```jsx
const o_obj = o({a: 1, b: 'hello'})
const o_a = o_obj.p('a') // o_a is a new Observable that watches the 'a' property. Its type is o.Observable<number>
o_a.set(3)
o_obj.p('b').set('!!!')
o_obj.get() // is now {a: 3, b: '!!!'}

const o_tf = o_a.tf({get: val => val * 2, set: nval => nval / 2})
o_tf.get() // 6
o_tf.set(8) // o_a is now 4, and o_obj is {a: 4, b: '!!!'}

// A transform can also be unidirectionnal
const o_tf2 = o_a.tf(val => val * 3)
o_tf2.get() // 9
// But then, the resulting observable is read only !
o_tf2.set(3) // Compile error ! Runtime error too !
```

The value in an observable is **immutable**. Whenever a modifying method is called, the object inside it is cloned.

```jsx
const prev = o_obj.get()
o_obj.p('b').set('something else')

prev !== o_obj.get() // true
```

They can do a **lot** more than these very simple transformations. Check the Observable documentation.

## Mixins

A `Mixin` is an object that is tied to a node. You can use the `$$` attribute to manually bind one to the node.

They offer the convenient `observe()` method, which ties the observing of an `Observable` to the presence of the node inside the `document`. They are warned whenever the node is inserted or removed from the `document`

```jsx
class MyMixin extends Mixin {
  inserted(node: Node,) {
    console.log(`I was inserted on`, parent)
  }

  removed(node: Node, parent: Node) {
    console.log(`I was removed from the document`)
    console.log(`My parent was`, parent)
  }
}

document.body.appendChild(<div $$={new MyMixin()}/>)
```

There are some useful functions that return mixins, such as `observe()`

```jsx
o_arr = o([1, 2, 3])

// the contents of o_arr will be logged as long as this div is inside the document.
document.body.appendChild(<div $$={observe(o_arr, value => console.log(value))}/>)
o_arr.set([4, 5, 6])
```

## Verbs

"Verbs" are functions that return `Comment` nodes. They indicate dynamicity in your interface. The most commonly used are `If` and `Repeat`.

`If` is used to conditionnally display content, where the condition can be an observable or not.

```jsx
import {o} from 'elt'
import {Button} from 'elt-material'

const o_object = o({a: 1} as null | {a: number})
document.body.appendChild(<div>
  <Button click={e => o_bool.toggle()}/>
  {If(o_object,
    // here, o_obj is Observable<{a: number}>
    o_obj => <span>a has: {o_obj.p('a')}</span>,
  // I cannot do o_object.p('a'), as it will complain about the null part.
  ).Else(() => <span>There is no value</span>)}
</div>)
```

`Repeat` is used to display elements of an array. Its callback gives an `Observable` which is the current item, and the number index.

```jsx
o_arr = o([1, 2, 3])
document.body.appendChild(<div>
  {Repeat(o_arr, (o_item, idx) =>
    // Here we suppose there is an Input component expecting
    // a model property. o_item can be set, even though it is in a repeat.
    <Input model={o_item} label={`Item #${idx}`}/>
  )}
</div>)
```

You can use `RepeatScroll` with `scrollable()` if you want to display a list but only render those that are in view and wait for the user to scroll before revealing the rest.

```jsx
// We need the div to be scrollable(), as RepeatScroll needs a scrollable parent.
document.body.appendChild(<div $$={scrollable()}>
  {RepeatScroll(o_my_long_array, o_item => <div>
    ... do something with o_item.
  </div>)}
</div>)
```

## Classes and Styles

You do not need to forward the `class`, `style` or `id` attribute. Generally speaking, the process of forwarding props generically to subcomponents with `<Comp ...{props}>` is not needed.

```jsx
function Elt() {
  return <div class='hello'/>
}

<Elt class='world'/>
// -> <div class='hello word'/>
```

`class` and `style` can receive `Observable` as well as regular values. `class` can also be an array with `RO<string>` or with an object of class definitions.

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
<Elt style={ {width: o_width} }>
```
