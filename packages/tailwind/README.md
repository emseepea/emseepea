# Tailwind Stylesheet

`@emseepea/tailwind/styles.css` is the compiled stylesheet for Em See Pea
form views. Consumers import one CSS file and need no Tailwind
configuration or Tailwind runtime dependency.

Choose this package when you want the checked Em See Pea form styles without
copying Tailwind setup into your app.

```ts
import "@emseepea/tailwind/styles.css";
```

The stylesheet has checked light, dark, high-contrast, reduced-motion, reflow,
focus, and target-size behavior. Removing it does not change the form's meaning
or give the browser permission to perform an action.

See the [React UI server example](../../examples/react-ui-server/README.md)
for the checked import path in a working server.

This package is open source under MIT and remains pre-alpha while its version is below 1.0.
