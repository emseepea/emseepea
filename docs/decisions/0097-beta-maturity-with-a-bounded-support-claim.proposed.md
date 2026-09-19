---
status: "proposed"
date: 2026-09-19
human-oversight: confirmed
oversight-date: 2026-09-19
decision-makers: ["Tom Howard"]
consulted: ["Architecture review"]
informed: []
reassessment-date: 2026-12-19
---

# Beta Maturity with a Bounded Support Claim

**Status: proposed. What is being asked:** ratify the maturity label and the
support boundary below, or reject them.

Ratifying commits the project to two things:

1. Wherever public wording uses the word beta, the four limits listed under
   "Beta here means exactly these four things" appear with it.
2. The current protocol-coverage wording is replaced with the exact claim listed
   under "The coverage claim becomes exact".

Reassessment is due 2026-12-19.

Throughout this record, **public wording** means text a reader meets — a
readme, a website page, a policy file. **Protocol surface** means the set of
protocol capabilities the software actually implements. The two are different
things, and the problem this record addresses is that the first has stopped
describing the second.

## Context and Problem Statement

Every piece of public wording calls this project pre-alpha. The word appears in
the repository readme, the security policy, the support policy, the contributing
guide, the risk policy, four package readmes, and three website pages.

Four things are wrong.

**One: the maturity word no longer matches the work.** Eleven starter packages
are published, the framework package is at version 0.14.0, and the protocol
coverage ledger records twenty-four verified capabilities. Two package readmes
carry no maturity sentence at all, so the wording does not even agree with
itself.

**Two: the coverage claim is vague where it should be exact.** The website says
the project "supports part of the Model Context Protocol (MCP) revision
`2026-07-28`, not the entire protocol". A reader cannot act on that. It also
understates what is proven: five older MCP revisions are verified from end to
end, and the website never mentions them. The most accurate wording in the
repository is already in the framework package readme, which names the active
revision, the five older revisions, and what is excluded.

The ledger is more careful than the website. It withdraws any claim that the
project covers the whole of the active protocol surface. That withdrawal stands
until someone compares the ledger against the pinned protocol specification and
confirms the ledger lists every rule that specification requires. This is why
the coverage claim below names individual capabilities rather than claiming the
protocol as a whole.

**Three: supported Node versions and tested Node versions are stated as if they
were one fact.** Public wording says the project "runs on Node.js 22 or 24".
Those are the two versions continuous integration exercises. They are not the
versions the packages declare as their supported floor. That floor is not
uniform either. Six library packages and seven starters declare Node 22 or
newer. Four starters require 22.13.0 or newer.

**Four: no current decision owns any of this.** One earlier decision introduced
the pre-alpha word. Another said maturity is communicated by 0.x version numbers
plus pre-alpha wording. Both have since been marked as replaced. In each case
the replacement decided a different subject and never restated the labelling
rule, so the rule kept being followed after the record carrying it was retired.

Two decisions that are still in force use the phrase "the pre-alpha period". For
them it names the window during which the authentication surface and the
telemetry configuration may still change. Those two records are ratified and
cannot be edited. If a new label closed that window, or left it without a name,
those records would point at a period that no longer exists. So the replacement
label must keep the window open and name it.

## Decision Drivers

- A reader must be able to check every claim against evidence that already
  exists, rather than trusting a judgement.
- The maturity word must not imply support the project does not provide.
- The breaking-change window that two in-force decisions depend on must stay
  open and keep a name.
- The coverage claim should state what is proven, neither overstating the
  protocol surface nor understating the older revisions that are verified.
- Supported versions and tested versions are different facts and should read
  as different facts.
- Whatever replaces the current wording must be enforced by a check, because
  the last wording drifted for months after the record behind it was retired.

## Considered Options

1. **Beta, with the support boundary stated wherever the label appears** - Move
   to beta and define it in the record, keeping the breaking-change window open.
2. **Alpha, with the same bounded definition** - The same structure, one step
   lower, matching the original request, which asked for the label alpha.
3. **Stay pre-alpha and fix only the false statements** - Correct the coverage
   and Node claims, leave the maturity word alone.
4. **Drop maturity labels entirely** - State capabilities and support limits
   directly and use no single-word label.

## Decision Outcome

Chosen option: **"Beta, with the support boundary stated wherever the label
appears"**.

**Beta here means exactly these four things, and nothing else.**

1. The protocol capabilities named in the coverage claim below are usable and
   verified from end to end.
2. Versions below 1.0 may still introduce breaking changes. This is the same
   window earlier records call the pre-alpha period; only the label changes.
3. Only the newest version published under the npm `latest` tag is eligible for
   security fixes.
4. There is no production-support promise, no backport promise, and no
   response-time promise.

**The label never appears alone.** Any public wording that uses the word beta
states those four limits beside it, or links directly to the page that does.
A bare maturity word invites a reader to supply the conventional meaning. For
beta that meaning is feature-complete and stabilising, which is the opposite of
a version line that may still break. The framework package readme is the model:
it states the exact capabilities and the exact exclusions in four lines.

