# Calibra — Production Architecture

This document describes the production backend architecture: database schema, AI bridge, and security model.

---

## 1. Database (Supabase)

### Tables

| Table | Purpose |
|-------|---------|
| **profiles** | One row per user. Stores `cognitive_model`, `motivator_choices`, `identity_notes`, `persona`, `has_completed_onboarding`. |
| **nodes** | Life domains (e.g. Mind, Body, Work). Scoped to `user_id`. |
| **coordinates** | Measurable dimensions within a node. Stores `value`, `score_history`, `description`. |
| **actions** | Concrete habits and tasks linked to a coordinate. Stores `title`, `effort`, `completed`, `archived`, `is_priority`. |
| **subscriptions** | Access tier per user (`free` / `pro`). Controls copilot and sync features. |

### Security

- All tables have **Row Level Security (RLS)** enabled.
- Every row is scoped to `auth.users(id)` — users can only read and write their own data.
- Foreign keys use `ON DELETE CASCADE` — deleting a user removes all their data cleanly.
- Schema lives at `schema/schema.sql`.

### Sync Model

- All writes are **fire-and-forget** via `swallow()` in `src/services/sync.ts`.
- Zustand (`useAppStore`) is the single source of truth for local state.
- On sign-in, `fetchUserData()` hydrates the store from Supabase.
- Offline-first: the app reads from AsyncStorage and syncs when a connection is available.

---

## 2. AI Bridge (`calibra-ai` Edge Function)

### Why an Edge Function

Calling an AI provider directly from the app would require embedding an API key in the client bundle, where it can be extracted. All AI calls go through a Supabase Edge Function instead.

### Edge Function

- **URL**: `https://<project>.supabase.co/functions/v1/calibra-ai`
- **Location**: `supabase/functions/calibra-ai/`
- **Env (server-only)**: AI provider API key stored in Supabase secrets — never in the client.

### Actions the Edge Function Handles

| Action | Trigger | Returns |
|--------|---------|---------|
| `briefing` | Atlas / Profile tab copilot open | Reflection lines + two action suggestions |
| `nodeDiagnostic` | Evaluate tab copilot open | Node-specific insight + two action suggestions |
| `taskDispatch` | Actions tab copilot open | Prioritisation signal + two action suggestions |
| `nodeIntent` | Node expanded in Evaluate screen | Single orientation line for that node |

### Client-Side

- `src/services/aiService.ts` — calls `supabase.functions.invoke('calibra-ai', { body })`.
- The client sends `{ action, persona, cognitiveModel, nodes }` — no API keys, no secrets.
- Responses are typed as `CopilotPayload` (`header`, `stats`, `lines`, `actions`).
- Results are cached per session to avoid redundant calls.

---

## 3. Auth

- Supabase email/password auth via `@supabase/supabase-js`.
- Session persisted via `@react-native-async-storage/async-storage`.
- Auth is **optional** — users can use the app without signing in. Sign-in enables cross-device sync.
- The Edge Function validates the incoming `Authorization: Bearer <token>` before processing AI requests.

---

## 4. Security Checklist

| Item | Status |
|------|--------|
| RLS enabled on all tables | ✅ |
| AI API key server-side only (Edge Function env) | ✅ |
| No secrets in `App.tsx`, `app.config.js`, or client bundle | ✅ |
| `devOverride` flag guarded behind `__DEV__` | ⚠️ Pending — see ROADMAP.md item 5 |
| Privacy manifest (`NSPrivacyAccessedAPITypes`) declared | ✅ |

---

## 5. Key Files

| Path | Role |
|------|------|
| `src/services/sync.ts` | All Supabase read/write — `fetchUserData`, `upsertProfile`, `upsertNode`, `upsertAction`, etc. |
| `src/services/aiService.ts` | Copilot fetch + TAB_CONFIG + TAB_ACTION mapping |
| `src/stores/useAppStore.ts` | Zustand store — single source of truth for all app state |
| `supabase/functions/calibra-ai/` | Edge Function — AI prompt logic, persona branching |
| `schema/schema.sql` | Full DDL with RLS policies |
| `eas.json` | EAS build profiles (`development`, `preview`, `production`) |
| `app.config.js` | Expo config — bundle ID, privacy manifest, EAS project ID |
