# `@emseepea/create-api-backed-server`

This directory is both the maintained example and its public npm initializer.

## Use This Template

Use this template when a tool calls a public JSON API and must validate and
select the fields returned to the caller. Choose the [tool server](../tool-server/README.md)
when all data is local, or the [sign-in tool server](../sign-in-tool-server/README.md)
when calling the tool requires authentication. [Compare all eight templates](https://emseepea.github.io/emseepea/examples/).

## Create a Project

```sh
npm init @emseepea/api-backed-server -- my-server
```

<!-- generated-project-readme -->

## Public Web Service Backend Example

Choose this example when your MCP tool needs to read a public web service and
return selected, checked data in a clear result for an assistant.

This example exposes one read-only `search-pea-taxa` tool. A normal run searches
[iNaturalist's public taxon catalogue](https://api.inaturalist.org/v1/docs/)
and returns at most five matching species.

Unlike the [first public tool example](https://github.com/emseepea/emseepea/tree/main/examples/tool-server),
this tool adapts a separate service. The public input and result use the Model Context Protocol
(MCP). The iNaturalist query and response are checked before the result is returned.

The tool preserves iNaturalist's useful field names and values. For example,
`rank` remains an open string, so iNaturalist can add a valid rank without
requiring an MCP release. Separate public and backend schemas still select and
check every field that can reach the caller.

The caller can choose a search term. The caller cannot change
the website, path, result limit, credentials, or HTTP rules. Search
terms are sent to iNaturalist. The example does not send authentication details or
change data. Do not include personal, secret, or confidential information in a
search term.

The automated checks use fixed pea taxon records through the same MCP server.
They do not depend on iNaturalist being available and do not make a speed or uptime
claim for iNaturalist. Normal runs use iNaturalist's public API.

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

Check that Claude chooses taxon search and understands the observation count:

```sh
npm run test:llm
```

If Claude is not already signed in, run `claude auth login` first.
