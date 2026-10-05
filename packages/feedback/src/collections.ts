import { z } from "zod";

export const feedbackCollectionSchema = z.string()
  .regex(/^[a-z][a-z0-9._-]{0,63}$/)
  .describe("Deployment-static feedback collection identifier.");

export type FeedbackCollection = z.output<typeof feedbackCollectionSchema>;
export type FeedbackCollectionRole = "submission" | "operator" | "monitor";

export type FeedbackSubmissionRoleDeclaration =
  | Readonly<{
    collection: FeedbackCollection;
    access: "public";
    requiredScopes?: never;
  }>
  | Readonly<{
    collection: FeedbackCollection;
    access: "protected";
    requiredScopes: readonly string[];
  }>;

export interface FeedbackProtectedRoleDeclaration {
  readonly collection: FeedbackCollection;
  readonly access: "protected";
  readonly requiredScopes: readonly string[];
}

export interface FeedbackCollectionsOptions {
  readonly collections: readonly FeedbackCollection[];
  readonly submissions?: readonly FeedbackSubmissionRoleDeclaration[];
  readonly operators?: readonly FeedbackProtectedRoleDeclaration[];
  readonly monitors?: readonly FeedbackProtectedRoleDeclaration[];
}

export interface FeedbackCollectionCatalogueEntry {
  readonly id: FeedbackCollection;
  readonly roles: readonly FeedbackCollectionRole[];
}

export interface FeedbackSubmissionRoleProjection {
  readonly collection: FeedbackCollection;
  readonly toolName: `submit-${string}-feedback`;
  readonly access: "public" | "protected";
  readonly requiredScopes: readonly string[];
}

export interface FeedbackProtectedRoleProjection {
  readonly collection: FeedbackCollection;
  readonly access: "protected";
  readonly requiredScopes: readonly string[];
}

export interface FeedbackCollectionsDefinition {
  readonly catalogue: readonly FeedbackCollectionCatalogueEntry[];
  readonly submissions: readonly FeedbackSubmissionRoleProjection[];
  readonly operators: readonly FeedbackProtectedRoleProjection[];
  readonly monitors: readonly FeedbackProtectedRoleProjection[];
}

export function defineFeedbackCollections(
  options: FeedbackCollectionsOptions,
): FeedbackCollectionsDefinition {
  const raw = requireRecord(options, "Feedback collections configuration");
  rejectUnknownKeys(raw, ["collections", "submissions", "operators", "monitors"],
    "Feedback collections configuration");
  if (!Array.isArray(raw.collections) || raw.collections.length === 0) {
    throw new TypeError("Feedback collections configuration requires at least one collection");
  }

  const declared = new Set<FeedbackCollection>();
  for (const value of raw.collections) {
    const checked = feedbackCollectionSchema.safeParse(value);
    if (!checked.success) throw new TypeError("Invalid feedback collection identifier");
    if (declared.has(checked.data)) {
      throw new TypeError(`Duplicate collection: ${checked.data}`);
    }
    declared.add(checked.data);
  }

  const submissions = compileSubmissionRoles(raw.submissions, declared);
  const operators = compileProtectedRoles("operator", raw.operators, declared);
  const monitors = compileProtectedRoles("monitor", raw.monitors, declared);
  const submissionCollections = new Set(submissions.map(({ collection }) => collection));
  const operatorCollections = new Set(operators.map(({ collection }) => collection));
  const monitorCollections = new Set(monitors.map(({ collection }) => collection));
  const catalogue = [...declared].sort().map((id) => Object.freeze({
    id,
    roles: Object.freeze([
      ...(submissionCollections.has(id) ? ["submission" as const] : []),
      ...(operatorCollections.has(id) ? ["operator" as const] : []),
      ...(monitorCollections.has(id) ? ["monitor" as const] : []),
    ]),
  }));

  return Object.freeze({
    catalogue: Object.freeze(catalogue),
    submissions: Object.freeze(submissions),
    operators: Object.freeze(operators),
    monitors: Object.freeze(monitors),
  });
}

