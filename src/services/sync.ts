/**
 * sync.ts — Supabase read/write helpers (offline-first)
 *
 * All writes are fire-and-forget: callers do NOT await them.
 * Reads happen only on sign-in to hydrate the store.
 */

import { supabase } from '../../lib/supabase';
import { Node, Goal, Task, CognitiveModel, MotivatorChoices } from '../types';

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
      evidence: goal.evidence,
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

// ─── Tasks ──────────────────────────────────────────────────────────────────

export async function upsertTask(
  userId: string,
  nodeId: string,
  goalId: string,
  task: Task
): Promise<void> {
  const { error } = await supabase.from('tasks').upsert(
    {
      id: task.id,
      user_id: userId,
      node_id: nodeId,
      goal_id: goalId,
      title: task.title,
      completed: task.completed,
      is_priority: task.isPriority,
      notes: task.notes ?? '',
      due_date: task.dueDate ?? '',
      reminder: task.reminder ?? '',
      created_at: task.createdAt,
      completed_at: task.completedAt ?? '',
      timestamp: task.timestamp,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id,user_id' }
  );
  if (error) swallow('upsertTask', error);
}

export async function deleteTask(
  userId: string,
  taskId: string
): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)
    .eq('user_id', userId);
  if (error) swallow('deleteTask', error);
}

// ─── Full fetch (on sign-in) ─────────────────────────────────────────────────

export interface UserData {
  profile: ProfilePayload | null;
  nodes: Node[];
}

export async function fetchUserData(userId: string): Promise<UserData> {
  // Fetch all tables in parallel
  const [profileRes, nodesRes, coordsRes, tasksRes] = await Promise.all([
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
  if (tasksRes.error) swallow('fetchTasks', tasksRes.error);

  const rawProfile = profileRes.data;
  const rawNodes: any[] = nodesRes.data ?? [];
  const rawCoords: any[] = coordsRes.data ?? [];
  const rawTasks: any[] = tasksRes.data ?? [];

  // No remote data at all — new user, keep local state
  if (!rawProfile && rawNodes.length === 0) {
    return { profile: null, nodes: [] };
  }

  // Assemble nodes → goals → tasks
  const nodes: Node[] = rawNodes.map((n) => {
    const goals: Goal[] = rawCoords
      .filter((c) => c.node_id === n.id)
      .map((c) => {
        const tasks: Task[] = rawTasks
          .filter((t) => t.goal_id === c.id)
          .map((t) => ({
            id: t.id,
            title: t.title,
            completed: t.completed,
            isPriority: t.is_priority,
            timestamp: t.timestamp,
            notes: t.notes,
            dueDate: t.due_date,
            reminder: t.reminder,
            createdAt: t.created_at,
            completedAt: t.completed_at || undefined,
          }));
        return {
          id: c.id,
          name: c.name,
          value: Number(c.value),
          evidence: c.evidence,
          scoreHistory: c.score_history ?? [],
          tasks,
        };
      });
    return {
      id: n.id,
      name: n.name,
      description: n.description,
      color: n.color,
      goals,
    };
  });

  const profile: ProfilePayload | null = rawProfile
    ? {
        cognitiveModel: rawProfile.cognitive_model as CognitiveModel,
        motivatorChoices: (rawProfile.motivators as MotivatorChoices) ?? {},
        identityNotes: rawProfile.identity_notes ?? '',
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
      for (const task of goal.tasks) {
        await upsertTask(userId, node.id, goal.id, task);
      }
    }
  }
}
