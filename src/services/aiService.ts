import { supabase } from '../../lib/supabase';
import { Node } from '../types';

/**
 * Fetch a score-aware, persona-tailored guidance blurb for a single node.
 * Returns the guidance string on success, null on any error.
 */
export async function fetchNodeIntent(node: Node, persona: string): Promise<string | null> {
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
          evidence: g.evidence ?? '',
        })),
      },
    },
  });

  if (error || !data?.guidance) return null;
  return data.guidance as string;
}
