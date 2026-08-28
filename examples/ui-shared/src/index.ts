import { defineElicitationView, defineTool, type ElicitationView } from "@emseepea/server";
import { z } from "zod";

const roastSchema = z.enum(["all", "light", "medium", "dark"]);
const previewInputSchema = z.strictObject({
  title: z.string().trim().min(1).max(80),
  roast: roastSchema,
  includeNotes: z.boolean(),
});
const previewOutputSchema = z.strictObject({
  status: z.literal("preview-only"),
  effectPerformed: z.literal(false),
  title: z.string(),
  matchingCount: z.number().int().nonnegative(),
  beans: z.array(z.strictObject({
    name: z.string(),
    origin: z.string(),
    roast: z.enum(["light", "medium", "dark"]),
    notes: z.array(z.string()).optional(),
  })),
  notice: z.literal("No report was sent or stored."),
});

const beans = [
  { name: "Harbour Dawn", origin: "Sample Coast", roast: "light" as const, notes: ["citrus", "honey"] },
  { name: "Highland Bloom", origin: "Sample Highlands", roast: "medium" as const, notes: ["berry", "cocoa"] },
  { name: "Forest Ember", origin: "Sample Range", roast: "dark" as const, notes: ["molasses", "cedar"] },
];

export function previewBeanReport(input: z.output<typeof previewInputSchema>) {
  const matching = beans.filter((bean) => input.roast === "all" || bean.roast === input.roast);
  return {
    status: "preview-only" as const,
    effectPerformed: false as const,
    title: input.title,
    matchingCount: matching.length,
    beans: matching.map(({ notes, ...bean }) => input.includeNotes ? { ...bean, notes } : bean),
    notice: "No report was sent or stored." as const,
  };
}

export function createPreviewBeanReportTool() {
  return defineTool({
    name: "preview-bean-report",
    access: "public",
    title: "Preview a Bean Report",
    description: "Preview a sample bean report without sending, storing, or changing anything.",
    inputSchema: previewInputSchema,
    outputSchema: previewOutputSchema,
    handler(input) {
      const data = previewBeanReport(input);
      return {
        text: `${data.title} contains ${data.matchingCount} matching sample beans. ${data.notice}`,
        data,
      };
    },
  });
}

const fields = (values: { title: string; roast: z.output<typeof roastSchema>; includeNotes: boolean }, titleErrors?: string[]) => [
  {
    kind: "text" as const,
    id: "report-title",
    name: "title",
    label: "Report title",
    description: "Name this preview so its purpose is clear.",
    required: true,
    minLength: 1,
    maxLength: 80,
    value: values.title,
    ...(titleErrors ? { errors: titleErrors } : {}),
  },
  {
    kind: "select" as const,
    id: "roast",
    name: "roast",
    label: "Roast",
    description: "Choose which sample beans the preview includes.",
    required: true,
    placeholder: "Choose a roast",
    value: values.roast,
    options: [
      { value: "all", label: "All roasts" },
      { value: "light", label: "Light" },
      { value: "medium", label: "Medium" },
      { value: "dark", label: "Dark" },
    ],
  },
  {
    kind: "checkbox" as const,
    id: "include-notes",
    name: "includeNotes",
    label: "Include tasting notes",
    description: "Add sample tasting notes to the preview.",
    checked: values.includeNotes,
  },
];

const base = {
  id: "bean-report-preview",
  heading: "Preview a bean report",
  intro: "Review sample report content. This preview sends and stores nothing.",
  legend: "Report options",
  submitLabel: "Create preview",
} as const;
const defaults = { title: "Roast overview", roast: "all" as const, includeNotes: true };

export const elicitationFixtures = {
  ready: defineElicitationView({ ...base, fields: fields(defaults), state: { kind: "ready", focusTarget: "none" } }),
  invalid: defineElicitationView({
    ...base,
    fields: fields({ ...defaults, title: "" }, ["Enter a report title."]),
    state: {
      kind: "invalid",
      focusTarget: "error-summary",
      summary: {
        heading: "Fix the report options",
        items: [{ fieldId: "report-title", message: "Enter a report title." }],
      },
    },
  }),
  busy: defineElicitationView({
    ...base,
    fields: fields(defaults),
    state: {
      kind: "busy",
      focusTarget: "status",
      status: "Preparing a sample preview. No report is being sent or stored.",
    },
  }),
  terminal: defineElicitationView({
    ...base,
    fields: fields(defaults),
    state: {
      kind: "terminal",
      focusTarget: "terminal",
      heading: "Preview ready",
      message: "Three sample beans match. No report was sent or stored.",
    },
  }),
} satisfies Readonly<Record<"ready" | "invalid" | "busy" | "terminal", ElicitationView>>;

export function fixtureForState(value: unknown): ElicitationView {
  return typeof value === "string" && value in elicitationFixtures
    ? elicitationFixtures[value as keyof typeof elicitationFixtures]
    : elicitationFixtures.ready;
}

export function viewFromSubmission(value: unknown): ElicitationView {
  const record = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  const title = firstString(record.title)?.trim() ?? "";
  const roast = roastSchema.safeParse(firstString(record.roast));
  const input = {
    title,
    roast: roast.success ? roast.data : "all" as const,
    includeNotes: firstString(record.includeNotes) === "true",
  };
  if (!title) {
    return defineElicitationView({
      ...base,
      fields: fields(input, ["Enter a report title."]),
      state: {
        kind: "invalid",
        focusTarget: "error-summary",
        summary: {
          heading: "Fix the report options",
          items: [{ fieldId: "report-title", message: "Enter a report title." }],
        },
      },
    });
  }
  const data = previewBeanReport(input);
  return defineElicitationView({
    ...base,
    fields: fields(input),
    state: {
      kind: "terminal",
      focusTarget: "terminal",
      heading: "Preview ready",
      message: `${data.matchingCount} sample ${data.matchingCount === 1 ? "bean matches" : "beans match"}. ${data.notice}`,
    },
  });
}

function firstString(value: unknown): string | undefined {
  return typeof value === "string" ? value : Array.isArray(value) && typeof value[0] === "string" ? value[0] : undefined;
}
