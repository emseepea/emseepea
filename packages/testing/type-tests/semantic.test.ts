import type { ToolOutcome } from "../semantic/test.mjs";

declare const outcome: ToolOutcome;

// @ts-expect-error Tool outcome names are read-only observations.
outcome.name = "other-tool";
// @ts-expect-error Tool outcome arguments are read-only observations.
outcome.arguments.changed = true;
