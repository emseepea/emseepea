import { z } from "zod";

const identifierSchema = z.string().min(1).max(64).regex(/^[A-Za-z][A-Za-z0-9_-]*$/);
const labelSchema = z.string().trim().min(1).max(160);
const proseSchema = z.string().trim().min(1).max(1_000);
const fieldErrorSchema = z.string().trim().min(1).max(300);

const resultStateSchema = z.strictObject({
  kind: z.enum(["loading", "ready", "updated", "empty", "sending", "sent", "error"]),
  status: proseSchema,
  focusTarget: z.enum(["none", "status", "result", "actions"]),
});

const resultActionSchema = z.strictObject({
  id: identifierSchema,
  label: labelSchema,
  accessibleName: labelSchema.optional(),
  disabled: z.boolean().optional(),
});

export const resultViewSchema = z.strictObject({
  id: identifierSchema,
  heading: labelSchema,
  headline: labelSchema.optional(),
  summary: proseSchema.optional(),
  metrics: z.array(z.strictObject({
    label: labelSchema,
    value: labelSchema,
    hint: labelSchema.optional(),
  })).max(32).default([]),
  reasons: z.strictObject({ label: labelSchema, items: z.array(proseSchema).min(1).max(16) }).optional(),
  assumptions: z.strictObject({ label: labelSchema, items: z.array(proseSchema).min(1).max(16) }).optional(),
  disclosure: z.strictObject({
    label: labelSchema,
    items: z.array(proseSchema).min(1).max(16),
  }).optional(),
  disclaimer: proseSchema,
  actionsLabel: labelSchema.optional(),
  actions: z.array(resultActionSchema).max(8).default([]),
  state: resultStateSchema,
}).superRefine((view, context) => {
  if (["ready", "updated", "sending", "sent"].includes(view.state.kind) && !view.headline) {
    context.addIssue({ code: "custom", message: "Result content requires a headline", path: ["headline"] });
  }
  if (view.actions.length > 0 && !view.actionsLabel) {
    context.addIssue({ code: "custom", message: "Result actions require a group label", path: ["actionsLabel"] });
  }
  if (view.state.focusTarget === "actions" && !view.actions.some((action) => !action.disabled)) {
    context.addIssue({ code: "custom", message: "The actions focus target requires an enabled action", path: ["state", "focusTarget"] });
  }
  const ids = new Set<string>();
  for (const [index, action] of view.actions.entries()) {
    if (ids.has(action.id)) {
      context.addIssue({ code: "custom", message: "Result action IDs must be unique", path: ["actions", index, "id"] });
    }
    ids.add(action.id);
    if (action.accessibleName && !action.accessibleName.toLocaleLowerCase().includes(action.label.toLocaleLowerCase())) {
      context.addIssue({ code: "custom", message: "An action accessible name must contain its visible label", path: ["actions", index, "accessibleName"] });
    }
  }
});

export type ResultView = z.output<typeof resultViewSchema>;
export type ResultAction = z.output<typeof resultActionSchema>;

export function parseResultView(value: unknown): ResultView {
  return resultViewSchema.parse(value);
}

export function defineResultView(value: z.input<typeof resultViewSchema>): ResultView {
  return parseResultView(value);
}

export interface McpAppHostContext {
  readonly theme?: "light" | "dark";
  readonly displayMode?: "inline" | "fullscreen" | "pip";
  readonly locale?: string;
  readonly timeZone?: string;
  readonly platform?: "web" | "desktop" | "mobile";
}

export interface McpAppState<Result> {
  readonly status: "connecting" | "ready" | "result" | "cancelled" | "error";
  readonly result: Result | null;
  readonly resultRevision: number;
  readonly hostContext: McpAppHostContext;
  readonly error?: string;
}

export interface McpAppController<Result> {
  readonly getState: () => McpAppState<Result>;
  readonly subscribe: (listener: () => void) => () => void;
  readonly connect: (channel?: Window) => () => void;
  readonly sendMessage: (text: string) => Promise<void>;
}

export interface McpAppControllerOptions<Result> {
  readonly name: string;
  readonly version: string;
  readonly parseResult: (value: unknown) => Result;
  readonly requestId?: string;
  readonly timeoutMs?: number;
}

interface PendingRequest {
  readonly resolve: () => void;
  readonly reject: (error: Error) => void;
  readonly timer: ReturnType<typeof setTimeout>;
}

