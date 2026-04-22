import { useQuery } from '@tanstack/react-query';
import { checkFamilyInteractions, type MedicationInteractionResult } from '../services/drugInteractionService';
import type { Medication } from '../../../types';

/**
 * Checks all pairwise interactions for the current family's medication list.
 * Results are cached for 1 hour (interactions don't change frequently).
 * Returns the full list of interactions plus a Set of medication names
 * that appear in at least one interaction (for badge rendering).
 */
export function useFamilyInteractionWarnings(medications: Medication[] | undefined): {
  interactions: MedicationInteractionResult[];
  interactingNames: Set<string>;
  isLoading: boolean;
} {
  const meds = medications ?? [];
  const cacheKey = meds
    .map((m) => m.name.toLowerCase().trim())
    .sort()
    .join(',');

  const query = useQuery({
    queryKey: ['drug_interactions_family', cacheKey],
    queryFn: () => checkFamilyInteractions(meds),
    enabled: meds.length >= 2,
    staleTime: 60 * 60 * 1000,
    retry: false,
  });

  const interactions = query.data ?? [];
  const interactingNames = new Set(
    interactions.flatMap((r) => [r.medicationName1.toLowerCase(), r.medicationName2.toLowerCase()]),
  );

  return { interactions, interactingNames, isLoading: query.isLoading };
}
