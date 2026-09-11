---
title: Choose an example
description: Find a starting point for tools, APIs, databases, SOAP, progress, forms, or shared reports.
---

Each initializer creates a standalone app with `private: true` in
`package.json`, application code, ordinary tests in `test/`, and language-model
tests in `eval/`. Capability
modules live in `src/capabilities/` and are discovered once at startup. Replace
`my-server` with an unused directory name. The [first-server guide](../getting-started/)
continues from the tool server starter.

## Build a production container

### Build with npm

Run `npm install` first. This creates the `package-lock.json` required by the
image build. Then run:

```sh
npm run container:build
```

The Dockerfile uses `npm ci` and fails when the lockfile is absent.

### Configure production behind a trusted proxy

The container is not safe for direct public exposure. Run it behind a trusted
proxy and mount the required deployment configuration at runtime. Local
`npm start` remains loopback-only on your computer. Container startup selects the fail-closed
`production-behind-proxy` deployment profile and refuses to start the app unless
`EMSEEPEA_DEPLOYMENT_CONFIG_FILE` points to a runtime-mounted JSON file.

The deployment file contains only non-secret policy:

```json
{
  "allowedAuthorities": ["mcp.example.com"],
  "allowedOrigins": ["https://mcp.example.com"],
  "trustedProxyAddresses": ["10.0.0.10"],
  "rateLimit": {
    "maxRequests": 100,
    "windowMs": 60000,
    "maxClients": 1000
  }
}
```

Those values show the shape only. Replace them with your real host, browser
origin, trusted proxy address, and request limits.

### Keep secrets out of the image

Provide secrets through your deployment platform at runtime. Do not add secrets
to the image, Dockerfile, deployment configuration file, or source control.

### Harden the running container

Run the image with:

- a read-only root filesystem
- a small writable temporary filesystem
- all Linux capabilities dropped
- `no-new-privileges`
- the deployment file mounted read-only

Put the container behind a proxy that:

- terminates TLS
- forwards exactly one client address
- sets HTTPS and authority metadata
- forwards `Origin` only when the client supplied it
- leaves `Authorization` unchanged

### Database examples are local-only

Docker Compose starts the database for local development only. It is not a
production deployment recipe. Use `npm run db:start` to start the local
database. `npm run db:reset` deletes the local database volume and its data.
You cannot undo this action.

### Read example-specific notes

For example-specific runtime assets and dependency notes, use the maintained
READMEs:

