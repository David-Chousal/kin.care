import { create } from 'zustand';
import { Family } from '../types';

interface FamilyState {
  family: Family | null;
  setFamily: (family: Family | null) => void;
}

export const useFamilyStore = create<FamilyState>((set) => ({
  family: null,
  setFamily: (family) => set({ family }),
}));
