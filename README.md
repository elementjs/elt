# What is Element


Element is a [typescript](https://typescriptlang.org) library for building user interfaces in a web environment. It is not meant to build websites ; its purpose is to write applications.

Weighing less than 10kb minified and gziped, it is meant as an alternative to React, Angular and the likes. Unlike many, it does **not** make use of any kind of virtual DOM. It is however pretty "reactive" and has an MVVM approach.

It makes use of fairly modern standards, such as `Map`, `Symbol` and `MutationObserver`. While it will probably work with some versions of IE, support is limited to Safari (+ iOS), Firefox, Chrome (+ Android Browser) and Edge.

# Why use it

  * **You use typescript** and don't want a javascript library that use patterns that the typing system doesn't always gracefully support. Everything is Element was built with type inference in mind. The `Observable` ecosystem tries hard to keep that valuable typing information without getting in your way.

  * **You like the Observer pattern** but you're afraid your app is going to leak. The `observe()` decorator and `Mixin#observe()` method provide a simple way of ensuring this won't happen.

  * Virtual-DOM appears brilliant to you, but you'd rather **manipulate the DOM directly**. This is a philosophical point ; Virtual DOM is extremely efficient, probably more so than manipulating the document directly, but it also adds a layer of abstraction that is not always needed.

  * **You like expliciteness**. Element was thought up to be as explicit as possible. The Observables and Verbs are a clear giveaway of what parts of your application are subject to change.

  * **You like immutability** and its benefits. Values held by Observables are immutable. All the "mutating" methods of the Observable class actually clone the underlying object before modifying it, maintaining its type and prototype chain.

# In a Nutshell

## It is meant to be used with TSX

Use TSX (the typescript version of JSX) to build your interfaces. The result of a TSX expression is always an `Element`.

```jsx
// You can write that.
document.body.appendChild(<div class='some-class'>Hello</div>)
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

They were built with typescript's inference system in mind. Everything is thus typed when using them, even though **there is only one Observable class**.

```jsx
const o_bool = o(true) // Observable<boolean>
o_bool.toggle() // compiles
o_bool.push(3) // compilation error
const o_arr = o([1, 2, 3]) // Observable<number[]>
o_arr.toggle() // compilation error
o_arr.push(4) // OK.
```

They can be transformed, and these transformations can be bidirectional.

```jsx
const o_obj = o({a: 1, b: 'hello'})
const o_a = o_obj.p('a') // o_a is a new Observable that watches the 'a' property
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

prev !== o_obj.get() // this is true
```

They can do a **lot** more than these very simple transformations. Check the Observable documentation page.

## ... and a very useful MaybeObservable object

The `MaybeObservable` is the root of Element's flexibility. It is also simple ; it means "either a value of a certain type, or an observable of this same type". The `o` function and its `o.get` method are meant to deal with it.

```jsx
const value = {a: 1, b: 2}
const o_value = o(value)

// o.get takes a MaybeObservable and returns its current value
o.get(value) === o.get(o_value)

// o() creates an observable or just passes the given observable if it already was one.
// It essentially transforms a MaybeObservable to an Observable
o_value === o(o_value)
```

Its usefulness lies in the fact that a Component may define its attributes as `MaybeObservable`, allowing the caller to do stuff like this ;

```jsx

interface IconAttributes extends Attrs {
  name: MaybeObservable<string>
}

function Icon({name}: IconAttributes) {
  const o_name = o(name) // make sure we have an Observable
  return <i class={['my-icon-lib', o_name.tf(name => `icon-${name}`)]}/>
}

// With a value
<Icon name='menu'/>

// With an observable
o_icon_name = o('menu')
<Icon name={o_icon_name}/>

// ... later
o_icon_name.set('close')
```

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
