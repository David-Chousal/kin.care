import { SUPABASE_URL, getSupabaseAccessToken } from '../../../lib/supabase';

const RXNORM_BASE = 'https://rxnav.nlm.nih.gov/REST';

export type InteractionSeverity = 'mild' | 'moderate' | 'severe';

const SEVERITY_RANK: Record<InteractionSeverity, number> = {
  mild: 0,
  moderate: 1,
  severe: 2,
};

/**
 * For each drug name appearing in interaction results (RxNorm / AI concept strings),
 * returns the highest severity among all pairs involving that name.
 * Keys are lowercased trimmed strings matching lookup from the medication list.
 */
export function worstSeverityByInteractionDrugName(
  interactions: MedicationInteractionResult[],
): Map<string, InteractionSeverity> {
  const map = new Map<string, InteractionSeverity>();
  for (const row of interactions) {
    for (const raw of [row.medicationName1, row.medicationName2]) {
      const key = raw.toLowerCase().trim();
      if (!key) continue;
      const prev = map.get(key);
      if (!prev || SEVERITY_RANK[row.severity] > SEVERITY_RANK[prev]) {
        map.set(key, row.severity);
      }
    }
  }
  return map;
}

export interface MedicationInteractionResult {
  medicationName1: string;
  medicationName2: string;
  severity: InteractionSeverity;
  description: string;
  source: 'rxnorm' | 'ai';
}

// In-memory RxCUI cache to avoid redundant lookups within a session
const rxcuiCache = new Map<string, string | null>();

async function lookupRxCui(drugName: string): Promise<string | null> {
  const key = drugName.toLowerCase().trim();
  if (rxcuiCache.has(key)) return rxcuiCache.get(key) ?? null;

  try {
    const url = `${RXNORM_BASE}/rxcui.json?name=${encodeURIComponent(key)}&search=1`;
    const res = await fetch(url);
    if (!res.ok) {
      rxcuiCache.set(key, null);
      return null;
    }
    const json = (await res.json()) as { idGroup?: { rxnormId?: string[] } };
    const rxcui = json?.idGroup?.rxnormId?.[0] ?? null;
    rxcuiCache.set(key, rxcui);
    return rxcui;
  } catch {
    rxcuiCache.set(key, null);
    return null;
  }
}

function parseSeverity(text: string): InteractionSeverity {
  const lower = text.toLowerCase();
  if (lower.includes('major') || lower.includes('severe') || lower.includes('high')) return 'severe';
  if (lower.includes('moderate') || lower.includes('medium')) return 'moderate';
  return 'mild';
}

interface RxNormInteractionPair {
  interactionConcept?: Array<{
    minConceptItem?: { name?: string };
  }>;
  severity?: string;
  description?: string;
}

interface RxNormResponse {
  fullInteractionTypeGroup?: Array<{
    fullInteractionType?: Array<{
      interactionPair?: RxNormInteractionPair[];
    }>;
  }>;
}

async function fetchRxNormInteractions(rxcuis: string[]): Promise<MedicationInteractionResult[]> {
  if (rxcuis.length < 2) return [];

  try {
    // RxNav discontinued drug–drug interaction REST endpoints (~2024); this often 404s.
    // Callers fall back to AI screening when this returns nothing.
    const url = `${RXNORM_BASE}/interaction/list.json?rxcuis=${rxcuis.join('+')}`;
    const res = await fetch(url);
    if (!res.ok) return [];

    const json = (await res.json()) as RxNormResponse;
    const results: MedicationInteractionResult[] = [];

    for (const group of json?.fullInteractionTypeGroup ?? []) {
      for (const type of group?.fullInteractionType ?? []) {
        for (const pair of type?.interactionPair ?? []) {
          const concepts = pair.interactionConcept ?? [];
          const name1 = concepts[0]?.minConceptItem?.name ?? '';
          const name2 = concepts[1]?.minConceptItem?.name ?? '';
          if (!name1 || !name2 || !pair.description) continue;

          results.push({
            medicationName1: name1,
            medicationName2: name2,
            severity: parseSeverity(pair.severity ?? ''),
            description: pair.description,
            source: 'rxnorm',
          });
        }
      }
    }

    return results;
  } catch {
    return [];
  }
}

