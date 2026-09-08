import { z } from 'zod';

/** Identifier type for public.pea_varieties */
export type PeaVarietiesName = string & { __brand: 'public.pea_varieties' };

/** Represents the table public.pea_varieties */
export default interface PeaVarieties {
  name: PeaVarietiesName;

  pea_type: string;

  growth_habit: string;

  days_to_maturity: number;

  notes: string;
}

/** Represents the initializer for the table public.pea_varieties */
export interface PeaVarietiesInitializer {
  name: PeaVarietiesName;

  pea_type: string;

  growth_habit: string;

  days_to_maturity: number;

  /** Default value: ''::text */
  notes?: string;
}

/** Represents the mutator for the table public.pea_varieties */
export interface PeaVarietiesMutator {
  name?: PeaVarietiesName;

  pea_type?: string;

  growth_habit?: string;

  days_to_maturity?: number;

  notes?: string;
}

export const peaVarietiesName = z.string() as unknown as z.Schema<PeaVarietiesName>;

export const peaVarieties = z.object({
  name: peaVarietiesName,
  pea_type: z.string(),
  growth_habit: z.string(),
  days_to_maturity: z.number(),
  notes: z.string(),
}) as unknown as z.Schema<PeaVarieties>;

export const peaVarietiesInitializer = z.object({
  name: peaVarietiesName,
  pea_type: z.string(),
  growth_habit: z.string(),
  days_to_maturity: z.number(),
  notes: z.string().optional(),
}) as unknown as z.Schema<PeaVarietiesInitializer>;

export const peaVarietiesMutator = z.object({
  name: peaVarietiesName.optional(),
  pea_type: z.string().optional(),
  growth_habit: z.string().optional(),
  days_to_maturity: z.number().optional(),
  notes: z.string().optional(),
}) as unknown as z.Schema<PeaVarietiesMutator>;