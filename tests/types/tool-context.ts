import { defineTool, type ToolPrincipal } from "../../packages/framework/src/index.js";
import { z } from "zod";

const schema = z.object({ value: z.string() });

defineTool({
  name: "public-type-check",
  access: "public",
  description: "Compile-time public context check.",
  inputSchema: schema,
  outputSchema: schema,
  handler: ({ value }, { principal }) => {
    const publicPrincipal: undefined = principal;
    void publicPrincipal;
    return { text: value, data: { value } };
  },
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
