import { $click, Service, o, view } from "elt"
import { boolean, date, dispatch_object_editor_open, number, object, ObjectEditorShell, string } from "elt/editor"

// First implementation slice of the object editor (see specs/ui-object-editor.md,
// editor/schema.tsx, editor/shell.tsx). Scoped to what's
// actually wired up so far: schema-mode scalar leaves (string / number / boolean /
// date) inside a single flat Object composite, mounted in the shell. NOT yet
// working: unknown mode (Object.render only draws `properties`, not Object.keys),
// nested/drill-in composites (Object renders its children inline, not as a
// preview + open button), Array/Set/Map (still render() stubs).

const profile_schema = object({
  properties: [
    { name: "name", type: string() },
    { name: "bio", type: string({ multiline: true }) },
    { name: "age", type: number({ min: 0 }) },
    { name: "active", type: boolean() },
    { name: "birthday", type: date({ date: true, nullable: true }) },
  ],
})

const product_schema = object({
  properties: [
    { name: "title", type: string() },
    { name: "price", type: number({ min: 0 }) },
    { name: "in_stock", type: boolean() },
    { name: "released", type: date({ date: true }) },
  ],
})

export default class ScreenObjectEditor extends Service({
  base: import("./base"),
}) {
  o_profile = o({
    name: "Ada Lovelace",
    bio: "Wrote the first published algorithm meant to be run on a machine.",
    age: 36,
    active: true,
    birthday: new Date(1815, 11, 10) as Date | null,
  })

  o_product = o({
    title: "Widget",
    price: 19.99,
    in_stock: true,
    released: new Date(2024, 0, 1) as Date | null,
  })

  // Class field, not created per-render: the shell owns real mutable state
  // (the column stack) that must survive across @view re-renders.
  shell = new ObjectEditorShell(this.o_profile, { schema: profile_schema })

  @view
  Content() {
    return (
      <e-box typographic pad>
        {this.base.DisplayTitle()}

        <p>
          Schema-mode scalar leaves in a flat Object composite, mounted in the shell. The button below opens a
          second, unrelated example as a new column through the real open path (
          <code>dispatch_object_editor_open</code> → <code>elt-object-editor-open</code> → shell.
          <code>open()</code>) -- not a drill-in from inside the first object, since nested composites don't dispatch
          open events yet.
        </p>

        <p>
          <button type="button">
            {$click(() =>
              dispatch_object_editor_open(this.shell.node, {
                o_value: this.o_product as unknown as o.Observable<unknown>,
                title: "product",
              }),
            )}
            Open product example
          </button>
        </p>

        {this.shell.node}

        <h3>Live values</h3>
        <e-flex gap column>
          <pre>{this.o_profile.tf((v) => JSON.stringify(v, null, 2))}</pre>
          <pre>{this.o_product.tf((v) => JSON.stringify(v, null, 2))}</pre>
        </e-flex>
      </e-box>
    )
  }
}
