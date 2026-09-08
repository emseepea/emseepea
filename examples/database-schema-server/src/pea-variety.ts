import { z } from "zod";

export const varietySchema = z.object({
  name: z.string().min(1).max(100).describe("Name of the pea variety."),
  pea_type: z.string().min(1).max(40).describe("Type of pea, such as shelling, snap, or snow."),
  growth_habit: z.string().min(1).max(40).describe("How the plant grows, such as bush or climbing."),
  days_to_maturity: z.number().int().positive().describe("Typical number of days from sowing to harvest."),
  notes: z.string().max(500).describe("Short growing or eating notes."),
});
