# Public Web Service Backend Example

Choose this example when your MCP tool needs to read a public web service and
return selected, checked data in a clear result for an assistant.

This example exposes one read-only `search-coffee-catalog` tool. A normal run
searches [BrewMark's public coffee catalogue](https://brewmark.io/developers/api-docs)
and returns at most five coffees.

Unlike the [first public tool example](https://github.com/emseepea/emseepea/tree/main/examples/basic-no-ui),
this tool adapts a separate service. The public input and result use the Model Context Protocol
(MCP). BrewMark's query and response are checked before the result is returned.

The tool preserves BrewMark's useful field names and values. It does not keep a
second list of roast levels, so BrewMark can add a valid level without requiring
an MCP release. Separate public and backend schemas still select and check every
field that can reach the caller.

The caller can choose a search term and roast filter. The caller cannot change
the website, path, result limit, sort order, credentials, or HTTP rules. Search
terms are sent to BrewMark. The example does not send authentication details or
change data. Do not include personal, secret, or confidential information in a
search term.

The automated checks use invented coffee records through the same MCP server.
They do not depend on BrewMark being available and do not make a speed or uptime
claim for BrewMark. Normal runs use BrewMark's fair-use public web service.

## Run

From this directory:

```sh
npm install
npm run build
npm start
```

The endpoint is `http://127.0.0.1:3000/mcp`.

## Check This Example

[Ordinary tests](test/) live in `test/`.
The [AI tool-choice and understanding test](eval/meaning.test.mjs) lives separately in `eval/`.
The commands below run each suite independently.

Run its build, mapping, validation, and MCP checks:

```sh
npm test
```

Check that Claude chooses catalogue search and understands the rating scales:

```sh
npm run test:llm
```

If Claude is not already signed in, run `claude auth login` first.
