# Tailwind Stylesheet

`@emseepea/tailwind/styles.css` is the compiled stylesheet for Em See Pea form
views and Result Cards. Consumers import one CSS file and need no Tailwind
configuration or Tailwind runtime dependency.

Choose this package when you want the checked Em See Pea form and Result Card
styles without copying Tailwind setup into your app.

```ts
import "@emseepea/tailwind/styles.css";
```

The stylesheet has checked light, dark, forced-colours, reduced-motion, reflow,
focus, and target-size behavior. Removing it changes presentation only. It
does not change meaning or give the browser permission to perform an action.

See the [React UI server example](../../examples/react-ui-server/README.md)
for the checked import path in a working server.

See [how to render an accessible Result Card](../../website/src/content/docs/result-cards.mdx)
for Native HTML, React, and Svelte guidance.

This package is open source under MIT and remains pre-alpha while its version is below 1.0.
