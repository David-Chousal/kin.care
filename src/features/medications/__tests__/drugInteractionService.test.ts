jest.mock('../../../lib/supabase', () => ({
  SUPABASE_URL: 'https://test.supabase.co',
  getSupabaseAccessToken: jest.fn(() => Promise.resolve('test-access-token')),
}));

// eslint-disable-next-line import/first
import { getSupabaseAccessToken } from '../../../lib/supabase';
import {
  checkAllInteractions,
  checkFamilyInteractions,
  worstSeverityByInteractionDrugName,
  type MedicationInteractionResult,
} from '../services/drugInteractionService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRxcuiResponse(rxcui: string | null) {
  return {
    ok: true,
    json: async () => ({
      idGroup: rxcui ? { rxnormId: [rxcui] } : {},
    }),
  };
}

function makeInteractionResponse(pairs: Array<{ name1: string; name2: string; severity: string; description: string }>) {
  return {
    ok: true,
    json: async () => ({
      fullInteractionTypeGroup: [
        {
          fullInteractionType: [
            {
              interactionPair: pairs.map((p) => ({
                interactionConcept: [
                  { minConceptItem: { name: p.name1 } },
                  { minConceptItem: { name: p.name2 } },
                ],
                severity: p.severity,
                description: p.description,
              })),
            },
          ],
        },
      ],
    }),
  };
}

function makeEmptyInteractionResponse() {
  return {
    ok: true,
    json: async () => ({}),
  };
}

const TEST_FAMILY_ID = '00000000-0000-0000-0000-000000000001';
const TEST_MED_ID = '00000000-0000-4000-8000-000000000002';

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('checkAllInteractions', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (getSupabaseAccessToken as jest.Mock).mockResolvedValue('test-access-token');
  });

  it('returns empty array when no existing drugs', async () => {
    const result = await checkAllInteractions('Lisinopril', [], TEST_FAMILY_ID);
    expect(result).toEqual([]);
  });

  it('returns RxNorm interactions when both drugs are found', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (url: RequestInfo | URL) => {
      const urlStr = String(url);
      if (urlStr.includes('/rxcui.json')) {
        return makeRxcuiResponse('12345') as unknown as Response;
      }
      if (urlStr.includes('/interaction/list.json')) {
        return makeInteractionResponse([
          {
            name1: 'lisinopril',
            name2: 'warfarin',
            severity: 'major',
            description: 'Increased bleeding risk.',
          },
        ]) as unknown as Response;
      }
      return makeEmptyInteractionResponse() as unknown as Response;
    });

    const results = await checkAllInteractions('lisinopril', [{ id: TEST_MED_ID, name: 'warfarin' }], TEST_FAMILY_ID);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject<Partial<MedicationInteractionResult>>({
      severity: 'severe',
      description: 'Increased bleeding risk.',
      source: 'rxnorm',
    });

    fetchMock.mockRestore();
  });

  it('maps "moderate" severity correctly', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(async (url: RequestInfo | URL) => {
      const urlStr = String(url);
      if (urlStr.includes('/rxcui.json')) return makeRxcuiResponse('99') as unknown as Response;
      return makeInteractionResponse([
        { name1: 'drugA', name2: 'drugB', severity: 'moderate', description: 'Moderate risk.' },
      ]) as unknown as Response;
    });

    const results = await checkAllInteractions('drugA', [{ id: TEST_MED_ID, name: 'drugB' }], TEST_FAMILY_ID);
    expect(results[0]?.severity).toBe('moderate');
    jest.restoreAllMocks();
  });

  it('falls back to AI when RxNorm returns no interaction rows but both drugs resolve', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(async (url: RequestInfo | URL) => {
      const urlStr = String(url);
      if (urlStr.includes('/rxcui.json')) return makeRxcuiResponse('11') as unknown as Response;
      if (urlStr.includes('/interaction/list.json')) {
        return makeEmptyInteractionResponse() as unknown as Response;
      }
      if (urlStr.includes('/drug-interactions') && !urlStr.includes('family')) {
        return {
          ok: true,
          json: async () => ({
            hasInteraction: true,
            severity: 'moderate',
            description: 'GI bleeding risk when combined.',
          }),
        } as unknown as Response;
      }
      return makeEmptyInteractionResponse() as unknown as Response;
    });

    const results = await checkAllInteractions('aspirin', [{ id: TEST_MED_ID, name: 'ibuprofen' }], TEST_FAMILY_ID);
    expect(results).toHaveLength(1);
    expect(results[0]?.source).toBe('ai');
    expect(results[0]?.severity).toBe('moderate');
    jest.restoreAllMocks();
  });

  it('does not throw when fetch fails', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));
    await expect(
      checkAllInteractions('drugA', [{ id: TEST_MED_ID, name: 'drugB' }], TEST_FAMILY_ID),
    ).resolves.toBeDefined();
    jest.restoreAllMocks();
  });
});

