import type { TestContext } from "node:test";

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ConversationOptions {
  server: URL;
  /** Real application context supplied in production. Never use this as test guidance. */
  context?: string;
  /** Server environment shared by all trials, or isolated values selected by trial number. */
  environment?: Record<string, string> | ((trial: number) => Record<string, string>);
  authToken?: string;
  authTokenEnvironment?: string;
}

export interface ConversationTurn {
  readonly responses: readonly string[];
  readonly toolCalls: readonly (readonly ToolCall[])[];
}

export interface SemanticConversation {
  /** Sends this exact user message through the same provider-native MCP conversation. */
  send(prompt: string): Promise<ConversationTurn>;
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
export function assertToolNames(turn: ConversationTurn, expected: readonly string[]): void;
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
