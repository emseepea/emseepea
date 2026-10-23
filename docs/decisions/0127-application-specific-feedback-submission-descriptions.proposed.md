---
status: "proposed"
date: 2026-10-23
human-oversight: unconfirmed
decision-makers: ["Tom Howard"]
consulted: []
informed: []
reassessment-date: 2027-01-23
---

# Application-specific Feedback Submission Descriptions

## Context and Problem Statement

[Issue #179](https://github.com/emseepea/emseepea/issues/179) records a production
metadata-scan finding against the generic native feedback description. A
calculator-specific replacement passed that application's scan while preserving
its collection triggers and privacy guidance. A replacement tool was needed
because the native constructor offered no supported description option.

## Decision Drivers

- Describe feedback in the context of the application operation being performed.
- Support accurate application-specific collection, storage and retention wording.
- Preserve native validation, authorization, execution and durable receipts.

## Considered Options

1. Add an optional complete description to the native submission constructor.
2. Append an application purpose to a fixed framework description.
3. Require adopters to replace the tool definition.

## Decision Outcome

Chosen option: **"Optional complete description on the native submission constructor"**, because adopters need accurate application wording while retaining native execution.

Add an optional complete `description` on `FeedbackSubmissionOptions`.
Omission uses an operation-specific default; a configured description is
published unchanged. Reject non-string and blank descriptions at construction.

A complete replacement supports accurate wording for application-specific
storage and retention without duplicating or contradicting fixed prose. The
option changes metadata only. Adopters remain responsible for retaining
accurate collection triggers, success disclosure, objections and privacy
instructions. The framework cannot establish those properties by inspecting
arbitrary prose.

## Consequences

Adopters keep the native implementation and can use the wording qualified for
their application. Existing callers need no configuration change, but receive
corrected default wording. Complete replacement can omit useful guidance;
documentation therefore explains the adopter's responsibility. Wording alone
cannot guarantee client behavior, private stored content or scan acceptance.

## Confirmation

- Source and package checks show configured descriptions on all supported protocol versions without changes to other discovery fields, schemas, authorization or receipts.
- Production confirmation names an adopter using the published option with its native backend and provides evidence of actual recording and accurate disclosure.
- Metadata-scan acceptance is separate evidence and names the application and tested definition.

This decision stays proposed pending explicit ratification of its final
substance and evidence of successful actual production use. The user's approval
of the delivery outcome is not recorded as architectural ratification.
