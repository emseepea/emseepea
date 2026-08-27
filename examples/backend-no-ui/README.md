# Backend No-UI Example

This example uses the public `defineMappedTool` API with two synthetic backend
adapters: an in-memory `Map` and a JSON file. Both pass through the same input,
backend-command, backend-result, and public-output validation lifecycle.

## Run

From the repository root:

```sh
npm install
npm run build
npm run start:backend
```

The endpoint is `http://127.0.0.1:3000/mcp`.

Run the HTTP-boundary checks with `npm test`.
