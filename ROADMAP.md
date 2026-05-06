# Calibra — Roadmap

Last updated: 2026-05-04. This document is the canonical reference for what's done, what's next, and what's required to ship on the Apple App Store.

---

## Status: Pre-Submission Sprint

The core product is functionally complete. The remaining work is submission infrastructure, a handful of data integrity fixes, and App Store Connect setup.

---

## The Product Audit: May 2026

### 🌟 Five things working well

1.  **Distinctive visual language:** The visual language is coherent and distinctive. The starfield, constellation nodes, orbital action satellites, and bezier trajectory chart all speak the same visual dialect. Most productivity apps look like spreadsheets with rounded corners. Calibra looks like a mission control for your life — and that's genuinely rare. The aesthetic does real work: it signals that this is a different kind of tool before the user does anything.
2.  **Load-bearing terminology:** The terminology is load-bearing, not decorative. Node, Coordinate, Action, Calibration, Persona — these aren't synonyms for "area", "goal", "task". They encode a specific mental model (system thinking, not checklist thinking) and once a user internalizes them, they think differently about their life. The "Evaluate" rename is a good recent example of this: the name tells you what to do there, not just what's stored there.
3.  **Architectural loop closure:** The Evaluate → Actions flow is now architecturally sound. You evaluate where you are, then you go add actions to move it. The copilot FAB now closes that loop — both buttons push you to act, not just navigate. This is the right direction for a behavior-change product. Insight without action is just self-awareness theater.
4.  **Predictable state architecture:** The state and sync architecture is deliberately simple. Fire-and-forget swallow() writes, Zustand as the single source of truth, no optimistic rollback complexity. For a solo-built mobile app, this is the correct trade-off. It means bugs are easy to trace and the system is predictable. There's no clever architecture to maintain.
5.  **Data ambition:** The trajectory chart shows real data ambition. Most apps in this space show you a number and call it tracking. Calibra computes scoreHistory across all coordinates, aggregates by node, and surfaces a multi-range time series. That's a meaningful data product inside what could have been just a mood journal. It gives users something to actually learn from over time.

### 🛠️ Five honest critiques

1.  **Onboarding dead-end:** There's no clear onboarding path and the blank state is brutal. If someone installs Calibra with zero nodes, zero coordinates, and zero actions, they see an empty Atlas constellation and a copilot FAB that surfaces "No areas added yet." That's a dead end. The product asks for a significant mental model shift (Nodes, Coordinates, Calibrations) but offers no guided path into it. The first five minutes are the whole game for retention and right now they're undesigned.
2.  **Subjective drift:** The scoring system has no grounding mechanism. A Coordinate score is a number from 1–10 that the user sets manually. But 7 to whom? On what scale? Without a reference point — a question to answer, a rubric, a before-and-after prompt — the numbers are vibes dressed as data. Two users can both rate their Sleep a 6 and mean completely different things. The trajectory chart then becomes a chart of subjective drift, not progress.
3.  **Reactive intelligence:** The Copilot is reactive, not proactive. It fires when you tap the FAB. That means it only helps people who already remember to check in. The users who need it most — the ones drifting — are the ones least likely to open it. There's no push, no nudge, no scheduled reflection prompt. The intelligence exists but it waits to be asked, which limits its impact on behavior change.
4.  **Cosmetic personas:** Personas feel inert right now. Engineer vs. Seeker vs. Spiritual changes some label text and subtitle copy. But the underlying data model, the structure of suggestions, the phrasing of copilot insights — none of it shifts meaningfully between personas. If someone picks Spiritual and still sees "TENSION" and "SIGNAL" as prefixes, the persona isn't doing real work. It's cosmetic differentiation where the product promises something deeper.
5.  **Lack of recovery loop:** There's no recovery loop for a low-score spiral. If a user's node average drops to a 3 and stays there for three weeks, the app shows them a red sparkline and tells them it's down. It doesn't adapt its suggestions, reduce its complexity, or offer a simpler path forward. There's no "you've been stuck — here's one small thing" mode. The app is built for people maintaining a system, not for people who've let it slip, which is when most people actually need it.

