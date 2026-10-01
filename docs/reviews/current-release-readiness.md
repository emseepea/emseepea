# Current Release Readiness

Date: 2026-10-01

This review covers the MCP versioning guide correction and a Fastify advisory
repair required by Quality. It is a release plan, not a publication claim.

## Planned Package Set

The planned public package versions are:

- `@emseepea/server@0.19.1`
- `@emseepea/feedback@0.5.1`
- `@emseepea/react@0.4.1`
- `@emseepea/svelte@0.2.1`
- `@emseepea/testing@0.17.1`

The server patch updates Fastify from 5.12.1 to 5.12.5. Changesets plans the
other public patches for their internal dependencies. The private
`@emseepea/website` patch to 0.0.3 carries the guide.

## Source Evidence and Limits

The guide now follows OpenAI's independent tool checks: deploy with both tools
callable, confirm the replacement is Live, then hide the old tool from
discovery. It keeps published, submitted, and currently live definitions in
the compatibility check and retains reviewer scenarios in CI. The change does
not alter the testing package or claim that a portal status proves a client
journey.

Architecture, Jobs To Be Done, voice and tone, cognitive accessibility, and
web accessibility reviews passed for the guide. The local website build and
all 14 built website tests passed. Quality failed its OSV scan on Fastify
5.12.1; OSV identifies 5.12.5 as fixing all five reported advisories. A clean
install with the updated lockfile succeeded, and npm audit reported zero
vulnerabilities. Exact-commit tests, Quality, package publication, and
deployed-site verification remain separate gates.

## Required Publication Evidence

- Pass local website build and website tests.
- Qualify the exact committed source and pass Quality on the exact `main` push.
- Confirm the release pull request contains the planned package versions.
- Verify the exact public package versions and provenance in the registry.
- Deploy the website artifact measured by the exact Quality run.
- Read back the live guide before claiming publication.

## Review Status, Not Release Status

The labels below are read by release tooling. They describe conditional
readiness and do not assert publication or website deployment.

- Result: PASS
- Risk review: PASS within the accepted 5/25 risk threshold.
- Final result: within appetite, subject to the required exact-commit gates.
- Release verification: NOT COMPLETE.
