import { defineResourceTemplate, type ResourceInventoryHandler } from "../../packages/framework/src/index.js";

const list: ResourceInventoryHandler = async (input, context) => {
  const after: string | undefined = input.after;
  const subject: string | undefined = context.principal.subject;
  const identity: string = context.principal.clientId;
  const permissions: readonly string[] = context.principal.permissions;
  const signal: AbortSignal = context.signal;
  const deadline: number = context.deadlineMs;
  // @ts-expect-error Bearer credentials are not exposed to listing callbacks.
  void context.principal.token;
  // @ts-expect-error Raw verifier claims are not forwarded.
  void context.principal.extra;
  // @ts-expect-error Backend limits are immutable.
  input.limit = 100;
  void [after, subject, identity, permissions, signal, deadline];
  return { entries: [{ key: "record-001", resource: {
    uri: "learn://documents/001", name: "Reference", mimeType: "text/plain",
  } }], hasMore: false };
};
defineResourceTemplate({
  name: "private-documents", uriTemplate: "learn://documents/{id}",
  access: "protected", requiredScopes: ["documents:read"], list,
  handler: ({ uri }, context) => ({ contents: [{ uri, text: context.principal.subject ?? "client-owned" }] }),
});
// @ts-expect-error Public templates cannot query private inventory.
defineResourceTemplate({ name: "public", uriTemplate: "learn://public/{id}", access: "public", list,
  handler: () => ({ contents: [] }) });
