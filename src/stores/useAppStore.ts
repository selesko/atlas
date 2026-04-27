import { create } from 'zustand';
import { Session } from '@supabase/supabase-js';
import { Node, Goal, Task, CognitiveModel, PeakPeriod } from '../types';
import { INITIAL_DATA } from '../constants/data';
import { todayISO } from '../constants/data';
import {
  fetchUserData,
  pushLocalData,
  upsertNode,
  upsertCoordinate,
  upsertTask,
  upsertProfile,
  deleteTask as syncDeleteTask,
} from '../services/sync';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AppState {
  // Domain state
  nodes: Node[];
  cognitiveModel: CognitiveModel;
  peakPeriod: PeakPeriod;
  motivators: string[];
  identityNotes: string;

  // Auth state
  // hasAccess is true when: real Supabase session exists OR dev override is on
  session: Session | null;
  devOverride: boolean;
  hasAccess: boolean; // derived: session !== null || devOverride

  setSession: (session: Session | null) => void;
  setDevOverride: (value: boolean) => void;

  // Persistence
  loadUserData: () => Promise<void>;

  // Onboarding
  hasCompletedOnboarding: boolean;
  setHasCompletedOnboarding: (value: boolean) => void;

  // Node actions
  updateValue: (nodeId: string, goalId: string, val: number) => void;
  updateGoal: (nodeId: string, goalId: string, patch: Partial<Pick<Goal, 'name' | 'evidence'>>) => void;
  addCoordinate: (nodeId: string) => void;
  addNode: (name: string, description: string, color: string) => void;
  updateNode: (nodeId: string, patch: Partial<Pick<Node, 'name' | 'description' | 'color'>>) => void;

  // Task actions
  toggleTask: (nodeId: string, goalId: string, taskId: string) => void;
  togglePriority: (nodeId: string, goalId: string, taskId: string) => void;
  addTask: (nodeId: string, goalId: string, title: string) => void;
  saveTaskEdit: (
    from: { nodeId: string; goalId: string; taskId: string },
    form: { title: string; nodeId: string; goalId: string; isPriority: boolean; notes: string; dueDate: string; reminder: string }
  ) => void;

  // Profile actions
  setCognitiveModel: (model: CognitiveModel) => void;
  setPeakPeriod: (period: PeakPeriod) => void;
  setMotivators: (motivators: string[]) => void;
  setIdentityNotes: (notes: string) => void;
  /** @deprecated use setDevOverride — kept for backwards compat during transition */
  setHasAccess: (value: boolean) => void;

  // Helpers
  getNodeAvg: (node: Node) => string;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>((set, get) => ({
  nodes: INITIAL_DATA,
  cognitiveModel: 'Architect',
  peakPeriod: 'MORNING',
  motivators: [],
  identityNotes: '',
  session: null,
  devOverride: false,
  hasAccess: false,
  hasCompletedOnboarding: false,

  setHasCompletedOnboarding: (value) => set({ hasCompletedOnboarding: value }),

  // ─── Auth ───────────────────────────────────────────────────────────────────

  setSession: (session) => set({ session, hasAccess: session !== null || get().devOverride }),
  setDevOverride: (value) => set({ devOverride: value, hasAccess: get().session !== null || value }),

  // ─── Persistence ────────────────────────────────────────────────────────────

  loadUserData: async () => {
    const { session, nodes: localNodes, cognitiveModel, peakPeriod, motivators, identityNotes } = get();
    const userId = session?.user.id;
    if (!userId) return;

    const { profile, nodes: remoteNodes } = await fetchUserData(userId);

    if (remoteNodes.length === 0 && !profile) {
      // New user — push local state up to Supabase
      await pushLocalData(userId, localNodes, { cognitiveModel, peakPeriod, motivators, identityNotes });
      return;
    }

    // Existing user — hydrate store with remote data
    set({
      nodes: remoteNodes.length > 0 ? remoteNodes : localNodes,
      ...(profile ? {
        cognitiveModel: profile.cognitiveModel,
        peakPeriod: profile.peakPeriod,
        motivators: profile.motivators,
        identityNotes: profile.identityNotes,
      } : {}),
    });
  },

  // ─── Helpers ────────────────────────────────────────────────────────────────

  getNodeAvg: (node: Node) =>
    (node.goals.reduce((acc, g) => acc + g.value, 0) / (node.goals.length || 1)).toFixed(1),

  // ─── Node actions ───────────────────────────────────────────────────────────

  updateValue: (nodeId, goalId, val) => {
    const today = todayISO();
    set(state => ({
      nodes: state.nodes.map(n => {
        if (n.id !== nodeId) return n;
        return {
          ...n,
          goals: n.goals.map(g => {
            if (g.id !== goalId) return g;
            const hist = g.scoreHistory || [];
            const withoutToday = hist.filter(e => e.date !== today);
            const scoreHistory = [...withoutToday, { date: today, value: val }]
              .sort((a, b) => a.date.localeCompare(b.date))
              .slice(-14);
            return { ...g, value: val, scoreHistory };
          }),
        };
      }),
    }));
    // Fire-and-forget sync
    const userId = get().session?.user.id;
    if (userId) {
      const node = get().nodes.find(n => n.id === nodeId);
      const goal = node?.goals.find(g => g.id === goalId);
      const sortIdx = node?.goals.findIndex(g => g.id === goalId) ?? 0;
      if (goal) upsertCoordinate(userId, nodeId, goal, sortIdx);
    }
  },

  updateGoal: (nodeId, goalId, patch) => {
    set(state => ({
      nodes: state.nodes.map(n =>
        n.id !== nodeId ? n : {
          ...n,
          goals: n.goals.map(g => g.id !== goalId ? g : { ...g, ...patch }),
        }
      ),
    }));
    const userId = get().session?.user.id;
    if (userId) {
      const node = get().nodes.find(n => n.id === nodeId);
      const goal = node?.goals.find(g => g.id === goalId);
      const sortIdx = node?.goals.findIndex(g => g.id === goalId) ?? 0;
      if (goal) upsertCoordinate(userId, nodeId, goal, sortIdx);
    }
  },

  addCoordinate: (nodeId) => {
    set(state => ({
      nodes: state.nodes.map(n => {
        if (n.id !== nodeId) return n;
        const prefix = n.id[0];
        const maxNum = n.goals.reduce((acc, g) => {
          const m = g.id.match(/\d+$/);
          return m ? Math.max(acc, parseInt(m[0], 10)) : acc;
        }, 0);
        const newId = `${prefix}${maxNum + 1}`;
        return {
          ...n,
          goals: [...n.goals, { id: newId, name: 'New Coordinate', value: 5, evidence: '', tasks: [] }],
        };
      }),
    }));
    const userId = get().session?.user.id;
    if (userId) {
      const node = get().nodes.find(n => n.id === nodeId);
      if (node) {
        const newGoal = node.goals[node.goals.length - 1];
        upsertCoordinate(userId, nodeId, newGoal, node.goals.length - 1);
      }
    }
  },

  addNode: (name, description, color) => {
    const nodeId = 'n' + Date.now();
    const newNode: Node = {
      id: nodeId,
      name,
      color,
      description: description.trim() || '',
      goals: [
        { id: nodeId + '-1', name: 'Coordinate 1', value: 5, evidence: '', tasks: [] },
        { id: nodeId + '-2', name: 'Coordinate 2', value: 5, evidence: '', tasks: [] },
      ],
    };
    set(state => ({ nodes: [...state.nodes, newNode] }));
    const userId = get().session?.user.id;
    if (userId) {
      const sortIdx = get().nodes.length - 1;
      upsertNode(userId, newNode, sortIdx);
      newNode.goals.forEach((g, gi) => upsertCoordinate(userId, nodeId, g, gi));
    }
  },

  updateNode: (nodeId, patch) => {
    set(state => ({
      nodes: state.nodes.map(n => n.id !== nodeId ? n : { ...n, ...patch }),
    }));
    const userId = get().session?.user.id;
    if (userId) {
      const node = get().nodes.find(n => n.id === nodeId);
      const sortIdx = get().nodes.findIndex(n => n.id === nodeId);
      if (node) upsertNode(userId, node, sortIdx);
    }
  },

  // ─── Task actions ───────────────────────────────────────────────────────────

  toggleTask: (nodeId, goalId, taskId) => {
    set(state => ({
      nodes: state.nodes.map(n => {
        if (n.id !== nodeId) return n;
        return {
          ...n,
          goals: n.goals.map(g => {
            if (g.id !== goalId) return g;
            return {
              ...g,
              tasks: g.tasks.map(t =>
                t.id !== taskId ? t : {
                  ...t,
                  completed: !t.completed,
                  ...(t.completed ? {} : { completedAt: todayISO() }),
                }
              ),
            };
          }),
        };
      }),
    }));
    const userId = get().session?.user.id;
    if (userId) {
      const goal = get().nodes.find(n => n.id === nodeId)?.goals.find(g => g.id === goalId);
      const task = goal?.tasks.find(t => t.id === taskId);
      if (task) upsertTask(userId, nodeId, goalId, task);
    }
  },

  togglePriority: (nodeId, goalId, taskId) => {
    set(state => ({
      nodes: state.nodes.map(n =>
        n.id !== nodeId ? n : {
          ...n,
          goals: n.goals.map(g =>
            g.id !== goalId ? g : {
              ...g,
              tasks: g.tasks.map(t =>
                t.id !== taskId ? t : { ...t, isPriority: !t.isPriority }
              ),
            }
          ),
        }
      ),
    }));
    const userId = get().session?.user.id;
    if (userId) {
      const goal = get().nodes.find(n => n.id === nodeId)?.goals.find(g => g.id === goalId);
      const task = goal?.tasks.find(t => t.id === taskId);
      if (task) upsertTask(userId, nodeId, goalId, task);
    }
  },

  addTask: (nodeId, goalId, title) => {
    const t = title.trim();
    if (!t) return;
    const newTask: Task = {
      id: 't' + Date.now(),
      title: t,
      completed: false,
      isPriority: false,
      timestamp: '',
      notes: '',
      dueDate: '',
      reminder: '',
      createdAt: todayISO(),
    };
    set(state => ({
      nodes: state.nodes.map(n =>
        n.id !== nodeId ? n : {
          ...n,
          goals: n.goals.map(g =>
            g.id !== goalId ? g : { ...g, tasks: [...g.tasks, newTask] }
          ),
        }
      ),
    }));
    const userId = get().session?.user.id;
    if (userId) upsertTask(userId, nodeId, goalId, newTask);
  },

  saveTaskEdit: (from, form) => {
    const { nodes } = get();
    const node = nodes.find(n => n.id === from.nodeId);
    const goal = node?.goals.find(g => g.id === from.goalId);
    const task = goal?.tasks.find(t => t.id === from.taskId);
    if (!task) return;

    const updated: Task = {
      ...task,
      title: form.title,
      isPriority: form.isPriority,
      notes: form.notes || '',
      dueDate: form.dueDate || '',
      reminder: form.reminder || '',
    };

    if (from.nodeId === form.nodeId && from.goalId === form.goalId) {
      set(state => ({
        nodes: state.nodes.map(n =>
          n.id !== from.nodeId ? n : {
            ...n,
            goals: n.goals.map(g =>
              g.id !== from.goalId ? g : {
                ...g,
                tasks: g.tasks.map(t => t.id !== from.taskId ? t : updated),
              }
            ),
          }
        ),
      }));
    } else {
      set(state => {
        const removed = state.nodes.map(n =>
          n.id !== from.nodeId ? n : {
            ...n,
            goals: n.goals.map(g =>
              g.id !== from.goalId ? g : {
                ...g,
                tasks: g.tasks.filter(t => t.id !== from.taskId),
              }
            ),
          }
        );
        return {
          nodes: removed.map(n =>
            n.id !== form.nodeId ? n : {
              ...n,
              goals: n.goals.map(g =>
                g.id !== form.goalId ? g : { ...g, tasks: [...g.tasks, updated] }
              ),
            }
          ),
        };
      });
    }

    // Upsert with the new nodeId/goalId (PK is id+user_id, so this cleanly updates location too)
    const userId = get().session?.user.id;
    if (userId) upsertTask(userId, form.nodeId, form.goalId, updated);
  },

  // ─── Profile actions ────────────────────────────────────────────────────────

  setCognitiveModel: (model) => {
    set({ cognitiveModel: model });
    const { session, peakPeriod, motivators, identityNotes } = get();
    if (session?.user.id) {
      upsertProfile(session.user.id, { cognitiveModel: model, peakPeriod, motivators, identityNotes });
    }
  },

  setPeakPeriod: (period) => {
    set({ peakPeriod: period });
    const { session, cognitiveModel, motivators, identityNotes } = get();
    if (session?.user.id) {
      upsertProfile(session.user.id, { cognitiveModel, peakPeriod: period, motivators, identityNotes });
    }
  },

  setMotivators: (motivators) => {
    set({ motivators });
    const { session, cognitiveModel, peakPeriod, identityNotes } = get();
    if (session?.user.id) {
      upsertProfile(session.user.id, { cognitiveModel, peakPeriod, motivators, identityNotes });
    }
  },

  setIdentityNotes: (notes) => {
    set({ identityNotes: notes });
    const { session, cognitiveModel, peakPeriod, motivators } = get();
    if (session?.user.id) {
      upsertProfile(session.user.id, { cognitiveModel, peakPeriod, motivators, identityNotes: notes });
    }
  },

  // backwards compat shim — delegates to devOverride
  setHasAccess: (value) => {
    set({ devOverride: value, hasAccess: get().session !== null || value });
  },
}));
