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
  briefing:       { Engineer: 'REFLECTION', Spiritual: 'READING',   Seeker: 'REFLECTION' },
  nodeDiagnostic: { Engineer: 'REFLECTION', Spiritual: 'RESONANCE', Seeker: 'REFLECTION' },
  taskDispatch:   { Engineer: 'REFLECTION', Spiritual: 'FLOW',      Seeker: 'REFLECTION' },
};

// ─── Persona voice ────────────────────────────────────────────────────────────

const PERSONA_VOICE: Record<string, string> = {
  Engineer:  'Direct and precise. Root the observation in actual numbers and names. No jargon, no drama — just what the data is saying and where to go.',
  Seeker:    'Honest and curious. Point toward the growth edge. Frame the observation as an opening, not a verdict. Ask the real question underneath the data.',
  Spiritual: 'Grounded and metaphorical. Find the meaning in the pattern. Speak to energy, the body, or natural cycles when it fits. Never clinical, never vague.',
};

// ─── Insight type guidance ────────────────────────────────────────────────────

const INSIGHT_TYPE_GUIDE = `
Choose ONE insight type based on what the data actually warrants:

SIGNAL — use when something clear and specific is true right now. A direct, honest observation. Ends with what it points toward.
  Good: "Sleep has been pulling everything else down. That's the one to look at."
  Bad: "Your system avg is 6.2."

TENSION — use when there's a real gap or friction. Something is unaddressed, off, or contradicted. Be specific — name the actual area.
  Good: "You have intentions for Health but nothing in place to back them up."
  Bad: "Some areas need attention."

REVEAL — use when there's a reframe worth offering. A different way to see what the pattern is showing. The kind of observation that makes someone pause.
  Good: "Movement keeps coming up as the gap. Maybe the question isn't how to fix it — it's whether you actually want to."
  Bad: "Consider your relationship with exercise."

Rules for the insight text:
- Sentence case — NOT ALL CAPS
- Specific — use the actual area names from the data, not generic terms
- Plain language — no "system", "drift", "calibrated", "velocity", "threshold", "coordinates"
- 1–2 sentences max. The first sentence is the observation. The second (optional) is what it points toward.
- The whole card answers one question: where should I put my energy right now?
`;

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
  const voice = PERSONA_VOICE[persona] ?? PERSONA_VOICE['Seeker'];
  const nodesSummary = nodesSummaryText(nodes);

  const totalAvg = nodes.length
    ? (nodes.reduce((acc: number, n: any) =>
        acc + n.goals.reduce((gacc: number, g: any) => gacc + Number(g.value), 0) / (n.goals.length || 1), 0)
      / nodes.length).toFixed(1)
    : '0.0';

  const lowestNode = nodes.length
    ? [...nodes].sort((a: any, b: any) => {
        const avgA = a.goals.reduce((s: number, g: any) => s + Number(g.value), 0) / (a.goals.length || 1);
        const avgB = b.goals.reduce((s: number, g: any) => s + Number(g.value), 0) / (b.goals.length || 1);
        return avgA - avgB;
      })[0]
    : null;

  return `You are a reflection guide inside an app called Calibra. The user tracks life areas (like Work, Health, Relationships) and scores how they're doing in each one.

The user just opened their reflection card. Your job: help them answer "where should I put my energy right now?"

PERSONA: ${persona}
VOICE: ${voice}

LIFE AREA DATA (overall avg: ${totalAvg}/10):
${nodesSummary || 'No areas defined yet.'}
${lowestNode ? `Lowest area: ${lowestNode.name}` : ''}

${INSIGHT_TYPE_GUIDE}

Return ONLY valid JSON — no markdown, no explanation:
{
  "stats": [
    { "label": "OVERALL", "value": "${totalAvg}" },
    { "label": "AREAS", "value": "${nodes.length}" }
  ],
  "lines": [
    {
      "prefix": "SIGNAL" | "TENSION" | "REVEAL",
      "text": "Your insight here — sentence case, 1–2 sentences, specific to the actual data, written in the ${persona} voice."
    },
    {
      "prefix": "MORE",
      "text": "One additional sentence of context or depth for users who want to go further. Sentence case."
    }
  ],
  "actions": [
    { "label": "What to do next (sentence case, plain language, ≤10 words)", "action": "calibrate", "nodeId": "<exact id from data>" },
    { "label": "A second option (sentence case, plain language, ≤10 words)", "action": "addCalibration", "nodeId": "<exact id from data>", "goalId": "<exact goal id from data>" }
  ]
}

Strict rules:
- prefix must be exactly one of: SIGNAL, TENSION, REVEAL — based on which type fits best
- text is sentence case, plain language, no jargon
- action labels are plain — say what the person should actually do, not app terminology
- nodeId and goalId must be exact IDs from the brackets in the data above`;
}

