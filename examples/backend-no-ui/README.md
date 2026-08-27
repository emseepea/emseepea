# Backend No-UI Example

This example uses the public `defineTool` API with two synthetic backends: an
in-memory `Map` and a validated JSON file. Their input and output already match
the public tool contract, so a separate mapping layer would add no value.

Use [`defineMappedTool`](../../packages/framework/README.md#mapped-backend-tool)
when a backend has a genuinely different command or result shape.

## Run

From the repository root:

```sh
npm install
npm run build
npm run start:backend
```

The endpoint is `http://127.0.0.1:3000/mcp`.

Run the HTTP-boundary checks with `npm test`.
