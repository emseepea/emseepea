import {
  acceptedContent,
  defineMappedTool,
  definePrompt,
  defineResource,
  defineResourceTemplate,
  defineStreamingTool,
  defineTool,
  inputRequired,
  type CapabilityModuleFactory,
  type MappedToolDefinition,
  type ToolPrincipal,
} from "../../packages/framework/src/index.js";
import { z } from "zod";

const schema = z.object({ value: z.string() });
const strictSchema = z.strictObject({ value: z.string() });
const dataWithExtraProperty = { value: "value", extra: true };
type MappedDefinition = MappedToolDefinition<typeof schema, typeof schema, typeof schema, typeof schema>;
const inputMapperArity: 1 = null as unknown as Parameters<MappedDefinition["mapInput"]>["length"];
const outputMapperArity: 1 = null as unknown as Parameters<MappedDefinition["mapOutput"]>["length"];
void inputMapperArity;
void outputMapperArity;

const discoveredFactory = ((context) => defineTool({
  name: "discovered-type-check",
  access: "public",
  description: "Compile-time discovered module context check.",
  inputSchema: schema,
  outputSchema: schema,
  handler: ({ value }) => ({ text: value, data: { value: context.prefix + value } }),
})) satisfies CapabilityModuleFactory<{ readonly prefix: string }>;
void discoveredFactory;

defineTool({
  name: "public-type-check",
  access: "public",
  description: "Compile-time public context check.",
  inputSchema: schema,
  outputSchema: schema,
  handler: ({ value: _value }, { deadlineMs, inputResponses, principal }) => {
    const publicPrincipal: undefined = principal;
    const deadline: number = deadlineMs;
    void publicPrincipal;
    void deadline;
    const answer = acceptedContent(inputResponses, "answer", schema);
    return answer
      ? { text: answer.value, data: answer }
      : inputRequired({
          inputRequests: {
            answer: inputRequired.elicit({ message: "Value?", requestedSchema: schema }),
          },
        });
  },
});

defineStreamingTool({
  name: "streaming-public-type-check",
  access: "public",
  description: "Compile-time streaming context check.",
  inputSchema: schema,
  outputSchema: schema,
  async handler({ value }, context) {
    const { principal, reportProgress } = context;
    const publicPrincipal: undefined = principal;
    // @ts-expect-error Streaming tools cannot request more client input.
    void context.inputResponses;
    await reportProgress({ progress: 1, total: 1, message: value });
    void publicPrincipal;
    return { text: value, data: { value } };
  },
});

// @ts-expect-error Tool handlers reject data properties absent from the public output schema.
defineTool({
  name: "invalid-variable-output-type-check",
  access: "public",
  description: "Compile-time variable output rejection check.",
  inputSchema: schema,
  outputSchema: schema,
  handler: ({ value }) => ({ text: value, data: dataWithExtraProperty }),
});

// @ts-expect-error Streaming tool handlers reject spread properties absent from the public output schema.
defineStreamingTool({
  name: "invalid-spread-output-type-check",
  access: "public",
  description: "Compile-time spread output rejection check.",
  inputSchema: schema,
  outputSchema: schema,
  handler: ({ value }) => ({ text: value, data: { ...dataWithExtraProperty } }),
});

defineResource({
  name: "resource-type-check",
  uri: "type-check://resource/value",
  handler: (context) => {
    const deadline: number = context.deadlineMs;
    const signal: AbortSignal = context.signal;
    void context.inputResponses;
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
      // @ts-expect-error Suggestions cannot request more client input.
      void context.inputResponses;
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
    void context.inputResponses;
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
    void context.inputResponses;
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
  isAvailable: (context) => {
    const deadline: number = context.deadlineMs;
    const signal: AbortSignal = context.signal;
    // @ts-expect-error Availability checks do not receive caller principals.
    void context.principal;
    void deadline;
    void signal;
    return true;
  },
  mapInput: ({ value }) => ({ key: value }),
  adapter: ({ key }, context) => {
    const deadline: number = context.deadlineMs;
    const signal: AbortSignal = context.signal;
    // @ts-expect-error Backend adapters cannot request more client input.
    void context.inputResponses;
    // @ts-expect-error Backend adapters do not receive caller principals.
    void context.principal;
    void deadline;
    void signal;
    return { record: key };
  },
  mapOutput: ({ record }) => ({ text: record, data: { value: record } }),
});

defineMappedTool({
  name: "invalid-mapped-input-type-check",
  access: "public",
  description: "Compile-time mapped input rejection check.",
  inputSchema: schema,
  outputSchema: schema,
  backendInputSchema: schema,
  backendOutputSchema: schema,
  mapInput: (input) => ({
    // @ts-expect-error Mapping cannot read a property absent from the public input schema.
    value: input.missing,
  }),
  adapter: ({ value }) => ({ value }),
  mapOutput: ({ value }) => ({ text: value, data: { value } }),
});

defineMappedTool({
  name: "invalid-mapped-output-type-check",
  access: "public",
  description: "Compile-time mapped output rejection check.",
  inputSchema: schema,
  outputSchema: schema,
  backendInputSchema: schema,
  backendOutputSchema: schema,
  mapInput: ({ value }) => ({ value }),
  adapter: ({ value }) => ({ value }),
  // @ts-expect-error Mapping must return data accepted by the public output schema.
  mapOutput: ({ value }) => ({ text: value, data: { missing: value } }),
});

// @ts-expect-error Strict public output schemas reject undeclared object-literal properties.
defineMappedTool({
  name: "invalid-extra-mapped-output-type-check",
  access: "public",
  description: "Compile-time strict mapped output rejection check.",
  inputSchema: schema,
  outputSchema: strictSchema,
  backendInputSchema: schema,
  backendOutputSchema: schema,
  mapInput: ({ value }) => ({ value }),
  adapter: ({ value }) => ({ value }),
  mapOutput: ({ value }) => ({ text: value, data: { value, extra: true } }),
});

defineMappedTool({
  name: "mapped-transformed-type-check",
  access: "public",
  description: "Compile-time transformed mapper boundary check.",
  inputSchema: z.object({ value: z.string().transform(Number) }),
  outputSchema: z.object({ summary: z.string().transform((value) => value.length) }),
  backendInputSchema: z.object({ count: z.coerce.number() }),
  backendOutputSchema: z.object({ count: z.string().transform(Number), label: z.string().default("ready") }),
  mapInput: ({ value }) => {
    const decodedPublicInput: number = value;
    return { count: String(decodedPublicInput) };
  },
  adapter: ({ count }) => {
    const decodedBackendInput: number = count;
    return { count: String(decodedBackendInput) };
  },
  mapOutput: ({ count, label }) => {
    const decodedBackendOutput: number = count;
    const defaultedBackendOutput: string = label;
    return {
      text: defaultedBackendOutput,
      data: { summary: String(decodedBackendOutput) },
    };
  },
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

defineStreamingTool({
  name: "streaming-protected-type-check",
  access: "protected",
  requiredScopes: ["value:read"],
  description: "Compile-time protected streaming context check.",
  inputSchema: schema,
  outputSchema: schema,
  async handler({ value }, { principal, reportProgress }) {
    const protectedPrincipal: ToolPrincipal = principal;
    await reportProgress({ progress: 1 });
    return { text: value, data: { value: protectedPrincipal.clientId } };
  },
});

// @ts-expect-error Opaque request state is not supported without an integrity design.
inputRequired({ requestState: "opaque" });
// @ts-expect-error Roots are deprecated in MCP 2026-07-28.
inputRequired.listRoots();
