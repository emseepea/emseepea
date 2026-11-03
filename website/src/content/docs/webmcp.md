---
title: Expose MCP tools in a browser
description: Register the tools from an existing MCP client with native WebMCP.
---

Web Model Context Protocol (WebMCP) lets a website register tools with a supporting browser. Use the optional browser-only entry point to expose every tool visible through your connected Model Context Protocol (MCP) client. Feedback is one use case; the adapter works with other tools too.

## Register your catalogue

Connect and authenticate your MCP client using your existing application setup. Then register its tools in one call:

```ts title="Register the tool catalogue"
import { registerWebMcp } from "@emseepea/server/webmcp";

const registration = await registerWebMcp({ client });

if (!registration.available) {
  // Keep your normal website interface available.
}

function disposeWebMcp() {
  if (registration.available) registration.dispose();
}
```

Call `disposeWebMcp()` from your existing logout or account/client-change handler. Keep the registration active while that client is in use.

The adapter does not connect, authenticate or close the supplied client. Your server still authorizes each call. A public tool listing can include tools that require authentication when invoked.

Registration is a snapshot. Reconnect and register again after changing the server deployment or client identity. Disposal removes only this adapter’s registrations and cancels its pending calls.

## Select tools when needed

All discovered tools are included by default, across every listing page. To select a smaller set, provide a predicate:

```ts title="Filter the catalogue"
const registration = await registerWebMcp({
  client,
  filter: (tool) => tool.name.startsWith("catalogue-"),
});
```

Existing page-tool names are preserved. A name collision or registration failure rejects the operation and removes registrations made by that attempt. The adapter does not replace unrelated page tools.

## Cancellation and outcomes

Pass an `AbortSignal` to bind registration and calls to your application’s lifetime. You can use `AbortSignal.timeout()` when your application needs a deadline; the adapter adds no separate timeout policy.

Successful calls return the complete checked MCP result as JSON, including `content`, `structuredContent` and `isError`. Text, image, audio, embedded resources and resource links remain in that result envelope.

A transport error or cancellation after dispatch returns an unknown outcome. The operation may already have completed. The adapter does not retry automatically or claim that cancellation rolled back a write. Raw transport exceptions are not shown to the agent.

## Metadata and current limits

Server-declared `readOnlyHint` is preserved. The adapter sets `consequentialHint` to `true` unless the server explicitly declares the tool read-only. This is framework policy, not a browser default. Server result content is marked untrusted.

MCP `outputSchema` describes `structuredContent`, while WebMCP `outputSchema` would describe the complete returned result. This increment does not expose that schema through WebMCP. When available, `registration.unsupported` identifies affected tools; their complete results are still returned.

This increment exposes tools. Resource reads, resource templates and prompts are not yet adapted. They remain required work for the full-catalogue integration and are not silently counted as tool support.

WebMCP is experimental. Current local native checks use Chrome 156.0.8078.80. Browser/API tests and the isolated CLI-to-native-WebMCP qualification do not establish ChatGPT or Claude extension compatibility. Keep the normal website interface available when the native API is absent.