function buildNodeDiagnosticPrompt(body: Record<string, unknown>): string {
  const nodes = (body.nodes as any[]) ?? [];
  const persona = (body.persona as string) ?? 'Seeker';
  const voice = PERSONA_VOICE[persona] ?? PERSONA_VOICE['Seeker'];
  const nodesSummary = nodesSummaryText(nodes);

  const lowAreas = nodes.filter((n: any) => {
    const avg = n.goals.reduce((s: number, g: any) => s + Number(g.value), 0) / (n.goals.length || 1);
    return avg < 6;
  });
  const noActions = nodes.flatMap((n: any) =>
    n.goals.filter((g: any) => (g.calibrationCount ?? (g.actions?.length ?? 0)) === 0)
  ).length;

  return `You are a reflection guide inside Calibra. The user is looking at their life areas and the individual things they track within each one.

Your job: help them answer "where should I put my energy right now?" — at the level of specific areas and what's inside them.

PERSONA: ${persona}
VOICE: ${voice}

AREA DATA:
${nodesSummary || 'No areas defined yet.'}

CONTEXT: ${lowAreas.length} area(s) scoring below 6${lowAreas.length ? ` (${lowAreas.map((n: any) => n.name).join(', ')})` : ''}. ${noActions} tracked item(s) with no actions behind them.

${INSIGHT_TYPE_GUIDE}

Return ONLY valid JSON — no markdown:
{
  "stats": [
    { "label": "BELOW 6", "value": "${lowAreas.length}" },
    { "label": "NO ACTIONS", "value": "${noActions}" }
  ],
  "lines": [
    {
      "prefix": "SIGNAL" | "TENSION" | "REVEAL",
      "text": "Your insight here — sentence case, 1–2 sentences, specific to the actual area names and scores, written in the ${persona} voice."
    },
    {
      "prefix": "MORE",
      "text": "One additional sentence of depth. Sentence case."
    }
  ],
  "actions": [
    { "label": "What to do next (plain language, ≤10 words)", "action": "calibrate", "nodeId": "<exact id>" },
    { "label": "A second option (plain language, ≤10 words)", "action": "addCalibration", "nodeId": "<exact id>", "goalId": "<exact goal id>" }
  ]
}

Strict rules:
- prefix must be exactly: SIGNAL, TENSION, or REVEAL
- text is sentence case, uses real area names from the data, no jargon
- action labels describe what the person actually does, not app mechanics
- nodeId and goalId must be exact IDs from the data`;
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

  const pendingSummary = nodes.map((n: any) => {
    const lines = n.goals.map((g: any) => {
      const pend = (g.actions ?? []).filter((a: any) => !a.completed);
      if (!pend.length) return null;
      const titles = pend.slice(0, 3).map((a: any) => `"${a.title}"`).join(', ');
      return `  [${n.id}] ${n.name} / [${g.id}] ${g.name}: ${pend.length} open — ${titles}`;
    }).filter(Boolean).join('\n');
    return lines || null;
  }).filter(Boolean).join('\n');

  // Find the area with the most open actions — the most loaded
  const mostLoaded = nodes.reduce((best: any, n: any) => {
    const openCount = n.goals.reduce((s: number, g: any) =>
      s + (g.actions ?? []).filter((a: any) => !a.completed).length, 0);
    return (!best || openCount > best.count) ? { node: n, count: openCount } : best;
  }, null);

  // Find the area with no actions at all — the most neglected
  const mostNeglected = nodes.find((n: any) =>
    n.goals.every((g: any) => (g.actions ?? []).length === 0)
  ) ?? null;

  return `You are a reflection guide inside Calibra. The user is looking at their open actions — things they've committed to doing to improve specific areas of their life.

Your job: help them answer "where should I put my energy right now?" at the level of what to actually do next.

PERSONA: ${persona}
VOICE: ${voice}

ACTION DATA:
${completed} done, ${pending} still open
${pendingSummary || 'No open actions.'}
${mostLoaded ? `Most loaded area: ${mostLoaded.node.name} (${mostLoaded.count} open)` : ''}
${mostNeglected ? `Area with nothing in place: ${mostNeglected.name}` : ''}

${INSIGHT_TYPE_GUIDE}

Return ONLY valid JSON — no markdown:
{
  "stats": [
    { "label": "DONE", "value": "${completed}" },
    { "label": "OPEN", "value": "${pending}" }
  ],
  "lines": [
    {
      "prefix": "SIGNAL" | "TENSION" | "REVEAL",
      "text": "Your insight here — sentence case, 1–2 sentences, specific to the actual actions and areas, written in the ${persona} voice."
    },
    {
      "prefix": "MORE",
      "text": "One additional sentence of depth. Sentence case."
    }
  ],
  "actions": [
    { "label": "What to do right now (plain language, ≤10 words)", "action": "prioritize", "nodeId": "<exact id>", "goalId": "<exact goal id>" },
    { "label": "Something to add or build on (plain language, ≤10 words)", "action": "deployTask", "nodeId": "<exact id>", "goalId": "<exact goal id>" }
  ]
}

Strict rules:
- prefix must be exactly: SIGNAL, TENSION, or REVEAL
- text is sentence case, plain language, uses real names from the data
- action labels describe what the person actually does
- nodeId and goalId must be exact IDs from the data`;
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
