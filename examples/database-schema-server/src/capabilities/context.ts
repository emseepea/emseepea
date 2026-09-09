import type { Pool } from "pg";
import type { AccessPolicy } from "@emseepea/server";

export interface DatabaseSchemaContext {
  readonly database: () => Pool | undefined;
  readonly access: AccessPolicy;
}
