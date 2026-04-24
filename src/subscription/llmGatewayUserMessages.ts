import type { ParsedLlmGatewayError } from './llmGatewayErrors';
import { TIER_DISPLAY_NAME } from './featureTierConfig';
export function userMessageFromLlmGatewayError(parsed: ParsedLlmGatewayError): string {
  switch (parsed.kind) {
    case 'subscription_required': {
      const tier = parsed.requiredTier === 'care_team' ? 'care_team' : 'family';
      const name = TIER_DISPLAY_NAME[tier];
      return `This feature needs a ${name} plan. Upgrade to unlock AI and other premium tools.`;
    }
    case 'rate_limited':
      return parsed.resetAt
        ? `${parsed.message} You can try again after ${new Date(parsed.resetAt).toLocaleString()}.`
        : `${parsed.message} Please wait a bit and try again.`;
    case 'forbidden_member':
      return 'You must be a member of this family to use this feature.';
    case 'unauthorized': {
      if (parsed.rawCode === 'missing_authorization') {
        return 'Sign in to continue.';
      }
      if (parsed.rawCode === 'session_not_verified') {
        return 'We could not verify your sign-in with the server. Try signing out and back in. If this keeps happening, contact support.';
      }
      return 'We could not verify your sign-in. Try signing out and back in. If the problem continues, contact support.';
    }
    case 'bad_request':
      return parsed.message;
    case 'server':
      return 'Our servers had a problem. Please try again in a few minutes.';
    case 'network':
      return parsed.message || 'Check your connection and try again.';
    default:
      return parsed.message;
  }
}
