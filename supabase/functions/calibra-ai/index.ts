import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CopilotStat { label: string; value: string; }
interface CopilotLine { prefix: string; text: string; }
interface CopilotAction { label: string; action: string; nodeId?: string; goalId?: string; }
interface CopilotPayload {
  header: string;
  stats: CopilotStat[];
  lines: CopilotLine[];
  actions: CopilotAction[];
}
interface NodeIntentResponse { guidance: string; }

// ─── Persona headers per tab ──────────────────────────────────────────────────

const HEADERS: Record<string, Record<string, string>> = {
  briefing: {
    Engineer: 'SYSTEM STATUS',
    Spiritual: 'FIELD READING',
    Seeker: 'SIGNAL LOG',
  },
  nodeDiagnostic: {
    Engineer: 'NODE DIAGNOSTIC',
    Spiritual: 'NODE RESONANCE',
    Seeker: 'NODE EXPLORER',
  },
  taskDispatch: {
    Engineer: 'TASK DISPATCH',
    Spiritual: 'TASK FLOW',
    Seeker: 'TASK DISCOVERY',
  },
};

// ─── Persona voice descriptors ────────────────────────────────────────────────

const PERSONA_VOICE: Record<string, string> = {
  Engineer: 'precise and systems-oriented — reference patterns, leverage points, and what to optimise. Avoid fluff.',
  Spiritual: 'reflective and holistic — acknowledge the inner dimension, speak to meaning and resistance, not just mechanics.',
  Seeker: 'curious and exploratory — frame things as questions or possibilities, encourage discovery over prescription.',
};

// ─── Node summary helper ──────────────────────────────────────────────────────

function nodesSummaryText(nodes: any[]): string {
  return nodes.map((n: any) => {
    const avg = (n.goals.reduce((acc: number, g: any) => acc + Number(g.value), 0) / (n.goals.length || 1)).toFixed(1);
    const goals = n.goals.map((g: any) =>
      `  - [${g.id}] ${g.name}: ${g.value}/10, actions: ${g.calibrationCount ?? (g.actions?.length ?? 0)}`
    ).join('\n');
    const pendingActions = n.goals.flatMap((g: any) => (g.actions ?? []).filter((a: any) => !a.completed)).length;
    return `Node [${n.id}]: ${n.name} (avg ${avg}/10, ${pendingActions} pending actions)\n${goals}`;
  }).join('\n\n');
}

// ─── Prompt builders ─────────────────────────────────────────────────────────

function buildAtlasBriefingPrompt(body: Record<string, unknown>): string {
  const nodes = (body.nodes as any[]) ?? [];
  const persona = (body.persona as string) ?? 'Seeker';
  const cognitiveModel = body.cognitiveModel ?? 'Architect';
  const voice = PERSONA_VOICE[persona] ?? PERSONA_VOICE['Seeker'];
  const nodesSummary = nodesSummaryText(nodes);

  const totalAvg = nodes.length
    ? (nodes.reduce((acc: number, n: any) =>
        acc + n.goals.reduce((gacc: number, g: any) => gacc + Number(g.value), 0) / (n.goals.length || 1), 0)
      / nodes.length).toFixed(1)
    : '0.0';

  const allAboveThreshold = nodes.every((n: any) => n.goals.every((g: any) => Number(g.value) >= 6));
  const atlasHealthy = parseFloat(totalAvg) >= 7.5 && allAboveThreshold;
  const toneHint = atlasHealthy
    ? 'The atlas is HEALTHY — acknowledge momentum, reinforce what is working, and suggest how to deepen or sustain it. Do NOT manufacture a problem.'
    : 'Identify the most important gap or drift to address.';

  return `You are a personal performance co-pilot for a self-improvement app called Calibra. Analyze the user's overall life balance (their Atlas) and generate a brief, persona-aware overview.

USER PROFILE:
- Cognitive archetype: ${cognitiveModel}
- Persona: ${persona}
- Voice tone: ${voice}

LIFE NODES (overall avg: ${totalAvg}/10):
${nodesSummary || 'No nodes defined yet.'}

TONE DIRECTION: ${toneHint}

Return ONLY a valid JSON object — no markdown, no explanation:
{
  "stats": [
    { "label": "ATLAS AVG", "value": "${totalAvg}" },
    { "label": "NODES", "value": "${nodes.length}" }
  ],
  "lines": [
    { "prefix": "> STATUS:", "text": "ONE PUNCHY ALL-CAPS SENTENCE THAT HONESTLY REFLECTS THE ATLAS STATE — AFFIRMING IF HEALTHY, DIAGNOSTIC IF NOT." },
    { "prefix": "> FOCUS:", "text": "ONE ALL-CAPS SENTENCE — EITHER REINFORCE MOMENTUM OR REDIRECT ENERGY, BASED ON THE ACTUAL DATA." }
  ],
  "actions": [
    { "label": "Specific action matching the tone above (sentence case, ≤12 words)", "action": "calibrate", "nodeId": "<exact node id from data>" },
    { "label": "Specific action to add or deepen a calibration (sentence case, ≤12 words)", "action": "addCalibration", "nodeId": "<exact node id from data>", "goalId": "<exact goal id from data>" }
  ]
}

Rules:
- lines[].text MUST be ALL CAPS, terminal-style, specific to actual data
- action labels are sentence case, concrete, motivating, ≤12 words
- nodeId and goalId MUST be copied verbatim from the IDs shown in brackets
- Match the ${persona} persona voice tone throughout`;
}

