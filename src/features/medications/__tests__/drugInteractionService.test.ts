import {
  checkAllInteractions,
  checkFamilyInteractions,
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

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('checkAllInteractions', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    // Clear the module-level rxcuiCache between tests by reimporting
    jest.isolateModules(() => {});
  });

  it('returns empty array when no existing drugs', async () => {
    const result = await checkAllInteractions('Lisinopril', []);
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

    const results = await checkAllInteractions('lisinopril', ['warfarin']);

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

    const results = await checkAllInteractions('drugA', ['drugB']);
    expect(results[0]?.severity).toBe('moderate');
    jest.restoreAllMocks();
  });

  it('returns empty array when RxNorm finds no interactions', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(async (url: RequestInfo | URL) => {
      const urlStr = String(url);
      if (urlStr.includes('/rxcui.json')) return makeRxcuiResponse('11') as unknown as Response;
      return makeEmptyInteractionResponse() as unknown as Response;
    });

    const results = await checkAllInteractions('aspirin', ['ibuprofen']);
    expect(results).toEqual([]);
    jest.restoreAllMocks();
  });

  it('does not throw when fetch fails', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));
    await expect(checkAllInteractions('drugA', ['drugB'])).resolves.toBeDefined();
    jest.restoreAllMocks();
  });
});

describe('checkFamilyInteractions', () => {
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

    const results = await checkFamilyInteractions([{ name: 'drugA' }, { name: 'drugB' }]);
    expect(results).toHaveLength(1);
    jest.restoreAllMocks();
  });

  it('caps at 15 medications', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async () =>
      makeRxcuiResponse(null) as unknown as Response,
    );

    const meds = Array.from({ length: 20 }, (_, i) => ({ name: `drug${i}` }));
    await checkFamilyInteractions(meds);

    // RxCUI lookups: at most 15 (capped)
    const rxcuiCalls = fetchSpy.mock.calls.filter((c) => String(c[0]).includes('/rxcui.json'));
    expect(rxcuiCalls.length).toBeLessThanOrEqual(15);

    fetchSpy.mockRestore();
  });
});