---

## ✅ Shipped (as of May 2026)

### Product Core
- [x] Node / Coordinate / Action data model — full CRUD
- [x] Calibrations (evidence attached to coordinates)
- [x] Score history + delta badges + trend arrows
- [x] Momentum system (-1 to +1 signal, color-coded)
- [x] OrbitalSlider circular dial for score entry
- [x] Score reflection prompt on action completion
- [x] Calibration dot indicators on coordinate cards
- [x] Action effort levels (easy / medium / heavy, weights 1/2/3)
- [x] Action archive (soft-delete, preserved in Supabase) + hard delete
- [x] Effort picker in Add Action modal and edit card
- [x] Effort badge visible on every action row

### AI / Persona
- [x] `calibra-ai` Supabase Edge Function deployed
- [x] Node AI intent line (live, persona-aware, session-cached)
- [x] Co-pilot Last Cycle recap
- [x] Persona auto-derived from Motivator tension choices
- [x] Persona + onboarding state persisted to Supabase
- [x] Copilot FAB — both action buttons use deployTask (open Add Action modal)
- [x] Tab-specific copilot fallback copy (Atlas, Evaluate, Actions)

### Atlas Screen (Cosmic Graph)
- [x] Three-view system: Nodes / Coordinates / Actions
- [x] Math-based inverse-coordinate touch detection on SVG canvas
- [x] Continuous `Animated.loop` rotation restored
- [x] Dynamic grey-out/filter for inactive nodes via legend
- [x] Jump-drive zoom effect on view switch
- [x] Interactive detail card with drill-down navigation
- [x] ExplainerModal (plain-language explainer for each view)
- [x] Guide rings on Coordinates view mapping to score values
- [x] Galaxy-spin direction fix on Actions view
- [x] Node popup: orbital action satellite graphic (effort-tiered rings)
- [x] Node popup: coordinate score bars + EVALUATE / ACTIONS nav buttons
- [x] 7-day trajectory sparkline (real scoreHistory data, green/rose trend)
- [x] Centered Trajectory modal — high-fidelity floating card design with scrollable bezier chart and 1W/1M/1Y range pills
- [x] Boxed "Desired Intent" — editable node description field integrated into evaluation cards
- [x] Copilot redesign — boxed "Briefing" style with premium italicized typography and glass blur
- [x] Tab separation — distinct pill-styled buttons for card navigation (Coordinates vs Actions)

### Navigation & Terminology
- [x] "Nodes" tab renamed to "Evaluate" — updated across App.tsx, theme.ts, aiService.ts, CopilotCard.tsx
- [x] PERSONA_SUBTITLES updated with Evaluate-specific subtitles per persona
- [x] INFO_TEXTS for Evaluate rewritten to frame the tab as a self-evaluation step

### Visual System
- [x] Dual light/dark mode — `DARK_THEME` / `LIGHT_THEME` tokens
- [x] `BlobBackground` — animated radial aura + star field
- [x] `GlassCard` — `expo-blur` frosted glass, adapts per theme
- [x] `OrbitalValueBadge` — arc score badge on node headers
- [x] Font weight + legibility pass for light mode
- [x] MCM-style SVG tab icons (Evaluate, Coordinates, Actions)
- [x] CopilotCard — ReflectionGraphic (persona-specific abstract gradient circles)
- [x] CopilotCard — DIVE DEEPER expanded charts (trajectory, node sliders, coordinate scatter)

### Infrastructure
- [x] AsyncStorage + Zustand `persist` — offline-first
- [x] Supabase RLS + schema formalization
- [x] 6-step onboarding flow
- [x] App icon + splash screen
- [x] Privacy policy deployed at usecalibra.com/privacy
- [x] Tasks → Actions rename (full codebase)
- [x] Evidence → Calibrations rename (full codebase)
- [x] Logbook removed (CopilotCard reflection covers the insight need)
- [x] Header taglines removed (tab title is sufficient)

---

## 🔴 Blockers — Must Fix Before App Store Submission

### ~~1. EAS project ID is empty~~ ✅ Fixed 2026-05-02
Project `@selesko/calibra` registered. ID `7be46428-1b2f-44ff-8fa6-1f17d282f851` written into `app.config.js`.

