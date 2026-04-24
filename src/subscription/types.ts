/** Matches Postgres / `get_my_effective_tier` text return. */
export type EffectiveTier = 'free' | 'family' | 'care_team';

export function parseEffectiveTier(raw: unknown): EffectiveTier {
  if (raw === 'care_team' || raw === 'family' || raw === 'free') return raw;
  return 'free';
}

export const TIER_RANK: Record<EffectiveTier, number> = {
  free: 0,
  family: 1,
  care_team: 2,
};

export function tierMeetsMinimum(tier: EffectiveTier, minimum: EffectiveTier): boolean {
  return TIER_RANK[tier] >= TIER_RANK[minimum];
}
