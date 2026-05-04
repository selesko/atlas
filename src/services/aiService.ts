import { supabase } from '../../lib/supabase';
import { Node } from '../types';

// ─── CopilotPayload types ─────────────────────────────────────────────────────

export interface CopilotStat { label: string; value: string; }
export interface CopilotLine { prefix: string; text: string; }
export interface CopilotAction {
  label: string;
  action: string;
  nodeId?: string;
  goalId?: string;
}
export interface CopilotPayload {
  header: string;
  stats: CopilotStat[];
  lines: CopilotLine[];
  actions: CopilotAction[];
}

// ─── Tab → edge-function action mapping ──────────────────────────────────────

const TAB_ACTION: Record<string, string> = {
  Atlas: 'briefing',
  Nodes: 'nodeDiagnostic',
  Actions: 'taskDispatch',
  Profile: 'briefing',
};

// ─── Tab visual config (accent + icon) ───────────────────────────────────────

export interface TabConfig {
  accentColor: string;
  icon: string;
}

export const TAB_CONFIG: Record<string, TabConfig> = {
  Atlas:   { accentColor: '#38BDF8', icon: '◎' },
  Nodes:   { accentColor: '#F59E0B', icon: '◈' },
  Actions: { accentColor: '#34D399', icon: '◫' },
  Profile: { accentColor: '#38BDF8', icon: '◎' },
};

// ─── Fetch copilot card payload ───────────────────────────────────────────────

export async function fetchCopilot(
  tab: string,
  nodes: Node[],
  persona: string,
  cognitiveModel: string,
): Promise<CopilotPayload | null> {
  const action = TAB_ACTION[tab] ?? 'briefing';

  // Build a lightweight nodes payload (no full action objects to keep request small)
  const nodesPayload = nodes.map(n => ({
    id: n.id,
    name: n.name,
    description: n.description,
    goals: n.goals.map(g => ({
      id: g.id,
      name: g.name,
      value: g.value,
      calibrationCount: g.actions.length,
      actions: g.actions.map(a => ({ id: a.id, title: a.title, completed: a.completed })),
    })),
  }));

  const { data, error } = await supabase.functions.invoke('calibra-ai', {
    body: { action, persona, cognitiveModel, nodes: nodesPayload },
  });

  if (error || !data?.lines) return null;
  return data as CopilotPayload;
}

// ─── Fetch node intent (inline guidance, not a full card) ─────────────────────

export async function fetchNodeIntent(
  node: Node,
  persona: string,
): Promise<string | null> {
  const avg = parseFloat(
    (node.goals.reduce((acc, g) => acc + g.value, 0) / (node.goals.length || 1)).toFixed(1)
  );

  const { data, error } = await supabase.functions.invoke('calibra-ai', {
    body: {
      action: 'nodeIntent',
      persona,
      node: {
        name: node.name,
        avg,
        description: node.description ?? '',
        coordinates: node.goals.map(g => ({
          name: g.name,
          value: g.value,
          calibrationCount: g.actions.length,
        })),
      },
    },
  });

  if (error || !data?.guidance) return null;
  return data.guidance as string;
}
