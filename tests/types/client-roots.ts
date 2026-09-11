import { defineTool, inputRequired, rootsResponse } from "../../packages/framework/src/index.js";
import { z } from "zod";

defineTool({
  name: "typed-roots", description: "Read checked client roots.", access: "public",
  inputSchema: z.object({}), outputSchema: z.object({ uri: z.string() }),
  handler(_input, context) {
    const roots = rootsResponse(context.inputResponses, "workspace");
    if (!roots) return inputRequired({ inputRequests: { workspace: inputRequired.roots() } });
    // @ts-expect-error Roots arrays are immutable.
    roots.push({ uri: "file:///other" });
    // @ts-expect-error Root values are immutable.
    roots[0]!.uri = "file:///other";
    return { data: { uri: roots[0]?.uri ?? "" } };
  },
});
// @ts-expect-error Raw client data has not been checked by the framework.
rootsResponse({ workspace: { roots: [] } }, "workspace");
