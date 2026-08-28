import { z } from "zod";

const identifierSchema = z.string().min(1).max(64).regex(/^[A-Za-z][A-Za-z0-9_-]*$/);
const labelSchema = z.string().trim().min(1).max(160);
const proseSchema = z.string().trim().min(1).max(1_000);
const fieldErrorSchema = z.string().trim().min(1).max(300);

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

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

const escapeAttribute = escapeHtml;

function sentence(value: string): string {
  return /[.!?]$/.test(value) ? value : `${value}.`;
}
