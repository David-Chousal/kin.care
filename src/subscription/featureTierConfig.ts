import type { EffectiveTier } from './types';
import { tierMeetsMinimum } from './types';

/**
 * Single source of truth for product ↔ tier (client UX; server still enforces AI, etc.).
 * Keep in sync with docs/SUBSCRIPTION_EFFECTIVE_TIER.md and marketing tables.
 */
export type FeatureId =
  | 'ai_visit_prep'
  | 'ai_drug_interactions'
  | 'document_vault'
  | 'unlimited_family_members'
  | 'clinical_data_export';

export type FeatureTierRule = {
  /** Minimum tier that unlocks this capability */
  minTier: EffectiveTier;
  /** Short label for paywalls */
  title: string;
  /** One line why it matters */
  benefit: string;
};

export const FEATURE_TIER: Record<FeatureId, FeatureTierRule> = {
  ai_visit_prep: {
    minTier: 'family',
    title: 'AI visit prep',
    benefit: 'Generate appointment summaries with AI (Family or Care Team).',
  },
  ai_drug_interactions: {
    minTier: 'family',
    title: 'AI drug interaction check',
    benefit: 'When RxNorm does not recognize a drug, AI checks interactions for your family meds.',
  },
  document_vault: {
    minTier: 'family',
    title: 'Document vault',
    benefit: 'Store and organize medical, legal, and insurance documents for your family.',
  },
  unlimited_family_members: {
    minTier: 'family',
    title: 'More than 3 family members',
    benefit: 'Invite everyone who helps with care — unlimited seats on Family or Care Team.',
  },
  clinical_data_export: {
    minTier: 'care_team',
    title: 'Clinical / EHR-style export',
    benefit: 'Export combined family health data for clinicians and pro caregivers (Care Team).',
  },
};

export function featureUnlocked(tier: EffectiveTier, featureId: FeatureId): boolean {
  return tierMeetsMinimum(tier, FEATURE_TIER[featureId].minTier);
}

export function requiredTierForFeature(featureId: FeatureId): EffectiveTier {
  return FEATURE_TIER[featureId].minTier;
}

/** Core tier (internal `free`): up to `FREE_PLAN_MEMBER_LIMIT` members; Family+ unlimited. */
export function canInviteMoreMembers(memberCount: number, tier: EffectiveTier): boolean {
  if (tierMeetsMinimum(tier, 'family')) return true;
  return memberCount < FREE_PLAN_MEMBER_LIMIT;
}

/**
 * Customer-facing tier names.
 *
 * IMPORTANT: internal identifier `free` remains stable for DB/API/entitlements; it is displayed as “Core”.
 */
export const TIER_DISPLAY_NAME: Record<EffectiveTier, string> = {
  free: 'Core',
  family: 'Family',
  care_team: 'Care Team',
};

/** Core plan member cap (internal `free`; caregivers + care recipient seats — product definition). */
export const FREE_PLAN_MEMBER_LIMIT = 3;
