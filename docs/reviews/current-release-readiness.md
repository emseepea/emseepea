# Current Release Readiness

Date: 2026-10-09

## Feedback annotations for adopter effects

Issue #153 adds checked annotation options to `defineFeedbackSubmission` and
`defineFeedbackConversation`. Submission accepts four optional boolean flags;
conversation configuration maps create, reply, list, and get to those flags.
Omitted and undefined values preserve current defaults. Invalid fields, flag
values, and operation names fail before registration. Definitions capture the
configuration rather than retain mutable caller objects.

The framework publishes configured descriptors through actual MCP discovery.
Annotations do not change persistence, authorization, hook dispatch, retries,
or execution. Applications remain responsible for classifying the full backend
and hook chain truthfully. Collection and operator helpers retain their
existing descriptor contracts.

## Planned package set

- `@emseepea/feedback@0.9.0`
- `@emseepea/create-api-backed-server@0.1.10`
- `@emseepea/create-database-schema-server@0.1.10`
- `@emseepea/create-html-ui-server@0.1.10`
- `@emseepea/create-mongodb-backed-server@0.1.10`
- `@emseepea/create-multi-instance-postgres-server@0.1.10`
- `@emseepea/create-openapi-backed-server@0.1.10`
- `@emseepea/create-progress-streaming-server@0.1.10`
- `@emseepea/create-react-ui-server@0.1.10`
- `@emseepea/create-resources-and-prompts-server@0.1.10`
- `@emseepea/create-soap-backed-server@0.1.10`
- `@emseepea/create-tool-server@0.1.10`

All eleven initializer patches update generated feedback dependency pins.
The private website version moves to 0.0.10 to deploy annotation guidance.
Server, testing, and UI packages are not planned for release.

## Architecture and jobs to be done

The merged implementation preserves the API already landed on main and adds
public-boundary and packed-install coverage. Explicit undefined flags retain
defaults, and null configuration is rejected.

This is an additive configuration of the existing checked tool contract under
ADR-0006 and the pluggable backend and hook boundary under ADR-0066. Current
defaults and deployment-static definitions remain unchanged. JTBD-002 covers
composition and JTBD-006 covers safely evolving a published contract;
JTBD-101 covers checked publication. No new architectural boundary is added.

ADR-0116 is a separately requested draft for issue #150. Human oversight is
pending, and no tool-call budget implementation is part of this release.
The draft explicitly distinguishes call budgets from provider rounds and
records the risk of detecting excess native calls after execution.

## Required checks and residual risk

Focused checks cover defaults, partial and complete overrides, all conversation
operations, public and protected MCP discovery, public and protected submission,
retention activity and notice cancellation, unchanged hook dispatch, malformed
configuration, and mutation after definition. Public types reject unsupported
flags and operation names. The same protocol checks run against fresh packed
installs, alongside existing feedback authorization and persistence tests.

Full exact-commit qualification must pass, including build, types, protocol,
packed installs, generated initializers, and documentation checks. Source
Quality must pass on Node.js 22 and 24, with vulnerability scanning,
initializer qualification, and existing performance budgets. Release must pass
semantic checks and verify registry integrity, signatures, provenance, and
fresh installs. Publish must verify latest, write release records, deploy the
website, and merge back to main. Failed semantic trials are not retried.

The main residual risk is an adopter declaring inaccurate annotations. The
framework cannot infer arbitrary backend and hook effects. Documentation
explains the four flags, includes the lifecycle-write reproduction, and states
that connectivity alone does not determine open-world behavior. Preserved
defaults protect compatibility. Residual risk is within the Low appetite,
conditional on all required exact-commit gates.

## Conditional release readiness

- Result: PASS
- Final result: within appetite, subject to the required exact-commit gates.
- Publication status: NOT READY until full exact-commit qualification,
  Source Quality, Release, and Publish pass.
