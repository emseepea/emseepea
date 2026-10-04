---
title: Trigger work from MCP Events
description: Add opt-in webhook events to an authenticated Em See Pea server.
---

Model Context Protocol (MCP) Events let a subscribed client receive a webhook
after something changes in your application. This is separate from the
process-local resource update stream. Events are **off by default**; ordinary
servers do not make outbound webhook calls.

The [draft MCP Events extension](https://github.com/modelcontextprotocol/experimental-ext-triggers-events/blob/main/docs/design-sketch-proposal.md)
defines three alternative delivery modes: polling, push streaming, and webhooks.
An event can offer webhooks alone; replay is optional. The draft also defines
`gap` and `terminated` webhook control messages.

[ChatGPT's current Events integration](https://developers.openai.com/plugins/build/mcp-events)
uses event discovery and `events/list`, `events/subscribe`, and
`events/unsubscribe` with webhook delivery and callback verification. It does
not support polling, streaming, or the draft's `gap` and `terminated` control
messages.

Em See Pea implements that webhook subset, not the full draft. It does not
implement polling, streaming, replay, or those control messages.

In a synthetic ChatGPT Work smoke test on 4 October 2026, ChatGPT posted two
event-triggered replies; the second followed a local server restart and called
`get_demo_note`.
This verifies that test setup, not production readiness or compatibility with
every client. Test your own client and deployment before relying on a trigger.

The [test server and setup guide](https://github.com/emseepea/emseepea/tree/main/dogfood/events)
are available in the repository. They use temporary credentials and synthetic
notes, not a production identity provider.

## Supply the application pieces

Start from an
[authenticated server](https://github.com/emseepea/emseepea/blob/main/packages/framework/README.md#authentication-and-observability).
Configure OAuth metadata and a verifier that checks issuer, audience, expiry,
resource, and permissions. Keep record-level authorization in application
code. Then provide:

- An account-specific `ownerKey(auth)` that stays the same across token renewal
  and server restarts. A client ID or access token is not an account key.
- `authorize`, which decides whether that owner may discover, subscribe to, or
  receive an event. The framework checks it again before delivery.
- `health`, which returns `true` only while your event store and outbound
  delivery dependencies are working. An unhealthy result fails closed.
- A durable `McpEventStore` shared by all server instances. Its subscription
  writes and deletes must be atomic; queued deliveries must survive restarts;
  and `claimDue` must lease each job across instances. `complete` and
  `reschedule` must reject stale leases. An in-memory map is only for tests.

See the [store interface and callback limits](https://github.com/emseepea/emseepea/blob/main/packages/framework/README.md#trigger-work-from-mcp-events).
Keep webhook secrets in the store as credentials; do not log or commit them.

## Register and publish an event

The imports from `./event-integration.js` below are application code you must
provide. They resolve the authenticated account, check order access, report
event-system health, and implement the durable store.

```ts title="Configure one event"
import { createEmseepea, publishMcpEvent } from "@emseepea/server";
import { z } from "zod";
import { authentication } from "./authentication.js";
import {
  accountIdForAuth, mayListOrders, mayReadOrder,
  eventSystemHealthy, eventStore,
} from "./event-integration.js";

const app = createEmseepea({
  name: "order-events",
  version: "1.0.0",
  authentication,
  events: {
    definitions: [{
      name: "orders.shipped",
      description: "An order has shipped",
      inputSchema: z.object({ orderId: z.string() }),
      payloadSchema: z.object({ orderId: z.string() }),
      matches: (arguments_, data) => arguments_.orderId === data.orderId,
    }],
    ownerKey: accountIdForAuth,
    authorize: ({ ownerKey, arguments: args, phase }) =>
      phase === "list" ? mayListOrders(ownerKey) :
      typeof args.orderId === "string" && mayReadOrder(ownerKey, args.orderId),
    health: eventSystemHealthy,
    store: eventStore,
  },
});

// Call this with the committed order's ID after its state change is durable.
async function afterOrderShipped(orderId: string) {
  await publishMcpEvent(app, "orders.shipped", { orderId });
}
```

`publishMcpEvent` validates the payload and queues a delivery for each matching,
currently authorized subscription. The server drains the durable queue while
running. Delivery is retried within bounds, so receiving clients should handle
duplicate event IDs safely. Do not put credentials or unnecessary personal data
in event payloads.

## Connect a webhook client

The client calls `events/list` and then `events/subscribe` with a public HTTPS
callback and a client-provided `whsec_` signing secret in the Standard Webhooks
format. The framework checks Domain Name System (DNS) records and the
connection address, refuses redirects, sends a signed challenge, and stores
the subscription only when the callback returns the challenge.

Private, loopback, and plain HTTP callback addresses are not accepted.

Subscriptions last no longer than 24 hours. The client renews one by calling
`events/subscribe` again before `refreshBefore`; there is no separate refresh
method. Unsubscribe with `events/unsubscribe`, using the same event name,
arguments, and callback URL. If access is withdrawn, the framework stops
delivery even if the subscription has not yet expired.

Before relying on a trigger, verify this full journey in your deployment:

1. Discover the event.
2. Subscribe with the intended account and callback.
3. Complete the signed challenge.
4. Commit an application change and publish its event.
5. Receive and verify the signed delivery.
6. Confirm the client's follow-up action.

Local protocol tests alone do not prove that a host will act on an event.