export function createMcpAppController<Result>(options: McpAppControllerOptions<Result>): McpAppController<Result> {
  const timeoutMs = checkedTimeout(options.timeoutMs ?? 10_000);
  const requestId = options.requestId ?? `emseepea-${globalThis.crypto.randomUUID()}`;
  const listeners = new Set<() => void>();
  const pending = new Map<string, PendingRequest>();
  let sequence = 0;
  let channel: Window | undefined;
  let ready = false;
  let disconnectCurrent: (() => void) | undefined;
  let state: McpAppState<Result> = { status: "connecting", result: null, resultRevision: 0, hostContext: {} };

  const update = (next: McpAppState<Result>) => {
    state = next;
    for (const listener of listeners) listener();
  };
  const getState = () => state;
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  const connect = (nextChannel: Window = window) => {
    disconnectCurrent?.();
    channel = nextChannel;
    ready = false;
    update({ ...state, status: "connecting", error: undefined });
    const initializeTimer = setTimeout(() => {
      update({ ...state, status: "error", error: "The result could not connect to its host." });
    }, timeoutMs);
    const disconnect = () => {
      clearTimeout(initializeTimer);
      nextChannel.removeEventListener("message", receive);
      ready = false;
      if (channel === nextChannel) channel = undefined;
      for (const request of pending.values()) {
        clearTimeout(request.timer);
        request.reject(new Error("The app was disconnected."));
      }
      pending.clear();
      if (disconnectCurrent === disconnect) disconnectCurrent = undefined;
    };
    const receive = (event: MessageEvent<unknown>) => {
      if (event.source !== nextChannel.parent || !record(event.data) || event.data.jsonrpc !== "2.0") return;
      const message = event.data;
      if (message.id === requestId) {
        clearTimeout(initializeTimer);
        if (record(message.error) || !record(message.result) || message.result.protocolVersion !== "2026-01-26") {
          update({ ...state, status: "error", error: "The result could not connect to its host." });
          return;
        }
        ready = true;
        update({ ...state, status: "ready", hostContext: checkedHostContext(message.result.hostContext), error: undefined });
        nextChannel.parent.postMessage({ jsonrpc: "2.0", method: "ui/notifications/initialized" }, "*");
        return;
      }
      if (typeof message.id === "string" && pending.has(message.id)) {
        const request = pending.get(message.id)!;
        clearTimeout(request.timer);
        pending.delete(message.id);
        if (record(message.error)) request.reject(new Error("The host rejected the message."));
        else request.resolve();
        return;
      }
      if (!ready || typeof message.method !== "string") return;
      if (message.method === "ui/resource-teardown" && (typeof message.id === "string" || typeof message.id === "number")) {
        nextChannel.parent.postMessage({ jsonrpc: "2.0", id: message.id, result: {} }, "*");
        update({ ...state, status: "cancelled", error: undefined });
        disconnect();
        return;
      }
      if (message.method === "ui/notifications/host-context-changed") {
        update({ ...state, hostContext: { ...state.hostContext, ...checkedHostContext(message.params) } });
        return;
      }
      if (message.method === "ui/notifications/tool-cancelled") {
        update({ ...state, status: "cancelled", error: undefined });
        return;
      }
      if (message.method !== "ui/notifications/tool-result" || !record(message.params)) return;
      try {
        update({
          ...state,
          status: "result",
          result: options.parseResult(message.params.structuredContent),
          resultRevision: state.resultRevision + 1,
          error: undefined,
        });
      } catch {
        update({ ...state, status: "error", error: "The result could not be displayed." });
      }
    };
    nextChannel.addEventListener("message", receive);
    disconnectCurrent = disconnect;
    nextChannel.parent.postMessage({
      jsonrpc: "2.0",
      id: requestId,
      method: "ui/initialize",
      params: {
        protocolVersion: "2026-01-26",
        appInfo: { name: options.name, version: options.version },
        appCapabilities: { availableDisplayModes: ["inline"] },
      },
    }, "*");
    return disconnect;
  };
  const sendMessage = (text: string) => {
    if (!text.trim()) return Promise.reject(new TypeError("Message text must not be empty"));
    if (!ready || !channel || !disconnectCurrent) return Promise.reject(new Error("The app is not connected."));
    const id = `${requestId}-message-${++sequence}`;
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error("The host did not answer the message."));
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer });
      channel!.parent.postMessage({
        jsonrpc: "2.0",
        id,
        method: "ui/message",
        params: { role: "user", content: [{ type: "text", text }] },
      }, "*");
    });
  };

  return { getState, subscribe, connect, sendMessage };
}