**Maturity is separate from the version number.** Three package readmes
currently say the project "remains pre-alpha while its version is below 1.0".
That rule is withdrawn. Under it the project could never leave pre-alpha,
because this decision keeps breaking changes available for every version below
1.0.

**The coverage claim becomes exact, and links its evidence.** Public wording
states these four things and no more:

1. The active revision is MCP `2026-07-28`, served over Streamable HTTP, the
   MCP transport that carries requests and streamed responses over ordinary web
   requests.
2. One stateless endpoint accepts requests. That same endpoint also serves a
   verified compatibility subset of five older revisions — `2025-11-25`,
   `2025-06-18`, `2025-03-26`, `2024-11-05` and `2024-10-07` — covering
   initialization, tool listing and tool invocation.
3. Two optional capabilities are not implemented: list-change notifications
   within one running process, and a general registration point for extension
   notifications.
4. MCP Sampling, the mechanism by which a server asks the client to run a model
   completion on its behalf, is intentionally absent because the active revision
   deprecates it.

The coverage ledger is linked as the evidence. Claims beyond this set are not
made.

**Supported versions and tested versions are stated separately.** Public wording
says the packages support Node 22 or newer, notes that four starters require
22.13.0 or newer, and says separately that continuous integration exercises
Node 22 and 24. It does not merge the two facts into one sentence.

**Every published package states its maturity.** The two package readmes that
carry no maturity sentence gain one, so a reader arriving at any published
package meets the same boundary.

**What reaching 1.0 requires.** All three of these must hold:

1. Breaking changes are announced and migrated, not merely permitted.
2. The ledger's withdrawn claim to the whole active protocol surface is either
   restored with evidence, or the remaining gaps are recorded as permanent.
3. A support commitment is decided and recorded that goes beyond today's
   position of no production support, no backports, and no response times.

Until all three hold, the label stays at beta.

## Consequences

### Good — what this improves

- Every maturity and coverage statement can be checked against the ledger, the
  package manifests, and the continuous integration configuration.
- The coverage claim stops understating five verified older revisions.
- A reader can tell what is supported from what is merely tested.
- The breaking-change window that two in-force decisions rely on stays open and
  keeps a name.

### Neutral — what this changes without cost

- The label moves while the substance of the support boundary stays as it was.
- Packages that previously said nothing about maturity now say the same thing as
  the rest.

### Bad — what this costs

- Beta invites a stronger reading than the limits allow, so the wording depends
  on the limits travelling with the label everywhere it appears.
- Public wording in twelve or more files must change together, and each changed
  page needs its recorded review before publication.
- One of the two retired records also carried a rule about which npm channel a
  release is published to. That rule is still unrecorded. This decision does not
  restore it. It needs its own record.

## Confirmation

These checks confirm the decision once it is implemented. Each must pass.

- Search the published files for the word pre-alpha. Check that none remains.
- For every place public wording uses the word beta, check that the four limits
  appear beside it or one link away. A check fails the build when a published
  readme states a maturity label without them.
- Compare the coverage claim in public wording against the coverage ledger.
  Check that the active revision, the five older revisions, the two
  unimplemented optional capabilities, and the intentionally absent Sampling all
  match.
- Check that every place public wording states a Node version gives the
  supported floor and the versions continuous integration exercises as two
  separate facts.
- Check that public wording states the 22.13.0 floor for the four starters that
  require it.
- Check that every published package readme states the maturity boundary.
- Check that no public wording ties the maturity label to the 1.0 version line.

## Pros and Cons of the Options

### Beta, with the support boundary stated wherever the label appears

- Good: matches the delivered and verified capabilities better than pre-alpha.
- Good: forces the limits into the same place as the label.
- Bad: the conventional reading of beta is stronger than the limits allow, so
  an unaccompanied label is actively misleading rather than merely vague.
- Bad: depends on a check to stay true.

### Alpha, with the same bounded definition

- Good: the conventional reading is closer to the retained limits, so an
  unaccompanied label misleads less.
- Good: matches the original request, which asked for the label alpha.
- Bad: understates eleven published starters and twenty-four verified
  capabilities.

### Stay pre-alpha and fix only the false statements

- Good: smallest change, and no positioning risk.
- Bad: leaves the maturity word contradicting the delivered capabilities.
- Bad: leaves the version-to-maturity rule contradicting the retained
  breaking-change window.

### Drop maturity labels entirely

- Good: nothing to misread, because the limits are the only claim.
- Bad: readers expect a single-word signal and will infer one anyway.
- Bad: gives up a summary that the security and support policies already imply.

## Reassessment Criteria

Revisit this decision if any of the following hold.

- All three conditions for 1.0 are met: announced and migrated breaking changes,
  a resolved ledger claim to the active protocol surface, and a recorded support
  commitment.
- A support commitment is made that this record denies — any promise of
  production support, backports, or response times.
- The coverage ledger restores or further withdraws its claim to the active
  protocol surface.
- The check enforcing the bounded label is removed or stops running, because the
  label's honesty depends on it.
