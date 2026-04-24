import { TIER_DISPLAY_NAME } from '../featureTierConfig';

describe('TIER_DISPLAY_NAME', () => {
  it('maps internal free tier to customer-facing Core', () => {
    expect(TIER_DISPLAY_NAME.free).toBe('Core');
    expect(TIER_DISPLAY_NAME.family).toBe('Family');
    expect(TIER_DISPLAY_NAME.care_team).toBe('Care Team');
  });
});
