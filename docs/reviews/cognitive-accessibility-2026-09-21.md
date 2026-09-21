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


## The Declared Proxy Boundary, Withdrawn

Result: PASS with findings applied. A third review covered the three prose
surfaces added for the second half of the decision, the declared proxy
boundary, and graded all three as failing. The defect was the same one this
record has now tracked eight times: a safety claim stated without its
condition, and the reassurance placed ahead of the danger.

This feature carries a sharper version of the risk than the hop count did.
Declaring the boundary is a claim the framework has no way to verify, and an
adopter meets it while a deployment is failing to start, which is the worst
moment to skim. The reviewer's finding was that all three surfaces read as a
documented way to make a startup error go away.

The website page was the weakest and, before the fix, the most dangerous. It
never said the claim was unverifiable and never said what is lost when it is
false. It stated "it skips the proxy address check and keeps every other
check" as an unconditional guarantee, then closed on a soft usage note. The
less dangerous hop count, on the same page, had four paragraphs and a link to
the full explanation; the more dangerous feature had one paragraph and no
link. It now leads with the condition, says the framework cannot check the
claim, says the protection is replaced with nothing where the claim is false,
and carries the link.

The framework README gave the instruction twelve lines above the condition
that makes it safe, so a reader who searched for "no fixed proxy address"
after a startup failure had everything needed to act and no reason to read on.
The condition is now in the same sentence as the instruction, and the
unverifiability follows immediately. Its heading, "A platform that enforces
the boundary for you", asserted as fact the very thing that is only the
adopter's claim; it now reads "A boundary you declare the platform enforces".

The changeset closed a paragraph with "so nothing about the existing shape
loosens". That was meant as a statement about the schema, and it is true of
the schema, but a release-note reader takes it as a security guarantee, and as
a security guarantee it is false: a check is gone. It was removed rather than
qualified, because no reassurance should be the last thing a skimmer reads.

One cross-cutting fix: a single check had three names across the code, the
startup warning and the three documents. It is called the proxy address check
everywhere now, including in the warning text and the test that pins it.

An architecture review of the same change found a gap the prose review could
not see. The configuration-file path had no test for a profile declaring the
boundary, for one carrying both fields, or for one carrying neither. The last
of those was not a new case but a relocated one: making the address list
optional in the schema moved an existing refusal into the exactly-one rule,
and nothing pinned it at its new home, so a later edit could have opened a
production profile with no boundary at all while the loader suite stayed
green. Three cases and a round-trip assertion now cover it.


## The Proved Proxy Boundary

Result: PASS with findings applied. The declared boundary reviewed in the
section above was withdrawn before it shipped. Pipeline risk review scored it
8 out of 25 against an appetite of 5 and refused the commit, on the grounds
that the remaining checks are all settable by whoever sends the request, so
the address comparison was the only one distinguishing a request that came
through the load balancer from one that came from anywhere.

What replaced it inverts the failure direction. Rather than declaring that the
platform enforces the boundary, the deployment configures its proxy to inject
a secret header, and the server checks it. A proxy that is not sending the
header refuses every request, so a mistake closes the server instead of
opening it. That decision is recorded in ADR-0103, which supersedes ADR-0102.

A fourth review covered the rewritten prose and the new decision record, and
graded three of the four as failing. Two findings mattered more than the rest.

The framework README told the reader to put the header and secret in the
`deployment` object shown above it. That object is a TypeScript literal in
source, so following the instruction literally writes a credential into the
repository, which the same section forbids four paragraphs later. It now says
to read the secret from the environment, in the paragraph that carries the
instruction rather than after it.

The README also stated "a caller cannot supply it, because they do not know
it" as an unconditional guarantee. It holds only while the secret stays
secret, and the decision record admits as much in its own Consequences: a
leaked secret admits a caller until it is rotated. That is the ninth
appearance of this defect across the day's work, and the first where the
maintainer-facing record carried the caveat while every adopter-facing surface
carried only the reassuring half. It now reads that a caller cannot guess it,
and that anyone who learns it can reach the server from any address until it
is rotated.

The reviewer also found the same ordering reflex on all three adopter
surfaces: a reassuring paragraph sitting between the action and the
precondition on that action. A reader who scans, copies the configuration and
deploys would meet the precondition after breaking their service. Each surface
now runs instruction, then precondition, then reassurance.

Two smaller defects were real errors rather than ordering. Both the changeset
and the website page said "supply one of the two fields" where the nearest
antecedent was the header and the secret, not the two boundary fields, so the
rule read as "a header or a secret, not both". And the website page sent the
reader to a README section using `secret` while the configuration file takes
`secretEnv`, with nothing saying they are the same field on two paths.

Asked directly whether the correction had overshot into making a safe feature
sound frightening, the reviewer said no: every dangerous statement is paired
with why the outcome is safe, in the same sentence or the next.


## The Log Claim

Pipeline risk review found a tenth instance of the same defect, in prose
written to fix the ninth. Every adopter surface said the secret is "never
written to a log". That is true of this framework and is tested. It is not
true of the adopter's own infrastructure, and the same paragraph had just told
them to have their load balancer inject the secret as a request header, on
platforms where header logging is a common default.

