import { z } from 'zod';

/**
 * Represents the compositeType public.pea_catalog_summary
 * Summary returned by the secondary stored-procedure example.
 */
export default interface PeaCatalogSummary {
  pea_type: string | null;

  variety_count: number | null;

  fastest_days_to_maturity: number | null;
}

export const peaCatalogSummary = z.object({
  pea_type: z.string().nullable(),
  variety_count: z.number().nullable(),
  fastest_days_to_maturity: z.number().nullable(),
}) as unknown as z.Schema<PeaCatalogSummary>;