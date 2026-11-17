# Current Release Readiness

Date: 2026-11-17

## Stateless MCP tools on Cloudflare Workers

Status: **PREPARED**. Publication is pending.

The public `createEmseepeaFetch` entry point serves explicitly registered
tools at `/mcp`. Developers can use the same tool declaration on Cloudflare
Workers and Node/Fastify. The Fetch entry point checks configured request
authorities, supplied browser origins, request bytes, and authorization
before dispatching a tool.

## Planned packages

- `@emseepea/create-api-backed-server@0.1.38`
- `@emseepea/create-database-schema-server@0.1.38`
- `@emseepea/create-html-ui-server@0.1.38`
- `@emseepea/create-mongodb-backed-server@0.1.38`
- `@emseepea/create-multi-instance-postgres-server@0.1.38`
- `@emseepea/create-openapi-backed-server@0.1.38`
- `@emseepea/create-progress-streaming-server@0.1.38`
- `@emseepea/create-react-ui-server@0.1.38`
- `@emseepea/create-resources-and-prompts-server@0.1.38`
- `@emseepea/create-soap-backed-server@0.1.38`
- `@emseepea/create-tool-server@0.1.38`
- `@emseepea/feedback@0.13.2`
- `@emseepea/react@0.4.24`
- `@emseepea/server@0.27.0`
- `@emseepea/svelte@0.2.24`
- `@emseepea/testing@0.26.17`

## Qualification

An independent install of a locally packed server ran one synthetic tool
through Fastify and local workerd. Discovery, listing, structured results,
and input and output validation matched. Workerd checks exercised declared
and streamed request size, authority and Origin, public OAuth metadata,
protected discovery, and verified caller access. The checks covered missing,
invalid, expired, wrong-resource, and insufficient-scope credentials,
verifier timeout, and rejection before tool input validation.

The exact source Quality run and release candidate qualification must pass
before promotion. Verify the installed registry package on both runtimes,
then confirm publication and mergeback. The published deployment guide and
live Worker verification are tracked separately in issue #246.

- Result: PASS
- Final result: within appetite, subject to the required exact-commit gates.