The claim now names its subject: this package never writes it to a log. Each
surface then carries the part that was missing, which is that the secret
travels as a request header and logging for that header should be turned off
at the proxy and anything in front of it. ADR-0103's Consequences records it
as the real cost of moving from a network-position check to a bearer secret.

The same review found a defect with no prose component. A header value reaches
the request path decoded as latin1, while the configured secret hashes as
UTF-8, so a secret containing any non-ASCII character could never match. Every
request would be refused with the same message an unconfigured proxy produces,
at exactly the moment the adopter is debugging a server that will not serve.
Secrets outside printable ASCII, and secrets with surrounding spaces, are now
refused at construction with a named error.

- `.changeset/forwarded-hops.md`
  SHA-256: `b1edd7c8084e27c61b952879b1cc649271133f3a794c32a26f595bc25faa5d72`
- `.changeset/forwarded-hops-initializers.md`
  SHA-256: `2496ba909f5147bb9e34d107c21cd8c65d967555b0c413711bbd8111306176dc`
- `.changeset/proved-proxy-boundary.md`
  SHA-256: `0c9752f61a4814a31943f91df36718d6db811bacd4437995e0cee71e26e14020`
- `docs/decisions/0102-declared-proxy-topology-for-production-deployments.proposed.md`
  SHA-256: `26637422f4a865802a1984bf1a8996d4b6494aea92265150460fe20ae8fdb553`
- `docs/decisions/0103-proved-proxy-boundary-for-production-deployments.proposed.md`
  SHA-256: `e246173868d08857699cc371a4e4853e0f1a1b24a9569f41a42694f16610bff3`
- `docs/decisions/README.md`
  SHA-256: `e4fab16eb4b85c558e317114d0d34e1f5ee85d350cc34ab37e89441c53ad0d7a`
- `docs/protocol-coverage.md`
  SHA-256: `8ec0e53447c41ae86620e4778c3e6e7d44b34e155a639769dd9e5d21b2d85385`
- `docs/reviews/current-release-readiness.md`
  SHA-256: `9d4a44f8974b33d1b67741c509389e96b3f938f9d65e939519accb77d99e0cfd`
- `packages/framework/README.md`
  SHA-256: `0de6e5fd5c558887f1fe1b6a4391758c03c30754c0a188798a67e0ece0890cbe`
- `website/src/content/docs/examples.md`
  SHA-256: `e0080c22cf47203a5f7deabcc29638c369a3177b392117685e67b2d0b31375fb`

## Ratified Proxy Decision and Superseded Index

Result: PASS. A fresh review of the ratified ADR-0103, the renamed historical
ADR-0102, and the regenerated decision index found no cognitive-accessibility
issues in the Markdown source. The decision leads with the proved boundary and
distinguishes a wrong declaration that could silently admit requests from a
missing secret that refuses them. The historical decision and index identify
ADR-0103 as its replacement. This review did not assess rendered website pages
or verify a deployed adopter request.

- `docs/decisions/0102-declared-proxy-topology-for-production-deployments.superseded.md`
  SHA-256: `26637422f4a865802a1984bf1a8996d4b6494aea92265150460fe20ae8fdb553`
- `docs/decisions/0103-proved-proxy-boundary-for-production-deployments.proposed.md`
  SHA-256: `1c527722a0fd2d77dc009ed17baa24e23bc74c3388d1769e758242f9bd436c31`
- `docs/decisions/README.md`
  SHA-256: `28db70f00098eb46244d1b9bcb5a830b6e45b330a927d8e9a960ac02150b3017`

## Feedback Recording Claim and Release Version

Result: PASS. A cognitive-accessibility review found no blocking issue in the
feedback changeset or the updated release-readiness package list. The
changeset states the order of the tool call and the condition for saying
feedback was recorded in plain language. The readiness change names the new
feedback version without claiming publication or adopter success. The review
also suggested removing a repeated trigger from the model-facing tool
description; that suggestion was applied. This review does not replace the
required exact-commit semantic evaluation.

- `.changeset/feedback-recording-claim.md`
  SHA-256: `d586b45d1dfbc4423f03fc1af162acc6692a5bd3f61ae72b573ff78cd378b799`
- `docs/reviews/current-release-readiness.md`
  SHA-256: `46280f24466e173188d04040412c10e4d8e3f3511463926749b47c4ed716b051`

## Database Schema Addition Confirmation

Result: PASS. The reviewer checked the exact changeset, the updated release
package list, and the model-facing tool description. The changeset plainly
states which saved details the AI is asked to include. The release list names
the planned initializer version without claiming that it is published. The
tool description asks for the returned name, pea type, and maturity time after
a successful addition. This review does not replace the semantic evaluation
of the model's actual answer.

- `.changeset/database-add-confirmation.md`
  SHA-256: `cf1cf9cf0842d380a7b93a4fc64259fee47a8bc58170eafc7a91d2f978ecb21f`
- `docs/reviews/current-release-readiness.md`
  SHA-256: `9185df4159e2f6dfbe40236913d8793b75977fbc7c0bea0f900e5060bbadcaac`
