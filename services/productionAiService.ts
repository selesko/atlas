/**
 * productionAiService — AI Bridge (Edge Function)
 *
 * Calls a remote Edge Function instead of OpenAI directly. API keys stay
 * server-side; the client never sees them.
 *
 * Set PRODUCTION_AI_URL (or use getProductionAiBaseUrl()) to your Edge
 * Function base, e.g. https://<project>.supabase.co/functions/v1/atlas-ai
 */

const DEFAULT_EDGE_URL = 'https://YOUR_PROJECT.supabase.co/functions/v1/atlas-ai';

function getBaseUrl(): string {
  // In production, read from env: process.env.EXPO_PUBLIC_ATLAS_AI_URL or similar
  if (typeof process !== 'undefined' && (process as any).env?.EXPO_PUBLIC_ATLAS_AI_URL) {
    return (process as any).env.EXPO_PUBLIC_ATLAS_AI_URL;
  }
  return DEFAULT_EDGE_URL;
}

export type AiRequest = {
  /** e.g. 'reflect', 'suggest', 'summarize' */
  action: string;
  /** Input or prompt. */
  payload: string | Record<string, unknown>;
  /** Optional: pass profile context for personalization (no PII). */
  context?: { cognitive_model?: string; peak_period?: string };
};

export type AiResponse = {
  ok: boolean;
  text?: string;
  error?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

/**
 * Calls the Atlas Edge Function. The Edge Function is responsible for:
 * - Validating the request
 * - Calling OpenAI (or another provider) with the API key
 * - Returning a structured { ok, text?, error?, usage? }
 *
 * @param request - Action, payload, and optional context
 * @param accessToken - Auth token for the Edge Function (e.g. Supabase anon/key or user JWT)
 */
export async function callProductionAi(
  request: AiRequest,
  accessToken?: string
): Promise<AiResponse> {
  const base = getBaseUrl();
  const url = `${base}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });

    const data = (await res.json().catch(() => ({}))) as AiResponse & { ok?: boolean; text?: string; error?: string };

    if (!res.ok) {
      return {
        ok: false,
        error: data?.error || `Edge Function error: ${res.status} ${res.statusText}`,
      };
    }

    return {
      ok: data?.ok ?? true,
      text: data?.text,
      error: data?.error,
      usage: data?.usage,
    };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Network or request error: ${err}` };
  }
}

/**
 * Convenience: request a reflection or suggestion from AI.
 * Use when the Edge Function supports action: 'reflect' or 'suggest'.
 */
export async function reflectWithAi(
  payload: string,
  context?: { cognitive_model?: string; peak_period?: string },
  accessToken?: string
): Promise<AiResponse> {
  return callProductionAi(
    { action: 'reflect', payload, context },
    accessToken
  );
}

export async function suggestWithAi(
  payload: string | Record<string, unknown>,
  context?: { cognitive_model?: string; peak_period?: string },
  accessToken?: string
): Promise<AiResponse> {
  return callProductionAi(
    { action: 'suggest', payload, context },
    accessToken
  );
}