function buildNodeDiagnosticPrompt(body: Record<string, unknown>): string {
  const nodes = (body.nodes as any[]) ?? [];
  const persona = (body.persona as string) ?? 'Seeker';
  const voice = PERSONA_VOICE[persona] ?? PERSONA_VOICE['Seeker'];
  const nodesSummary = nodesSummaryText(nodes);

  const belowThreshold = nodes.flatMap((n: any) => n.goals.filter((g: any) => Number(g.value) < 6)).length;
  const noCalibrations = nodes.flatMap((n: any) => n.goals.filter((g: any) => (g.calibrationCount ?? (g.actions?.length ?? 0)) === 0)).length;
  const nodesHealthy = belowThreshold === 0 && noCalibrations === 0;
  const toneHint = nodesHealthy
    ? 'All coordinates are above threshold and have calibrations — acknowledge the strong state, reinforce consistency, and suggest how to push further. Do NOT invent a problem.'
    : 'Identify the most important gap to address.';

  return `You are a personal performance co-pilot for Calibra. Analyze the user's coordinate scores and generate a diagnostic report.

COORDINATE DATA:
${nodesSummary || 'No nodes defined yet.'}

QUICK STATS: ${belowThreshold} coordinates below threshold (score < 6), ${noCalibrations} with no calibrations.
TONE DIRECTION: ${toneHint}

Persona: ${persona}
Voice tone: ${voice}

Return ONLY a valid JSON object — no markdown:
{
  "stats": [
    { "label": "BELOW 6", "value": "${belowThreshold}" },
    { "label": "NO CALIBRATIONS", "value": "${noCalibrations}" }
  ],
  "lines": [
    { "prefix": "> SCAN:", "text": "ONE ALL-CAPS SENTENCE — AFFIRMING IF HEALTHY, DIAGNOSTIC IF NOT. SPECIFIC TO ACTUAL DATA." },
    { "prefix": "> SIGNAL:", "text": "ONE ALL-CAPS SENTENCE — REINFORCE MOMENTUM OR NAME THE HIGHEST-LEVERAGE FIX. SPECIFIC TO ACTUAL DATA." }
  ],
  "actions": [
    { "label": "Action matching the tone above for the most relevant coordinate (sentence case, ≤12 words)", "action": "calibrate", "nodeId": "<exact node id>" },
    { "label": "Action to add or strengthen a calibration (sentence case, ≤12 words)", "action": "addCalibration", "nodeId": "<exact node id>", "goalId": "<exact goal id>" }
  ]
}

Rules:
- lines are ALL CAPS, specific to actual coordinate data
- action labels are sentence case, concrete, ≤12 words
- nodeId/goalId must be exact IDs from the data
- Match the ${persona} persona voice`;
}

