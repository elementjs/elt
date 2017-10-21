# What is Element


Element is a [typescript](https://typescriptlang.org) library intended to build user interfaces in a web environment.
It tries to embrace the DOM as much as possible while still providing powerful constructs
that allow for complex application creation.

It helps you accomplish this goal by providing the following ;

- A controller system which binds objects to DOM nodes, notifying them whenever
  the node is added or removed from the document
- An observable library for all that reactive bindings goodness
- A react compatible build function meant to be used with jsx/tsx

Element is typescript-first. As such, its API is meant to accomodate the type checker
and its inference as much as possible.

Note that it is not meant to be used for website creation ; only the latest browsers
are targeted. It is however ideal for mobile applications or environments such as [nwjs](https://nwjs.io).
