import { create } from 'zustand';

/** UI for family postgres realtime; distinct from NetInfo. */
export type FamilyRealtimeUiState = 'inactive' | 'subscribed' | 'syncPaused';

interface SyncConnectivityState {
  familyRealtimeUi: FamilyRealtimeUiState;
  setFamilyRealtimeUi: (familyRealtimeUi: FamilyRealtimeUiState) => void;
}

export const useSyncConnectivityStore = create<SyncConnectivityState>((set) => ({
  familyRealtimeUi: 'inactive',
  setFamilyRealtimeUi: (familyRealtimeUi) => set({ familyRealtimeUi }),
}));
