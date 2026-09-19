# Cognitive Accessibility Review - 2026-09-19

## Open-by-Default Result Schema Release Note

Result: PASS. An independent cognitive-accessibility specialist reviewed the
release note for publishing tool result schemas open by default, across four
rounds. Every finding from every round was applied.

The first round found the note read at roughly grade 13 to 15 for a reader
working through an upgrade, left "open" and "closed" undefined, ran six unheaded
paragraphs that interleaved three audiences, and addressed a release instruction
to adopters. The second round found the requested action named no mechanism. The
third round found a single numbered list spanning two contradictory lead-ins, so
a screen reader announcing three items presented the one case that opens as
though it stayed closed. The fourth round found an ambiguous pronoun at the
action sentence, where "they clear" read first as the baselines being cleared
rather than the breaks, an exception clause with two candidate referents, and
undefined jargon carrying nothing its own heading did not already carry.

The note now defines open and closed before using them, separates what changed
from the migration, from how to keep a schema closed, from what did not change,
from the maintainer instruction. It names the baseline concept before relying on
it, gives the re-capture command rather than only the instruction, states both
reported break names with the reason each appears, keeps the opening case out of
the list of cases that stay closed, and anchors the pairing exception to the case
it qualifies.

Two points were confirmed against the implementation before adoption, because
the reviewer flagged them as changing substance if wrong: the checker reports a
second break for a schema using reusable sub-schemas because its handled keyword
set omits that keyword, and re-capturing the baseline stops both breaks being
reported.

One section was removed rather than reworded. It warned adopters supplying a
non-Zod schema that values reachable from their cached document would be frozen.
A pipeline risk assessment identified that as a real hazard rather than a
documented quirk, so the framework now copies the document before freezing and
the warning no longer describes anything true.

- `.changeset/open-by-default-output-schemas.md`
  SHA-256: `0d0357fe1b24d04ba2ff2dac94112ae25906514e83c880cc45d634939b3ce385`

## Beta Maturity Decision

Result: PASS. An independent cognitive-accessibility specialist reviewed the
maturity and coverage-claim decision across three rounds before ratification.
All findings were applied.

The first round found the protocol abbreviation never expanded although it
carried the whole coverage claim, a ninety-word sentence holding the four claims
ratification commits to, an endpoint property named before the endpoint itself,
exit conditions stacked in prose where every other rule used a list, and a
withdrawal the reader first met in the exit criteria without ever being told it
happened. The second round found the word "surface" carrying three different
meanings, numbered points referenced by position instead of content, and one
transport name left unglossed inside the list readers are asked to check against
evidence. The third round found a two-item commitment delivered as running
prose, an idiom in a heading-weight line, a sentence about wrongly merged facts
that was itself merged, a definite reference to a rule the record never
describes, and a double-negative confirmation step that could not be run as one
check.

The record now defines its two senses of "surface" before using either, states
the ratification commitment as a list, expands the protocol abbreviation and
glosses both the transport and the deprecated sampling mechanism, restates each
numbered point's content where it is referenced, and splits the merged Node
sentence and the double-negative check into separate statements.

One point was confirmed against the protocol records before adoption, because
the reviewer flagged it as changing substance if wrong: the gloss describing
sampling as the mechanism by which a server asks the client to run a model
completion on its behalf.

The generated decisions index is covered by the same review, because its entry
for this decision is derived from the reviewed record rather than written
separately.

- `docs/decisions/0097-beta-maturity-with-a-bounded-support-claim.proposed.md`
  SHA-256: `a5ceb96222d61d9551841ac5510be8f7a6721314e1a9954e1732bc90e0286085`
- `docs/decisions/README.md`
  SHA-256: `2dbc21e9223983cfbc2ccb660c5ffe38260fe5f4571b98928b2715ea17c9a586`

## Open-by-Default Published Output Schemas Decision

Result: PASS. An independent cognitive-accessibility specialist reviewed the
decision record across three rounds before ratification. Findings covered an
unstated requested action, identifiers arriving before the concepts they name,
an unnamed precedent behind the leading driver, a decision sentence carrying
two reasons in one clause, and verification steps written as claims already
true rather than checks to run.

All findings were applied. The record now opens with what is being asked and
what ratifying commits to, explains each term before the identifier that names
it, names the precedent behind the leading driver, splits the decision into its
two reasons, and states its confirmation steps as checks. The confirmation
heading itself is the schema heading the decisions compendium requires, with a
descriptive lead-in sentence carrying the clarity the reviewer asked for.

- `docs/decisions/0096-open-by-default-published-output-schemas.proposed.md`
  SHA-256: `63e2779c0fc0e96b4e29d59e112cb6a8882f36959194976750ce45a3d38753c8`
