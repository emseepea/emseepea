import type { McpEventStore } from "@emseepea/server";
import { assertMcpEventStoreConformance, type McpEventStoreConformanceFixtureFactory } from "../dist/index.js";

declare const store: McpEventStore;
const factory: McpEventStoreConformanceFixtureFactory = () => ({
  open: () => ({ store, close() {} }),
  async dispose() {},
});
const result: Promise<void> = assertMcpEventStoreConformance(factory);
void result;

// @ts-expect-error A shared store alone cannot supply fixture cleanup and reopen.
void assertMcpEventStoreConformance(() => store);
// @ts-expect-error Every returned handle needs a close callback.
const missingClose: McpEventStoreConformanceFixtureFactory = () => ({ open: () => ({ store }), dispose() {} });
void missingClose;
