import type { Pool } from "pg";

export interface DatabaseSchemaContext {
  readonly database: () => Pool | undefined;
}
