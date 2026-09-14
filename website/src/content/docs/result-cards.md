---
title: Render an accessible result card
description: Use the native HTML, React, or Svelte renderer with one checked result model.
---

Create one checked result model for a Model Context Protocol (MCP) application,
then pass it to the renderer that fits your application. Em See Pea supplies
the result structure and accessibility semantics. Your application keeps
ownership of domain parsing, calculations, wording, effects, action
authorization, and styles.

## Before you start

You need Node.js 22 or 24 and an application with a page shell. The page shell
owns the document language, title, skip link, `main` landmark, one H1, routing,
route focus, and visible focus styles. Add an empty element with `id="result"`
where the card belongs.

Install the checked model and native HTML renderer:

```sh title="Install the native renderer"
npm install @emseepea/server
```

For React, also install `@emseepea/react`, React, and React DOM. For Svelte,
also install `@emseepea/svelte` and Svelte. All three renderers are unstyled.

## Define one result model

Map your checked domain result into `ResultView`. Do not put domain parsing,
calculations, effect authorization, or styling in the renderer.

```ts title="result-view.ts"
import { defineResultView } from "@emseepea/server/ui";

export const resultView = defineResultView({
  id: "pea-result",
  heading: "Pea planting plan",
  headline: "3 varieties match",
  metrics: [{ label: "Matching varieties", value: "3" }],
  reasons: {
    label: "Why these varieties match",
    items: ["They suit the selected growing conditions."],
  },
  disclaimer: "Check local growing advice before planting.",
  state: {
    kind: "ready",
    status: "Pea planting plan ready: 3 varieties match.",
    focusTarget: "none",
  },
});
```

The result is bounded and validated before rendering. It has a contextual
heading, a definition list for the metric, a labelled reasons list, a
disclaimer, and one persistent polite status message.

## Render native HTML

Use `renderResultView` when the application does not need a framework renderer.
Pass the heading level that fits the surrounding page and a unique `idPrefix`
for every result in the document.

```ts title="native.ts"
import { renderResultView } from "@emseepea/server/ui";
import { resultView } from "./result-view.js";

const target = document.querySelector<HTMLElement>("#result");
if (!target) throw new Error("Missing #result host element");

target.innerHTML = renderResultView(resultView, {
  headingLevel: 2,
  idPrefix: "pea-result-card",
});
```

The host element now contains native headings, lists, and status semantics. The
renderer escapes result text and does not create the page shell.

This snippet is for the initial native render. For later state changes, keep the
status element mounted and update its `textContent`. Use React or Svelte when
the rest of the card also changes dynamically.

## Render with React

Choose React when the application already uses React. Install the renderer:

```sh title="Install the React renderer"
npm install @emseepea/react react react-dom
```

```tsx title="react.tsx"
import { ResultCard } from "@emseepea/react";
import { createRoot } from "react-dom/client";
import { resultView } from "./result-view.js";

const target = document.querySelector<HTMLElement>("#result");
if (!target) throw new Error("Missing #result host element");

createRoot(target).render(
  <ResultCard view={resultView} headingLevel={2} idPrefix="pea-result-card" />,
);
```

`ResultCard` renders the same checked result structure as the native renderer.
It does not parse domain data, perform effects, or apply styles.

## Render with Svelte

Choose Svelte for a self-contained Model Context Protocol Apps (MCP Apps)
resource when either framework is acceptable. Install the renderer:

```sh title="Install the Svelte renderer"
npm install @emseepea/svelte svelte
```

```svelte title="SvelteApp.svelte"
<script lang="ts">
  import { ResultCard } from "@emseepea/svelte";
  import { resultView } from "./result-view.js";
</script>

<ResultCard view={resultView} headingLevel={2} idPrefix="pea-result-card" />
```

`ResultCard` renders the same names, semantics, heading level, and status as the
native and React renderers. Em See Pea does not provide a Svelte initializer or
bundled styling.

This recommendation is based on the maintained equivalent production fixture.
Svelte measured 27.9% smaller with gzip and 27.2% smaller with Brotli. The
fixture used esbuild `0.28.2`, React and React DOM `19.2.8`, Svelte `5.57.0`,
minified ES modules, an ES2022 target, and no source maps.

- React: 534,121 raw bytes; 129,181 bytes with gzip level 9; 109,052 bytes
  with Brotli quality 11.
- Svelte: 406,619 raw bytes; 93,075 bytes with gzip level 9; 79,414 bytes
  with Brotli quality 11.
- Reduction: 23.9% raw; 27.9% with gzip; 27.2% with Brotli.

These measurements apply only to this fixture and dependency set. They are not
a general claim about framework speed or bundle size. Run
`npm run measure:result-cards` in the repository to reproduce them.

## Add MCP Apps lifecycle only when needed

Use `useMcpApp` in React or `createMcpApp` in Svelte only for the MCP Apps host
lifecycle. These bindings handle initialization, host context, tool results,
cancellation, teardown, and `ui/message` through the shared checked controller.

The maintained [React result-card fixture](https://github.com/emseepea/emseepea/blob/main/tests/fixtures/result-card-bundles/react.tsx)
and [Svelte result-card fixture](https://github.com/emseepea/emseepea/blob/main/tests/fixtures/result-card-bundles/SvelteApp.svelte)
show the lifecycle bindings. Treat every host message as untrusted input.

## Add actions and state updates

Result actions are native buttons. An action callback reports the selected
presentation action; it does not authorize a server effect. Check identity,
permissions, current state, and request data again at the effect boundary.

For an action that continues the conversation, set the state to `sending`
before awaiting `app.sendMessage(prompt)`. This sends a `ui/message` request.
While it is pending, set `action.disabled` to `true` and update the existing
status to ongoing text such as `Asking ChatGPT: Show me growing tips.`

After the host accepts the message, use completion text such as
`Asked ChatGPT: Show me growing tips.` If the request fails, show a short error.
Tell the user how to continue in the chat.

The
[maintained React result example](https://github.com/emseepea/emseepea/blob/main/examples/react-ui-server/src/mcp-app.tsx)
implements this sequence without making the action a server-side effect.

Update the existing `state.status` text for loading, completion, cancellation,
and errors. Keep one persistent polite status instead of adding another live
region. Use `focusTarget` only when focus must move after a meaningful update.
Do not make the whole card clickable or add custom card roles, positive
`tabindex` values, redundant ARIA, or extra landmarks.

## Check the result

The documentation test suite builds these examples outside the monorepo against
packed public packages. The cross-renderer contract tests
also check hostile text escaping, names, semantics, heading levels, status
updates, focus targets, native buttons, mobile reflow, forced colours, reduced
motion, and contrast-related states.

After adapting the model, run your application build and keyboard checks.
Confirm that the card reflows at 320 CSS pixels, visible focus remains clear,
and status changes are announced once without moving focus unnecessarily.

For the complete checked behaviour, read:

- the [`ResultView` source and native renderer](https://github.com/emseepea/emseepea/blob/main/packages/framework/src/ui.ts);
- the [maintained React result example](https://github.com/emseepea/emseepea/blob/main/examples/react-ui-server/src/mcp-app.tsx); and
- the [cross-renderer contract tests](https://github.com/emseepea/emseepea/blob/main/tests/black-box/ui-contract.test.mjs).
