import type { Pool } from "pg";
import type { AccessPolicy } from "@emseepea/server";

export interface MultiInstanceContext {
  readonly database: () => Pool | undefined;
  readonly access: AccessPolicy;
}