function checkedHostContext(value: unknown): McpAppHostContext {
  if (!record(value)) return {};
  return {
    ...(value.theme === "light" || value.theme === "dark" ? { theme: value.theme } : {}),
    ...(value.displayMode === "inline" || value.displayMode === "fullscreen" || value.displayMode === "pip"
      ? { displayMode: value.displayMode } : {}),
    ...(typeof value.locale === "string" && value.locale.length <= 100 ? { locale: value.locale } : {}),
    ...(typeof value.timeZone === "string" && value.timeZone.length <= 100 ? { timeZone: value.timeZone } : {}),
    ...(value.platform === "web" || value.platform === "desktop" || value.platform === "mobile"
      ? { platform: value.platform } : {}),
  };
}

function checkedTimeout(value: number): number {
  if (!Number.isSafeInteger(value) || value < 100 || value > 60_000) {
    throw new TypeError("timeoutMs must be an integer from 100 to 60000");
  }
  return value;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const commonFieldShape = {
  id: identifierSchema,
  name: identifierSchema,
  label: labelSchema,
  description: proseSchema.optional(),
  required: z.boolean().optional(),
  disabled: z.boolean().optional(),
  errors: z.array(fieldErrorSchema).max(8).optional(),
};

export const elicitationTextFieldSchema = z.strictObject({
  ...commonFieldShape,
  kind: z.literal("text"),
  value: z.string().max(1_000).optional(),
  minLength: z.number().int().min(0).max(1_000).optional(),
  maxLength: z.number().int().min(1).max(1_000).optional(),
});

export const elicitationSelectFieldSchema = z.strictObject({
  ...commonFieldShape,
  kind: z.literal("select"),
  value: z.string().max(200).optional(),
  placeholder: labelSchema,
  options: z.array(z.strictObject({
    value: z.string().min(1).max(200),
    label: labelSchema,
    disabled: z.boolean().optional(),
  })).min(1).max(100),
});

export const elicitationCheckboxFieldSchema = z.strictObject({
  ...commonFieldShape,
  kind: z.literal("checkbox"),
  checked: z.boolean(),
});

export const elicitationFieldSchema = z.discriminatedUnion("kind", [
  elicitationTextFieldSchema,
  elicitationSelectFieldSchema,
  elicitationCheckboxFieldSchema,
]);

const readyStateSchema = z.strictObject({
  kind: z.literal("ready"),
  focusTarget: z.literal("none"),
  status: proseSchema.optional(),
});
const invalidStateSchema = z.strictObject({
  kind: z.literal("invalid"),
  focusTarget: z.literal("error-summary"),
  summary: z.strictObject({
    heading: labelSchema,
    items: z.array(z.strictObject({
      fieldId: identifierSchema,
      message: fieldErrorSchema,
    })).min(1).max(32),
  }),
});
const busyStateSchema = z.strictObject({
  kind: z.literal("busy"),
  focusTarget: z.literal("status"),
  status: proseSchema,
});
const terminalStateSchema = z.strictObject({
  kind: z.literal("terminal"),
  focusTarget: z.literal("terminal"),
  heading: labelSchema,
  message: proseSchema,
});

export const elicitationStateSchema = z.discriminatedUnion("kind", [
  readyStateSchema,
  invalidStateSchema,
  busyStateSchema,
  terminalStateSchema,
]);

export const elicitationViewSchema = z.strictObject({
  id: identifierSchema,
  heading: labelSchema,
  intro: proseSchema.optional(),
  legend: labelSchema,
  fields: z.array(elicitationFieldSchema).min(1).max(32),
  submitLabel: labelSchema,
  state: elicitationStateSchema,
}).superRefine((view, context) => {
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const [index, field] of view.fields.entries()) {
    if (ids.has(field.id)) {
      context.addIssue({ code: "custom", message: "Field IDs must be unique", path: ["fields", index, "id"] });
    }
    if (names.has(field.name)) {
      context.addIssue({ code: "custom", message: "Field names must be unique", path: ["fields", index, "name"] });
    }
    ids.add(field.id);
    names.add(field.name);
    if (field.kind === "text" && field.minLength !== undefined && field.maxLength !== undefined &&
        field.minLength > field.maxLength) {
      context.addIssue({ code: "custom", message: "minLength cannot exceed maxLength", path: ["fields", index] });
    }
    if (field.kind === "select") {
      const values = new Set<string>();
      for (const [optionIndex, option] of field.options.entries()) {
        if (values.has(option.value)) {
          context.addIssue({
            code: "custom",
            message: "Select option values must be unique",
            path: ["fields", index, "options", optionIndex, "value"],
          });
        }
        values.add(option.value);
      }
      if (field.value !== undefined && !values.has(field.value)) {
        context.addIssue({ code: "custom", message: "Selected value must be an option", path: ["fields", index, "value"] });
      }
    }
  }

  if (view.state.kind !== "invalid") {
    for (const [index, field] of view.fields.entries()) {
      if ((field.errors?.length ?? 0) > 0) {
        context.addIssue({
          code: "custom",
          message: "Field errors require the invalid state",
          path: ["fields", index, "errors"],
        });
      }
    }
    return;
  }

  const fields = new Map(view.fields.map((field) => [field.id, field]));
  const summaryIds = new Set<string>();
  for (const [index, item] of view.state.summary.items.entries()) {
    const field = fields.get(item.fieldId);
    if (!field) {
      context.addIssue({ code: "custom", message: "Summary item must reference a field", path: ["state", "summary", "items", index, "fieldId"] });
    } else if (!field.errors?.includes(item.message)) {
      context.addIssue({ code: "custom", message: "Summary message must match a field error", path: ["state", "summary", "items", index, "message"] });
    }
    if (summaryIds.has(item.fieldId)) {
      context.addIssue({ code: "custom", message: "Summary field references must be unique", path: ["state", "summary", "items", index, "fieldId"] });
    }
    summaryIds.add(item.fieldId);
  }
  for (const [index, field] of view.fields.entries()) {
    if ((field.errors?.length ?? 0) > 0 && !summaryIds.has(field.id)) {
      context.addIssue({ code: "custom", message: "Every invalid field must appear in the summary", path: ["fields", index, "errors"] });
    }
  }
});

