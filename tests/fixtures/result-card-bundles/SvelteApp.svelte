<script>
  import { ResultCard, createMcpApp } from "@emseepea/svelte";
  import { parseResultView } from "@emseepea/server/ui";
  import { loading } from "./shared.js";

  const app = createMcpApp({ name: "Result", version: "1.0.0", parseResult: parseResultView });
  const view = $derived($app.result ?? loading);
</script>

<ResultCard {view} headingLevel={2} onAction={() => app.sendMessage("Continue")} />
