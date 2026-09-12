import type { ResultAction, ResultView, McpAppControllerOptions, McpAppState } from "@emseepea/server/ui";
import type { Component } from "svelte";
import type { Readable } from "svelte/store";

export interface ResultCardProps {
  readonly view: ResultView;
  readonly headingLevel: 2 | 3 | 4 | 5 | 6;
  readonly onAction?: (action: ResultAction) => void;
  readonly idPrefix?: string;
}

export const ResultCard: Component<ResultCardProps>;

export interface McpApp<Result> extends Readable<McpAppState<Result>> {
  readonly sendMessage: (text: string) => Promise<void>;
}

export function createMcpApp<Result>(options: Omit<McpAppControllerOptions<Result>, "requestId">): McpApp<Result>;
