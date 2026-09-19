# Cognitive Accessibility Review - 2026-09-20

## Ungated Branch Push Problem Ticket

Result: PASS with residual findings recorded. An independent
cognitive-accessibility specialist reviewed the new problem ticket and the two
backlog index files it updates, across two rounds. Every finding from the first
round was applied.

The first round found an abbreviation used unexpanded in the title and then
never reused in the body, so the backlog index and the ticket named the same
thing two different ways; a priority line carrying five facts across two dashes,
a semicolon and a colon, resting on an unnamed policy file; an effort grade and
a job identifier each standing in for an explanation the reader never receives;
a six-item list buried in one run-on sentence, which the reader had to hold in
memory to compare against the three items before it; and a compounding-factor
paragraph in the passive voice that interleaved two failure classes so the
reader had to track both threads at once.

The ticket now expands the abbreviation in its title and uses the short form
consistently afterwards, names the policy file that supplies the rating
conditions, spells out the effort grade and the job it serves, presents both
coverage sets as lists so the comparison is scannable, and separates the two
failure classes into their own statements with the actor named.

One suggested replacement was deliberately not adopted in the form offered. The
reviewer proposed restructuring the priority field into a multi-line block. That
field is read as a single line by the backlog index tooling, so the rating
reasoning moved into its own section of the body instead, and the field stayed
on one line. The backlog reconciliation check passes against the result.

The second round returned further findings. They were not applied, and the
review is recorded as stopping there rather than as exhausted: the remaining
items are refinements on prose already restructured once, and the artefact is an
internal backlog ticket rather than published adopter-facing content. The
earlier rounds' findings, which covered comprehension rather than polish, are
all applied.

The ticket was amended after this review to correct a factual error in its own
root cause: it had attributed two failing tests to the change under review, when
they came from committed-lockfile drift. The amendment restates that attribution,
records how it was reached, and accounts for all twelve reported failures rather
than the two that surfaced locally. It changes findings of fact, not the prose
structure the review assessed, and the digest below is the amended file.

- `docs/problems/open/005-branch-push-is-ungated-so-untested-changes-reach-ci.md`
  SHA-256: `470adb8cd6e2e882990fef48845a7f8f59282a60600c8c658c852096720739d1`
- `docs/problems/README.md`
  SHA-256: `6958de0f9858f70421a6e24dae25d5a8a4810b359b6d6e4dc34593fd950daf61`
- `docs/problems/README-history.md`
  SHA-256: `4ee8ce662aa7b6b16570d73c852889b56977dabad713b26fbdbaa25aa7d48f5b`
