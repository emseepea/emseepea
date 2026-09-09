import {
  defineElicitationView,
  defineTool,
  type AccessPolicy,
  type ElicitationView,
} from "@emseepea/server";
import { z } from "zod";

const peaTypeSchema = z.enum(["all", "shelling", "snap"])
  .describe("Pea type to include, or all pea types.");
const inputSchema = z.strictObject({
  title: z.string().trim().min(1).max(80).describe("Title for the planting-plan preview."),
  peaType: peaTypeSchema,
  includeTips: z.boolean().describe("Whether to include sample growing tips."),
});
const outputSchema = z.strictObject({
  status: z.literal("preview-only").describe("Confirms that this result is only a preview."),
  effectPerformed: z.literal(false).describe("Confirms that nothing was sent, stored, or changed."),
  title: z.string().describe("Title of the planting-plan preview."),
  matchingCount: z.number().int().nonnegative().describe("Number of sample varieties matching the selected pea type."),
  varieties: z.array(z.strictObject({
    name: z.string().describe("Name of the sample pea variety."),
    growthHabit: z.enum(["bush", "climbing"]).describe("Whether the variety grows as a bush or climbing vine."),
    peaType: z.enum(["shelling", "snap"]).describe("Whether the variety is grown for shelled peas or edible pods."),
    tips: z.array(z.string()).optional().describe("Sample growing tips when requested."),
  })).describe("Sample pea varieties matching the selected pea type."),
  notice: z.literal("No report was sent or stored.").describe("Reminder that the preview caused no external effect."),
});

const varieties = [
  { name: "Harbour Gem", growthHabit: "bush" as const, peaType: "shelling" as const, tips: ["compact", "harvest when pods feel full"] },
  { name: "Highland Snap", growthHabit: "climbing" as const, peaType: "snap" as const, tips: ["provide support", "pick pods young"] },
  { name: "Meadow Sweet", growthHabit: "bush" as const, peaType: "snap" as const, tips: ["suits containers", "keep soil moist"] },
];

export function previewPlantingPlan(input: z.output<typeof inputSchema>) {
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

export function createPreviewPlantingPlanTool(access: AccessPolicy = { access: "public" }) {
  return defineTool({
    name: "preview-planting-plan",
    ...access,
    title: "Preview a Pea Planting Plan",
    description: "Preview a sample pea planting plan without sending, storing, or changing anything.",
    inputSchema,
    outputSchema,
    handler: (input) => ({ data: previewPlantingPlan(input) }),
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
