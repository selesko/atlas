# Calibra — Roadmap

Last updated: 2026-05-02. This document is the canonical reference for what's done, what's next, and what's required to ship on the Apple App Store.

---

## Status: Pre-Submission Sprint

The core product is functionally complete. The remaining work is submission infrastructure, a handful of data integrity fixes, and App Store Connect setup.

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

### AI / Persona
- [x] `calibra-ai` Supabase Edge Function deployed
- [x] Node AI intent line (live, persona-aware, session-cached)
- [x] Co-pilot Last Cycle recap
- [x] Persona auto-derived from Motivator tension choices
- [x] Persona + onboarding state persisted to Supabase

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

### Visual System
- [x] Dual light/dark mode — `DARK_THEME` / `LIGHT_THEME` tokens
- [x] `BlobBackground` — animated radial aura + star field
- [x] `GlassCard` — `expo-blur` frosted glass, adapts per theme
- [x] `OrbitalValueBadge` — arc score badge on node headers
- [x] Font weight + legibility pass for light mode
- [x] MCM-style SVG tab icons (Nodes, Coordinates, Actions)

### Infrastructure
- [x] AsyncStorage + Zustand `persist` — offline-first
- [x] Supabase RLS + schema formalization
- [x] 6-step onboarding flow
- [x] App icon + splash screen
- [x] Privacy policy deployed at usecalibra.com/privacy
- [x] Tasks → Actions rename (full codebase)
- [x] Evidence → Calibrations rename (full codebase)

---

## 🔴 Blockers — Must Fix Before App Store Submission

These will either cause `eas build` to fail or get the app rejected during App Store review.

### ~~1. EAS project ID is empty~~ ✅ Fixed 2026-05-02
Project `@selesko/calibra` registered. ID `7be46428-1b2f-44ff-8fa6-1f17d282f851` written into `app.config.js`.

### ~~2. No `eas.json` build configuration~~ ✅ Fixed 2026-05-02
`eas.json` created with `development`, `preview`, and `production` profiles.

### ~~3. Privacy manifest is empty~~ ✅ Fixed 2026-05-02
Four `NSPrivacyAccessedAPITypes` declared in `app.config.js` (`FileTimestamp`, `SystemBootTime`, `DiskSpace`, `UserDefaults`).

### ~~4. Trajectory chart uses simulated data~~ ✅ Fixed 2026-05-02
Fake data removed. Real `scoreHistory`-backed sparkline added to System Status card. Green/rose color indicates 7-day trend direction.

### 5. `devOverride` exposed in Profile screen
`ProfileScreen.tsx` imports and uses `devOverride` / `setDevOverride` from the store. If this unlocks restricted features or bypasses paywalls, it must be removed (or guarded behind `__DEV__`) before submission.
- **Fix:** Check what `devOverride` controls and either remove the toggle from the release UI or wrap it in `if (__DEV__)`.
- **File:** `ProfileScreen.tsx`, `useAppStore.ts`

---

## 🟡 Should Fix Before Launch (Quality / Trust)

These won't cause rejection but will affect first impressions and user trust.

### 6. Radar hit detection ignores rotation offset
The Nodes view hit detection in `AtlasScreen.tsx` computes positions from static `radarPts` — but the canvas is continuously rotating via `radarRotation`. At any given moment the visual positions of the nodes don't match the positions used for hit testing. Tapping a node will often select the wrong one (or nothing).
- **Fix:** Read the current rotation value at tap time and apply the inverse rotation to the tap coordinates before comparing against `radarPts`, or use a snapshot of the rotation angle at the moment of press.
- **File:** `AtlasScreen.tsx`

### 7. Radar coordinate overflow
`Radar.tsx` positions coordinates at `radius = 60 + (i % 3) * 30` (three ring positions). With 6+ coordinates per node, items stack on top of each other and the 40px tap radius causes misfires. Need either more ring positions, angular distribution, or a density-aware layout.
- **Fix:** Distribute coordinates by angle as well as radius, similar to how nodes are distributed in the Nodes view. Or cap visible coordinates and add a scroll/expand mechanism.
- **File:** `Radar.tsx`

### 8. `TasksScreen.tsx` shim is dead code
`src/screens/TasksScreen.tsx` is a one-line re-export shim from the Tasks → Actions rename. No component in the codebase imports it. Safe to delete.
- **Fix:** Delete `TasksScreen.tsx`.
- **File:** `src/screens/TasksScreen.tsx`

### 9. `README_PRODUCTION.md` references old Atlas naming
The production README uses `atlas-ai` as the edge function URL and references "Atlas" throughout. Update to Calibra branding and `calibra-ai`.
- **File:** `README_PRODUCTION.md`

---

## 🟢 App Store Connect Setup (Admin tasks, no code required)

These are all done in App Store Connect / Apple Developer at appstoreconnect.apple.com.

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

These are good ideas but not required for initial submission.

- Fix trajectory chart to use real `scoreHistory` data (moved from blocker if v1.0 ships without the chart)
- Push notifications for streak reminders / co-pilot nudges
- Widget (iOS home screen) showing system balance score
- iCloud Keychain or Sign in with Apple (reduces friction vs Supabase email auth)
- Haptic patterns differentiated per persona (Engineer = precise, Spiritual = soft)
- Android build + Play Store submission

---