export type ElicitationView = z.output<typeof elicitationViewSchema>;
export type ElicitationField = z.output<typeof elicitationFieldSchema>;
export type ElicitationState = z.output<typeof elicitationStateSchema>;
export type ElicitationHeadingLevel = 2 | 3 | 4 | 5 | 6;

export function parseElicitationView(value: unknown): ElicitationView {
  return elicitationViewSchema.parse(value);
}

export function defineElicitationView(value: z.input<typeof elicitationViewSchema>): ElicitationView {
  return parseElicitationView(value);
}

export function renderElicitationForm(
  value: unknown,
  options: { readonly headingLevel: ElicitationHeadingLevel },
): string {
  const view = parseElicitationView(value);
  const headingLevel = checkedHeadingLevel(options.headingLevel);
  const subheadingLevel = Math.min(headingLevel + 1, 6) as ElicitationHeadingLevel;
  const headingId = `${view.id}--heading`;
  const introId = `${view.id}--intro`;
  const statusId = `${view.id}--status`;
  const parts = [
    `<section data-emseepea-part="view" data-emseepea-state="${view.state.kind}">`,
    `<h${headingLevel} id="${headingId}">${escapeHtml(view.heading)}</h${headingLevel}>`,
  ];
  if (view.intro) parts.push(`<p id="${introId}" data-emseepea-part="intro">${escapeHtml(view.intro)}</p>`);
  parts.push(renderStatus(view, statusId));

  if (view.state.kind === "terminal") {
    parts.push(
      `<div id="${view.id}--terminal" data-emseepea-part="terminal" tabindex="-1" autofocus>`,
      `<h${subheadingLevel}>${escapeHtml(view.state.heading)}</h${subheadingLevel}>`,
      `<p>${escapeHtml(view.state.message)}</p>`,
      "</div>",
      "</section>",
    );
    return parts.join("");
  }

  if (view.state.kind === "invalid") {
    parts.push(renderErrorSummary(view, subheadingLevel));
  }
  parts.push(
    `<form method="post" data-emseepea-part="form" aria-labelledby="${headingId}"` +
      `${view.intro ? ` aria-describedby="${introId}"` : ""}` +
      `${view.state.kind === "busy" ? ' aria-busy="true"' : ""}>`,
    "<fieldset>",
    `<legend>${escapeHtml(view.legend)}</legend>`,
    ...view.fields.map((field) => renderField(view.id, field)),
    "</fieldset>",
    `<button type="submit" data-emseepea-part="submit"${view.state.kind === "busy" ? " disabled" : ""}>` +
      `${escapeHtml(view.submitLabel)}</button>`,
    "</form>",
    "</section>",
  );
  return parts.join("");
}

