import { $id, Attrs } from 'elt'

export function MyComponent(a: Attrs<HTMLDivElement>) {
  return <div>Hello, world.</div>
}

<MyComponent>{$id('some-id')}</MyComponent>
