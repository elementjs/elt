import { Service, o, view } from "elt"
import { boolean, date, number, object, ObjectEditorShell, string } from "elt/editor"

// First implementation slice of the object editor (see specs/ui-object-editor.md,
// editor/schema.tsx, editor/shell.tsx). Scoped to what's actually wired up so
// far: schema-mode scalar leaves (string / number / boolean / date), and one
// nested Object composite property that opens as a real column via the
// preview + drill-in path. NOT yet working: unknown mode (Object.render only
// draws `properties`, not Object.keys), Array/Set/Map (still render() stubs).

const address_schema = object({
  properties: [
    { name: "street", type: string() },
    { name: "city", type: string() },
  ],
})

const profile_schema = object({
  properties: [
    { name: "name", type: string() },
    { name: "bio", type: string({ multiline: true }) },
    { name: "age", type: number({ min: 0 }) },
    { name: "active", type: boolean() },
    { name: "birthday", type: date({ date: true, nullable: true }) },
    { name: "address", type: address_schema },
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
    address: { street: "12 Analytical Engine Ave", city: "London" },
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
          Schema-mode scalar leaves in a flat Object composite, mounted in the shell. <code>address</code> is a
          nested Object composite -- it renders as an "Open ›" button, not inline, and drills into a real second
          column through the actual open path (a widget dispatches <code>elt-object-editor-open</code>, the shell
          listens and mounts the column).
        </p>

        {this.shell.node}

        <h3>Live values</h3>
        <pre>{this.o_profile.tf((v) => JSON.stringify(v, null, 2))}</pre>
      </e-box>
    )
  }
}