function compileSubmissionRoles(
  value: unknown,
  declared: ReadonlySet<FeedbackCollection>,
): FeedbackSubmissionRoleProjection[] {
  const entries = optionalArray(value, "Submission roles");
  const toolNames = new Set<string>();
  const projections = entries.map((entry) => {
    const role = requireRecord(entry, "Submission role");
    if (Object.keys(role).some((key) => !["collection", "access", "requiredScopes"].includes(key))) {
      throw new TypeError("Submission destination must be fixed by deployment configuration");
    }
    const collection = collectionReference(role.collection, declared);
    const toolName = submissionToolName(collection);
    if (toolNames.has(toolName)) throw new TypeError(`Duplicate submission tool name: ${toolName}`);
    toolNames.add(toolName);
    if (role.access !== "public" && role.access !== "protected") {
      throw new TypeError("Submission access must be public or protected");
    }
    const requiredScopes = role.access === "protected"
      ? protectedScopes("Submission", role.requiredScopes)
      : publicScopes(role.requiredScopes);
    return Object.freeze({ collection, toolName, access: role.access, requiredScopes });
  });
  return projections.sort(compareCollection);
}

function compileProtectedRoles(
  roleName: "operator" | "monitor",
  value: unknown,
  declared: ReadonlySet<FeedbackCollection>,
): FeedbackProtectedRoleProjection[] {
  const entries = optionalArray(value, `${roleName} roles`);
  const collections = new Set<FeedbackCollection>();
  const projections = entries.map((entry) => {
    const role = requireRecord(entry, `${capitalize(roleName)} role`);
    rejectUnknownKeys(role, ["collection", "access", "requiredScopes"], `${capitalize(roleName)} role`);
    const collection = collectionReference(role.collection, declared);
    if (collections.has(collection)) throw new TypeError(`Duplicate ${roleName} role for collection: ${collection}`);
    collections.add(collection);
    if (role.access !== "protected") {
      throw new TypeError(`${capitalize(roleName)} roles must use protected access`);
    }
    return Object.freeze({
      collection,
      access: "protected" as const,
      requiredScopes: protectedScopes(capitalize(roleName), role.requiredScopes),
    });
  });
  return projections.sort(compareCollection);
}

function collectionReference(
  value: unknown,
  declared: ReadonlySet<FeedbackCollection>,
): FeedbackCollection {
  const checked = feedbackCollectionSchema.safeParse(value);
  if (!checked.success || !declared.has(checked.data)) {
    throw new TypeError(`Role references undeclared collection: ${String(value)}`);
  }
  return checked.data;
}

function submissionToolName(collection: FeedbackCollection): `submit-${string}-feedback` {
  const slug = collection.replace(/[._]+/g, "-");
  return `submit-${slug}-feedback`;
}

function protectedScopes(roleName: string, value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError(`${roleName} role requires at least one scope`);
  }
  const scopes = value.map((scope) => {
    if (typeof scope !== "string" || scope.length > 240 || !/^[\x21\x23-\x5B\x5D-\x7E]+$/.test(scope)) {
      throw new TypeError(`${roleName} role contains an invalid scope`);
    }
    return scope;
  });
  if (new Set(scopes).size !== scopes.length) {
    throw new TypeError(`${roleName} role contains duplicate scopes`);
  }
  return Object.freeze(scopes);
}

function publicScopes(value: unknown): readonly string[] {
  if (value !== undefined) throw new TypeError("Public submission roles cannot declare scopes");
  return Object.freeze([]);
}

function optionalArray(value: unknown, label: string): readonly unknown[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
  return value;
}

function requireRecord(value: unknown, label: string): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value as Readonly<Record<string, unknown>>;
}

function rejectUnknownKeys(
  value: Readonly<Record<string, unknown>>,
  allowed: readonly string[],
  label: string,
): void {
  if (Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new TypeError(`${label} contains an unsupported field`);
  }
}

function compareCollection<T extends Readonly<{ collection: FeedbackCollection }>>(a: T, b: T): number {
  return a.collection < b.collection ? -1 : a.collection > b.collection ? 1 : 0;
}

function capitalize(value: string): string {
  return `${value[0]?.toUpperCase()}${value.slice(1)}`;
}
