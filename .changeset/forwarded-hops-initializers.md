---
"@emseepea/create-tool-server": patch
"@emseepea/create-api-backed-server": patch
"@emseepea/create-openapi-backed-server": patch
"@emseepea/create-resources-and-prompts-server": patch
"@emseepea/create-progress-streaming-server": patch
"@emseepea/create-html-ui-server": patch
"@emseepea/create-react-ui-server": patch
"@emseepea/create-multi-instance-postgres-server": patch
"@emseepea/create-database-schema-server": patch
"@emseepea/create-mongodb-backed-server": patch
"@emseepea/create-soap-backed-server": patch
---

Start new projects on a server version that works behind a load balancer which adds to `x-forwarded-for`

Each starter pins a version of the server package, and a project you create
from it uses that version. That pin now points at a server version that reads
the `x-forwarded-for` header differently. The header holds a list of addresses.
The server now finds the client by counting backwards from the last entry.

You can therefore run a project from one of these starters behind a load
balancer that adds its own address to that header. To do that, set
`forwardedHops` in the production deployment profile. On the previous pin the
server started but refused every request that arrived through such a balancer.

Before you set `forwardedHops`, read the note in this release's
`@emseepea/server` entry. A count higher than the real number of proxies is the
dangerous mistake: the server then reads a value the caller supplied, and the
rate limit never catches that caller. Nothing reports it. Count the entries
your own deployment actually adds after your address, and use that number.

Nothing changes for a project that does not set `forwardedHops`. The default
is `0`, which is the behaviour the previous pin had.
