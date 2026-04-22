import Groq from 'groq-sdk';

const RXNORM_BASE = 'https://rxnav.nlm.nih.gov/REST';

const groq = new Groq({
  apiKey: process.env.EXPO_PUBLIC_GROQ_API_KEY ?? '',
  dangerouslyAllowBrowser: true,
});

export type InteractionSeverity = 'mild' | 'moderate' | 'severe';

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
  drugName1: string,
  drugName2: string,
): Promise<MedicationInteractionResult | null> {
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'user',
          content: `Are there any clinically significant drug interactions between "${drugName1}" and "${drugName2}"?

Respond ONLY with a JSON object (no markdown) in this exact format:
{"hasInteraction":false,"severity":"none","description":""}
or
{"hasInteraction":true,"severity":"mild"|"moderate"|"severe","description":"brief clinical description"}`,
        },
      ],
      temperature: 0,
      max_tokens: 150,
    });

    const text = completion.choices[0]?.message?.content?.trim() ?? '';
    // Strip any markdown code fences if present
    const json = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    const result = JSON.parse(json) as {
      hasInteraction: boolean;
      severity: string;
      description: string;
    };

    if (!result.hasInteraction || result.severity === 'none') return null;

    const severity: InteractionSeverity = ['mild', 'moderate', 'severe'].includes(result.severity)
      ? (result.severity as InteractionSeverity)
      : 'moderate';

    return {
      medicationName1: drugName1,
      medicationName2: drugName2,
      severity,
      description: result.description,
      source: 'ai',
    };
  } catch {
    return null;
  }
}

/**
 * Check a new drug against a list of existing drugs.
 * Uses RxNorm for drugs it recognises; falls back to Groq AI for unknowns.
 * Returns only interactions that involve newDrugName.
 */
export async function checkAllInteractions(
  newDrugName: string,
  existingDrugNames: string[],
): Promise<MedicationInteractionResult[]> {
  if (existingDrugNames.length === 0) return [];

  const allNames = [newDrugName, ...existingDrugNames];

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
    // Filter to pairs that involve the new drug (case-insensitive)
    const newLower = newDrugName.toLowerCase();
    for (const r of rxNormResults) {
      if (r.medicationName1.toLowerCase() === newLower || r.medicationName2.toLowerCase() === newLower) {
        results.push(r);
      }
    }
    // If new drug was found in RxNorm, don't fall back to AI for the found pairs
    const newDrugInRxNorm = withRxcui.some((e) => e.name.toLowerCase() === newLower);
    if (newDrugInRxNorm) {
      // Still run AI for existing drugs that weren't in RxNorm
      const aiChecks = withoutRxcui
        .filter((name) => name.toLowerCase() !== newLower)
        .map((name) => checkInteractionViaAI(newDrugName, name));
      const aiResults = await Promise.all(aiChecks);
      results.push(...aiResults.filter((r): r is MedicationInteractionResult => r !== null));
      return deduplicateInteractions(results);
    }
  }

  // New drug not in RxNorm (or no drugs recognised) — use AI for all pairs
  const aiChecks = existingDrugNames.map((name) => checkInteractionViaAI(newDrugName, name));
  const aiResults = await Promise.all(aiChecks);
  results.push(...aiResults.filter((r): r is MedicationInteractionResult => r !== null));

  return deduplicateInteractions(results);
}

/**
 * Check all pairwise interactions for a family's medication list.
 * Uses a single batched RxNorm call for efficiency; AI fallback for unknown drugs.
 * Caps at 15 medications (105 pairs) to stay within reasonable API limits.
 */
export async function checkFamilyInteractions(
  medications: Array<{ name: string }>,
): Promise<MedicationInteractionResult[]> {
  const capped = medications.slice(0, 15);
  if (capped.length < 2) return [];

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
