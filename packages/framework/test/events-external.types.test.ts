import { createEmseepea, type EmseepeaOptions, type ExternalEmseepeaOptions,
  type McpEventsOptions, type McpEventStore, type ExternalMcpEventsOptions } from "../dist/index.js";
type Equal<A,B> = (<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2) ? true : false;
type Assert<T extends true> = T;
export type LegacyStoreUnchanged = Assert<Equal<McpEventsOptions["store"],McpEventStore>>;
export type LegacyNamedOptionsUnchanged = Assert<Equal<NonNullable<EmseepeaOptions["events"]>["store"],McpEventStore>>;
export type LegacyParametersUnchanged = Assert<Equal<Parameters<typeof createEmseepea>[0],EmseepeaOptions>>;
declare const legacy: EmseepeaOptions;
declare const external: ExternalEmseepeaOptions;
const oldApp = createEmseepea(legacy);
const externalApp = createEmseepea(external);
export type SameReturn = Assert<Equal<typeof oldApp,typeof externalApp>>;
export type NewMode = Assert<Equal<ExternalMcpEventsOptions["mode"],"external">>;
// @ts-expect-error External configuration cannot name a legacy queue store.
const invalidExternal: ExternalMcpEventsOptions = {...external.events,store:legacy.events!.store};
void invalidExternal;
