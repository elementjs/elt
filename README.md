# What is Element


Element is a [typescript](https://typescriptlang.org) library for building user interfaces in a web environment. It is not meant to build websites ; its purpose is to write applications.

Weighing less than 15kb minified and gziped, it is meant as an alternative to React, Angular and the likes. Unlike several of them, it does *not* make use of any kind of virtual DOM. Instead, it provides the developper with an `Observable` class and a `Mixin` system to manipulate the DOM directly.

It makes use of fairly modern standards, such as `Map`, `Set`, `Symbol` and `WeakMap`. While it will probably work with some versions of IE, support is limited to less than two year old versions of Safari (+ iOS), Firefox, Chrome (+ Android Browser) and Edge.

While it is of course usable in plain javascript, its real intended audience is typescript users.

# Why use it

  * **You use typescript** and don't want a javascript library that use patterns that the typing system doesn't always gracefully support. Everything is Element was built with *type inference* in mind. The `Observable` ecosystem tries hard to keep that valuable typing information without getting in your way.

  * **You like the Observer pattern** but you're afraid your app is going to leak as this pattern is prone to. Element solves this elegantly by tying the observing to the presence of a Node in the DOM, removing the need to un-register observers that would otherwise leak. See [`ObserverHolder`](#o.ObserverHolder), [`observe()`](#observe), [`App.Block`](#App.Block) and [`Mixin`](#Mixin).

  * Virtual-DOM appears brilliant to you, but **you'd rather manipulate the DOM directly**. This is a philosophical point ; Virtual DOM is extremely efficient, probably more so than manipulating the document directly, but it also adds a layer of abstraction that is not always needed. In Element, all the `<jsx>code</jsx>` returns DOM Elements, or at least Nodes that can be manipulated with "vanilla" javascript.

  * **You like expliciteness**. Element was thought up to be as explicit as possible. The Observables and Verbs are a clear giveaway of what parts of your application are subject to change. Every symbol you use should be reachable with the go-to definition of your code editor.

  * **You're tired of packages with dozens of dependencies**. Element has none. It uses plain, vanilla JS, and doesn't shy away from reimplementing simple algorithm instead of polluting your node_modules.

# Getting started

First, install elt in your

# In a Nutshell

All UI libraries basically do the same thing : display data and provide a way to modify it.

In Element, this is achieved by using the [`Observable`](#o.Observable) class, which is essentially a wrapper around an immutable object that informs [`Observer`](#o.Observer)s whenever the object changes.

[`Mixin`](#Mixin)s are objects meant to be associated to a `Node` which allow us to :
- run code whenever the associated `Node` is created, added to the DOM or removed from the DOM
- observe Observables, but **only** while the Node is inside the `document`.

All the library is built on this basis. Of course, Observables can do *much* more than just observing an object and Mixins provide more functionnality.

## It is meant to be used with TSX

Use TSX (the typescript version of JSX) to build your interfaces. The result of a TSX expression is (almost) always a DOM `Element` -- it is at least a `Node`.

```jsx
// You can write that.
append_child_and_mount(document.body, <div class='some-class'>Hello</div>)
```

For convenience, the `class`, `style` and `id` attributes (plus some other global HTML attributes, see the [`Attrs`](#e.JSX.Attrs) interface) do not need to be forwarded in your components definitions.

```tsx
import { Attrs } from 'elt'
function MyComponent(a: Attrs, )
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

const o_tf = o_a.tf(val => val * 2, (nval, oval, obs) => obs.set(nval / 2))
o_tf.get() // 6
o_tf.set(8) // o_a is now 4, and o_obj is {a: 4, b: '!!!}
```

The value in an observable is **immutable**. Whenever a modifying method is called, the object inside it is cloned.

```jsx
const prev = o_obj.get()
o_obj.p('b').set('something else')

prev !== o_obj.get() // true
```

They can do a **lot** more than these very simple transformations. Check the Observable documentation page.

## Mixins

A `Mixin` is an object that is tied to a node. You can use the `$$` attribute to bind one to the node.

They offer the convenient `observe()` method, which ties the observing of an `Observable` to the presence of the node inside the `document`. They are warned whenever the node is inserted or removed from the `document`

```jsx
class MyMixin extends Mixin {
  inserted(node: Node, parent: Node) {
    console.log(`I was inserted on`, parent)
  }

  removed(node: Node, parent: Node, prev: Node | null, next: Node | null) {
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
```

## Verbs

"Verbs" are functions that return `Comment` nodes. They indicate dynamicity in your interface. The most commonly used are `DisplayIf` and `Repeat`.

`DisplayIf` is used to conditionnally display content.

```jsx
import {o} from 'elt'
import {Button} from 'elt-material'

const o_bool = o(false)
document.body.appendChild(<div>
  <Button click={e => o_bool.toggle()}/>
  {DisplayIf(o_bool,
    () => <span>My value is true</span>,
    () => <span>My value is false</span>
  )}
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

`class` and `style` can receive `Observable` as well as regular values. `class` can also be an array with `MaybeObservable<string>` or with an object of class definitions.

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


# Getting Started

Add the following to your `tsconfig.json` :

```javascript
{
  // ...
  "jsx": "react",
  "jsxFactory": "E",
  // Those can come in handy
  "lib": ["es6", "dom"]
}
```

This should do it, now you can just ...

```typescript
import {/* ... */} from 'elt'
```

... and start coding !

# Examples

You can fork this TodoMVC example to see more of it in action.
