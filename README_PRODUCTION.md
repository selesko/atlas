# Atlas — Production Readiness

This document outlines the plan to move Atlas from local storage to a structured, multi-user backend and to keep API keys and secrets **only** on the server.

---

## 1. Database

### Schema

- **`schema/schema.sql`** — DDL for `profiles` and `evidence_logs`.
- **`schema/types.ts`** — TypeScript types for rows, inserts, and filters.

### Tables

| Table           | Purpose                                                                 |
|----------------|-------------------------------------------------------------------------|
| **profiles**   | User Manifest: `cognitive_model`, `peak_period`, `motivators`, `identity_notes`. One row per `user_id`. |
| **evidence_logs** | Mind/Body/Home scores and "why" statements. One row per calibration event; each row is tied to `user_id`. |

### Multi-User

- Every `evidence_log` has a **`user_id`**.
- `profiles.user_id` is UNIQUE; one profile per user.
- All queries must be scoped by `user_id` (enforced via RLS in production).

### Deployment

- Run `schema/schema.sql` in your Postgres (e.g. Supabase SQL editor).
- Enable Row Level Security (RLS) and add policies so users can only read/write their own `profiles` and `evidence_logs` (see commented section in `schema.sql`).

---

## 2. AI Bridge (No API Keys in the Client)

### Problem

- Calling OpenAI (or similar) directly from the app would require embedding an API key in the client.
- Keys in client bundles can be extracted and abused.

### Approach: Edge Function

- **Do not** call OpenAI from the app.
- The app calls our **Edge Function** (e.g. Supabase Edge Function) over HTTPS.
- The Edge Function holds the API key in **server-side** environment variables and forwards requests to OpenAI.

### Implementation

- **`services/productionAiService.ts`** — Client-side module that:
  - Sends `{ action, payload, context? }` to a **remote URL** (your Edge Function).
  - Does **not** contain or receive any API keys.

### Edge Function (Your Backend)

- **URL**: e.g. `https://<project>.supabase.co/functions/v1/atlas-ai`
- **Env (server-only)**: `OPENAI_API_KEY` (or `ANTHROPIC_API_KEY`, etc.)
- **Responsibilities**:
  - Validate `action` and `payload`.
  - Optionally verify the request (JWT, Supabase `Authorization: Bearer`).
  - Call OpenAI (or other provider) with the key from env.
  - Return `{ ok, text?, error?, usage? }`.

### Config in the App

- Set the Edge Function base URL via:
  - **`EXPO_PUBLIC_ATLAS_AI_URL`** (or your chosen env), or
  - App config / `Constants.expoConfig.extra`.
- The app must **never** receive or store `OPENAI_API_KEY` or similar.

---

## 3. Moving API Keys Server-Side — Checklist

| Step | Action |
|------|--------|
| 1 | Create an Edge Function (Supabase, Vercel, etc.) that accepts POST `{ action, payload, context? }`. |
| 2 | Add `OPENAI_API_KEY` (or equivalent) to the **Edge Function’s** environment only. |
| 3 | In the Edge Function, call OpenAI with that key and return `{ ok, text?, error?, usage? }`. |
| 4 | In the app, set `EXPO_PUBLIC_ATLAS_AI_URL` (or your variable) to the Edge Function URL. |
| 5 | Ensure no `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or similar appears in `App.tsx`, `app.config.js`, or any client bundle. |
| 6 | Use `productionAiService.callProductionAi()` (and helpers like `reflectWithAi`, `suggestWithAi`) for all AI calls. |

---

## 4. Security Summary

- **Database**: `user_id` on all logs; RLS so users only access their own data.
- **AI**: Keys only in the Edge Function env; client talks to our URL, not to OpenAI.
- **Auth**: Edge Function should verify the incoming `Authorization` (e.g. Supabase JWT) before calling external APIs.

---

## 5. Files Added / Modified

| Path | Role |
|------|------|
| `schema/schema.sql` | DDL for `profiles`, `evidence_logs`; RLS comments. |
| `schema/types.ts` | TS types for DB rows and inserts. |
| `services/productionAiService.ts` | Client AI bridge; calls remote Edge Function only. |
| `README_PRODUCTION.md` | This plan and checklist. |
