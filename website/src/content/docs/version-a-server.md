---
title: Version a published MCP server
description: Change a marketplace-listed MCP server while keeping existing clients working.
---

A new Model Context Protocol (MCP) server release can reach clients before a
marketplace accepts its updated tool definitions. OpenAI reviews hosted tool
changes independently: one tool can go live while another update is held.
Plan for the public contracts that clients and reviewers may use during that
interval. Your application chooses its release numbers and when to deploy. The
MCP protocol revision and marketplace listing version are separate from your
server release number.

## Keep the published contracts

Save the public contract visible through the MCP endpoint when a version is
published or submitted for review. Use these records during the change:

- **Published baseline:** the captured contract for the version currently
  published to clients.
- **Submitted baseline:** the captured contract for the version under review.
- **Live tool baseline:** each tool definition currently marked Live by the
  marketplace, including an earlier definition retained while an update is held.

Keep each baseline that still has clients or an active review. Compare a
candidate against the published, submitted, and live definitions that still
apply; these may differ during per-tool review. A review outcome may change
which baselines remain active; retain older captures as history.

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

After submitting a plugin version, keep a copy of its submitted definition and
exact test cases as a regression baseline. Keep credentials and private
customer data out of that copy.

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

Keep the old implementation callable until its clients have migrated. For a
hosted tool update to an already published OpenAI plugin, correct any scan
findings and repeat deployment and scanning before continuing:

1. Add the replacement under a new name while the old tool still accepts its
   published inputs and produces its relied-on results. Leave the old tool
   discoverable at this stage.
2. Test calls to both tools through the MCP endpoint.
3. Deploy the server with both tools supported.
4. Rescan in the OpenAI portal.
5. Confirm the replacement is marked **Live** and appears in fresh discovery.
   An issue-free scan alone does not establish that it is Live.
6. Give clients migration instructions and time to adopt the replacement.
7. Only after the replacement is Live, set `discoverable: false` on the old
   tool. Keep old direct calls working under their existing access policy.
8. Rescan in the OpenAI portal.
9. Confirm the old tool is absent from fresh discovery while the replacement
   remains Live.
10. Verify affected clients have migrated.
11. Remove old direct-call support. This breaks clients still calling its old
    name.
12. Update active baselines and migration instructions according to your
    application release policy.

An existing client may still hold the old definition while your server
supports its calls. OpenAI can remove the old tool from fresh discovery as
soon as a scan detects that it is hidden or deleted. Do not rely on an atomic
switch between old and new tool lists.

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
- A changed tool keeps its previous definition live while the update is held;
  a passing update replaces that definition automatically.
- A server deployment takes effect before a scan or approval.

Each tool can pass independently. After deploying a tool change, select
**Rescan** in the portal and inspect both its issues and its **Live definition**
or **Held update**. If the portal says **Earlier version live**, the update is
still held; fix its findings and rescan before treating the new definition as
available. An incomplete check is not an approval, even with no findings. Keep
accepting calls that match each live definition. If a deployment stops the
server from accepting those calls, roll it back.

OpenAI distinguishes these tool updates from changes to submitted plugin
information or imported skills, which require a new draft version, review, and
publication.

Check the [submission flow](https://developers.openai.com/plugins/deploy/submission)
and your own marketplace's rules when planning the release. A server deployed,
a tool approved, a listing published, and a client journey verified are separate
results; record each one you actually observed.
