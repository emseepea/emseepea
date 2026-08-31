import type { Client } from "@modelcontextprotocol/client";

export type SemanticClient = {
  readonly [Method in "callTool" | "readResource" | "getPrompt"]:
    (params: Parameters<Client[Method]>[0]) => ReturnType<Client[Method]>;
};

interface MeaningTestOptions {
  server: URL;
  environment?: Record<string, string>;
  authToken?: string;
  authTokenEnvironment?: string;
  question: string;
  criticalFacts: (string | RegExp)[];
  criteria: string;
  assertAnswer?(answer: string): void | Promise<void>;
}

export interface SemanticTestOptions extends MeaningTestOptions {
  requiredPaths: string[];
  exercise(client: SemanticClient): Promise<void>;
}

export interface ToolSelectionTestOptions extends MeaningTestOptions {
  expectedTools: string[];
}

export function semanticTest(name: string, options: SemanticTestOptions): Promise<void>;
export function toolSelectionTest(name: string, options: ToolSelectionTestOptions): Promise<void>;
