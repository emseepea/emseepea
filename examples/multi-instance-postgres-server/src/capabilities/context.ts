import type { Pool } from "pg";

export interface MultiInstanceContext {
  readonly database: () => Pool | undefined;
}
