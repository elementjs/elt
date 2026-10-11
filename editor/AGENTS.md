# elt/editor — maintainer notes

This file is for changing the `editor/` library itself. The editor is a **consumer** of elt and of elt/ui, like any application: no exception applies to it.

**Never do** what [`hard-dont.md`](../docs/md/hard-dont.md) and [`ui-hard-dont.md`](../docs/md/ui-hard-dont.md) list. They matter more than everything else in this file. `just check` enforces part of them.

The rules to read in full before changing the editor: [`elt-rules.md`](../docs/md/elt-rules.md) and [`elt-ui-rules.md`](../docs/md/elt-ui-rules.md). The editor's own documentation is [`object-editor.md`](../docs/md/object-editor.md); keep it aligned with the code.