export function renderResultView(
  value: unknown,
  options: { readonly headingLevel: ElicitationHeadingLevel; readonly idPrefix: string },
): string {
  const view = parseResultView(value);
  const headingLevel = checkedHeadingLevel(options.headingLevel);
  const prefix = checkedIdentifier("idPrefix", options.idPrefix);
  const headingId = `${prefix}--heading`;
  const focused = (target: ResultView["state"]["focusTarget"]) =>
    view.state.focusTarget === target ? ' tabindex="-1" autofocus' : "";
  const parts = [
    `<section data-emseepea-part="result-view" data-emseepea-state="${view.state.kind}" aria-labelledby="${headingId}"${focused("result")}>`,
    `<h${headingLevel} id="${headingId}">${escapeHtml(view.heading)}</h${headingLevel}>`,
    `<div data-emseepea-part="status" role="status" aria-live="polite" aria-atomic="true" aria-relevant="additions text"${focused("status")}>${escapeHtml(view.state.status)}</div>`,
  ];
  if (view.headline) parts.push(`<p data-emseepea-part="headline">${escapeHtml(view.headline)}</p>`);
  if (view.summary) parts.push(`<p data-emseepea-part="summary">${escapeHtml(view.summary)}</p>`);
  if (view.metrics.length) {
    parts.push(`<dl data-emseepea-part="metrics">${view.metrics.map((metric) =>
      `<div data-emseepea-part="metric"><dt>${escapeHtml(metric.label)}${metric.hint ? ` <span data-emseepea-part="hint">(${escapeHtml(metric.hint)})</span>` : ""}</dt><dd>${escapeHtml(metric.value)}</dd></div>`
    ).join("")}</dl>`);
  }
  if (view.reasons) parts.push(renderResultList("reasons", view.reasons, prefix));
  if (view.assumptions) parts.push(renderResultList("assumptions", view.assumptions, prefix));
  if (view.disclosure) {
    parts.push(`<details data-emseepea-part="disclosure"><summary>${escapeHtml(view.disclosure.label)}</summary><ul>${view.disclosure.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></details>`);
  }
  if (view.actions.length) {
    const firstEnabled = view.actions.findIndex((action) => !action.disabled);
    parts.push(`<div data-emseepea-part="actions" role="group" aria-label="${escapeAttribute(view.actionsLabel!)}">${view.actions.map((action, index) =>
      `<button type="button" data-emseepea-part="action" data-emseepea-action="${escapeAttribute(action.id)}"${action.accessibleName ? ` aria-label="${escapeAttribute(action.accessibleName)}"` : ""}${action.disabled ? " disabled" : ""}${index === firstEnabled && view.state.focusTarget === "actions" ? " autofocus" : ""}>${escapeHtml(action.label)}</button>`
    ).join("")}</div>`);
  }
  parts.push(`<p data-emseepea-part="disclaimer">${escapeHtml(view.disclaimer)}</p>`, "</section>");
  return parts.join("");
}

function renderResultList(
  part: "reasons" | "assumptions",
  group: { readonly label: string; readonly items: readonly string[] },
  prefix: string,
): string {
  const labelId = `${prefix}--${part}-label`;
  return `<div data-emseepea-part="${part}"><p id="${labelId}" data-emseepea-part="${part}-label">${escapeHtml(group.label)}</p>` +
    `<ul aria-labelledby="${labelId}">${group.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>`;
}

