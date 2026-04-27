# Calibra — Project Deep Dive & Roadmap to Profitable App Store Launch

**Author:** Prepared for Jeff Goldblatt
**Date:** April 26, 2026 (rebranded from "Atlas")
**Status:** Pre-launch. Functional prototype, no persistence, no payments.
**Brand:** Calibra · **Domain:** [usecalibra.com](https://usecalibra.com) (purchased 2026-04-26) · **Codebase:** still in `/atlas/` until Phase 1 restructure · **Recommended bundle ID:** `com.calibra.app`

---

## TL;DR

Calibra (formerly Atlas) is a beautifully animated React Native prototype of a "personal operating system" — a radar chart that tracks balance across Mind, Body, and Home, with task logging and an AI Co-Pilot. The visual design is genuinely strong. Underneath that surface, however, the app is a **single 1,761-line `App.tsx` with zero persistence, zero authentication, a placeholder AI function, and disabled row-level security on the database**. Roughly 40% of what the UI implies actually works end-to-end.

To ship this profitably you have three real bodies of work, in order:

1. **Foundation** (~3–4 weeks) — refactor the monolith, wire Supabase auth + persistence, enable RLS, build the real Edge Function, switch dev placeholders for production config.
2. **App Store readiness** (~2–3 weeks) — bundle IDs, icons, screenshots, privacy policy, EAS build, TestFlight beta, RevenueCat for subscriptions.
3. **Monetization & growth** (ongoing) — freemium with a Pro tier at ~$4.99/mo or $39.99/yr, paywalled around AI usage, history depth, and custom nodes.

Realistic solo-dev timeline to a paid v1.0 in App Store and Play Store: **10–14 calendar weeks** at ~15–20 focused hours/week. Faster if you full-time it.

---

## 1. App Concept

### What Calibra is

Calibra is a **self-calibration tool** dressed up as a navigation system. Instead of habit tracking ("Did you meditate today? ✓") it asks the user to score themselves 1–10 on a small set of life dimensions, write a one-line "why," and watch a radar chart visualize the resulting balance. A central AI "Co-Pilot" reads the scores plus the user's chosen archetype (Architect / Strategist / Builder / Analyst) and offers reflections.

The mental model is **quantified-self meets coaching journal meets sci-fi UI**. The product personality is closer to a flight instrument than to Calm or Headspace. The name leans into the same metaphor — to *calibrate* is the verb the entire app is built around.

### Core data primitives

- **Nodes** (Mind, Body, Home — extensible): top-level life dimensions
- **Coordinates** (e.g. Meditation, Sleep, Environment): child metrics under each node, scored 1–10
- **Evidence logs**: append-only events of `{coordinate, score, why_statement, timestamp}`
- **Profile**: cognitive_model, peak_period (morning/evening), motivators, identity notes

That's it. The simplicity is a feature — the schema fits on one screen and is extensible.

### Differentiation in the market

Wellness/quantified-self is a crowded category, but Calibra has a real angle:

| Competitor | What they do | Where Calibra differs |
|---|---|---|
| Stoic, Reflectly | Mood + journaling | Calibra treats every entry as evidence on a multi-axis chart, not isolated journal entries |
| Habitica, Streaks | Habit checkboxes | Calibra scores *quality* (1–10) not *completion* (Y/N) — better for nuanced self-knowledge |
| Bearable, Daylio | Mood tracking | Calibra adds the AI coach layer and the "system" framing |
| Notion templates | Manual life dashboards | Calibra is purpose-built and mobile-first |
| Finch, Fabulous | Gamified wellness | Calibra is sober, instrument-like, for adults who roll their eyes at gamification |

**Most plausible target user:** intentional 25–45 year-old, knowledge worker, already journals or uses Notion, identifies with words like "system" and "operating model." Likely overlaps heavily with Tim Ferriss / Ali Abdaal / Anne-Laure Le Cunff audiences.

The **defensible wedge** is the radar chart + archetype + AI loop. Habit trackers can't easily copy that without reworking their UI. Journaling apps can't easily copy the scoring math. The Calibra brand reinforces the wedge — it names the verb.

### What Calibra is *not* (and shouldn't pretend to be)

- A medical or therapy app. The "Body" node is wellness-flavored, not clinical. Clear distancing from medical claims protects you from regulators and from disappointed users.
- A productivity app. Tasks exist but they support reflection, not GTD.
- A social app. No feeds, no comparisons. This is private by design — that's a marketing asset.

---

## 2. Architecture

### Topology today

```
[React Native + Expo client (App.tsx monolith)]
               │
               │  (currently: nothing — the client never calls Supabase)
               ▼
[Supabase Postgres]      [Supabase Edge Function "ai-briefing"]
   • profiles                • placeholder "Hello {name}!"
   • evidence_logs           • does not call any LLM
   • RLS commented out       • JWT verification on but unused
```

### Topology you need

```
[Expo client]
  ├─ AsyncStorage cache (offline-first reads)
  ├─ Supabase JS client (auth + RLS-scoped queries)
  └─ Edge Function bridge (AI calls only)
               │
               ▼
[Supabase project]
  ├─ Postgres tables (RLS enabled, FKs to auth.users)
  ├─ Edge Function `calibra-ai` → Gemini/OpenAI server-side
  └─ Storage bucket (optional: for journal exports)
               │
               ▼
[RevenueCat]  ←→  [Stripe / App Store / Play Billing]
  └─ Subscription state webhook → Supabase `subscriptions` table
```

### Architectural decisions worth defending

- **Supabase over Firebase**: better SQL, RLS is real auth-aware row security, Postgres is portable. Stay.
- **AI keys server-side via Edge Function**: the productionAiService pattern is correct. Don't move LLM keys into the client. Stay.
- **Single Postgres with RLS** instead of per-tenant databases: simpler operations, fine until tens of thousands of users. Stay.
- **Append-only evidence_logs**: the schema treats logs as immutable events, with current-state derived by aggregation. This is the right call — it gives you history "for free" and supports timelines. Stay.

### Architectural problems to fix before launch

- **Disabled RLS** (schema.sql lines 46–55 are commented out). Anyone with the anon key — which ships in your app binary — could read every user's data. **This is a must-fix on day one.**
- **No FK from `profiles.user_id` → `auth.users(id)`** with `ON DELETE CASCADE`. Today, deleting an auth user orphans data forever. GDPR compliance requires fixing this.
- **No `subscriptions` table**. You need one; RevenueCat's webhook should write to it.
- **No migrations folder**. `supabase/migrations/` is empty. You need versioned SQL for repeatable deploys.

---

## 3. App Stack

### What's installed (verdict: modern but bleeding-edge in places)

| Layer | Choice | Verdict |
|---|---|---|
| Runtime | Expo SDK 54, RN 0.81.5 | Current. Good. |
| UI | React 19.1, react-native-svg 15.12, reanimated 3.16, lucide-react-native | React 19 on RN is still ramping — pin versions tightly and watch for compat issues |
| Backend client | @supabase/supabase-js 2.91 | Current. |
| AI SDK | @google/genai 1.34 | Pre-1.0-feeling API; pin exact versions |
| Type system | TypeScript 5.9 | Current. |
| Build tool | Expo + Metro, but `vite` also in scripts | **Confused** — pick one. If mobile-only, drop Vite. |

### What's missing that you'll need

- **`@react-native-async-storage/async-storage`** — for offline cache and Supabase session persistence. Must add.
- **`react-native-purchases` (RevenueCat)** — for subscriptions. Must add.
- **`expo-notifications`** — for the daily check-in reminder loop, which is your core retention mechanic.
- **`react-native-gesture-handler`** — already a transitive dep but worth declaring explicitly.
- **`@sentry/react-native`** — crash reporting. Don't ship blind.
- **`posthog-react-native`** or similar — analytics for retention/funnel work. Without this you can't iterate intelligently after launch.
- **State management** — currently 50+ `useState` calls in one file. Reach for Zustand (small, fast, no provider hell). Don't add Redux, it's overkill.

### Configuration gaps

`app.config.js` today is essentially empty. To pass App Store and Play Store validation you need:

- `ios.bundleIdentifier` = `com.calibra.app`
- `android.package` = `com.calibra.app` (matching)
- `version`, `ios.buildNumber`, `android.versionCode`
- App icon (1024×1024 PNG in `assets/icon.png`)
- Splash screen
- All NSUsageDescription strings (notifications at minimum)
- An `eas.json` with `production`, `preview`, `development` profiles
- `expo-notifications` plugin entry once you add notifications

### `README_PRODUCTION.md` summary

The doc states the right intent: multi-user via Supabase, AI keys server-side, RLS for isolation. It correctly identifies the bridge pattern. **But it describes intent, not state** — RLS is still off, the Edge Function is still a placeholder, and no auth flow is wired. Treat it as a design memo, not a status report.

---

## 4. Code Deep Dive

### What's actually working today

- All four tabs render and animate beautifully (Atlas, Nodes, Tasks, Profile — these are the in-app tab labels; "Atlas" here refers to the radar tab, *not* the brand)
- Three radar visualizations (radar, trajectory, constellation) — math is correct
- Sliders update local state; tasks toggle complete; profile selections persist within a session
- 7-day rolling score history is computed in-memory
- Co-Pilot FAB triggers a gorgeous orbit/sunburst transition into a modal

### What's scaffolded but doesn't actually do anything

- **Supabase calls**: zero CRUD operations. The client is instantiated and `getSession()` polls every 30s, but the result is ignored. Closing the app loses all data.
- **AI Co-Pilot**: the briefing text is hand-coded inside a `useMemo` block. No call to `productionAiService` is wired from the UI. The Edge Function it would call is itself a placeholder that returns `{message: "Hello ${name}!"}`.
- **Paywall**: triggers a "$9.99/MO UNRESTRICTED" modal, but the gate is cosmetic. A `hasAccess` toggle in the Profile tab — labeled `DEVELOPER OVERRIDE` — bypasses everything. **This must come out before submission.**
- **Task fields**: due date, reminder, notes all exist as inputs but are never read or used.

### Concrete code risks (with fixes coming in §5)

| Risk | Severity | Note |
|---|---|---|
| RLS disabled on production schema | **Critical** | Day-one data exposure — uncomment lines 46–55 in `schema.sql` and migrate |
| No persistence (data evaporates on close) | **Critical** | Users lose work between sessions |
| Anon key visible in binary + RLS off | **Critical** | Combined, these mean the database is wide open |
| Dev override toggle in production UI | **High** | Trivially defeats your paywall |
| Monolithic 1,761-line `App.tsx` | **High** | Cannot test, cannot collaborate, refactor pain compounds |
| No auth flow (signup/signin/reset) | **High** | Cannot ship a multi-user app without it |
| AI Edge Function is a "Hello World" | **High** | Co-Pilot, the headline feature, doesn't actually run |
| No FK / cascade from profiles → auth.users | **High** | GDPR delete-user requests cannot be fulfilled |
| No error boundaries, no loading states | Medium | Crashes are unhandled and feel broken |
| Animation listener leaks (e.g. radar listener cleanup) | Medium | Memory drift on long sessions |
| No rate limit on Edge Function | Medium | Once it's real, cost overrun risk |
| No input validation on `why_statement` | Medium | Prompt-injection vector once AI is wired |
| `vite` in scripts conflicting with Expo Metro | Low | Likely vestigial — just remove |

### Code structure verdict

`App.tsx` is the entire app. The animation work and the visual design are the most valuable artifacts in the codebase — preserve those carefully when refactoring. The state management and persistence layer essentially do not exist yet, so you're not throwing work away by introducing Zustand and feature-folder structure.

---

## 5. Roadmap to Profitable Launch

This is scoped for a **solo developer** working ~15–20 focused hours per week. Each phase has explicit exit criteria. Don't move forward until they're met — half-done foundations cost 3× to fix later.

### Phase 0 — Decisions (this week)

Before writing any code, lock these:

- ~~**Brand name**~~ — ✓ **Done.** Calibra.
- ~~**Domain**~~ — ✓ **Done.** `usecalibra.com` purchased 2026-04-26.
- **Bundle identifier** — recommend `com.calibra.app`. Lock it now; cannot change once published.
- **Apple Developer + Google Play accounts** — $99/yr + $25 one-time. Enroll now; Apple takes ~24–48h to approve.
- **App Store name search for "Calibra"** — verify category is clean (it should be, per pre-launch checks) before designing brand assets.
- **LLM provider** — Gemini (cheaper, already in deps) or OpenAI/Anthropic. Recommend starting with Gemini Flash for cost; you can ship a "Premium = better model" upgrade later.

**Exit criteria:** developer accounts approved, bundle ID picked, App Store category collision checked.

---

### Phase 1 — Foundation Refactor (3–4 weeks)

The goal here is *not* new features. It's making the prototype shippable.

**1.1 Restructure the codebase** (3–5 days)
- Rename repo/folder from `atlas` → `calibra` (or keep `atlas/` if git history matters more than tidiness — your call).
- Create `src/` with `screens/`, `components/`, `hooks/`, `stores/`, `lib/`, `types/`.
- Extract each tab from `App.tsx` into its own screen: `AtlasScreen` (the radar tab), `NodesScreen`, `TasksScreen`, `ProfileScreen`.
- Extract the radar visualization into `components/RadarChart.tsx`. This is your crown jewel — make it reusable.
- Add Zustand for global state (`stores/useAppStore.ts`). Move the 50+ `useState` calls into stores by domain (nodes, tasks, profile, ui).

**1.2 Add real auth** (3–5 days)
- Email + password via Supabase auth (Apple Sign-in is required by App Store if you offer any other social login, so either add Apple Sign-in *or* stick to email-only).
- Onboarding screens: welcome → archetype quiz (use the existing cognitive_model question) → first node calibration.
- AsyncStorage adapter for Supabase session persistence.
- Sign-out, password reset, delete account flows. **Delete account is non-optional for App Store.**

**1.3 Wire persistence** (3–5 days)
- Uncomment and migrate the RLS policies in `schema.sql`.
- Add `ON DELETE CASCADE` FKs from `profiles.user_id` and `evidence_logs.user_id` to `auth.users(id)`.
- Add a `subscriptions` table now so RevenueCat has somewhere to write later.
- Replace every in-memory state mutation with a Supabase call. Add optimistic updates so the UI still feels snappy.
- Add AsyncStorage cache so offline reads work.

**1.4 Implement the real AI Edge Function** (2–3 days)
- Replace the placeholder `ai-briefing/index.ts` with a real handler (rename to `calibra-ai` for brand consistency):
  - Validates `Authorization` header (Supabase JWT)
  - Validates request shape (action, payload, context)
  - Calls Gemini with a prompt template per action (`reflect`, `suggest`, `summarize`)
  - Sanitizes user `why_statement` inputs to mitigate prompt injection
  - Tracks token usage in a `ai_usage_logs` table for rate limits and billing
- Wire the Co-Pilot modal to actually call it.

**1.5 Cleanup** (1–2 days)
- Remove the `DEVELOPER OVERRIDE` toggle.
- Remove `vite` from package.json scripts unless you intend a web build.
- Add Sentry for crash reporting.
- Add PostHog (or Amplitude) for product analytics.
- Add error boundaries around each screen.
- Add loading and empty states everywhere there's a Supabase call.

**Exit criteria:** A signed-in user can create nodes/coordinates, log scores, see real AI reflections, sign out and back in on a different device, and have their data persist. RLS verified by signing in as User A and confirming you can't query User B's rows.

---

### Phase 2 — App Store Readiness (2–3 weeks)

**2.1 Visual assets** (3–5 days, consider outsourcing)
- App icon (1024×1024) — pay a designer ~$200 on Dribbble or Fiverr; the radar motif is a strong visual anchor and pairs naturally with the Calibra wordmark
- Splash screen
- 6–8 App Store screenshots per device class (iPhone, iPad, Android phone, tablet)
- Short marketing video (optional but lifts conversion)
- Outsource: icon design, screenshot polish in Figma. Total budget ~$300–600.

**2.2 Legal & compliance** (1–2 days, outsource)
- Privacy policy and terms of service hosted at `usecalibra.com/privacy` and `/terms`. Use **Termly** or **Iubenda** ($10–15/mo) — don't write these yourself.
- Privacy manifest for iOS 17+ (declare any tracking SDKs; PostHog requires this).
- Age rating questionnaire answers prepped for both stores.
- Apple's App Privacy details: declare what data you collect (email, usage data) and how it's used.

**2.3 Build pipeline** (2–3 days)
- Create `eas.json` with `development`, `preview`, `production` profiles.
- Set up code signing (EAS handles this automatically — let it).
- First production build with `eas build --profile production --platform all`.

**2.4 RevenueCat integration** (2–3 days)
- Create RevenueCat account (free up to $2.5k MTR).
- Set up products: `calibra_pro_monthly`, `calibra_pro_annual`, `calibra_pro_lifetime` (optional).
- Configure App Store Connect IAP products and Google Play products.
- Wire `react-native-purchases` SDK in app.
- Webhook from RevenueCat → Supabase to update the `subscriptions` table.

**2.5 Beta testing** (1–2 weeks, can overlap with rest)
- TestFlight build to 10–25 friends/early users.
- Google Play internal testing track (similar size).
- Add an in-app feedback button that emails you (don't make people leave to give feedback).
- Iterate on top 5 issues. Don't try to fix everything — ship.

**Exit criteria:** Production build runs on real devices, paywall converts a test purchase end-to-end, screenshots and metadata are uploaded to both stores, privacy policy is live at a public URL.

---

### Phase 3 — Soft Launch (1–2 weeks)

**Submit to both stores. Free with IAP for Pro.** Do not launch the Pro tier yet — launch with everything free for the first 1–2 weeks. Why: get install volume, validate the funnel, fix the bugs that only surface at scale, build review count.

- Apple review usually takes 24–72h; expect a rejection on first try (it's normal). Most common rejections for wellness apps: missing account deletion, vague privacy descriptions, "subscription" language without clear pricing.
- Google Play first review can take 7+ days now.
- Plan a **pricing experiment** for week 3: turn on the Pro tier with a 7-day free trial. Watch the conversion funnel.

**Exit criteria:** App is live in both stores, you have at least 100 organic installs, retention curve has a stable shape (most apps lose 50%+ in week 1 — that's normal).

---

### Phase 4 — Monetization Tuning (2–3 weeks)

**Recommended freemium split:**

| Feature | Free | Calibra Pro |
|---|---|---|
| Mind/Body/Home nodes (3 default) | ✓ | ✓ |
| 2 coordinates per node | ✓ | Unlimited |
| Custom nodes | — | ✓ |
| Score history | 14 days | Forever |
| Radar visualization | ✓ | ✓ |
| Trajectory + Constellation views | — | ✓ |
| AI Co-Pilot briefings | 1/week | Daily |
| AI reflections on logs | — | ✓ |
| Cloud sync across devices | ✓ | ✓ |
| CSV / PDF export | — | ✓ |
| Priority feature requests | — | ✓ |

**Pricing recommendation:** $4.99/mo, $39.99/yr (33% discount), and consider a $79.99 lifetime tier early on — power users *love* lifetime tiers and they generate a lot of revenue in the early growth phase when you have low MRR but need cash.

**Why this split works:**
- **Habit-forming features stay free.** You want users opening the app daily; that's how they tell their friends about it.
- **AI is the obvious paywall** — it's where your costs scale per user, so charging for it aligns interest. Gemini Flash is ~$0.10 per 1M tokens; one daily briefing is maybe 2k tokens. So a Pro user costs you ~$0.02/mo at this rate. Margin is enormous.
- **History depth as a paywall is psychological** — at day 13, users get a "you're about to lose your data" prompt. That's the highest-converting moment in any tracker app.
- **Custom nodes is a power-user wedge** — your most engaged free users will hit the limit and convert.

**Conversion targets to aim for:**
- Free → trial start: 8–15% (industry average for wellness)
- Trial → paid: 30–50% (lower if friction-free trial, higher if paywalled features)
- Annual / monthly mix: aim for >50% annual (better LTV, lower churn)

**Things to A/B test (in this order):**
1. Paywall placement: at onboarding vs. at first feature gate vs. at day 7
2. Trial length: 0 days vs. 7 days vs. 14 days
3. Pricing display: monthly-first vs. annual-first

---

### Phase 5 — Growth (ongoing, post-launch)

**Channel priorities for a wellness/quantified-self app, in order of likely ROI for a solo dev:**

1. **TikTok / Instagram Reels** — your radar chart is genuinely watchable. Short-form videos showing the rotating radar with voiceover ("My week in five seconds, calibrated") will outperform any other channel for a visual app like this. Budget: $0, but ~2 hours/week of consistent posting.
2. **App Store Optimization (ASO)** — keywords in title and subtitle matter more than the description. Use a tool like AppTweak or Sensor Tower trial. Expect 2–3× organic install lift from getting ASO right. Calibra has the advantage of being a clean keyword with no major competitors.
3. **Reddit communities** — r/getdisciplined, r/QuantifiedSelf, r/productivity, r/selfimprovement. **Don't spam.** Comment helpfully for weeks before mentioning the app once.
4. **Newsletter / influencer outreach** — Ali Abdaal, Matt D'Avella, Anne-Laure Le Cunff (Ness Labs) are exactly your audience. Offer them lifetime Pro for an honest review.
5. **Product Hunt launch** — once you have 500+ users and a stable v1.1. Plan it for a Tuesday or Wednesday.

**Retention features to ship in months 2–6 (in priority order):**

| Feature | Why | Effort |
|---|---|---|
| Daily check-in push notification | Single biggest retention lever for any tracker | Low |
| Apple Health / Google Fit integration | Pulls in real Body data — eliminates manual entry | Medium |
| Home screen widget (radar) | Friction reduction; iOS users love widgets | Medium |
| Apple Watch companion | Premium signal; great for ASO and reviews | High |
| Weekly email recap (with AI summary) | Re-engagement loop | Medium |
| Streaks / consistency stats | Mild gamification — but keep the sober tone | Low |
| Custom archetypes via AI | Ditch the 4-archetype CHECK constraint, let users describe themselves | Medium |
| Shareable cards (radar export to image) | Organic growth via social sharing | Low |

---

## 6. What to Outsource (Solo-Dev Cheat Sheet)

You will burn time on the wrong things if you try to do everything yourself. Outsource these:

| Item | Cost | Why |
|---|---|---|
| App icon design | $150–400 | A good icon outperforms a self-made one in install rate; Dribbble or 99designs |
| Screenshot polish (Figma) | $100–250 | Fiverr templates are good; pay for the polish |
| Privacy policy + ToS | $10–15/mo (Termly/Iubenda) | Don't draft these yourself |
| Bookkeeping (once you have revenue) | $0 to $50/mo | Wave is free; QuickBooks if you incorporate |
| Trademark search ("Calibra" in software class) | $0 (TESS) or $400 (lawyer) | Verify Calibra is clear in Class 9 software before brand spend |
| Customer support (post-launch) | $0 (just you, via Crisp or Intercom free tier) | Don't hire support until you're at $5k+ MRR |

**Do NOT outsource:**
- Onboarding flow design — you must understand your user's first 3 minutes intimately
- AI prompt engineering — your brand voice lives in the prompts
- App Store description / keywords — you're closest to the product
- Customer feedback triage — read every email yourself for at least the first 1,000 users

---

## 7. Realistic Financial Picture (Honest Numbers)

Most indie wellness apps that launch on the App Store earn **$0–$500/mo for the first 3–6 months**. The ones that work usually take 12–18 months to reach $5k MRR. Top 5% can hit $20k MRR in year 1.

**Conservative scenario:**
- 100 organic installs/month × 5% trial-start × 30% trial-to-paid × $4.99 = **$7.50/mo new MRR** at month 1
- After 12 months of compounding installs and improvements: $200–800 MRR
- This is the realistic baseline. Don't quit your job for it.

**Optimistic scenario (one viral TikTok or a Ness Labs feature):**
- 5k installs in a week, 8% trial-start, 40% conversion, mix of annual = **$2,000 in week-one ARR booking**
- A single moment can change the trajectory. The radar visualization is the single most viral asset you have. Make a 15-second video of it this month.

**Cost structure at 1,000 paid users:**
- Supabase Pro: $25/mo
- Gemini Flash usage: ~$20/mo at daily Pro briefings
- RevenueCat: free under $2.5k MTR
- Apple/Google fees: 15% (small biz program) or 30% standard
- Domain + privacy policy + email: ~$30/mo
- **Net margin per Pro user: ~$3.50/mo on the $4.99 tier.** Solid.

---

## 8. UI & Functionality Polish — 10 Improvement Areas

*Research-informed (MIT metacognition, Harvard self-reflection apps). Tracked April 2026.*

| # | Area | Status | Notes |
|---|------|--------|-------|
| 1 | **Onboarding flow** — cold-start experience, no context given to new users | ✅ Complete | 6-step OnboardingScreen: Welcome → System → Name nodes → Profile → Calibration → Sign-up |
| 2 | **Evidence indicators** — no visual signal that evidence is missing or logged | ✅ Complete | Amber dot (missing) / node-color dot (logged) on coordinate cards; post-completion nudge in Tasks |
| 3 | **Visual momentum** — score history had no expressive visual output | ✅ Complete | Momentum-colored slider fill, card glow, value number display; sparkline explored but removed per preference |
| 4 | **Co-pilot doesn't close the loop** — suggestions fire once and disappear | ✅ Complete | Last Cycle recap section in co-pilot modal: before/after value, node avg delta, momentum signal |
| 5 | **Tasks disconnected from scores** — completing a task had no score pathway | ✅ Complete | Score reflection prompt (bottom sheet modal) fires on task completion: orbital dial to update coordinate score |
| 6 | **No progress/win acknowledgment** — nothing marks meaningful improvement | 🔲 Pending | Threshold crossing, streak, node hitting a new high |
| 7 | **Node intent is static** — desired intent description doesn't react to score state | 🔲 Pending | Intent should surface context-aware prompts based on current score range |
| 8 | **Profile data doesn't shape experience** — cognitive model and peak period set but ignored | 🔲 Pending | Co-pilot and task suggestions should adapt to archetype and peak period |
| 9 | **No weekly rhythm** — no check-in cadence, no sense of time passing | 🔲 Pending | Weekly review moment, cadence nudge, time-aware briefing |
| 10 | **Visual hierarchy doesn't guide attention** — everything equally weighted | 🔲 Pending | Pull the eye toward lowest-scoring or most-drifted node |

### Orbital Slider (bonus — in progress)
The linear slider across all coordinate inputs is being replaced with a circular orbital dial inspired by the Calibra solar mark logo. Sun at center (shows current value), planet handle orbits the arc. Implemented in `OrbitalSlider.tsx`. Currently live in the coordinate edit modal and score reflection prompt. Card-level expand-on-press interaction planned next.

---

## 9. Concrete Next Three Actions

The brand and domain are locked. Next:

1. **Lock the bundle ID** as `com.calibra.app` (or your variant). Once decided, never changes.
2. **Run a USPTO TESS search for "Calibra"** in Class 9 (software). 5 minutes. Confirms trademark is clear before you spend on brand assets.
3. **Refactor `App.tsx` into screens + Zustand stores** — this is the single change that unlocks everything else. Until it's done, every feature you add makes the cleanup harder. Block out 2 weekends.

After those three, the order in §5 holds. The product is real. The visuals are good. The data model is sound. The work between here and a paid v1.0 is mostly mechanical — auth, persistence, paywall, store metadata. None of it is research; all of it is execution.

You've named it. Now go build it.
