import type { Client } from "soap";
import type { AccessPolicy } from "@emseepea/server";

export interface SoapExampleContext {
  readonly client: Client;
  readonly access: AccessPolicy;
}
