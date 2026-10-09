---
title: List a caller’s private resources
description: Add authenticated, bounded resource inventory pages to a protected URI template.
---

Add a `list` callback to a protected `defineResourceTemplate` when MCP clients
need concrete resource URIs belonging to the signed-in caller. The callback
returns metadata only: `uri`, `name`, and `mimeType`. Resource contents remain
available through `resources/read`, which checks access again.

Without this callback, `resources/list` continues to list registered static
resources. `resources/templates/list` continues to describe registered URI
patterns. Definitions, access policies, and callbacks remain fixed at startup;
the records returned by a callback may change.

## Query only the caller’s records

```ts
import { defineResourceTemplate } from "@emseepea/server";

const documents = defineResourceTemplate({
  name: "documents",
  uriTemplate: "learn://documents/{id}",
  access: "protected",
  requiredScopes: ["documents:read"],
  async list({ after, limit }, { principal, signal, deadlineMs }) {
    if (!principal.subject) throw new Error("A verified user is required");
    // Application-owned query: apply ownership, ACL, retention, and deletion
    // rules before selecting at most limit + 1 rows from the backend.
    const rows = await store.listVisibleDocuments({
      owner: principal.subject, after, limit: limit + 1, signal, deadlineMs,
    });
    return {
      entries: rows.slice(0, limit).map((row) => ({
        key: row.orderKey,
        resource: {
          uri: `learn://documents/${row.id}`,
          name: row.title,
          mimeType: "text/plain",
        },
      })),
      hasMore: rows.length > limit,
    };
  },
  async handler({ uri }, { principal, signal, deadlineMs }) {
    if (!principal.subject) throw new Error("A verified user is required");
    const row = await store.readVisibleDocument({
      uri, owner: principal.subject, signal, deadlineMs,
    });
    return { contents: [{ uri, text: row.text, mimeType: "text/plain" }] };
  },
});
```

`store` is your application’s backend adapter. Register `documents` in
`createEmseepea({ resources: [documents], authentication: ... })` with your
validated token verifier and OAuth metadata. The framework does not supply a
database query or make record ownership decisions.

A validated verifier may set `AuthInfo.extra.subject` to the stable user ID.
The framework exposes only that optional `principal.subject`, alongside
`clientId`, validated `permissions`, and the resource audience. It does not
forward tokens or other extra claims.

The subject must be a nonempty string
of at most 256 characters without control characters. The verifier must
validate the token and its subject before returning them.

An OAuth `clientId` identifies the client application; several users may share
it. Use the verified subject for user-owned records. A client-owned inventory
may use `clientId` if that matches its actual ownership model. Never fall back
to an unrestricted query when the required identity is absent.

## Return a bounded, ordered page

The public types are `ResourceInventoryHandler`, `ResourceInventoryPage`, and
`ResourceInventoryEntry`.

- Query with `after` as an exclusive lower bound and return at most `limit`
  entries. Apply authorization and record policy in that bounded query.
- Give every eligible record a unique, immutable ordering key, including its
  tie-breaker. Keys contain 1–256 printable ASCII characters without spaces.
  Return them in strictly increasing JavaScript string order; your backend
  comparison must use that same order.
- Keep each URI unique across the source’s traversal and consistent with its
  registered template. Its read handler must enforce the current record policy.
- Set `hasMore` only when further eligible entries exist. A page with
  `hasMore: true` must contain an entry. Do not fetch the whole collection to
  slice it in memory.

Metadata permits only `uri` (at most 2,048 characters), `name` (at most 512),
and `mimeType` (at most 128). Invalid or oversized callback results fail with a
generic protocol error. Backend error details are not returned to clients.
The callback receives the request’s cancellation signal and deadline; stop
backend work when cancelled.

`listPagination.pageSize` bounds the combined static and dynamic page count
(maximum 100). The inventory default is 50. `listPagination.maxPageBytes` and
`maxApplicationResultBytes` bound response bytes, including MCP result
metadata. The tighter byte limit applies; the default is 1 MiB.

A single
entry that cannot fit causes an error. Static resources come first, followed
by eligible inventory sources in registration order.

## Authenticate the entire list

Once a server registers an inventory callback, every `resources/list` request
requires authentication, even with public discovery or legacy MCP clients.
The framework authorizes each source before calling it and skips inaccessible
sources.

A caller must have access to at least one inventory source; access
to every source is not required. The response is private and has a zero cache
lifetime. Other methods keep their existing authentication rules.

`list` is supported only on a protected, discoverable template. Public or
suppressed templates cannot register it. Applications without a callback keep
their existing listing behavior.

## Restart an expired traversal

The framework returns opaque, encrypted, integrity-protected `nextCursor`
values. Cursors bind the caller identity, subject, permissions, resource
audience, registered sources, and traversal position. Changing permissions
requires a fresh listing. Never decode or construct these values yourself.

A traversal expires **15 minutes after its first page**. Fetching another page
or replaying a cursor does not extend that time. Cursors use a process-local
key and cannot be relied upon across instances or restarts. Route subsequent
pages to the same serving instance, or restart without a cursor if it rejects
one. Shutdown discards the key; there is no cursor table to clean up.

Pages query live records rather than a snapshot. An insertion behind the
current ordering key may be missed in that traversal. A deletion or access
revocation removes a record from later pages; replaying a cursor may therefore
return different results. A previously listed URI does not grant future read
access. Start again when you need a fresh view.

This API does not provide a durable update consumer or commit-order cursor.
It does not emit resource-list change notifications (`listChanged` remains
false). Client support determines how inventory is displayed; this capability
does not establish a native ChatGPT Sources or UI integration.
