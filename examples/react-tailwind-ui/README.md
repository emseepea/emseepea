# React and Tailwind UI Example

Choose this example when your application already uses React and you want an
accessible form without writing Tailwind configuration or component styles.

This example makes the server-rendered form interactive with React and imports
one compiled Em See Pea stylesheet. It needs no Tailwind configuration and uses
the same sample states as the native example.

## Run

From the repository root:

```sh
npm install
npm run build
npm run start:react-ui
```

Open
`http://127.0.0.1:3001/` for the page or use
`http://127.0.0.1:3001/mcp` for Model Context Protocol (MCP).

The page previews content only. It does not send or store a report.

## Check This Example

[Ordinary tests](test/) live in `test/`.
The [AI understanding test](eval/meaning.test.mjs) lives separately in `eval/`.
The commands below run each suite independently.

Run its build, browser, keyboard, React, and accessibility checks:

```sh
npm test -w @emseepea/example-react-tailwind-ui
```

Check that Claude understands that a preview changes nothing:

```sh
npm run test:llm -w @emseepea/example-react-tailwind-ui
```

If Claude is not already signed in, run `npm run claude:login` from the
repository root first.
