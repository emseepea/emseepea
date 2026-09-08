import { peaVarietiesName, type PeaVarietiesName } from './PeaVarieties.mjs';
import { z } from 'zod';

/**
 * Represents the view public.pea_variety_catalog
 * Stable read and write boundary for the pea variety catalogue.
 */
export default interface PeaVarietyCatalog {
  name: PeaVarietiesName;

  pea_type: string;

  growth_habit: string;

  days_to_maturity: number;

  notes: string;
}

export const peaVarietyCatalog = z.object({
  name: peaVarietiesName,
  pea_type: z.string(),
  growth_habit: z.string(),
  days_to_maturity: z.number(),
  notes: z.string(),
}) as unknown as z.Schema<PeaVarietyCatalog>;