### ~~2. No `eas.json` build configuration~~ ✅ Fixed 2026-05-02
`eas.json` created with `development`, `preview`, and `production` profiles.

### ~~3. Privacy manifest is empty~~ ✅ Fixed 2026-05-02
Four `NSPrivacyAccessedAPITypes` declared in `app.config.js` (`FileTimestamp`, `SystemBootTime`, `DiskSpace`, `UserDefaults`).

### ~~4. Trajectory chart uses simulated data~~ ✅ Fixed 2026-05-02
Replaced with real `scoreHistory`-backed computation. Sparkline + full stock chart modal both use live data.

### 5. `devOverride` exposed in Profile screen
`ProfileScreen.tsx` imports and uses `devOverride` / `setDevOverride` from the store. If this unlocks restricted features or bypasses paywalls, it must be removed (or guarded behind `__DEV__`) before submission.
- **Fix:** Check what `devOverride` controls and either remove the toggle from the release UI or wrap it in `if (__DEV__)`.
- **File:** `ProfileScreen.tsx`, `useAppStore.ts`

---

## 🟡 Should Fix Before Launch (Quality / Trust)

### ~~6. Radar hit detection ignores rotation offset~~ ✅ Fixed 2026-05-05
Completely overhauled Radar chart interaction. Removed manual coordinate math and moved to native SVG `onPress` events on individual entities. Shifted rotation to `Animated.View` for stable, system-level transform handling. Hit detection is now 100% accurate regardless of spin.

### ~~7. Radar coordinate overflow~~ ✅ Fixed 2026-05-05
Coordinates are now distributed with native hit-target expansion (25px invisible circles) and the layout has been cleaned up to prevent visual stacking.

### 8. `TasksScreen.tsx` shim is dead code
`src/screens/TasksScreen.tsx` is a one-line re-export shim from the Tasks → Actions rename. No component imports it.
- **Fix:** Delete `TasksScreen.tsx`.
- **File:** `src/screens/TasksScreen.tsx`

### 9. `README_PRODUCTION.md` references old Atlas naming
The production README uses `atlas-ai` as the edge function URL and references "Atlas" throughout.
- **Fix:** Update to Calibra branding and `calibra-ai`.
- **File:** `README_PRODUCTION.md`

### 10. Empty state is undesigned — blank Evaluate screen with no nodes
A new user who gets past onboarding without adding nodes sees an empty constellation and a copilot that says "No areas added yet." There's no prompt, no example, no next step.
- **Fix:** Add an empty state to the Atlas and Evaluate screens — a ghost constellation with one CTA: "Add your first node." Consider pre-populating one example node (Mind / Body / Work) that the user can rename or delete.
- **Files:** `AtlasScreen.tsx`, `src/screens/NodesScreen.tsx`

---

## 🟢 App Store Connect Setup (Admin tasks, no code required)

- [ ] Register app in App Store Connect (`com.calibra.app`)
- [ ] Set app category — recommend **Health & Fitness** (primary) or **Productivity** (secondary)
- [ ] Set age rating — complete the age rating questionnaire (likely **4+**)
- [ ] Write app description (up to 4000 chars) and subtitle (30 chars max)
- [ ] Add keywords (100 chars max — think: life balance, habit tracker, goals, AI coach)
- [ ] Add privacy policy URL: `https://usecalibra.com/privacy`
- [ ] Upload screenshots:
  - 6.7" iPhone (required) — at least 3 screenshots
  - 5.5" iPhone (required for older devices)
  - 12.9" iPad (required if `supportsTablet: true` — currently false, so skip)
- [ ] Optional: App preview video (30 sec max, shows the cosmic graph well)
- [ ] Set up in-app purchase / subscription if monetizing (or set as free)

---

## 📋 Pre-Submission Testing Checklist

Complete this on a physical iPhone before submitting to TestFlight.

