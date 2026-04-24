import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';

/** Aligns with TanStack defaults; banner hook uses the same NetInfo source with extra rules. */
export function computeReactQueryOnline(state: NetInfoState): boolean {
  if (state.isConnected !== true) return false;
  if (state.isInternetReachable == null) return true;
  return state.isInternetReachable === true;
}

/**
 * Bridges React Native connectivity to TanStack Query so queries pause sensibly and
 * reconnect refetches run when the device comes back online.
 */
export function initReactQueryNetworkSync(): void {
  onlineManager.setEventListener((setOnline) => {
    return NetInfo.addEventListener((state) => {
      setOnline(computeReactQueryOnline(state));
    });
  });

  void NetInfo.fetch().then((state) => {
    onlineManager.setOnline(computeReactQueryOnline(state));
  });
}
