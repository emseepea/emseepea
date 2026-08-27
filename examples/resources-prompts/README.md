# Resources and prompts example

This private workspace exposes a public static resource, a non-enumerating
public resource template, and a public prompt through `@emseepea/server`.
The template variable and prompt argument opt into checked completion without
adding a separate completion registry.

From the repository root:

```sh
npm run build
npm run start -w @emseepea/example-resources-prompts
```

The server listens on `http://127.0.0.1:3000/mcp` by default. Set `PORT` to
choose another port.

Run the three-trial semantic consumption case with `npm run test:eval`; it
records the official-client resource read and prompt get operations.
