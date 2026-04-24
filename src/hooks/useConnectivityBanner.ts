import { useEffect, useMemo, useState } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { useSyncConnectivityStore } from '../store/syncConnectivity';

export type ConnectivityBannerKind = 'none' | 'offline' | 'unstable' | 'syncPaused';

function netKindFromState(state: NetInfoState): ConnectivityBannerKind {
  if (state.type === 'unknown') return 'none';
  if (state.isConnected !== true) return 'offline';
  if (state.isInternetReachable === false) return 'unstable';
  return 'none';
}

/**
 * NetInfo drives offline / unstable. Supabase family realtime status adds “sync paused”
 * when the device looks online but the live channel is down (common on hospital Wi‑Fi).
 */
export function useConnectivityBanner(): ConnectivityBannerKind {
  const [netKind, setNetKind] = useState<ConnectivityBannerKind>('none');
  const familyRealtimeUi = useSyncConnectivityStore((s) => s.familyRealtimeUi);

  useEffect(() => {
    let cancelled = false;
    void NetInfo.fetch().then((state) => {
      if (!cancelled) setNetKind(netKindFromState(state));
    });
    const unsub = NetInfo.addEventListener((state) => {
      setNetKind(netKindFromState(state));
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return useMemo(() => {
    if (netKind !== 'none') return netKind;
    if (familyRealtimeUi === 'syncPaused') return 'syncPaused';
    return 'none';
  }, [netKind, familyRealtimeUi]);
}
