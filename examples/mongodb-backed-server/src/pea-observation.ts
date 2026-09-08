import { z } from "zod";

export const observationSchema = z.object({
  variety_name: z.string().min(1).max(100).describe("Name of the observed pea variety."),
  observed_on: z.iso.date().describe("Calendar date of the observation in YYYY-MM-DD format."),
  location: z.string().min(1).max(100).describe("Short human-readable name of the growing location."),
  growth_stage: z.string().min(1).max(40)
    .describe("Observed growth stage, such as germinating, flowering, or podding."),
  notes: z.string().max(500).describe("Short notes about what was observed."),
});
