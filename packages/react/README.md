# React Renderer

`@emseepea/react` renders validated Em See Pea form and result views with native
HTML controls. It is unstyled and does not send requests, authenticate people,
or authorize server actions.

Choose this package when your app already uses React and you want Em See Pea
to render the form structure for you.

```tsx
import { ElicitationForm } from "@emseepea/react";

<ElicitationForm view={view} headingLevel={2} onSubmit={submit} />;
```

See the [React UI server example](../../examples/react-ui-server/README.md)
for the checked renderer in a working server.

## Render an MCP Apps result

Use `ResultCard` with the validated model from `@emseepea/server/ui`. The
component keeps status announcements persistent and uses native headings,
lists, disclosures, and buttons.

```tsx
import { ResultCard, useMcpApp, useMcpTheme } from "@emseepea/react";
import { useEffect } from "react";

const app = useMcpApp({ name: "Result", version: "1.0.0", parseResult });
<ResultCard view={toResultView(app.result)} headingLevel={2} />;
```

`useMcpApp` implements the standards-first MCP Apps initialization, host-context,
tool-result, cancellation, teardown, and `ui/message` lifecycle. Keep domain
result parsing and mapping in the adopter, and treat host messages as untrusted.

Use `useMcpTheme` when the app also runs outside an MCP host. A host theme wins;
otherwise the hook follows the browser colour scheme. The hook returns the value
without applying styles, attributes, or classes.

```tsx
const theme = useMcpTheme(app.hostContext.theme);

useEffect(() => {
  document.documentElement.dataset.emseepeaTheme = theme;
}, [theme]);
```

For a self-contained resource that does not already use React, see the measured
[React and Svelte bundle guidance](../framework/README.md#choose-a-result-card-package).
When React is already present, this package avoids adding a second framework.

This package is open source under MIT and remains pre-alpha while its version is below 1.0.
