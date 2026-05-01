/**
 * sync.ts — Supabase read/write helpers (offline-first)
 *
 * All writes are fire-and-forget: callers do NOT await them.
 * Reads happen only on sign-in to hydrate the store.
 */

import { supabase } from '../../lib/supabase';
import { Node, Goal, Action, CognitiveModel, MotivatorChoices, Persona } from '../types';

// ─── helpers ────────────────────────────────────────────────────────────────

/** Silent error logger — never throws, never blocks UI */
function swallow(label: string, err: unknown) {
  if (__DEV__) console.warn(`[sync] ${label}:`, err);
}

// ─── Profile ────────────────────────────────────────────────────────────────

export interface ProfilePayload {
  cognitiveModel: CognitiveModel;
  motivatorChoices: MotivatorChoices;
  identityNotes: string;
  persona: Persona;
  hasCompletedOnboarding: boolean;
}

export async function upsertProfile(
  userId: string,
  payload: ProfilePayload
): Promise<void> {
  const { error } = await supabase.from('profiles').upsert(
    {
      user_id: userId,
      cognitive_model: payload.cognitiveModel,
      motivators: payload.motivatorChoices,
      identity_notes: payload.identityNotes,
      persona: payload.persona,
      has_completed_onboarding: payload.hasCompletedOnboarding,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
  if (error) swallow('upsertProfile', error);
}

// ─── Nodes ──────────────────────────────────────────────────────────────────

export async function upsertNode(
  userId: string,
  node: Node,
  sortOrder: number
): Promise<void> {
  const { error } = await supabase.from('nodes').upsert(
    {
      id: node.id,
      user_id: userId,
      name: node.name,
      description: node.description,
      why: node.why ?? '',
      color: node.color,
      sort_order: sortOrder,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id,user_id' }
  );
  if (error) swallow('upsertNode', error);
}

export async function deleteNode(userId: string, nodeId: string): Promise<void> {
  const { error } = await supabase
    .from('nodes')
    .delete()
    .eq('id', nodeId)
    .eq('user_id', userId);
  if (error) swallow('deleteNode', error);
}

// ─── Coordinates (Goals) ────────────────────────────────────────────────────

export async function upsertCoordinate(
  userId: string,
  nodeId: string,
  goal: Goal,
  sortOrder: number
): Promise<void> {
  const { error } = await supabase.from('coordinates').upsert(
    {
      id: goal.id,
      user_id: userId,
      node_id: nodeId,
      name: goal.name,
      value: goal.value,
      score_history: goal.scoreHistory ?? [],
      sort_order: sortOrder,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id,user_id' }
  );
  if (error) swallow('upsertCoordinate', error);
}

export async function deleteCoordinate(
  userId: string,
  goalId: string
): Promise<void> {
  const { error } = await supabase
    .from('coordinates')
    .delete()
    .eq('id', goalId)
    .eq('user_id', userId);
  if (error) swallow('deleteCoordinate', error);
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function upsertAction(
  userId: string,
  nodeId: string,
  goalId: string,
  action: Action
): Promise<void> {
  const { error } = await supabase.from('tasks').upsert(
    {
      id: action.id,
      user_id: userId,
      node_id: nodeId,
      goal_id: goalId,
      title: action.title,
      completed: action.completed,
      is_priority: action.isPriority,
      notes: action.notes ?? '',
      due_date: action.dueDate ?? '',
      reminder: action.reminder ?? '',
      created_at: action.createdAt,
      completed_at: action.completedAt ?? '',
      timestamp: action.timestamp,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id,user_id' }
  );
  if (error) swallow('upsertAction', error);
}

export async function deleteAction(
  userId: string,
  actionId: string
): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', actionId)
    .eq('user_id', userId);
  if (error) swallow('deleteAction', error);
}

// ─── Full fetch (on sign-in) ─────────────────────────────────────────────────

export interface UserData {
  profile: ProfilePayload | null;
  nodes: Node[];
}

export async function fetchUserData(userId: string): Promise<UserData> {
  // Fetch all tables in parallel
  const [profileRes, nodesRes, coordsRes, actionsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('nodes').select('*').eq('user_id', userId).order('sort_order'),
    supabase
      .from('coordinates')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order'),
    supabase.from('tasks').select('*').eq('user_id', userId),
  ]);

  if (profileRes.error) swallow('fetchProfile', profileRes.error);
  if (nodesRes.error) swallow('fetchNodes', nodesRes.error);
  if (coordsRes.error) swallow('fetchCoords', coordsRes.error);
  if (actionsRes.error) swallow('fetchActions', actionsRes.error);

  const rawProfile = profileRes.data;
  const rawNodes: any[] = nodesRes.data ?? [];
  const rawCoords: any[] = coordsRes.data ?? [];
  const rawActions: any[] = actionsRes.data ?? [];

  // No remote data at all — new user, keep local state
  if (!rawProfile && rawNodes.length === 0) {
    return { profile: null, nodes: [] };
  }

  // Assemble nodes → coordinates → actions
  const nodes: Node[] = rawNodes.map((n) => {
    const goals: Goal[] = rawCoords
      .filter((c) => c.node_id === n.id)
      .map((c) => {
        const actions: Action[] = rawActions
          .filter((a) => a.goal_id === c.id)
          .map((a) => ({
            id: a.id,
            title: a.title,
            completed: a.completed,
            isPriority: a.is_priority,
            timestamp: a.timestamp,
            notes: a.notes,
            dueDate: a.due_date,
            reminder: a.reminder,
            createdAt: a.created_at,
            completedAt: a.completed_at || undefined,
          }));
        return {
          id: c.id,
          name: c.name,
          value: Number(c.value),
          scoreHistory: c.score_history ?? [],
          actions,
        };
      });
    return {
      id: n.id,
      name: n.name,
      description: n.description,
      why: n.why ?? '',
      color: n.color,
      goals,
    };
  });

  const profile: ProfilePayload | null = rawProfile
    ? {
        cognitiveModel: rawProfile.cognitive_model as CognitiveModel,
        motivatorChoices: (rawProfile.motivators as MotivatorChoices) ?? {},
        identityNotes: rawProfile.identity_notes ?? '',
        persona: (rawProfile.persona as Persona) ?? 'Seeker',
        hasCompletedOnboarding: rawProfile.has_completed_onboarding ?? false,
      }
    : null;

  return { profile, nodes };
}

// ─── Push local state to Supabase (new user first sign-in) ──────────────────

export async function pushLocalData(
  userId: string,
  nodes: Node[],
  profile: ProfilePayload
): Promise<void> {
  await upsertProfile(userId, profile);
  for (let ni = 0; ni < nodes.length; ni++) {
    const node = nodes[ni];
    await upsertNode(userId, node, ni);
    for (let gi = 0; gi < node.goals.length; gi++) {
      const goal = node.goals[gi];
      await upsertCoordinate(userId, node.id, goal, gi);
      for (const action of goal.actions) {
        await upsertAction(userId, node.id, goal.id, action);
      }
    }
  }
}
