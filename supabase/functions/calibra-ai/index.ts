import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

interface BriefingLine { prefix: string; text: string; }
interface Suggestion { label: string; action: string; nodeId?: string; goalId?: string; }
interface BriefingResponse { briefingLines: BriefingLine[]; suggest1: Suggestion; suggest2: Suggestion; }

function buildPrompt(body: Record<string, unknown>): string {
  const nodes = (body.nodes as any[]) ?? [];
  const cognitiveModel = body.cognitiveModel ?? 'Architect';
  const peakPeriod = body.peakPeriod ?? 'MORNING';
  const motivators = (body.motivators as string[]) ?? [];

  const nodesSummary = nodes.map((n: any) => {
    const avg = (n.goals.reduce((acc: number, g: any) => acc + Number(g.value), 0) / (n.goals.length || 1)).toFixed(1);
    const goals = n.goals.map((g: any) =>
      `  - [${g.id}] ${g.name}: ${g.value}/10, evidence: "${g.evidence || 'none'}"`
    ).join('\n');
    const pendingTasks = n.goals.flatMap((g: any) => (g.tasks ?? []).filter((t: any) => !t.completed)).length;
    return `Node [${n.id}]: ${n.name} (avg ${avg}/10, ${pendingTasks} pending tasks)\n${goals}`;
  }).join('\n\n');

  return `You are a personal performance co-pilot for a self-improvement app called Calibra. Analyze the user's data and generate a concise tactical briefing.

USER PROFILE:
- Cognitive archetype: ${cognitiveModel}
- Peak productivity period: ${peakPeriod}
- Motivators: ${motivators.length ? motivators.join(', ') : 'not configured'}

LIFE NODES (self-tracked areas with coordinates scored 1-10):
${nodesSummary || 'No nodes defined yet.'}

Return ONLY a valid JSON object with this exact structure — no markdown, no explanation:
{
  "briefingLines": [
    { "prefix": "> STATUS:", "text": "ONE PUNCHY ALL-CAPS SENTENCE ABOUT THEIR OVERALL PATTERN." },
    { "prefix": "> FOCUS:", "text": "ONE SPECIFIC ALL-CAPS INSIGHT ABOUT WHERE TO DIRECT ENERGY." }
  ],
  "suggest1": {
    "label": "Specific action for the node needing most attention (sentence case, ≤12 words)",
    "action": "calibrate",
    "nodeId": "<exact node id from data>"
  },
  "suggest2": {
    "label": "Specific action for the coordinate most needing evidence (sentence case, ≤12 words)",
    "action": "logEvidence",
    "nodeId": "<exact node id from data>",
    "goalId": "<exact goal id from data>"
  }
}

Rules:
- briefingLines[].text MUST be ALL CAPS, terminal-style, specific to the user's actual data
- suggest labels are sentence case, concrete and motivating
- nodeId and goalId MUST be copied verbatim from the IDs shown in brackets above
- suggest1 action must be exactly "calibrate"
- suggest2 action must be exactly "logEvidence"`;
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const prompt = buildPrompt(body);

  let anthropicRes: Response;
  try {
    anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: `Network error calling Anthropic: ${e}` }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text();
    return new Response(JSON.stringify({ error: `Anthropic API error ${anthropicRes.status}: ${errText}` }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const anthropicData = await anthropicRes.json();
  const rawText: string = anthropicData.content?.[0]?.text ?? '';

  // Strip any accidental markdown fences
  const cleaned = rawText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();

  let briefing: BriefingResponse;
  try {
    briefing = JSON.parse(cleaned);
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to parse AI response as JSON', raw: rawText }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(briefing), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
});
