import {
  defineMappedTool,
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
