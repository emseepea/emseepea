# Resources and Prompts Example

Choose this example when you want to give an assistant reusable reference
content and guided starting questions, without adding another tool.

It provides:

- a fixed resource at one known address
- a resource pattern for related content at predictable addresses
- a reusable prompt with one checked argument
- optional suggestions for the resource and prompt fields

## Run

From the repository root:

```sh
npm install
npm run build
npm run start -w @emseepea/example-resources-prompts
```

The server listens on `http://127.0.0.1:3000/mcp` by default. Set `PORT` to
choose another port.

## Check This Example

Run its build and MCP resource and prompt checks:

```sh
npm test -w @emseepea/example-resources-prompts
```

Check that Claude keeps coffee strength and extraction distinct:

```sh
npm run test:llm -w @emseepea/example-resources-prompts
```

If Claude is not already signed in, run `npm run claude:login` from the
repository root first.
