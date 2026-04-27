import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'calibra_radar_snapshots';

export interface SnapshotNode {
  nodeId: string;
  nodeName: string;
  color: string;
  avg: number;
}

export interface RadarSnapshot {
  id: string;
  createdAt: string; // ISO date
  triggerNodeId: string;
  triggerNodeName: string;
  triggerNodeAvg: number;
  nodeScores: SnapshotNode[];
}

interface SnapshotState {
  snapshots: RadarSnapshot[];
  loaded: boolean;
  loadSnapshots: () => Promise<void>;
  addSnapshot: (snapshot: RadarSnapshot) => Promise<void>;
  clearSnapshots: () => Promise<void>;
}

export const useSnapshotStore = create<SnapshotState>((set, get) => ({
  snapshots: [],
  loaded: false,

  loadSnapshots: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const snapshots: RadarSnapshot[] = raw ? JSON.parse(raw) : [];
      set({ snapshots, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  addSnapshot: async (snapshot) => {
    const next = [snapshot, ...get().snapshots].slice(0, 50); // keep last 50
    set({ snapshots: next });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  },

  clearSnapshots: async () => {
    set({ snapshots: [] });
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {}
  },
}));
