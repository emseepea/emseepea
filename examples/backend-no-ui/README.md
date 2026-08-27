# Backend No-UI Example

This example exposes one read-only `create-bean-report` tool through the public
`defineMappedTool` API. It optionally filters a validated JSON catalogue by
roast and returns a useful report.

Unlike the [basic no-UI example](../basic-no-ui/README.md), this example has a
genuine public/private contract boundary. Public camel-case filters and report
fields are mapped to and from private snake-case backend commands and rows. The
file path remains module-owned and cannot be selected by the caller.

## Run

From the repository root:

```sh
npm install
npm run build
npm run start:backend
```

The endpoint is `http://127.0.0.1:3000/mcp`.

Run the HTTP-boundary checks with `npm test`.