function buildTaskDispatchPrompt(body: Record<string, unknown>): string {
  const nodes = (body.nodes as any[]) ?? [];
  const persona = (body.persona as string) ?? 'Seeker';
  const voice = PERSONA_VOICE[persona] ?? PERSONA_VOICE['Seeker'];

  const allActions = nodes.flatMap((n: any) =>
    n.goals.flatMap((g: any) => (g.actions ?? []).map((a: any) => ({
      ...a, nodeName: n.name, nodeId: n.id, goalName: g.name, goalId: g.id,
    })))
  );
  const completed = allActions.filter((a: any) => a.completed).length;
  const pending = allActions.filter((a: any) => !a.completed).length;

  const actionsSummary = nodes.map((n: any) => {
    const coordLines = n.goals.map((g: any) => {
      const pend = (g.actions ?? []).filter((a: any) => !a.completed);
      if (!pend.length) return null;
      const titles = pend.slice(0, 3).map((a: any) => `"${a.title}"`).join(', ');
      return `  [${n.id}] ${n.name} / [${g.id}] ${g.name}: ${pend.length} pending — ${titles}`;
    }).filter(Boolean).join('\n');
    return coordLines || null;
  }).filter(Boolean).join('\n');

  const actionsHealthy = pending === 0 && completed > 0;
  const actionToneHint = actionsHealthy
    ? 'The backlog is CLEAR and completions are up — acknowledge the clean state, affirm the velocity, suggest what to build on next. Do NOT invent urgency.'
    : pending > 0
      ? 'Identify what to act on now.'
      : 'No actions exist yet — suggest deploying the first one.';

  return `You are a personal performance co-pilot for Calibra. Analyze the user's action backlog and generate a dispatch report.

ACTION DATA:
Total: ${completed} completed, ${pending} pending
${actionsSummary || 'No pending actions.'}

TONE DIRECTION: ${actionToneHint}
Persona: ${persona}
Voice tone: ${voice}

Return ONLY a valid JSON object — no markdown:
{
  "stats": [
    { "label": "COMPLETED", "value": "${completed}" },
    { "label": "PENDING", "value": "${pending}" }
  ],
  "lines": [
    { "prefix": "> VELOCITY:", "text": "ONE ALL-CAPS SENTENCE — AFFIRMING IF BACKLOG IS CLEAR, DIRECTIONAL IF NOT. SPECIFIC TO DATA." },
    { "prefix": "> DISPATCH:", "text": "ONE ALL-CAPS SENTENCE — EITHER REINFORCE MOMENTUM OR NAME THE TOP PRIORITY. SPECIFIC TO DATA." }
  ],
  "actions": [
    { "label": "Action matching the tone above (sentence case, ≤12 words)", "action": "prioritize", "nodeId": "<exact node id>", "goalId": "<exact goal id>" },
    { "label": "Action to deploy or deepen a calibration (sentence case, ≤12 words)", "action": "deployTask", "nodeId": "<exact node id>", "goalId": "<exact goal id>" }
  ]
}

Rules:
- lines are ALL CAPS, specific to actual task data
- action labels are sentence case, specific, ≤12 words
- nodeId/goalId must be exact IDs from the data
- Match the ${persona} persona voice`;
}

function buildNodeIntentPrompt(body: Record<string, unknown>): string {
  const node = body.node as any;
  const persona = (body.persona as string) ?? 'Seeker';

  const scoreRange = node.avg >= 8 ? 'high (thriving)' : node.avg >= 5 ? 'mid (developing)' : 'low (struggling)';

  const coordsSummary = (node.coordinates as any[]).map((c: any) =>
    `  - ${c.name}: ${c.value}/10, calibrations: ${c.calibrationCount ?? 0}`
  ).join('\n');

  const voice = PERSONA_VOICE[persona] ?? PERSONA_VOICE['Seeker'];

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

async function callAnthropic(
  prompt: string,
  maxTokens: number,
): Promise<{ text: string } | { error: string; status: number }> {
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

// ─── CORS headers ─────────────────────────────────────────────────────────────

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Handler ─────────────────────────────────────────────────────────────────

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
  const persona = (body.persona as string) ?? 'Seeker';

  // ── Node intent (inline, not a full copilot card) ─────────────────────────
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
    try { intent = JSON.parse(result.text); } catch {
      return new Response(JSON.stringify({ error: 'Failed to parse AI response', raw: result.text }), {
        status: 502, headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }
    return new Response(JSON.stringify(intent), {
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }

  // ── Tab co-pilot actions ──────────────────────────────────────────────────
  const promptBuilders: Record<string, (b: Record<string, unknown>) => string> = {
    briefing: buildAtlasBriefingPrompt,
    nodeDiagnostic: buildNodeDiagnosticPrompt,
    taskDispatch: buildTaskDispatchPrompt,
  };

  const buildPrompt = promptBuilders[action] ?? promptBuilders['briefing'];
  const result = await callAnthropic(buildPrompt(body), 400);

  if ('error' in result) {
    return new Response(JSON.stringify({ error: result.error }), {
      status: result.status,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }

  let aiResponse: Omit<CopilotPayload, 'header'>;
  try {
    aiResponse = JSON.parse(result.text);
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to parse AI response', raw: result.text }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }

  // Inject server-determined header (persona + tab)
  const headerMap = HEADERS[action] ?? HEADERS['briefing'];
  const header = headerMap[persona] ?? headerMap['Seeker'];

  const payload: CopilotPayload = { header, ...aiResponse };

  return new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
});
