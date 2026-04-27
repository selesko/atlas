import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BriefingLine { prefix: string; text: string; }
interface Suggestion { label: string; action: string; nodeId?: string; goalId?: string; }
interface BriefingResponse { briefingLines: BriefingLine[]; suggest1: Suggestion; suggest2: Suggestion; }
interface NodeIntentResponse { guidance: string; }

// ─── Prompt builders ─────────────────────────────────────────────────────────

function buildBriefingPrompt(body: Record<string, unknown>): string {
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

function buildNodeIntentPrompt(body: Record<string, unknown>): string {
  const node = body.node as any;
  const persona = (body.persona as string) ?? 'Seeker';

  const scoreRange = node.avg >= 8 ? 'high (thriving)' : node.avg >= 5 ? 'mid (developing)' : 'low (struggling)';

  const coordsSummary = (node.coordinates as any[]).map((c: any) =>
    `  - ${c.name}: ${c.value}/10${c.evidence ? `, evidence: "${c.evidence}"` : ', no evidence logged'}`
  ).join('\n');

  const personaVoice: Record<string, string> = {
    Engineer: 'precise and systems-oriented — reference patterns, leverage points, and what to optimise. Avoid fluff.',
    Spiritual: 'reflective and holistic — acknowledge the inner dimension, speak to meaning and resistance, not just mechanics.',
    Seeker: 'curious and exploratory — frame things as questions or possibilities, encourage discovery over prescription.',
  };

  const voice = personaVoice[persona] ?? personaVoice['Seeker'];

  return `You are a personal co-pilot inside an app called Calibra. A user has opened a life node to review it. Generate one short, context-aware guidance message for this node.

NODE: ${node.name}
Current average score: ${node.avg}/10 (${scoreRange})
Desired intent: ${node.description || 'not set'}

COORDINATES:
${coordsSummary}

USER PERSONA: ${persona}
Voice tone: ${voice}

Write 1–2 sentences of guidance. Rules:
- Sentence case (not ALL CAPS)
- Specific to the actual score range and coordinate data shown
- If thriving (avg ≥ 8): reinforce what's working, suggest how to sustain or deepen it
- If developing (avg 5–7): identify the leverage point, give one concrete directional nudge
- If struggling (avg < 5): acknowledge the gap without judgment, name the smallest next step
- Match the persona voice described above
- Do NOT start with "You" — vary the opening
- No more than 40 words total

Return ONLY a valid JSON object, no markdown:
{ "guidance": "your 1-2 sentence guidance here" }`;
}

// ─── Shared Anthropic caller ─────────────────────────────────────────────────

async function callAnthropic(prompt: string, maxTokens: number): Promise<{ text: string } | { error: string; status: number }> {
  let res: Response;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  } catch (e) {
    return { error: `Network error calling Anthropic: ${e}`, status: 502 };
  }

  if (!res.ok) {
    const errText = await res.text();
    return { error: `Anthropic API error ${res.status}: ${errText}`, status: 502 };
  }

  const data = await res.json();
  const raw: string = data.content?.[0]?.text ?? '';
  const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
  return { text: cleaned };
}

// ─── Handler ─────────────────────────────────────────────────────────────────

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }

  const action = (body.action as string) ?? 'briefing';

  // ── Node intent ──────────────────────────────────────────────────────────────
  if (action === 'nodeIntent') {
    if (!body.node) {
      return new Response(JSON.stringify({ error: 'Missing node payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    const result = await callAnthropic(buildNodeIntentPrompt(body), 120);
    if ('error' in result) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: result.status,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    let intent: NodeIntentResponse;
    try {
      intent = JSON.parse(result.text);
    } catch {
      return new Response(JSON.stringify({ error: 'Failed to parse AI response', raw: result.text }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    return new Response(JSON.stringify(intent), {
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }

  // ── Co-pilot briefing (default) ──────────────────────────────────────────────
  const result = await callAnthropic(buildBriefingPrompt(body), 600);
  if ('error' in result) {
    return new Response(JSON.stringify({ error: result.error }), {
      status: result.status,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }

  let briefing: BriefingResponse;
  try {
    briefing = JSON.parse(result.text);
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to parse AI response as JSON', raw: result.text }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }

  return new Response(JSON.stringify(briefing), {
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
});