- [ ] Full new user flow: onboarding → add node → add coordinate → add action → complete action → update score
- [ ] Sign in / sign out — verify data persists across sessions
- [ ] Offline mode — kill network, verify app loads from local cache with no crash
- [ ] Light mode and dark mode — check all screens for contrast and legibility
- [ ] Nodes view: tap each node dot, verify correct node is highlighted
- [ ] Coordinates view: tap a coordinate dot, verify correct detail card appears
- [ ] Actions view: tap an action dot, verify correct detail card appears
- [ ] ExplainerModal: tap empty space in each view, verify modal opens and dismisses
- [ ] Onboarding: test from a fresh install (delete app, reinstall)
- [ ] Co-pilot: verify AI guidance loads, verify "Last Cycle" section appears on second session
- [ ] Persona: change motivator tensions, verify persona label updates on Atlas screen
- [ ] Score history: update a coordinate score twice, verify delta badge appears
- [ ] Trajectory modal: tap sparkline, verify chart opens; test all four range pills
- [ ] Evaluate tab: verify tab name, node sliders, and nav to Actions all work

---

## 🚀 Submission Steps (Order Matters)

1. Fix all 🔴 blockers above
2. Run `eas init` → get project ID
3. Create `eas.json` with production profile
4. Run `eas build --platform ios --profile production`
5. Download the `.ipa` and upload to App Store Connect via Transporter or `eas submit`
6. Complete App Store Connect metadata
7. Submit for TestFlight internal testing
8. Test on physical device (checklist above)
9. Submit for App Store review
10. Respond to any review notes within 24h (first submission often gets questions about sign-in requirement and AI usage)

---

## 🔭 Post-Launch (v1.1+)

These are the right next problems to solve — not required for v1.0, but each one addresses a real gap in what the product can do.

### Scoring has no grounding mechanism
A user setting a Coordinate to 7 and another user setting theirs to 7 may mean completely different things. Without a reference point, the trajectory chart measures subjective drift rather than real progress.
- **Direction:** Introduce a scoring prompt when a user first rates a coordinate — 2–3 questions that anchor the number to something real ("What does a 10 look like for you?"). Store the answer as a coordinate description. Revisit the prompt if the score hasn't moved in 30 days.

### Copilot is reactive — no proactive check-in
The copilot only fires when the user taps the FAB. Users who are drifting (the ones who most need it) are least likely to open it voluntarily.
- **Direction:** Scheduled local push notifications — a daily or weekly prompt timed to when the user is typically in the app. "Your system hasn't moved in 5 days. One score. One action. That's it." Pairs naturally with the trajectory chart.

### Personas feel cosmetic, not behavioral
Engineer / Seeker / Spiritual currently changes label text and subtitle copy. The underlying data model, copilot phrasing, and suggestion logic are identical across all three.
- **Direction:** Differentiate the copilot prompts sent to `calibra-ai` by persona. Engineer gets data-framed language and specific deltas. Seeker gets directional questions and pattern observations. Spiritual gets reflective, non-metric framing. The edge function already receives `persona` — use it more aggressively.

### No recovery loop for sustained low scores
If a node has been below 4 for three weeks, the app shows a red sparkline and moves on. There's no adaptive response — no simpler path, no reduced complexity, no acknowledgement that something is stuck.
- **Direction:** Add a "stuck signal" — if a node's 14-day trajectory is flat and below 5, surface a specific recovery prompt in the copilot: one small action, lower bar, no pressure framing. The goal is re-engagement, not optimization.

### Android build + Play Store submission
- **Direction:** Once iOS is approved, run `eas build --platform android --profile production`. The codebase is cross-platform — this is mostly a signing and metadata task.

### Push notifications for streak reminders / co-pilot nudges
- Pairs directly with the proactive copilot item above.

### iOS home screen widget — system balance score
- Single number. Constellation graphic. Tap to open. High impact, low implementation complexity once the core is stable.

### iCloud Keychain or Sign in with Apple
- Reduces friction vs Supabase email auth for first-time iOS users. Required if the "Sign in with Apple" option becomes a meaningful conversion lever.

### Haptic patterns differentiated per persona
- Engineer: precise single tap. Seeker: soft double. Spiritual: slow fade pulse. Low effort, high feel.

---
