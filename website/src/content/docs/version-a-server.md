---
title: Version a published MCP server
description: Change a marketplace-listed MCP server while keeping existing clients working.
---

A new Model Context Protocol (MCP) server release can reach clients before a
marketplace accepts its updated tool definitions. Plan for the public contracts
that clients and reviewers may use during that interval. Your application
chooses its release numbers and when to deploy; the MCP protocol revision and a
marketplace listing version are separate from your server release number.

## Keep the published contracts

Save the public contract visible through the MCP endpoint when a version is
published or submitted for review. Use these records during the change:

- **Published baseline:** the captured contract for the version currently
  published to clients.
- **Submitted baseline:** the captured contract for the version under review.

Keep each baseline that still has clients or an active review. During review,
compare the candidate against both. A review outcome may change which
baselines remain active; retain older captures as history.

The [published-contract commands in `@emseepea/testing`](https://github.com/emseepea/emseepea/tree/main/packages/testing#check-a-published-mcp-contract)
show how to capture a versioned baseline and check a candidate against every
JSON baseline in a directory.

Capture at the point your application records a
real publication or submission. Keep baseline retention and approval decisions
in your application repository.

If an established contract needs different
comparison rules, the testing package accepts a trusted, application-owned
policy module. That module runs as local code, with your process's authority.

Run the contract check in continuous integration (CI) before deployment. It reports
incompatibilities in tool names, input and output schemas, resources, media
types, user interface (UI) metadata, and content security policy. A failure
needs a deliberate response: keep the old contract, add a separately named
capability, or arrange a supported client migration.

The check covers the public MCP surface it extracts. It does not verify private
provider behavior, every user's permissions, or how a client interprets a
result.

Test the older client journeys you need to keep, including successful
calls, errors, authorization, and any UI resource they open. If you are moving
an existing server onto Em See Pea, use the [migration guide](../less-server-code/)
to check operational contracts too.

## Keep the reviewer cases running

Before committing a submission change, write the cases you intend to give the
reviewer. Record each prompt or scenario, the expected tool choice or safe
refusal, the expected result, and the fixture data needed to reproduce it.

Run those cases as automated checks on every relevant server change. Include
both the public contract comparison and the behavior checks in the pipeline:
a compatible schema alone cannot prove the answer is correct.

After submitting, keep a copy of the submitted version and its exact test cases
as a regression baseline. Keep credentials and private customer data out of
that copy.

If you revise the submission, preserve the earlier copy as history
and make the new submitted cases the active baseline. A failing case should
stop the change until you fix the behavior or intentionally update the
submission and its tests. Local checks reduce regressions; they do not prove
what a reviewer observed in OpenAI's environment.

OpenAI's [submission guidance](https://developers.openai.com/plugins/deploy/submission#testing)
sets the current requirements for positive and negative reviewer cases and the
expected behavior each case must describe.

The
[AI tests guide](../ai-tests/) shows how to check tool choice and response
meaning with `@emseepea/testing`. Your application owns its reviewer fixtures,
CI wiring, and release decision.

## Replace an incompatible tool in stages

Keep the old implementation callable until its clients have migrated.

1. Add the replacement under a new name while the old tool still accepts its
   published inputs and produces its relied-on results.
2. Test calls to both tools through the MCP endpoint.
3. Give clients migration instructions and time to adopt the replacement.
4. When the replacement works, set `discoverable: false` on the old tool. It
   disappears from MCP list discovery but remains directly callable by name
   under its existing access policy.
5. Submit a version whose scanned listing includes the new tool and omits the
   old one.
6. After the new version is published, verify affected clients have migrated.
7. Remove direct-call support for the old tool only after that verification.
   This removal breaks clients still calling its old name.
8. Update active baselines and migration instructions according to your
   application release policy.

- **Reviewer:** works from the submitted scan, which should list the new tool
  and omit the retired one.
- **Existing client:** may still hold the old definition and call the old tool
  while your server supports it.
- **Fresh discovery:** may stop showing the old tool when OpenAI scans its
  removal. The new tool can pass its own checks independently.

Do not use a new release number alone as proof of compatibility. Record which
baseline checks and client journeys passed for the exact server revision you
intend to deploy. After deployment, verify the affected journey against the
serving revision before declaring the change complete.

## Check the marketplace's update rules

Marketplace processes differ. For an OpenAI plugin with a remote MCP server,
[OpenAI's current maintenance rules](https://developers.openai.com/plugins/deploy/app-review#ongoing-maintenance)
say that OpenAI periodically scans the live endpoint:

- A deleted tool leaves the published list when a scan detects its removal.
- A new tool becomes available after its automated checks pass.
- A changed tool keeps its previous definition live while the update is held.
- A server deployment takes effect before a scan or approval.

Keep accepting calls that match the live definition. If a deployment stops the
server from accepting those calls, roll back that deployment.

OpenAI distinguishes these tool updates from changes to submitted plugin
information or imported skills, which require a new draft version, review, and
publication.

Check the [submission flow](https://developers.openai.com/plugins/deploy/submission)
and your own marketplace's rules when planning the release. A server deployed,
a tool approved, a listing published, and a client journey verified are separate
results; record each one you actually observed.
