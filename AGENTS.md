# Elt - Agent Context

## Docs (progressive disclosure)

Do not read all of `./docs` up front. Pick by branch:

| Branch | Read |
| ------ | ---- |
| Choosing which doc to open | [`docs/md/index.md`](./docs/md/index.md) |
| App code using **core elt** | [`docs/md/using-elt-agent.md`](./docs/md/using-elt-agent.md) |
| **UI** (layout, theme, widgets, `"elt/ui"`) | [`ui/AGENTS.md`](./ui/AGENTS.md) → [`docs/md/using-elt-ui-agent.md`](./docs/md/using-elt-ui-agent.md) |
| Feature specs | [`specs/`](./specs/) |
| Architecture decisions | [`docs/src/adr/`](./docs/src/adr/) |

Inside a guide: read **Hard rules**, then only the section that matches the task.

# Instructions

- Do **NOT** wrap lines in markdown
- Write so most developers get it without knowing scoped community slang; define our terms; never reuse a common word in a special sense when “toolbar”, “header”, or “frame around the content” would do unless the term is universally understood, like "packaging" or "drill-down".
- Fix root causes instead of patching around structural problems, ask the user if the fix is structurally important
- Do NOT add dependencies by yourself
- ALWAYS Create regression and integration tests when working on new features or when features did not already have them.
- Test your claims/assertions instead of only recalling when your confidence level is not impeccable
- DRY : keep the code simple, avoid repetitions and factorize code whenever possible.
- Implementations MUST always be the most efficient CPU/RAM wise. If a compromise is to be made, prompt the user
- Always prompt the user whenever you deem an important architectural decision is to be made (adding/removing a library, implementation details/philosophy, performance concerns)
- Explain the code through comments when implementing
- If there is a TODO.md file somewhere, keep it updated with what's been done
- When alerting me on problems or inconsistencies, use examples if the explanation is complex
- Maintain `./docs` <-> code relevance

# When writing specs or code

The redactor(s) write specs with you as a mirror, to help shape them as best as possible for a prompt implementation by a low/medium thinking agent.

Spec language MUST be specification-only : no musing, rationale, or back-and-forth outside a blockquote. Everything outside a blockquote is a binding rule. A blockquote is optional context — skip it when implementing, and consult it only when a rule seems ambiguous or you want to check a judgment call. No remnant of our conversation may remain outside a blockquote ; code blocks are the one exception, where explanatory inline comments stay regardless.

Blockquote types :

- `> Why:` — rationale/justification for the rule immediately above it.
- `> Question:` — a lingering question you need answered. Remove it once answered (in the text, or during conversation) ; amend it in place if the answer isn't sufficient yet.
- `> Thoughts:` — your own scratch reasoning. The redactor deletes these by default ; delete one yourself only once it's gone obsolete (superseded, or its question already resolved elsewhere).
- `> Advise:` — an explicit question from the redactor to you, however they label it (`Advise`, or whatever they happen to reach for in the moment — treat any clearly question-directed custom blockquote the same way). When you reply, delete the block itself, leaving the updated spec text in its place, plus any `> Thoughts:`/`> Question:` you want to leave behind.

The redactor may also leave a question inline, outside any blockquote (e.g. a parenthetical) while redacting, for commodity. Address it like if it were `> Advise:`.

# When writing code

Similarly to spec work ; leave questions/dialogue with a marker, like //> Question: so that I can find items to go back to more easily by grepping.
