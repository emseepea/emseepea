# `@emseepea/create-html-ui-server`

This directory is both the maintained example and its public npm initializer.

```sh
npm init @emseepea/html-ui-server@next -- my-server
```

<!-- generated-project-readme -->

## Native UI Example

Choose this example when you need an accessible form but do not want React or
another browser UI framework.

This example adds one server-rendered form to the Fastify Model Context
Protocol (MCP) server. It uses the native renderer and the same sample states as
the React example. Choose the React example instead when your application
already uses React and needs client-side updates.

## Run

From this directory:

```sh
npm install
npm run build
npm start
```

Open
`http://127.0.0.1:3000/` for the page or use
`http://127.0.0.1:3000/mcp` for Model Context Protocol (MCP).

The page previews content only. It does not send or store a report.

## Check This Example

[Ordinary tests](test/) live in `test/`.
The [AI tool-choice and understanding test](eval/meaning.test.mjs) lives separately in `eval/`.
The commands below run each suite independently.

Run its build, browser, keyboard, and accessibility checks:

```sh
npm test
```

Check that Claude chooses the preview tool and understands that it changes nothing:

```sh
npm run test:llm
```

If Claude is not already signed in, run `claude auth login` first.