describe('worstSeverityByInteractionDrugName', () => {
  it('picks highest severity per drug across pairs', () => {
    const interactions: MedicationInteractionResult[] = [
      {
        medicationName1: 'Aspirin',
        medicationName2: 'Warfarin',
        severity: 'severe',
        description: 'Bleeding',
        source: 'rxnorm',
      },
      {
        medicationName1: 'Aspirin',
        medicationName2: 'Ibuprofen',
        severity: 'mild',
        description: 'GI',
        source: 'rxnorm',
      },
    ];
    const map = worstSeverityByInteractionDrugName(interactions);
    expect(map.get('aspirin')).toBe('severe');
    expect(map.get('warfarin')).toBe('severe');
    expect(map.get('ibuprofen')).toBe('mild');
  });

  it('upgrades severity when a second pair is worse', () => {
    const interactions: MedicationInteractionResult[] = [
      {
        medicationName1: 'DrugA',
        medicationName2: 'DrugB',
        severity: 'mild',
        description: 'x',
        source: 'ai',
      },
      {
        medicationName1: 'DrugA',
        medicationName2: 'DrugC',
        severity: 'moderate',
        description: 'y',
        source: 'ai',
      },
    ];
    expect(worstSeverityByInteractionDrugName(interactions).get('druga')).toBe('moderate');
  });
});

describe('checkFamilyInteractions', () => {
  beforeEach(() => {
    (getSupabaseAccessToken as jest.Mock).mockResolvedValue('test-access-token');
  });

  it('returns empty array for fewer than 2 medications', async () => {
    const result = await checkFamilyInteractions([{ name: 'Aspirin' }]);
    expect(result).toEqual([]);
  });

  it('deduplicates identical interaction pairs', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(async (url: RequestInfo | URL) => {
      const urlStr = String(url);
      if (urlStr.includes('/rxcui.json')) return makeRxcuiResponse('1') as unknown as Response;
      return makeInteractionResponse([
        { name1: 'drugA', name2: 'drugB', severity: 'minor', description: 'Dup 1' },
        { name1: 'drugA', name2: 'drugB', severity: 'minor', description: 'Dup 2' },
      ]) as unknown as Response;
    });

    const results = await checkFamilyInteractions([
      { name: 'drugA', family_id: TEST_FAMILY_ID },
      { name: 'drugB', family_id: TEST_FAMILY_ID },
    ]);
    expect(results).toHaveLength(1);
    jest.restoreAllMocks();
  });

  it('calls batched AI when RxNorm returns no pairs and family_id is present', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(async (url: RequestInfo | URL) => {
      const urlStr = String(url);
      if (urlStr.includes('/rxcui.json')) return makeRxcuiResponse('99') as unknown as Response;
      if (urlStr.includes('/interaction/list.json')) {
        return makeEmptyInteractionResponse() as unknown as Response;
      }
      if (urlStr.includes('drug-interactions-family')) {
        return {
          ok: true,
          json: async () => ({
            interactions: [
              {
                medicationName1: 'xanax',
                medicationName2: 'aspirin',
                severity: 'moderate',
                description: 'Increased bleeding or sedation risk — verify with clinician.',
              },
            ],
          }),
        } as unknown as Response;
      }
      return makeEmptyInteractionResponse() as unknown as Response;
    });

    const results = await checkFamilyInteractions([
      { name: 'xanax', family_id: TEST_FAMILY_ID },
      { name: 'aspirin', family_id: TEST_FAMILY_ID },
    ]);
    expect(results).toHaveLength(1);
    expect(results[0]?.medicationName1).toBe('xanax');
    expect(results[0]?.source).toBe('ai');
    jest.restoreAllMocks();
  });

  it('caps at 15 medications', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (url: RequestInfo | URL) => {
      const urlStr = String(url);
      if (urlStr.includes('drug-interactions-family')) {
        return { ok: true, json: async () => ({ interactions: [] }) } as unknown as Response;
      }
      return makeRxcuiResponse(null) as unknown as Response;
    });

    const meds = Array.from({ length: 20 }, (_, i) => ({
      name: `drug${i}`,
      family_id: TEST_FAMILY_ID,
    }));
    await checkFamilyInteractions(meds);

    // RxCUI lookups: at most 15 (capped)
    const rxcuiCalls = fetchSpy.mock.calls.filter((c) => String(c[0]).includes('/rxcui.json'));
    const familyBatchCalls = fetchSpy.mock.calls.filter((c) => String(c[0]).includes('drug-interactions-family'));
    expect(rxcuiCalls.length).toBe(15);
    expect(familyBatchCalls.length).toBe(1);

    fetchSpy.mockRestore();
  });
});
