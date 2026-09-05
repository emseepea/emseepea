# `@emseepea/create-progress-streaming-server`

This directory is both the maintained example and its public npm initializer.

## Use This Template

Use this template for a tool that reports bounded progress while its HTTP call
remains open. Choose the [tool server](../tool-server/README.md) when the result
can return promptly. This template does not add replay, reconnectable sessions,
or subscriptions. [Compare all eight templates](https://emseepea.github.io/emseepea/examples/).

## Create a Project

```sh
npm init @emseepea/progress-streaming-server -- my-server
```

<!-- generated-project-readme -->

## Streaming Progress Example

Choose this example when a tool takes long enough that people benefit from
seeing progress before the final answer.

The public tool reports progress during its request. A client can ask for
server-sent events (SSE), which carry progress over the same `POST` request.
Without that request, the tool returns one JSON response when it finishes.

## Run

From this directory:

```sh
npm install
npm run build
npm start
```

The server listens on `http://127.0.0.1:3000/mcp` by default. Set `PORT` to
choose another port. This example starts locally and does not configure a proxy.

To adapt it for a public server, see
[Use Progress Behind a Proxy](https://github.com/emseepea/emseepea/blob/main/packages/framework/README.md#use-progress-behind-a-proxy).
It does not add saved sessions, replay, subscriptions, or recovery after
reconnecting.

## Check This Example

[Ordinary tests](test/) live in `test/`.
The [AI tool-choice and understanding test](eval/meaning.test.mjs) lives separately in `eval/`.
The commands below run each suite independently.

Run its build and progress-stream checks:

```sh
npm test
```

Check that Claude chooses the germination tool and keeps progress separate from the result:

```sh
npm run test:llm
```

If Claude is not already signed in, run `claude auth login` first.
