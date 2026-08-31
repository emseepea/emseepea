import type { Client } from "@modelcontextprotocol/client";

export type SemanticClient = {
  readonly [Method in "callTool" | "readResource" | "getPrompt"]:
    (params: Parameters<Client[Method]>[0]) => ReturnType<Client[Method]>;
};

export interface SemanticTestOptions {
  server: URL;
  environment?: Record<string, string>;
  authToken?: string;
  authTokenEnvironment?: string;
  question: string;
  criticalFacts: (string | RegExp)[];
  criteria: string;
  requiredPaths: string[];
  exercise(client: SemanticClient): Promise<void>;
  assertAnswer?(answer: string): void | Promise<void>;
}

export function semanticTest(name: string, options: SemanticTestOptions): Promise<void>;
