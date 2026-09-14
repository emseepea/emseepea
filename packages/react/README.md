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

## Render a result in a Model Context Protocol App

Follow [Render an accessible result card](https://emseepea.github.io/emseepea/result-cards/)
for the checked model, React renderer, Model Context Protocol Apps (MCP Apps)
lifecycle, and framework choice.

This package is open source under MIT and remains pre-alpha while its version is below 1.0.