- [Tool server](https://github.com/emseepea/emseepea/tree/main/examples/tool-server)
- [API-backed server](https://github.com/emseepea/emseepea/tree/main/examples/api-backed-server)
- [OpenAPI-backed server](https://github.com/emseepea/emseepea/tree/main/examples/openapi-backed-server)
- [Resources and prompts server](https://github.com/emseepea/emseepea/tree/main/examples/resources-and-prompts-server)
- [Progress streaming server](https://github.com/emseepea/emseepea/tree/main/examples/progress-streaming-server)
- [HTML UI server](https://github.com/emseepea/emseepea/tree/main/examples/html-ui-server)
- [React UI server](https://github.com/emseepea/emseepea/tree/main/examples/react-ui-server)
- [Multi-instance PostgreSQL server](https://github.com/emseepea/emseepea/tree/main/examples/multi-instance-postgres-server)
- [Database-schema server](https://github.com/emseepea/emseepea/tree/main/examples/database-schema-server)
- [MongoDB-backed server](https://github.com/emseepea/emseepea/tree/main/examples/mongodb-backed-server)
- [SOAP-backed server](https://github.com/emseepea/emseepea/tree/main/examples/soap-backed-server)

For each starter, the linked GitHub example directory contains the public
initializer package, README, changelog, and maintained example source. The
commands use the default npm release channel.

## Answer questions about your data

**Tool server.** Read details from a small in-memory catalogue.
Use it to learn the tool definition without another service to configure.

```sh
npm init @emseepea/tool-server -- my-server
```

[Read the tool server example](https://github.com/emseepea/emseepea/tree/main/examples/tool-server).

## Connect a public API

**API-backed server.** Call an external JSON API and return selected, checked
fields as an MCP result. The example preserves useful service values instead of
maintaining a second closed list that needs another release when the service adds
a valid value.

```sh
npm init @emseepea/api-backed-server -- my-server
```

[Read the API-backed server example](https://github.com/emseepea/emseepea/tree/main/examples/api-backed-server).

## Generate an API boundary from OpenAPI

**OpenAPI-backed server.** Generate TypeScript declarations and Zod runtime
validators from a committed OpenAPI 3 contract. A local Swagger 2 fixture also
demonstrates the conversion path. Choose the API-backed server above when no
usable machine-readable contract exists.

```sh
npm init @emseepea/openapi-backed-server -- my-server
```

[Read the OpenAPI-backed server example](https://github.com/emseepea/emseepea/tree/main/examples/openapi-backed-server).

## Add authentication or observability

Every starter is open by default. Its app factory also accepts the same typed
authentication and observability extensions. The starter's README and tests
show both open and protected composition, so choose a starter for the
application shape instead of choosing a separate security template.

Discovery stays public by default. Protect it explicitly only when the
catalogue itself is sensitive. Protected discovery shows each principal only
the capabilities allowed by their permissions. OAuth metadata remains public
so clients can learn how to authenticate.

## Retire a capability through a marketplace review window

Set `discoverable: false` on a retiring tool, resource, resource template, or
prompt. It disappears from MCP list discovery but remains callable by clients
that already know its name or URI, subject to its existing access policy.

Publish the replacement first. Then submit and publish the hidden-but-callable
version. Remove the old capability only after the marketplace supports that
version. This setting preserves compatibility during review; it does not grant
authorization or make a known capability secret.

## Add feedback to any starter

Feedback is a cross-cutting capability, not another application shape. Install
`@emseepea/feedback` after choosing any starter. Add a public detailed
submission, a protected durable support conversation, or both through the
starter's `additionalTools` option.

PostgreSQL and Firestore can keep append-only conversations and transactional
notification outboxes. GitHub Issues and Zendesk can remain the authoritative
support system, including native replies, actions, status, and notifications.

[Choose a feedback mode and backend](../feedback/).

## Share reference material and prompts

Provide readable resources, resource addresses with parameters, reusable
prompts, and suggestions for prompt fields.

Use a static resource for content at one registered URI. Use a resource template
for content at predictable URIs, such as `invoice://{invoiceId}`.

`resources/list` returns metadata for static resources registered with the
server. `resources/templates/list` returns metadata for registered URI
templates. These methods do not query application records, return resource
contents, or expand templates into matching resource URIs.

For a large or searchable collection, provide a list or search tool that
validates its inputs and limits the number of results. The tool can return
useful record details and a concrete resource URI for each relevant result. A
client can pass that URI to `resources/read`, which performs its own
authorization check before reading the resource.

```sh
npm init @emseepea/resources-and-prompts-server -- my-server
```

[Read the resources and prompts server example](https://github.com/emseepea/emseepea/tree/main/examples/resources-and-prompts-server).

## Report progress during a tool call

Public or protected tools can send updates over the same open `POST` response,
then return one final result. In production, a trusted proxy can forward this
response without buffering it. The framework authenticates and authorizes
protected calls before application code or the event stream begins. This does
not add saved sessions, replay, or subscriptions.

```sh
npm init @emseepea/progress-streaming-server -- my-server
```

[Read the progress-streaming server example](https://github.com/emseepea/emseepea/tree/main/examples/progress-streaming-server).

## Add a web form

The native HTML and React examples show the same pea planting-plan form. Choose native
HTML for fewer dependencies, or React to fit an existing React application.
The HTML example keeps page, form, and stylesheet handlers in `src/routes/`.
The React example also keeps its browser-script handler there. Both register
the routes once during startup.

For native HTML:

```sh
npm init @emseepea/html-ui-server -- my-server
```

For React:

```sh
npm init @emseepea/react-ui-server -- my-server
```

[Read the HTML UI server example](https://github.com/emseepea/emseepea/tree/main/examples/html-ui-server)
or [the React UI server example](https://github.com/emseepea/emseepea/tree/main/examples/react-ui-server).

## Share a report store between server instances

Interchangeable server instances use the same PostgreSQL store. Save a complete
harvest report through one process and retrieve or update it through another,
without exposing server identity or routing to the user. The garden bed and
harvest date identify one report.

Use:

```sh
npm init @emseepea/multi-instance-postgres-server -- my-server
```

[Read the multi-instance PostgreSQL server example](https://github.com/emseepea/emseepea/tree/main/examples/multi-instance-postgres-server).

## Generate validation from a PostgreSQL schema

Use an existing PostgreSQL schema as the internal contract. The initializer
generates checked-in TypeScript and runtime validation, prefers reads and writes
through a view, and includes one stored procedure as a secondary pattern.

```sh
npm init @emseepea/database-schema-server -- my-server
```

[Read the database-schema server example](https://github.com/emseepea/emseepea/tree/main/examples/database-schema-server).

## Connect MongoDB collections

Compare two collection policies in one project. Pea varieties use a MongoDB
validator. Pea observations remain schemaless and are validated by the
application before writes and after reads. Tools follow the user's task rather
than exposing either storage policy.

```sh
npm init @emseepea/mongodb-backed-server -- my-server
```

[Read the MongoDB-backed server example](https://github.com/emseepea/emseepea/tree/main/examples/mongodb-backed-server).

## Connect a SOAP service

Keep a local WSDL and XSD authoritative for a legacy SOAP service. Generate
TypeScript from the contract, validate raw XML before parsing, and return small,
described JSON to the model.

```sh
npm init @emseepea/soap-backed-server -- my-server
```

[Read the SOAP-backed server example](https://github.com/emseepea/emseepea/tree/main/examples/soap-backed-server).
