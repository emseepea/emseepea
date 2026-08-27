import {
  defineMappedTool,
  definePrompt,
  defineResource,
  defineResourceTemplate,
  defineTool,
  type MappedToolDefinition,
  type ToolPrincipal,
} from "../../packages/framework/src/index.js";
import { z } from "zod";

const schema = z.object({ value: z.string() });
type MappedDefinition = MappedToolDefinition<typeof schema, typeof schema, typeof schema, typeof schema>;
const inputMapperArity: 1 = null as unknown as Parameters<MappedDefinition["mapInput"]>["length"];
const outputMapperArity: 1 = null as unknown as Parameters<MappedDefinition["mapOutput"]>["length"];
void inputMapperArity;
void outputMapperArity;

defineTool({
  name: "public-type-check",
  access: "public",
  description: "Compile-time public context check.",
  inputSchema: schema,
  outputSchema: schema,
  handler: ({ value }, { deadlineMs, principal }) => {
    const publicPrincipal: undefined = principal;
    const deadline: number = deadlineMs;
    void publicPrincipal;
    void deadline;
    return { text: value, data: { value } };
  },
});

defineResource({
  name: "resource-type-check",
  uri: "type-check://resource/value",
  handler: (context) => {
    const deadline: number = context.deadlineMs;
    const signal: AbortSignal = context.signal;
    // @ts-expect-error Public resource handlers do not receive caller principals.
    void context.principal;
    void deadline;
    void signal;
    return { contents: [{ uri: "type-check://resource/value", text: "value" }] };
  },
});

defineResourceTemplate({
  name: "resource-template-type-check",
  uriTemplate: "type-check://resource/{value}",
  complete: {
    value: (partial, context) => {
      const candidate: string = partial;
      const deadline: number = context.deadlineMs;
      const signal: AbortSignal = context.signal;
      const siblings: Readonly<Record<string, string>> = context.arguments;
      void deadline;
      void signal;
      void siblings;
      return [candidate];
    },
  },
  handler: ({ uri, variables }, context) => {
    const requestedUri: string = uri;
    const value: string | readonly string[] | undefined = variables.value;
    const deadline: number = context.deadlineMs;
    const signal: AbortSignal = context.signal;
    // @ts-expect-error Public resource-template handlers do not receive caller principals.
    void context.principal;
    void value;
    void deadline;
    void signal;
    return { contents: [{ uri: requestedUri, text: "value" }] };
  },
});

definePrompt({
  name: "prompt-type-check",
  argsSchema: schema,
  complete: {
    value: (partial, context) => {
      const candidate: string = partial;
      const siblings: Readonly<Record<string, string>> = context.arguments;
      return [candidate, ...Object.values(siblings)];
    },
  },
  handler: ({ value }, context) => {
    const deadline: number = context.deadlineMs;
    const signal: AbortSignal = context.signal;
    // @ts-expect-error Public prompt handlers do not receive caller principals.
    void context.principal;
    void deadline;
    void signal;
    return { messages: [{ role: "user", content: { type: "text", text: value } }] };
  },
});

definePrompt({
  name: "invalid-completion-key",
  argsSchema: schema,
  complete: {
    // @ts-expect-error Prompt completion keys must name registered prompt arguments.
    missing: () => [],
  },
  handler: () => ({ messages: [] }),
});

// @ts-expect-error MCP prompt arguments must accept string values on the wire.
definePrompt({
  name: "invalid-number-prompt",
  argsSchema: z.object({ count: z.number() }),
  handler: () => ({ messages: [] }),
});

defineMappedTool({
  name: "mapped-public-type-check",
  access: "public",
  description: "Compile-time mapped context check.",
  inputSchema: schema,
  outputSchema: schema,
  backendInputSchema: z.object({ key: z.string() }),
  backendOutputSchema: z.object({ record: z.string() }),
  mapInput: ({ value }) => ({ key: value }),
  adapter: ({ key }, context) => {
    const deadline: number = context.deadlineMs;
    const signal: AbortSignal = context.signal;
    // @ts-expect-error Backend adapters do not receive caller principals.
    void context.principal;
    void deadline;
    void signal;
    return { record: key };
  },
  mapOutput: ({ record }) => ({ text: record, data: { value: record } }),
});

defineMappedTool({
  name: "mapped-protected-type-check",
  access: "protected",
  requiredScopes: ["value:read"],
  description: "Compile-time protected mapped context check.",
  inputSchema: schema,
  outputSchema: schema,
  backendInputSchema: schema,
  backendOutputSchema: schema,
  mapInput: ({ value }) => ({ value }),
  adapter: ({ value }) => ({ value }),
  mapOutput: ({ value }) => ({
    text: value,
    data: { value },
  }),
});

defineTool({
  name: "protected-type-check",
  access: "protected",
  requiredScopes: ["value:read"],
  description: "Compile-time protected context check.",
  inputSchema: schema,
  outputSchema: schema,
  handler: ({ value }, { principal }) => {
    const protectedPrincipal: ToolPrincipal = principal;
    return { text: value, data: { value: protectedPrincipal.clientId } };
  },
});