async function checkInteractionViaAI(
  newDrugName: string,
  existingMedicationId: string,
  existingMedicationName: string,
  familyId: string,
): Promise<MedicationInteractionResult | null> {
  try {
    const token = await getSupabaseAccessToken();
    if (!token || !familyId) return null;

    const res = await fetch(`${SUPABASE_URL}/functions/v1/llm-gateway/drug-interactions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        family_id: familyId,
        new_drug_name: newDrugName,
        existing_medication_id: existingMedicationId,
      }),
    });

    if (!res.ok) return null;

    const result = (await res.json()) as {
      hasInteraction: boolean;
      severity: string;
      description: string;
    };

    if (!result.hasInteraction || result.severity === 'none') return null;

    const severity: InteractionSeverity = ['mild', 'moderate', 'severe'].includes(result.severity)
      ? (result.severity as InteractionSeverity)
      : 'moderate';

    return {
      medicationName1: newDrugName,
      medicationName2: existingMedicationName,
      severity,
      description: String(result.description ?? ''),
      source: 'ai',
    };
  } catch {
    return null;
  }
}

async function fetchFamilyInteractionsBatchAI(
  familyId: string,
): Promise<MedicationInteractionResult[]> {
  try {
    const token = await getSupabaseAccessToken();
    if (!token || !familyId) return [];

    const res = await fetch(`${SUPABASE_URL}/functions/v1/llm-gateway/drug-interactions-family`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ family_id: familyId }),
    });

    if (!res.ok) return [];

    const body = (await res.json()) as {
      interactions?: Array<{
        medicationName1: string;
        medicationName2: string;
        severity: InteractionSeverity;
        description: string;
      }>;
    };

    const rows = body.interactions ?? [];
    return rows.map((r) => ({
      medicationName1: r.medicationName1,
      medicationName2: r.medicationName2,
      severity: ['mild', 'moderate', 'severe'].includes(r.severity) ? r.severity : 'moderate',
      description: String(r.description ?? ''),
      source: 'ai' as const,
    }));
  } catch {
    return [];
  }
}

/**
 * Check a new drug against a list of existing drugs.
 * Uses RxNorm for drugs it recognises; falls back to server-side AI for unknowns.
 * Returns only interactions that involve newDrugName.
 * @param familyId Required for AI fallback (server resolves listed drugs by medication id).
 */
export async function checkAllInteractions(
  newDrugName: string,
  existingMedications: Array<{ id: string; name: string }>,
  familyId: string,
): Promise<MedicationInteractionResult[]> {
  if (existingMedications.length === 0) return [];

  const allNames = [newDrugName, ...existingMedications.map((m) => m.name)];

  // Look up RxCUIs for all drugs in parallel
  const rxcuiEntries = await Promise.all(
    allNames.map(async (name) => ({ name, rxcui: await lookupRxCui(name) })),
  );

  const withRxcui = rxcuiEntries.filter((e) => e.rxcui !== null) as Array<{
    name: string;
    rxcui: string;
  }>;
  const withoutRxcui = rxcuiEntries.filter((e) => e.rxcui === null).map((e) => e.name);

  const results: MedicationInteractionResult[] = [];

  // Batch RxNorm interaction check for all recognised drugs
  if (withRxcui.length >= 2) {
    const rxNormResults = await fetchRxNormInteractions(withRxcui.map((e) => e.rxcui));
    const newLower = newDrugName.toLowerCase().trim();
    const rxInvolvingNew = rxNormResults.filter(
      (r) =>
        r.medicationName1.toLowerCase().trim() === newLower ||
        r.medicationName2.toLowerCase().trim() === newLower,
    );
    results.push(...rxInvolvingNew);

    const newDrugInRxNorm = withRxcui.some((e) => e.name.toLowerCase().trim() === newLower);
    if (newDrugInRxNorm) {
      const aiForUnrecognised = await Promise.all(
        withoutRxcui
          .filter((name) => name.toLowerCase().trim() !== newLower)
          .map((name) => {
            const med = existingMedications.find(
              (m) => m.name.toLowerCase().trim() === name.toLowerCase().trim(),
            );
            if (!med) return Promise.resolve(null);
            return checkInteractionViaAI(newDrugName, med.id, med.name, familyId);
          }),
      );
      results.push(...aiForUnrecognised.filter((r): r is MedicationInteractionResult => r !== null));

      // RxNorm interaction data is often unavailable (discontinued API). If it returned nothing
      // involving the new drug, AI-screen against existing meds that RxNorm did resolve.
      if (rxInvolvingNew.length === 0) {
        const existingInRxNorm = existingMedications.filter((m) =>
          withRxcui.some((e) => e.name.toLowerCase().trim() === m.name.toLowerCase().trim()),
        );
        const aiFallback = await Promise.all(
          existingInRxNorm.map((m) => checkInteractionViaAI(newDrugName, m.id, m.name, familyId)),
        );
        results.push(...aiFallback.filter((r): r is MedicationInteractionResult => r !== null));
      }

      return deduplicateInteractions(results);
    }
  }

  // New drug not in RxNorm (or no drugs recognised) — use AI for all pairs
  const aiChecks = existingMedications.map((m) =>
    checkInteractionViaAI(newDrugName, m.id, m.name, familyId),
  );
  const aiResults = await Promise.all(aiChecks);
  results.push(...aiResults.filter((r): r is MedicationInteractionResult => r !== null));

  return deduplicateInteractions(results);
}

/**
 * Check all pairwise interactions for a family's medication list.
 * Uses a single batched RxNorm call for efficiency; AI fallback for unknown drugs.
 * Caps at 15 medications to stay within reasonable API limits.
 * Uses RxNorm when available; otherwise one batched AI screen via llm-gateway.
 */
export async function checkFamilyInteractions(
  medications: Array<{ name: string; family_id?: string }>,
): Promise<MedicationInteractionResult[]> {
  const capped = medications.slice(0, 15);
  if (capped.length < 2) return [];

  const familyId = capped.map((m) => m.family_id?.trim()).find((id) => id && id.length > 0) ?? '';

  const rxcuiEntries = await Promise.all(
    capped.map(async (m) => ({ name: m.name, rxcui: await lookupRxCui(m.name) })),
  );

  const withRxcui = rxcuiEntries.filter((e) => e.rxcui !== null) as Array<{
    name: string;
    rxcui: string;
  }>;

  const results: MedicationInteractionResult[] = [];

  if (withRxcui.length >= 2) {
    const rxNormResults = await fetchRxNormInteractions(withRxcui.map((e) => e.rxcui));
    results.push(...rxNormResults);
  }

  if (results.length === 0 && familyId) {
    const aiRows = await fetchFamilyInteractionsBatchAI(familyId);
    results.push(...aiRows);
  }

  return deduplicateInteractions(results);
}

function deduplicateInteractions(
  interactions: MedicationInteractionResult[],
): MedicationInteractionResult[] {
  const seen = new Set<string>();
  return interactions.filter((r) => {
    const key = [r.medicationName1, r.medicationName2].sort().join('||');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
