# `@emseepea/create-resources-and-prompts-server`

This directory is both the maintained example and its public npm initializer.

## Use This Template

Use this template to publish readable resources, parameterized resource
addresses, reusable prompts, and prompt-field suggestions. Choose the
[tool server](../tool-server/README.md) when the model needs to call an
operation instead of reading material or rendering a prompt. [Compare all eight templates](https://emseepea.github.io/emseepea/examples/).

## Create a Project

```sh
npm init @emseepea/resources-and-prompts-server -- my-server
```

<!-- generated-project-readme -->

## Resources and Prompts Example

Choose this example when you want to give an assistant reusable reference
content and guided starting questions, without adding another tool.

It provides:

- a fixed resource at one known address
- a resource pattern for related content at predictable addresses
- a reusable prompt with one checked argument
- optional suggestions for the resource and prompt fields

## Run

From this directory:

```sh
npm install
npm run build
npm start
```

The server listens on `http://127.0.0.1:3000/mcp` by default. Set `PORT` to
choose another port.

## Check This Example

[Ordinary tests](test/) live in `test/`.
The [AI understanding test](eval/meaning.test.mjs) lives separately in `eval/`.
The commands below run each suite independently.

Run its build and MCP resource and prompt checks:

```sh
npm test
```

Check that Claude keeps sowing depth and plant spacing distinct:

```sh
npm run test:llm
```

If Claude is not already signed in, run `claude auth login` first.
