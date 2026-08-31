# Public Web Service Backend Example

Choose this example when your MCP tool needs to read a public web service and
translate its data into a clear result for an assistant.

This example exposes one read-only `search-coffee-catalog` tool. A normal run
searches [BrewMark's public coffee catalogue](https://brewmark.io/developers/api-docs)
and returns at most five coffees.

Unlike the [basic no-UI example](../basic-no-ui/README.md), this tool adapts a
separate service. The public input and result use the Model Context Protocol
(MCP). BrewMark's query and response are checked before the result is returned.

The caller can choose a search term and roast filter. The caller cannot change
the website, path, result limit, sort order, credentials, or HTTP rules. Search
terms are sent to BrewMark. The example does not send authentication details or
change data. Do not include personal, secret, or confidential information in a
search term.

The automated checks use invented coffee records through the same MCP server.
They do not depend on BrewMark being available and do not make a speed or uptime
claim for BrewMark. Normal runs use BrewMark's fair-use public web service.

## Run

From the repository root:

```sh
npm install
npm run build
npm run start:backend
```

The endpoint is `http://127.0.0.1:3000/mcp`.

## Check This Example

[Ordinary tests](test/) live in `test/`.
The [AI understanding test](eval/meaning.test.mjs) lives separately in `eval/`.
The commands below run each suite independently.

Run its build, mapping, validation, and MCP checks:

```sh
npm test -w @emseepea/example-backend-no-ui
```

Check that Claude understands the catalogue and rating scales correctly:

```sh
npm run test:llm -w @emseepea/example-backend-no-ui
```

If Claude is not already signed in, run `npm run claude:login` from the
repository root first.
