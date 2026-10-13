import type { TestContext } from "node:test";

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolOutcome {
  readonly name: string;
  readonly arguments: Readonly<Record<string, unknown>>;
  readonly result: unknown;
  readonly isError: boolean;
}

export interface ToolSelectionContract {
  readonly required: readonly {
    readonly name: string;
    readonly minCalls: number;
    readonly maxCalls: number;
  }[];
  readonly allowed: readonly {
    readonly name: string;
    readonly maxCalls: number;
  }[];
  readonly forbidden?: readonly string[];
  readonly totalCalls: {
    readonly minCalls: number;
    readonly maxCalls: number;
  };
}

export interface ConversationOptions {
  server: URL;
  /** Real application context supplied in production. Never use this as test guidance. */
  context?: string;
  /** Server environment shared by all trials, or isolated values selected by trial number. */
  environment?: Record<string, string> | ((trial: number) => Record<string, string>);
  /** Opt in to registered native resource-helper evidence. Currently Codex only. */
  nativeResources?: boolean;
  authToken?: string;
  authTokenEnvironment?: string;
}

export interface ResourceOperation {
  readonly method: "resources/list" | "resources/templates/list" | "resources/read";
  readonly target: string;
  readonly source: "provider-native-helper";
  readonly arguments: Readonly<Record<string, unknown>>;
  readonly result: unknown;
}

export interface ConversationTurn {
  readonly resourceOperations: readonly (readonly ResourceOperation[])[];
  readonly responses: readonly string[];
  readonly toolCalls: readonly (readonly ToolCall[])[];
  readonly toolOutcomes: readonly (readonly ToolOutcome[])[];
  readonly elicitations: readonly (readonly ElicitationEvidence[])[];
}

export interface ScriptedElicitation {
  /** Every fragment must occur in exactly one actual form request. Never sent to the model. */
  messageIncludes: readonly string[];
  response: { action: "accept" | "decline" | "cancel"; content?: Record<string, unknown> };
}

export interface ElicitationEvidence {
  readonly mode: "form";
  readonly message: string;
  readonly requestedSchema: Record<string, unknown>;
  readonly response?: ScriptedElicitation["response"];
  readonly inputSource?: "scripted-human";
}

export interface SemanticConversation {
  /** Sends this exact user message through the same provider-native MCP conversation. */
  send(prompt: string, options?: { elicitations: readonly ScriptedElicitation[] }): Promise<ConversationTurn>;
  /** Starts a provider-native conversation with no transcript history against the same running test application. */
  fresh(): Promise<void>;
}

export function createConversation(
  testContext: TestContext,
  options: ConversationOptions,
): Promise<SemanticConversation>;

export function assertToolCalls(turn: ConversationTurn, expected: readonly ToolCall[]): void;
/** Requires the exact primary calls and allows one trailing submit-feedback call. */
export function assertToolCallsWithOptionalFeedback(
  turn: ConversationTurn,
  expected: readonly ToolCall[],
): Promise<void>;
export function assertNoToolCalls(turn: ConversationTurn): void;
/** Allows no tool call or exactly one call to the named tool in each trial. */
export function assertOptionalToolCall(turn: ConversationTurn, name: string): void;
/** Requires an exact sequence, or one of at most eight explicitly authored sequences. */
export function assertToolNames(
  turn: ConversationTurn,
  expected: readonly string[] | { readonly oneOf: readonly (readonly string[])[] },
): void;
/** Requires completed calls to satisfy an independently authored closed-world selection contract. */
export function assertToolSelection(turn: ConversationTurn, contract: ToolSelectionContract): void;
export function assertToolArguments(
  turn: ConversationTurn,
  name: string,
  expected: Record<string, unknown>,
): void;
export function assertFeedback(
  turn: ConversationTurn,
  expectation: { observation: string | readonly string[]; detailIncludes: readonly string[] },
): void;
/** Asserts that successful turns did not submit an error, friction, or other negative observation. */
export function assertNoNegativeFeedback(...turns: readonly ConversationTurn[]): void;
export function assertResponseContains(turn: ConversationTurn, expected: string | readonly string[]): void;
export function assertResponseMeaning(
  turn: ConversationTurn,
  expectation: { expected: string },
): Promise<void>;
