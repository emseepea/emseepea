# `@emseepea/testing`

Test what a Model Context Protocol (MCP) server returns and whether a language
model understands it.

The package starts a Streamable HTTP server, connects through the official MCP
client, and records the MCP operations used by each check. Semantic checks use
Promptfoo and a model command supplied by the caller.

The package is intended to publish under the `next` tag with the first
pre-alpha release.

## Add Semantic Checks to an Example

Install the package as a development dependency:

```sh
npm install --save-dev @emseepea/testing@next
```

Create `eval.yaml` beside the example. Say which server to start, which MCP
operation to run, and what a correct answer must mean:

```yaml
description: Coffee details keep each concept distinct
server: ./dist/server.js
operations:
  - method: tools/call
    name: get-bean-details
    arguments:
      name: Highland Bloom
question: What are this coffee's origin, variety, process, roast, and tasting notes?
criticalFacts: [Sample Highlands, Bourbon, natural, medium, berry, cocoa]
criteria: Keep origin, variety, process, roast, and tasting notes distinct.
```

Build the example, then run:

```sh
npx emseepea-test eval.yaml
```

The check calls the server through the official MCP client. It runs three
answers and three independent judgments per answer, and saves the evidence
under `artifacts/llm-eval/`.
