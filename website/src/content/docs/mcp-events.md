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

Configure authentication, authorization, durable storage, and callback delivery
for your deployment before relying on a trigger.

## Check client availability first

Checked **15 October 2026** against [OpenAI's MCP Events
guide](https://developers.openai.com/plugins/build/mcp-events). Its availability
statement lists the following surfaces. For each surface, you still need to
verify that the subscribed chat runs automatically after an application event.
This guide records no completed native client test for the framework.

| Client surface | Availability |
| --- | --- |
| ChatGPT web: Work | Listed |
| ChatGPT desktop: Work + **Cloud** | Listed |
| dots | Listed |
| Ordinary ChatGPT chat | Not listed; unverified |
| Codex | Native subscriptions unavailable |

Workspace controls apply to the listed surfaces. Successful testing in Work
does not prove that ordinary ChatGPT chat supports monitoring.

Codex MCP tool access does not establish native Events support. A native event
resumes the chat that subscribed; it does not launch a new Codex cloud task in
a selected environment. A passing webhook test, smoke-server recipe, or HTTP
2xx callback does not establish that a client ran or changed business data.

Before configuring monitoring:

1. Use one of the documented client surfaces and check that your workspace
   permits the plugin and event-triggered tasks.
2. Connect and authorize the MCP server through its plugin. ChatGPT Events
   requires MCP 2.0, protocol version `2026-07-28`.
3. Confirm that discovery (`server/discover` and `events/list`) exposes the
   intended event to that account. Check the plugin page for discovered events.
4. Rescan the server after changing tools or events. In the intended chat,
   mention or select the connected plugin and ask to monitor the exact event.
5. Check subscription and signed callback verification separately from automatic
   chat execution. Test with a normal application change using synthetic data.

### If events do not appear

Check [client availability](#check-client-availability-first), desktop **Cloud** selection, workspace controls,
plugin connection, authorization, and negotiated protocol version first.

Rescan after an event-definition change. Reconnect and reauthorize the plugin
if its connection is stale, then check discovery again in the intended chat.
Do not repeatedly trigger business changes before a subscription exists.

If discovery works but monitoring does not, inspect subscription creation,
callback verification, expiry, and current access. A callback accepted by the
client still needs a separate observation of automatic chat execution.

Record the client surface, date, and redacted correlation evidence; keep callback
secrets and private chat links out of public reports. Do not manually force a
task run and count it as automatic execution.

## Plan the remaining production responsibilities

The current framework supplies the webhook protocol subset, callback-address
protections, challenge verification, signing, bounded retries, and authorization
checks. It retains a pluggable store interface.

It does **not** yet supply the
complete supported production Events setup requested in
[issue #174](https://github.com/emseepea/emseepea/issues/174).
Feedback database/provider adapters are not Events subscription or queue stores.

Before production activation, use this checklist to assign an owner and evidence
for each item. Keep completion records with your deployment:

- **Identity and policy:** stable owner and tenant mapping, event eligibility,
  record access, revocation and deletion handling, retention, and payload limits.
  These remain application decisions. Enabling Events grants no email permission.
- **Durable Events storage:** atomic subscription changes, durable queued
  deliveries, concurrent claims, stale-lease rejection, renewal, expiry, cleanup,
  and restart recovery. A shared conformance suite and optional PostgreSQL Events
  adapter/migrations are still delivery work; do not substitute a feedback store.
- **Delivery while requests are idle:** a separately invoked bounded worker or
  scheduler, health checks, graceful shutdown, scaling, and one delivery owner.
  In-process timers cannot ensure execution when a host suspends CPU or scales
  to zero. An external scheduler must not compete with an SDK-owned worker.
  A supported external-worker mode and deployment recipe remain delivery work;
  this guide does not expose a configuration switch for them.
- **Business changes and events:** a transactional outbox that saves the
  business change and pending event together, then publishes after commit with
  stable identity and safe retry. Arrange reconciliation for missed dispatch.
  When an external provider owns the transaction, document its webhook and
  reconciliation limits instead of claiming a shared transaction.
- **Event sources:** provider-native verification, least-privilege credentials,
  tenant mapping, stable source IDs, duplicates, ordering, rate limits, retries,
  and reconciliation. A general source contract and GitHub/Zendesk evaluation
  remain delivery work; existing feedback helpers are not those general adapters.
- **Operations:** secret storage/rotation, pause/resume, backlog inspection,
  safe activation, and structured diagnostics with safe correlation IDs and
  categorical reasons. Exclude secrets and unnecessary personal data.
- **Automatic chat execution:** test a normal application
  event, renewal and restart, duplicate and nonmatching events, revoked access,
  unsubscribe, and prevention of event feedback loops. Keep callback acceptance,
  client execution, and business effects as three separate evidence records.
- **Feedback completion:** qualify capture, retained conversation, operator
  reply, optional native monitoring, supported backend operations, failure
  recovery, explicit notification policy, and synthetic-data cleanup using
  fresh published packages. Do not treat the Events protocol alone as this journey.

The [synthetic smoke server](https://github.com/emseepea/emseepea/tree/main/dogfood/events)
is a bounded test aid, not a production initializer or deployment recipe.
The remaining infrastructure will be delivered in reviewed increments. No new
hosted service or generic task orchestrator is required by this guide.

## Supply the application pieces

Start from an
[authenticated server](https://github.com/emseepea/emseepea/blob/main/packages/framework/README.md#authentication-and-observability).
Configure OAuth metadata and a verifier that checks issuer, audience, expiry,
resource, and permissions. Keep record-level authorization in application
code. Then provide:

- An account-specific `ownerKey(auth)` that stays the same across token renewal
  and server restarts. A client ID or access token is not an account key.
- `authorize`, which independently checks `list`, `subscribe`, `refresh`, and
  `delivery`. The framework checks it before enqueue and again before delivery.
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

To target one account, pass a fourth argument:

```ts
await publishMcpEvent(app, "orders.shipped", { orderId }, {
  ownerKey: accountScope,
});
```

`accountScope` must be the same stable account key returned by `events.ownerKey`.
The key restricts delivery to that owner's matching, authorized subscriptions
and stays outside the event payload. Omit the fourth argument to evaluate all
matching subscriptions.

An optional event-definition `listWire(ownerKey, wire)` can narrow the choices
shown to an authorized owner or hide the entry. Central list authorization
runs first. Preserve the name, description, delivery mode, and object schemas.

For [collection-aware feedback](/emseepea/feedback/#separate-customer-and-internal-feedback),
operators subscribe to `feedback.submitted` using `collections: ["internal"]`,
`collections: ["customer"]`, or both authorized collections. The event carries
only record references; protected tools retrieve the exact authoritative
record in the same account scope.

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
