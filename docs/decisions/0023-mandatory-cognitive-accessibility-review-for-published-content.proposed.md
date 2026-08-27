---
status: "proposed"
date: 2026-08-27
human-oversight: confirmed
oversight-date: 2026-08-27
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2026-11-27
---

# Mandatory Cognitive-Accessibility Review for Published Content

## Context and Problem Statement

Technically accurate public prose can still be unusable. The root README had a
dense evidence paragraph that became an unreadable wall of text on a mobile
screen. Structural Markdown checks did not detect the cognitive load.

Em See Pea needs one publication rule for human-written and generated prose so
ordinary readers can find, understand, and act on essential information without
having to decode maintainer-oriented evidence dumps.

## Decision Drivers

- All committed artifacts and outbound repository prose are public.
- Mobile readers, people with cognitive disabilities, and fatigued readers need
  clear structure, plain language, and manageable information density.
- Generated prose has the same comprehension risk as human-written prose.
- Automated density checks can catch regressions but cannot prove comprehension.
- Detailed evidence must remain available without overwhelming the primary task.
- Publication must remain fail-closed when required review evidence is absent.

## Considered Options

1. **Mandatory specialist review plus a density guard** - Require cognitive-
   accessibility review of every changed published prose surface and retain a
   small automated check for unusually dense README paragraphs.
2. **Automated density checks only** - Enforce paragraph-length and structure
   heuristics without specialist human review.
3. **Ordinary editorial review** - Ask normal code reviewers to consider
   readability without a dedicated cognitive-accessibility gate.
4. **No dedicated control** - Rely on author judgement and reader feedback.

## Decision Outcome

Chosen option: **"Mandatory specialist review plus a density guard"**, because
the realised README failure passed structural checks and required human
cognitive-accessibility judgement to identify. Automation remains a regression
signal, not a comprehension claim.

Published content means prose intended for people, including:

- root, package, and example READMEs
- documentation and documentation website pages
- release notes and Changesets
- package descriptions
- contribution, security, support, and conduct guidance
- generated prose
- public issue, pull-request, discussion, or release text

Source code, protocol fixtures, machine data, and generated evidence records are
excluded unless they contain prose presented to readers.

Every changed published prose surface receives a cognitive-accessibility review
before commit, push, release, or website publication, as applicable.

The review checks whether readers can:

- identify the task
- find the next action
- understand the language
- scan the content on mobile
- avoid unnecessary memory load

Move detailed evidence behind descriptive links when it is not needed for the
reader's immediate task.

The automated guard rejects unusually long prose paragraphs in the root README.
It ignores code fences, tables, headings, lists, link definitions, and
machine-generated data.

This guard is deliberately narrow. Passing it does not prove cognitive
accessibility, readability, comprehension, or WCAG conformance.

The existing published-content baseline must be audited rather than silently
grandfathered. The standing risk remains outside appetite until the baseline is
reviewed and the controls have evidence.

## Consequences

### Good

- Readers can understand the primary task before encountering detailed evidence.
- Generated content receives the same scrutiny as hand-written content.
- A cheap regression guard catches a repeat of the observed README failure.
- Detailed technical evidence remains available through progressive disclosure.

### Neutral

- Cognitive-accessibility review becomes part of the normal publication path.
- Review evidence is qualitative and must identify the surfaces reviewed.

### Bad

- Publishing prose takes an additional specialist review step.
- Automated checks cannot replace judgement and may require narrow exceptions
  for genuinely indivisible prose.
- The initial baseline audit adds work before the first release.

## Confirmation

- `QUALITY.md` defines the mandatory review, published-content scope, and
  fail-closed publication rule.
- A standing register entry records incomprehensible public content as a risk.
- The root README is rewritten into short task-oriented sections and passes a
  cognitive-accessibility review at a rendered mobile width.
- A runnable automated test rejects an over-dense root README prose paragraph
  while ignoring non-prose structures.
- Every existing published prose surface is inventoried and receives recorded
  cognitive-accessibility review before the first public package release.
- Changed Changesets, release notes, website prose, and outbound repository prose
  cannot publish without named review evidence.
- No document claims cognitive accessibility or comprehension solely because an
  automated check passed.

## Pros and Cons of the Options

### Mandatory specialist review plus a density guard

- Good: Combines human comprehension judgement with a cheap regression signal.
- Bad: Adds a required review step to every public prose change.

### Automated density checks only

- Good: Fast, deterministic, and easy to run in CI.
- Bad: Can reward short but confusing prose and cannot assess meaning.

### Ordinary editorial review

- Good: Adds no new specialist gate.
- Bad: Repeats the process that allowed the realised failure.

### No dedicated control

- Good: Has no process cost.
- Bad: Leaves a known and realised accessibility risk uncontrolled.

## Reassessment Criteria

Reassess when the content inventory or publication surfaces change materially,
the automated guard produces repeated false positives, measured reader research
supports a better control, or a later cognitive-accessibility failure shows the
review gate is ineffective.
