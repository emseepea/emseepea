# `@emseepea/create-soap-backed-server`

This directory is both the maintained example and the template source for its
public npm initializer.

## Use This Template

Use this template when an MCP tool must call an existing SOAP service whose
WSDL and XSD remain authoritative. It shows local contract loading, generated
TypeScript, raw XML validation before parsing, and a small public MCP schema.

Choose the [API-backed server](../api-backed-server/README.md) for JSON over
HTTP, or the [tool server](../tool-server/README.md) when no backend service is
needed. [Compare all templates](https://emseepea.github.io/emseepea/examples/).

## Create a Project

```sh
npm init @emseepea/soap-backed-server -- my-server
```

The command creates a standalone app in a new `my-server` directory and sets
`private: true` in its `package.json` so the app cannot be published by
accident. It includes local service contracts, checked-in generated types,
lint checks, ordinary tests, and a semantic test.

<!-- generated-project-readme -->

## Choose Open or Protected Access

Start open when the catalogue and operations are public.

To protect this template, pass both options to the app factory:

- `access: { access: "protected", requiredScopes: ["peas:read"] }`
- an `authentication` adapter

Keep `authentication.discovery` as `"public"` unless capability names or
schemas are sensitive. Use `"protected"` only when each principal should see a
permission-filtered catalogue. OAuth metadata remains public in both modes.

## Add Observability

The same factory accepts `observability`.

- Use `structuredLogging` for safe structured events.
- Use `openTelemetry` for traces and metrics.

Adapters receive only redacted framework events. They never receive request
bodies, arguments, results, tokens, provider claims, or raw errors. See the
[server API](https://github.com/emseepea/emseepea/tree/main/packages/framework#authentication-and-observability) for the complete configuration.

## SOAP-Backed Server

The committed WSDL defines the operation and imports the committed service XSD.
That XSD generates `src/generated/pea-service.ts`. The same XSD is imported by
the SOAP-envelope schema used to validate every raw response before the `soap`
library parses it.

Normal builds and starts use checked-in generated types and local contracts.
They never fetch a WSDL or XSD. Compatible backend values pass through without
translation tables.

## Configure the Service

Set the one fixed SOAP endpoint, then build and start:

```sh
npm install
npm run build
PEA_SOAP_URL=https://soap.example.test/pea npm start
```

Keep service credentials outside the URL and source code. Add authentication
headers inside the server for your provider. Never accept an endpoint, schema
location, SOAP action, or arbitrary XML from an MCP caller.

## Change the Contract

Edit the local files under `contracts/`, then regenerate and review the diff:

```sh
npm run generate
npm run generate:check
```

The generator maps the XSD's required fields, optional fields, arrays, numeric
types, and named types into TypeScript. The runtime XSD validator enforces the
actual restrictions.

## Safety Boundary

The transport accepts responses only from `PEA_SOAP_URL`. It does not follow
redirects. It rejects requests or responses over 64 KiB, DTDs, entity
declarations, malformed XML, XSD-invalid XML, SOAP faults, and responses taking
longer than 1.5 seconds. Schema imports are restricted to the committed local
service XSD. Public failures contain no provider details.

## Tool

`get-pea-variety` retrieves one variety and returns described JSON. The MCP
caller never sees SOAP XML or chooses transport details.

## Check This Project

Run generation, lint, build, and ordinary tests without spending model tokens:

```sh
npm run generate:check
npm run lint
npm test
```

Run the more expensive AI test separately:

```sh
npm run test:llm
```

If Claude is not already signed in, run `claude auth login` first.
