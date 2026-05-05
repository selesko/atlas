import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session } from '@supabase/supabase-js';
import { Node, Goal, Action, ActionEffort, CognitiveModel, PeakPeriod, Persona, MotivatorChoices } from '../types';
import { ThemeMode, THEMES } from '../constants/theme';
import { INITIAL_DATA } from '../constants/data';
import { todayISO } from '../constants/data';
import {
  fetchUserData,
  pushLocalData,
  upsertNode,
  upsertCoordinate,
  upsertAction,
  upsertProfile,
  deleteAction as syncDeleteAction,
} from '../services/sync';
import { calculatePersona } from '../utils/personaCalc';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AppState {
  // Domain state
  nodes: Node[];
  cognitiveModel: CognitiveModel;
  motivatorChoices: MotivatorChoices;
  identityNotes: string;
  persona: Persona;

  // Theme
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;

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
  updateGoal: (nodeId: string, goalId: string, patch: Partial<Pick<Goal, 'name'>>) => void;
  addCoordinate: (nodeId: string) => void;
  addNode: (name: string, description: string, color: string, why?: string) => void;
  updateNode: (nodeId: string, patch: Partial<Pick<Node, 'name' | 'description' | 'color' | 'why'>>) => void;

  // Node/Goal archive & delete
  archiveNode: (nodeId: string) => void;
  restoreNode: (nodeId: string) => void;
  deleteNode: (nodeId: string) => void;
  archiveGoal: (nodeId: string, goalId: string) => void;
  restoreGoal: (nodeId: string, goalId: string) => void;
  deleteGoal: (nodeId: string, goalId: string) => void;
  restoreAction: (nodeId: string, goalId: string, actionId: string) => void;

  // Action management
  toggleAction: (nodeId: string, goalId: string, actionId: string) => void;
  togglePriority: (nodeId: string, goalId: string, actionId: string) => void;
  addAction: (nodeId: string, goalId: string, title: string, effort?: ActionEffort) => void;
  updateActionEffort: (nodeId: string, goalId: string, actionId: string, effort: ActionEffort) => void;
  deleteAction: (nodeId: string, goalId: string, actionId: string) => void;
  archiveAction: (nodeId: string, goalId: string, actionId: string) => void;
  saveActionEdit: (
    from: { nodeId: string; goalId: string; actionId: string },
    form: { title: string; nodeId: string; goalId: string; isPriority: boolean; notes: string; dueDate: string; reminder: string; effort?: ActionEffort }
  ) => void;

  // Profile actions
  setCognitiveModel: (model: CognitiveModel) => void;
  setPersona: (persona: Persona) => void;
  setMotivatorChoices: (choices: MotivatorChoices) => void;
  setIdentityNotes: (notes: string) => void;
  /** @deprecated use setDevOverride — kept for backwards compat during transition */
  setHasAccess: (value: boolean) => void;

  // Helpers
  getNodeAvg: (node: Node) => string;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      nodes: INITIAL_DATA,
  cognitiveModel: 'Architect',
  motivatorChoices: {},
  identityNotes: '',
  persona: 'Seeker',
  themeMode: 'dark',
  setThemeMode: (mode) => set({ themeMode: mode }),
  session: null,
  devOverride: false,
  hasAccess: false,
  hasCompletedOnboarding: false,

  setHasCompletedOnboarding: (value) => {
    set({ hasCompletedOnboarding: value });
    const { session, cognitiveModel, motivatorChoices, identityNotes, persona } = get();
    if (session?.user.id) {
      upsertProfile(session.user.id, { cognitiveModel, motivatorChoices, identityNotes, persona, hasCompletedOnboarding: value });
    }
  },

  // ─── Auth ───────────────────────────────────────────────────────────────────

  setSession: (session) => set({ session, hasAccess: session !== null || get().devOverride }),
  setDevOverride: (value) => set({ devOverride: value, hasAccess: get().session !== null || value }),

  // ─── Persistence ────────────────────────────────────────────────────────────

  loadUserData: async () => {
    const { session, nodes: localNodes, cognitiveModel, motivatorChoices, identityNotes } = get();
    const userId = session?.user.id;
    if (!userId) return;

    const { profile, nodes: remoteNodes } = await fetchUserData(userId);

    if (remoteNodes.length === 0 && !profile) {
      // New user — push local state up to Supabase
      const { persona, hasCompletedOnboarding } = get();
      await pushLocalData(userId, localNodes, { cognitiveModel, motivatorChoices, identityNotes, persona, hasCompletedOnboarding });
      return;
    }

    // Existing user — hydrate store with remote data
    set({
      nodes: remoteNodes.length > 0 ? remoteNodes : localNodes,
      ...(profile ? {
        cognitiveModel: profile.cognitiveModel,
        motivatorChoices: profile.motivatorChoices,
        identityNotes: profile.identityNotes,
        persona: profile.persona,
        hasCompletedOnboarding: profile.hasCompletedOnboarding,
      } : {}),
    });
  },

  // ─── Helpers ────────────────────────────────────────────────────────────────

  getNodeAvg: (node: Node) =>
    (node.goals.reduce((acc, g) => acc + g.value, 0) / (node.goals.length || 1)).toFixed(1),

  // ─── Node actions ───────────────────────────────────────────────────────────

  updateValue: (nodeId, goalId, val) => {
    const today = todayISO();

    // Capture node avg BEFORE update for threshold detection
    const prevNode = get().nodes.find(n => n.id === nodeId);
    const prevAvg = prevNode
      ? prevNode.goals.reduce((acc, g) => acc + g.value, 0) / (prevNode.goals.length || 1)
      : 0;

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
          goals: [...n.goals, { id: newId, name: 'New Coordinate', value: 5, actions: [] }],
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
        { id: nodeId + '-1', name: 'Coordinate 1', value: 5, actions: [] },
        { id: nodeId + '-2', name: 'Coordinate 2', value: 5, actions: [] },
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

  // ─── Node/Goal archive & delete ─────────────────────────────────────────────

  archiveNode: (nodeId) => {
    set(state => ({ nodes: state.nodes.map(n => n.id !== nodeId ? n : { ...n, archived: true }) }));
    const userId = get().session?.user.id;
    if (userId) { const node = get().nodes.find(n => n.id === nodeId); const idx = get().nodes.findIndex(n => n.id === nodeId); if (node) upsertNode(userId, node, idx); }
  },

  restoreNode: (nodeId) => {
    set(state => ({ nodes: state.nodes.map(n => n.id !== nodeId ? n : { ...n, archived: false }) }));
    const userId = get().session?.user.id;
    if (userId) { const node = get().nodes.find(n => n.id === nodeId); const idx = get().nodes.findIndex(n => n.id === nodeId); if (node) upsertNode(userId, node, idx); }
  },

  deleteNode: (nodeId) => {
    set(state => ({ nodes: state.nodes.filter(n => n.id !== nodeId) }));
  },

  archiveGoal: (nodeId, goalId) => {
    set(state => ({ nodes: state.nodes.map(n => n.id !== nodeId ? n : { ...n, goals: n.goals.map(g => g.id !== goalId ? g : { ...g, archived: true }) }) }));
    const userId = get().session?.user.id;
    if (userId) { const node = get().nodes.find(n => n.id === nodeId); const goal = node?.goals.find(g => g.id === goalId); const idx = node?.goals.findIndex(g => g.id === goalId) ?? 0; if (goal) upsertCoordinate(userId, nodeId, goal, idx); }
  },

  restoreGoal: (nodeId, goalId) => {
    set(state => ({ nodes: state.nodes.map(n => n.id !== nodeId ? n : { ...n, goals: n.goals.map(g => g.id !== goalId ? g : { ...g, archived: false }) }) }));
    const userId = get().session?.user.id;
    if (userId) { const node = get().nodes.find(n => n.id === nodeId); const goal = node?.goals.find(g => g.id === goalId); const idx = node?.goals.findIndex(g => g.id === goalId) ?? 0; if (goal) upsertCoordinate(userId, nodeId, goal, idx); }
  },

  deleteGoal: (nodeId, goalId) => {
    set(state => ({ nodes: state.nodes.map(n => n.id !== nodeId ? n : { ...n, goals: n.goals.filter(g => g.id !== goalId) }) }));
  },

  restoreAction: (nodeId, goalId, actionId) => {
    set(state => ({ nodes: state.nodes.map(n => n.id !== nodeId ? n : { ...n, goals: n.goals.map(g => g.id !== goalId ? g : { ...g, actions: g.actions.map(a => a.id !== actionId ? a : { ...a, archived: false }) }) }) }));
    const userId = get().session?.user.id;
    const action = get().nodes.find(n => n.id === nodeId)?.goals.find(g => g.id === goalId)?.actions.find(a => a.id === actionId);
    if (userId && action) upsertAction(userId, nodeId, goalId, { ...action, archived: false });
  },

  // ─── Action management ──────────────────────────────────────────────────────

  toggleAction: (nodeId, goalId, actionId) => {
    set(state => ({
      nodes: state.nodes.map(n => {
        if (n.id !== nodeId) return n;
        return {
          ...n,
          goals: n.goals.map(g => {
            if (g.id !== goalId) return g;
            return {
              ...g,
              actions: g.actions.map(a =>
                a.id !== actionId ? a : {
                  ...a,
                  completed: !a.completed,
                  ...(a.completed ? {} : { completedAt: todayISO() }),
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
      const action = goal?.actions.find(a => a.id === actionId);
      if (action) upsertAction(userId, nodeId, goalId, action);
    }
  },

  togglePriority: (nodeId, goalId, actionId) => {
    set(state => ({
      nodes: state.nodes.map(n =>
        n.id !== nodeId ? n : {
          ...n,
          goals: n.goals.map(g =>
            g.id !== goalId ? g : {
              ...g,
              actions: g.actions.map(a =>
                a.id !== actionId ? a : { ...a, isPriority: !a.isPriority }
              ),
            }
          ),
        }
      ),
    }));
    const userId = get().session?.user.id;
    if (userId) {
      const goal = get().nodes.find(n => n.id === nodeId)?.goals.find(g => g.id === goalId);
      const action = goal?.actions.find(a => a.id === actionId);
      if (action) upsertAction(userId, nodeId, goalId, action);
    }
  },

  addAction: (nodeId, goalId, title, effort = 'easy') => {
    const t = title.trim();
    if (!t) return;
    const newAction: Action = {
      id: 't' + Date.now(),
      title: t,
      completed: false,
      isPriority: false,
      timestamp: '',
      notes: '',
      dueDate: '',
      reminder: '',
      createdAt: todayISO(),
      effort,
    };
    set(state => ({
      nodes: state.nodes.map(n =>
        n.id !== nodeId ? n : {
          ...n,
          goals: n.goals.map(g =>
            g.id !== goalId ? g : { ...g, actions: [...g.actions, newAction] }
          ),
        }
      ),
    }));
    const userId = get().session?.user.id;
    if (userId) upsertAction(userId, nodeId, goalId, newAction);
  },

  updateActionEffort: (nodeId, goalId, actionId, effort) => {
    set(state => ({
      nodes: state.nodes.map(n =>
        n.id !== nodeId ? n : {
          ...n,
          goals: n.goals.map(g =>
            g.id !== goalId ? g : {
              ...g,
              actions: g.actions.map(a => a.id !== actionId ? a : { ...a, effort }),
            }
          ),
        }
      ),
    }));
    const userId = get().session?.user.id;
    if (userId) {
      const action = get().nodes.find(n => n.id === nodeId)?.goals.find(g => g.id === goalId)?.actions.find(a => a.id === actionId);
      if (action) upsertAction(userId, nodeId, goalId, action);
    }
  },

  deleteAction: (nodeId, goalId, actionId) => {
    set(state => ({
      nodes: state.nodes.map(n =>
        n.id !== nodeId ? n : {
          ...n,
          goals: n.goals.map(g =>
            g.id !== goalId ? g : { ...g, actions: g.actions.filter(a => a.id !== actionId) }
          ),
        }
      ),
    }));
    const userId = get().session?.user.id;
    if (userId) syncDeleteAction(userId, actionId);
  },

  archiveAction: (nodeId, goalId, actionId) => {
    set(state => ({
      nodes: state.nodes.map(n =>
        n.id !== nodeId ? n : {
          ...n,
          goals: n.goals.map(g =>
            g.id !== goalId ? g : {
              ...g,
              actions: g.actions.map(a =>
                a.id !== actionId ? a : { ...a, archived: true }
              ),
            }
          ),
        }
      ),
    }));
    const userId = get().session?.user.id;
    const node = get().nodes.find(n => n.id === nodeId);
    const action = node?.goals.find(g => g.id === goalId)?.actions.find(a => a.id === actionId);
    if (userId && action) upsertAction(userId, nodeId, goalId, { ...action, archived: true });
  },

  saveActionEdit: (from, form) => {
    const { nodes } = get();
    const node = nodes.find(n => n.id === from.nodeId);
    const goal = node?.goals.find(g => g.id === from.goalId);
    const action = goal?.actions.find(a => a.id === from.actionId);
    if (!action) return;

    const updated: Action = {
      ...action,
      title: form.title,
      isPriority: form.isPriority,
      notes: form.notes || '',
      dueDate: form.dueDate || '',
      reminder: form.reminder || '',
      ...(form.effort ? { effort: form.effort } : {}),
    };

    if (from.nodeId === form.nodeId && from.goalId === form.goalId) {
      set(state => ({
        nodes: state.nodes.map(n =>
          n.id !== from.nodeId ? n : {
            ...n,
            goals: n.goals.map(g =>
              g.id !== from.goalId ? g : {
                ...g,
                actions: g.actions.map(a => a.id !== from.actionId ? a : updated),
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
                actions: g.actions.filter(a => a.id !== from.actionId),
              }
            ),
          }
        );
        return {
          nodes: removed.map(n =>
            n.id !== form.nodeId ? n : {
              ...n,
              goals: n.goals.map(g =>
                g.id !== form.goalId ? g : { ...g, actions: [...g.actions, updated] }
              ),
            }
          ),
        };
      });
    }

    // Upsert with the new nodeId/goalId (PK is id+user_id, so this cleanly updates location too)
    const userId = get().session?.user.id;
    if (userId) upsertAction(userId, form.nodeId, form.goalId, updated);
  },

  // ─── Profile actions ────────────────────────────────────────────────────────

  setPersona: (persona) => {
    set({ persona });
    const { session, cognitiveModel, motivatorChoices, identityNotes, hasCompletedOnboarding } = get();
    if (session?.user.id) {
      upsertProfile(session.user.id, { cognitiveModel, motivatorChoices, identityNotes, persona, hasCompletedOnboarding });
    }
  },

  setCognitiveModel: (model) => {
    set({ cognitiveModel: model });
    const { session, motivatorChoices, identityNotes, persona, hasCompletedOnboarding } = get();
    if (session?.user.id) {
      upsertProfile(session.user.id, { cognitiveModel: model, motivatorChoices, identityNotes, persona, hasCompletedOnboarding });
    }
  },

  setMotivatorChoices: (choices) => {
    const newPersona = calculatePersona(choices);
    set({ motivatorChoices: choices, persona: newPersona });
    const { session, cognitiveModel, identityNotes, hasCompletedOnboarding } = get();
    if (session?.user.id) {
      upsertProfile(session.user.id, { cognitiveModel, motivatorChoices: choices, identityNotes, persona: newPersona, hasCompletedOnboarding });
    }
  },

  setIdentityNotes: (notes) => {
    set({ identityNotes: notes });
    const { session, cognitiveModel, motivatorChoices, persona, hasCompletedOnboarding } = get();
    if (session?.user.id) {
      upsertProfile(session.user.id, { cognitiveModel, motivatorChoices, identityNotes: notes, persona, hasCompletedOnboarding });
    }
  },

  // backwards compat shim — delegates to devOverride
  setHasAccess: (value) => {
    set({ devOverride: value, hasAccess: get().session !== null || value });
  },
    }),
    {
      name: 'calibra-app-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        nodes: state.nodes,
        cognitiveModel: state.cognitiveModel,
        motivatorChoices: state.motivatorChoices,
        identityNotes: state.identityNotes,
        persona: state.persona,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
      }),
    }
  )
);
