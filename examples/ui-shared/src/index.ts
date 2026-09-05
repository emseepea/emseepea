import { defineElicitationView, defineTool, type ElicitationView } from "@emseepea/server";
import { z } from "zod";

const peaTypeSchema = z.enum(["all", "shelling", "snap"]);
const previewInputSchema = z.strictObject({
  title: z.string().trim().min(1).max(80),
  peaType: peaTypeSchema,
  includeTips: z.boolean(),
});
const previewOutputSchema = z.strictObject({
  status: z.literal("preview-only"),
  effectPerformed: z.literal(false),
  title: z.string(),
  matchingCount: z.number().int().nonnegative(),
  varieties: z.array(z.strictObject({
    name: z.string(),
    growthHabit: z.enum(["bush", "climbing"]),
    peaType: z.enum(["shelling", "snap"]),
    tips: z.array(z.string()).optional(),
  })),
  notice: z.literal("No report was sent or stored."),
});

const varieties = [
  { name: "Harbour Gem", growthHabit: "bush" as const, peaType: "shelling" as const, tips: ["compact", "harvest when pods feel full"] },
  { name: "Highland Snap", growthHabit: "climbing" as const, peaType: "snap" as const, tips: ["provide support", "pick pods young"] },
  { name: "Meadow Sweet", growthHabit: "bush" as const, peaType: "snap" as const, tips: ["suits containers", "keep soil moist"] },
];

export function previewPlantingPlan(input: z.output<typeof previewInputSchema>) {
  const matching = varieties.filter((variety) => input.peaType === "all" || variety.peaType === input.peaType);
  return {
    status: "preview-only" as const,
    effectPerformed: false as const,
    title: input.title,
    matchingCount: matching.length,
    varieties: matching.map(({ tips, ...variety }) => input.includeTips ? { ...variety, tips } : variety),
    notice: "No report was sent or stored." as const,
  };
}

export function createPreviewPlantingPlanTool() {
  return defineTool({
    name: "preview-planting-plan",
    access: "public",
    title: "Preview a Pea Planting Plan",
    description: "Preview a sample pea planting plan without sending, storing, or changing anything.",
    inputSchema: previewInputSchema,
    outputSchema: previewOutputSchema,
    handler(input) {
      const data = previewPlantingPlan(input);
      return {
        text: `${data.title} contains ${data.matchingCount} matching pea varieties. ${data.notice}`,
        data,
      };
    },
  });
}

const fields = (values: { title: string; peaType: z.output<typeof peaTypeSchema>; includeTips: boolean }, titleErrors?: string[]) => [
  {
    kind: "text" as const,
    id: "report-title",
    name: "title",
    label: "Plan title",
    description: "Name this preview so its purpose is clear.",
    required: true,
    minLength: 1,
    maxLength: 80,
    value: values.title,
    ...(titleErrors ? { errors: titleErrors } : {}),
  },
  {
    kind: "select" as const,
    id: "pea-type",
    name: "peaType",
    label: "Pea type",
    description: "Choose which sample pea varieties the preview includes.",
    required: true,
    placeholder: "Choose a pea type",
    value: values.peaType,
    options: [
      { value: "all", label: "All pea types" },
      { value: "shelling", label: "Shelling" },
      { value: "snap", label: "Snap" },
    ],
  },
  {
    kind: "checkbox" as const,
    id: "include-tips",
    name: "includeTips",
    label: "Include growing tips",
    description: "Add sample growing tips to the preview.",
    checked: values.includeTips,
  },
];

const base = {
  id: "pea-planting-plan-preview",
  heading: "Preview a pea planting plan",
  intro: "Review a sample planting plan. This preview sends and stores nothing.",
  legend: "Planting plan options",
  submitLabel: "Create preview",
} as const;
const defaults = { title: "Autumn pea plan", peaType: "all" as const, includeTips: true };

export const elicitationFixtures = {
  ready: defineElicitationView({ ...base, fields: fields(defaults), state: { kind: "ready", focusTarget: "none" } }),
  invalid: defineElicitationView({
    ...base,
    fields: fields({ ...defaults, title: "" }, ["Enter a plan title."]),
    state: {
      kind: "invalid",
      focusTarget: "error-summary",
      summary: {
        heading: "Fix the planting plan options",
        items: [{ fieldId: "report-title", message: "Enter a plan title." }],
      },
    },
  }),
  busy: defineElicitationView({
    ...base,
    fields: fields(defaults),
    state: {
      kind: "busy",
      focusTarget: "status",
      status: "Preparing a sample planting-plan preview. No report is being sent or stored.",
    },
  }),
  terminal: defineElicitationView({
    ...base,
    fields: fields(defaults),
    state: {
      kind: "terminal",
      focusTarget: "terminal",
      heading: "Preview ready",
      message: "Three sample pea varieties match. No report was sent or stored.",
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
  const peaType = peaTypeSchema.safeParse(firstString(record.peaType));
  const input = {
    title,
    peaType: peaType.success ? peaType.data : "all" as const,
    includeTips: firstString(record.includeTips) === "true",
  };
  if (!title) {
    return defineElicitationView({
      ...base,
    fields: fields(input, ["Enter a plan title."]),
      state: {
        kind: "invalid",
        focusTarget: "error-summary",
        summary: {
          heading: "Fix the planting plan options",
          items: [{ fieldId: "report-title", message: "Enter a plan title." }],
        },
      },
    });
  }
  const data = previewPlantingPlan(input);
  return defineElicitationView({
    ...base,
    fields: fields(input),
    state: {
      kind: "terminal",
      focusTarget: "terminal",
      heading: "Preview ready",
      message: `${data.matchingCount} sample pea ${data.matchingCount === 1 ? "variety matches" : "varieties match"}. ${data.notice}`,
    },
  });
}

function firstString(value: unknown): string | undefined {
  return typeof value === "string" ? value : Array.isArray(value) && typeof value[0] === "string" ? value[0] : undefined;
}
