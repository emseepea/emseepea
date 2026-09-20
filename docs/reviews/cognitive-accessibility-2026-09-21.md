# Cognitive Accessibility Review - 2026-09-21

## Declared Proxy Topology and the Forwarded Hop Count

Result: PASS with findings applied. An independent cognitive-accessibility
specialist reviewed the five prose surfaces changed by the `forwardedHops`
work. Every finding was applied before this record was written, and the
digests below bind to the text after those fixes.

The review was asked to judge one thing above all others. An adopter setting
this number must come away knowing that a count higher than the real number of
proxies is the dangerous mistake, because it reads a value the caller supplied
and lets that caller choose their own rate-limit key, while a count lower than
the truth puts every caller on one shared limit and shows up immediately. The
reviewer found that claim stated correctly everywhere, but delivered in a way a
scanning reader could invert on three of the five surfaces.

Three findings were graded as failures.

The framework README led with the safe mistake and closed the section with
"Refusals of honest traffic are therefore the signal that the count is wrong",
which invites the reader to conclude that no refusals means the count is right.
The bullet directly above it says that is false. That sentence was the most
misreadable in the change. The section now leads with the dangerous case, gives
the silent half and the loud half their own bullets instead of nesting them,
and states the inverse and denies it: no refusals does not mean the count is
right, because the half a caller exploits is refused by nothing.

The website examples page never marked the dangerous case as dangerous. It
described both outcomes and ended on a reassuring clause attached to the safe
one, leaving a reader scanning for what they must get right with no signal. It
now names the too-high case as the dangerous mistake and the too-low case as
the safe mistake, in that order, and replaces an unlinked "see the framework
README" with a link to the section that explains both.

The changeset carried the whole asymmetry in one 108-word paragraph, with the
verdict at roughly word forty and two trailing hedges the reader had to carry
back three sentences. It is now four paragraphs, dangerous case first.

Two problems ran across every surface. "Rate-limit key" was used as though it
carried its own consequence, which it does not for an adopter meeting it for
the first time; each surface now says what actually happens, that the limit
never catches them. And "counted past, not verified" is an invented idiom that
also invites the reader to think verification is something they could switch
on; it now reads "counted, not checked".

The remaining findings were smaller: an action stated before its condition, a
bullet carrying three ideas and two ambiguous pronouns, a configuration snippet
with no indication of which object it belonged in, a forward reference to
"forwarding declaration" some four hundred lines before the term is introduced,
and two internal identifiers used as reader-facing nouns in the changeset.

A later architecture review found one more defect of the same class, in prose
the earlier fixes had left stranded. A sentence beginning "It must also forward
streamed responses" had taken its subject from a paragraph now separated by the
whole hop-count section, so a reader arriving at it had just been reading about
hop counts. It now has its own heading and names its subject.

## What the decision record carries, and what it does not

The decision record itself was reviewed on the same terms. Its statement of the
asymmetry is the strongest in the set, but it interrupted itself with an
account of its own rewrite history before the explanation arrived.

That history has been removed from the record rather than relocated within it,
and it is written here instead. The reason is a standing instruction from the
maintainer, who is the sole decision-maker and ratifier on that record: he
ratifies the headline of a decision, not the notes beneath it, and notes he has
not read should not sit in a decision record as though they were firm rules.

The history itself is worth keeping, because it is the reason a test exists.
Across this session the hop-count failure direction was stated backwards five
times: in the record's Consequences, then in the Confirmation bullet added to
guard against exactly that, then in the changeset, then in the code
documentation, then in the record's Good consequences. The cause was a summary
that is true and memorable but incomplete on its own, that counting from the
end defeats a caller-supplied prefix, which holds only while the declared count
is right. A behavioural test now pins the direction, so prose that states it
backwards contradicts a passing test rather than standing unchallenged. The
record's Confirmation says that in those terms and no longer refers to its own
edit history.

The record's opening sentence was also split, an abbreviation expanded on first
use, and two sentences that could only be parsed on a second reading were
broken up.


## The Release Documents

Result: PASS with findings applied. A second review covered the two documents
written after the first round: the starter-package changeset for the eleven
initializers, and the release-readiness record.

The starter changeset carried the same defect a seventh time. It told the
reader they could set `forwardedHops` and said nothing about which direction
is dangerous, leaving that only in a different package's changelog that a
starter's reader has no reason to open. It now carries the warning itself.

The readiness record held the checked-versus-assumed line well in its
dedicated boundary sections and lost it in six individual sentences, each
stating a tested case as a universal property. Two were outright wrong. It
claimed the repeated-header test runs "at every hop count" when the test loops
over 0 and 1; the source of that error was the test's own comment, which said
the same thing and has been corrected. And it stated the counting-from-the-end
guarantee without its condition, sixteen lines above its own description of
the case where that guarantee does not hold. That is the sixth appearance of
this error, and the first inside a document whose purpose is to separate what
was checked from what was assumed.

The record also left the outcome of two architecture-review runs unstated, so
a reader had to assume the last one passed; it now gives the sequence and says
the third run passed only because it was told the maintainer had directed the
rewrite. It claimed a backlog item exists for the amendment conflict when only
a session task had been queued and no problem ticket filed; it now says so.
Four uses of "proves" about single tests are now "shows".

One finding was not applied. The reviewer asked for the bare `- Result: PASS`
line to be removed, because it is the most scannable token in a document whose
reader is deciding whether to trust the release. That line is parsed by
`scripts/verify-release-readiness.mjs`, which refuses the release without it.
The qualification was added to the line below instead. This is the same
collision between reader-facing text and a machine-read marker that Problem
004 tracks.

- `.changeset/forwarded-hops.md`
  SHA-256: `b1edd7c8084e27c61b952879b1cc649271133f3a794c32a26f595bc25faa5d72`
- `.changeset/forwarded-hops-initializers.md`
  SHA-256: `2496ba909f5147bb9e34d107c21cd8c65d967555b0c413711bbd8111306176dc`
- `docs/decisions/0102-declared-proxy-topology-for-production-deployments.proposed.md`
  SHA-256: `26637422f4a865802a1984bf1a8996d4b6494aea92265150460fe20ae8fdb553`
- `docs/decisions/README.md`
  SHA-256: `b9674517b690b93e3489865d5c2a313baa3c4cea35fdfd563870bdf7b71e1011`
- `docs/protocol-coverage.md`
  SHA-256: `8ec0e53447c41ae86620e4778c3e6e7d44b34e155a639769dd9e5d21b2d85385`
- `docs/reviews/current-release-readiness.md`
  SHA-256: `741691a2af8f88b462ec9916617663a711f78b325bfb228731a0da3bd6a316d5`
- `packages/framework/README.md`
  SHA-256: `5c9a1aaf11868a219c29d0609d8491e3506f9baf12a63f179622bc963b79577e`
- `website/src/content/docs/examples.md`
  SHA-256: `fe05971b5c49cdc6bbac822a9cbc4bf2a80520171098209f532042c5b49e4f31`
