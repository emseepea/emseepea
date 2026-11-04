# Current Release Readiness

Date: 2026-11-05

## Provider-neutral GitHub feedback references

Status: **PREPARED, NOT PUBLISHED**. Issue #236 changes the public identifier
format for GitHub-backed submissions, conversations and webhook events. References
use `feedback-123`, `feedback-123-body`, `message-456` and `event:<delivery>`.
Numeric provider identifiers remain visible under Tom's confirmed scope.

Previously saved identifiers and reply-event subscriptions intentionally stop
working after upgrading. Obtain current conversation references through listing
and recreate the subscriptions. Do not submit duplicate feedback to replace an
old submission-only reference. Provider records, private deduplication keys,
authorization and scope checks are unchanged. No new key, dependency or
compatibility layer is introduced.

## Planned packages

The existing Changesets planner selects:

- `@emseepea/feedback@0.12.0`

## Verified preparation

The framework, feedback and testing packages build. Eleven targeted adapter,
webhook, reply-event and public Model Context Protocol (MCP) checks pass. The
public check invokes real MCP submission, list, get and reply operations, then
publishes an ingested synthetic webhook into a matching event subscription.
It verifies neutral references, numeric correlation, rejection of invalid and
old references before provider calls, and denial across scopes. The provider
fixture is synthetic; no production provider write was performed.

Risk R017 records provider-name disclosure through otherwise valid output.
Its GitHub-specific implemented-source residual is 3/25 following the verified
behavioral controls. This does not establish publication or installed-package
acceptance. Other backends are outside this assessment.

## Reviews and remaining checks

Revision 2 passed independent architecture, Jobs To Be Done, cognitive and
planning reviews. The plan's projected release risk is 4/25 conditional on the
required checks. New tests were independently classified as behavioral.
Public prose received voice review; the final cognitive review and concrete
commit/push/release assessment remain required.

Fresh clean exact-source qualification, source continuous integration (CI),
credentialed Claude release qualification, downloaded-package verification,
governed publication, registry readback, independent installation and mergeback
Quality remain required. No release or adopter-production verification is claimed.

The prior WebMCP release was published through [Publish 41765338023](https://github.com/emseepea/emseepea/actions/runs/41765338023).
Its [release-time readiness record](https://github.com/emseepea/emseepea/blob/35aa4a4ea4525434aa051ba6734ec010f778e1d5/docs/reviews/current-release-readiness.md)
remains immutable. Full-catalogue WebMCP work remains separate under issue #230.

- Result: PASS
- Final result: within appetite, subject to the required exact-commit gates.
