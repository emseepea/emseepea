import { z } from "zod";

export const editableReportSchema = z.object({
  gardenBed: z.string().min(1).max(80).describe("Garden bed that this harvest report describes."),
  harvestDate: z.iso.date().describe("Harvest date in YYYY-MM-DD format."),
  shellingCount: z.number().int().nonnegative().describe("Shelling pea plants harvested."),
  snapCount: z.number().int().nonnegative().describe("Snap pea plants harvested."),
});

export const reportKeySchema = editableReportSchema.pick({
  gardenBed: true,
  harvestDate: true,
});

export const reportSchema = editableReportSchema.extend({
  totalPlants: z.number().int().nonnegative().describe("Total pea plants harvested."),
});
