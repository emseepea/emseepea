import type { DatabaseSync } from "node:sqlite";

export interface MultiInstanceContext {
  readonly database: () => DatabaseSync | undefined;
  readonly instanceName: string;
}
