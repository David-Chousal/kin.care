import { Platform } from 'react-native';
import { PURCHASES_ERROR_CODE } from 'react-native-purchases';

export type RcUiMessage = { title: string; body: string; isDevDetail?: boolean };

type RcShape = { code?: string; message?: string };

function rcShape(e: unknown): RcShape | null {
  if (typeof e !== 'object' || e === null) return null;
  const o = e as Record<string, unknown>;
  const code = o.code != null ? String(o.code) : undefined;
  const message = typeof o.message === 'string' ? o.message : undefined;
  if (!code) return null;
  return { code, message };
}

/**
 * Maps RevenueCat / StoreKit failures to user-facing copy.
 * In `__DEV__`, includes a short technical hint when safe.
 */
export function messageFromRevenueCatError(e: unknown): RcUiMessage {
  const rc = rcShape(e);
  if (!rc?.code) {
    return {
      title: 'Something went wrong',
      body: __DEV__ && e instanceof Error ? e.message : 'Please try again.',
      isDevDetail: __DEV__,
    };
  }

  const code = rc.code;
  const raw = rc.message ?? '';

  if (code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
    return { title: 'Purchase cancelled', body: 'No charge was made.' };
  }

  if (
    code === PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR ||
    code === PURCHASES_ERROR_CODE.NETWORK_ERROR
  ) {
    return {
      title: 'Subscriptions temporarily unavailable',
      body:
        Platform.OS === 'web'
          ? 'Subscribe from the Kin iOS or Android app.'
          : 'Check your internet connection and try again. If this keeps happening, try again later.',
      isDevDetail: __DEV__,
    };
  }

  if (code === PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR) {
    return {
      title: 'Not available',
      body: 'This plan is not available for purchase right now. Try again later or pick another plan.',
      isDevDetail: __DEV__,
    };
  }

  if (__DEV__) {
    return {
      title: 'RevenueCat / Store',
      body: `${raw}\n(Error code: ${String(code)})`,
      isDevDetail: true,
    };
  }

  return {
    title: 'Subscriptions temporarily unavailable',
    body: 'We could not reach the App Store. Please try again in a few minutes.',
  };
}
