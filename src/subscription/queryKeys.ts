export const subscriptionQueryKeys = {
  effectiveTier: (userId: string | undefined) => ['subscription', 'effectiveTier', userId] as const,
};
