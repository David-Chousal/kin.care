import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  checkFamilyInteractions,
  worstSeverityByInteractionDrugName,
  type InteractionSeverity,
  type MedicationInteractionResult,
} from '../services/drugInteractionService';
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
  /** Lowercased drug names as returned by interaction sources → worst severity on that drug. */
  severityByDrugName: Map<string, InteractionSeverity>;
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
  const severityByDrugName = useMemo(
    () => worstSeverityByInteractionDrugName(interactions),
    [interactions],
  );
  const interactingNames = useMemo(() => new Set(severityByDrugName.keys()), [severityByDrugName]);

  return { interactions, interactingNames, severityByDrugName, isLoading: query.isLoading };
}
