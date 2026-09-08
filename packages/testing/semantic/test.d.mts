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
export function assertNoToolCalls(turn: ConversationTurn): void;
export function assertResponseContains(turn: ConversationTurn, expected: string | readonly string[]): void;
export function assertResponseMeaning(
  turn: ConversationTurn,
  expectation: { expected: string },
): Promise<void>;
