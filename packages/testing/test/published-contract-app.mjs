import { createEmseepea, defineTool } from "@emseepea/server";
import { z } from "zod";

export function createContractApp() {
  return createEmseepea({
    name: "published-contract-command-test",
    version: "0.0.0",
    tools: [defineTool({
      name: "inspect-contract",
      access: "public",
      description: process.env.CONTRACT_DESCRIPTION ?? "Inspect the contract.",
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      handler: () => ({ data: { ok: true } }),
    })],
  });
}
