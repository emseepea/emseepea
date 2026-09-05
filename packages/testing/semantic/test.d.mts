import type { Client } from "@modelcontextprotocol/client";
import type { TestContext } from "node:test";

export type SemanticClient = {
  readonly [Method in "callTool" | "readResource" | "getPrompt"]:
    (params: Parameters<Client[Method]>[0]) => ReturnType<Client[Method]>;
};

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ConversationOptions {
  server: URL;
  context?: string;
  environment?: Record<string, string>;
  authToken?: string;
  authTokenEnvironment?: string;
}

export interface ConversationTurn {
  readonly responses: readonly string[];
  readonly toolCalls: readonly (readonly ToolCall[])[];
}

export interface SemanticConversation {
  prepare(exercise: (client: SemanticClient) => Promise<void>): Promise<void>;
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
