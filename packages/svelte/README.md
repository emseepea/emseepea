# Svelte Result Renderer

`@emseepea/svelte` renders a validated Em See Pea result view with native HTML.
It is unstyled and does not send requests, authenticate people, or authorize
server actions.

```svelte
<script>
  import { ResultCard, createMcpApp } from "@emseepea/svelte";
  import { parseResultView } from "@emseepea/server/ui";

  const app = createMcpApp({ name: "Result", version: "1.0.0", parseResult: parseResultView });
  const view = $derived($app.result ?? loadingView);
</script>

<ResultCard {view} headingLevel={2} onAction={() => app.sendMessage("Continue")} />
```

`createMcpApp` implements the standards-first MCP Apps initialization,
host-context, tool-result, cancellation, teardown, and `ui/message` lifecycle.
Keep domain result parsing and mapping in the adopter, and treat host messages
as untrusted.

For a self-contained resource that does not already use either framework, see
the measured [React and Svelte bundle guidance](../framework/README.md#choose-a-result-card-package).

This package is open source under MIT and remains pre-alpha while its version is below 1.0.