function renderStatus(view: ElicitationView, statusId: string): string {
  const text = view.state.kind === "ready"
    ? view.state.status ?? ""
    : view.state.kind === "invalid"
      ? `Form has ${view.state.summary.items.length} ${view.state.summary.items.length === 1 ? "error" : "errors"}.`
      : view.state.kind === "busy"
        ? view.state.status
        : sentence(view.state.heading);
  const focused = view.state.focusTarget === "status" ? ' tabindex="-1" autofocus' : "";
  return `<div id="${statusId}" data-emseepea-part="status" role="status" aria-live="polite" ` +
    `aria-atomic="true" aria-relevant="additions text"${focused}>${escapeHtml(text)}</div>`;
}

function renderErrorSummary(view: ElicitationView, headingLevel: ElicitationHeadingLevel): string {
  if (view.state.kind !== "invalid") return "";
  const fields = new Map(view.fields.map((field) => [field.id, field]));
  const items = view.state.summary.items.map((item) => {
    const label = fields.get(item.fieldId)?.label ?? item.fieldId;
    return `<li><a href="#${view.id}--field--${item.fieldId}">` +
      `${escapeHtml(`${label}: ${item.message}`)}</a></li>`;
  }).join("");
  return `<div id="${view.id}--error-summary" data-emseepea-part="error-summary" role="alert" tabindex="-1" autofocus>` +
    `<h${headingLevel}>${escapeHtml(view.state.summary.heading)}</h${headingLevel}><ul>${items}</ul></div>`;
}

function renderField(viewId: string, field: ElicitationField): string {
  const fieldId = `${viewId}--field--${field.id}`;
  const descriptionId = `${fieldId}--description`;
  const errorId = `${fieldId}--error`;
  const describedBy = [field.description ? descriptionId : undefined, field.errors?.length ? errorId : undefined]
    .filter(Boolean).join(" ");
  const attributes = [
    `id="${fieldId}"`,
    `name="${escapeAttribute(field.name)}"`,
    field.required ? "required" : undefined,
    field.disabled ? "disabled" : undefined,
    field.errors?.length ? 'aria-invalid="true"' : undefined,
    describedBy ? `aria-describedby="${describedBy}"` : undefined,
  ].filter(Boolean).join(" ");
  const label = `<label for="${fieldId}">${escapeHtml(field.label)}` +
    `${field.required ? ' <span data-emseepea-part="required">(required)</span>' : ""}</label>`;
  let control: string;
  if (field.kind === "text") {
    control = `<input type="text" ${attributes}` +
      `${field.value !== undefined ? ` value="${escapeAttribute(field.value)}"` : ""}` +
      `${field.minLength !== undefined ? ` minlength="${field.minLength}"` : ""}` +
      `${field.maxLength !== undefined ? ` maxlength="${field.maxLength}"` : ""}>`;
  } else if (field.kind === "select") {
    const placeholder = `<option value=""${field.value === undefined ? " selected" : ""}>` +
      `${escapeHtml(field.placeholder)}</option>`;
    const options = field.options.map((option) => (
      `<option value="${escapeAttribute(option.value)}"${field.value === option.value ? " selected" : ""}` +
      `${option.disabled ? " disabled" : ""}>${escapeHtml(option.label)}</option>`
    )).join("");
    control = `<select ${attributes}>${placeholder}${options}</select>`;
  } else {
    control = `<input type="checkbox" value="true" ${attributes}${field.checked ? " checked" : ""}>`;
  }
  const description = field.description
    ? `<p id="${descriptionId}" data-emseepea-part="description">${escapeHtml(field.description)}</p>`
    : "";
  const errors = field.errors?.length
    ? `<div id="${errorId}" data-emseepea-part="field-error">${field.errors.map((error) => `<p>${escapeHtml(error)}</p>`).join("")}</div>`
    : "";
  return `<div data-emseepea-part="field" data-emseepea-field-kind="${field.kind}">` +
    `${field.kind === "checkbox" ? `${control}${label}` : `${label}${control}`}${description}${errors}</div>`;
}

function checkedHeadingLevel(value: unknown): ElicitationHeadingLevel {
  if (value !== 2 && value !== 3 && value !== 4 && value !== 5 && value !== 6) {
    throw new TypeError("headingLevel must be an integer from 2 to 6");
  }
  return value;
}

function checkedIdentifier(field: string, value: unknown): string {
  const result = identifierSchema.safeParse(value);
  if (!result.success) throw new TypeError(`${field} must be a valid identifier`);
  return result.data;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

const escapeAttribute = escapeHtml;

function sentence(value: string): string {
  return /[.!?]$/.test(value) ? value : `${value}.`;
}
