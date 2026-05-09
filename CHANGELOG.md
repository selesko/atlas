# Calibra Changelog

---

## [action-card-v2] — 2026-05-09

### Edit Action Card — 5 design improvements
- **TITLE field:** `fontSize` 16→17, `letterSpacing` 0.3, white text — visually distinguishes it as the primary field.
- **Effort picker:** Selected pill now uses the action's node color instead of the fixed accent blue. Consistent with the rest of the system's color philosophy.
- **NOTES field:** Replaced `taskEditNotes` style with shared `inputBox` + `inputBoxText` (bordered box, `rgba(255,255,255,0.03)` bg). Both edit cards now use the same input surface.
- **PRIORITY row:** Moved below NOTES. It's a secondary concern and now sits at the natural bottom of the form. Star icon and label also adopt node color when active.
- **SAVE button:** Now uses `nodeColor` for border and text (same pattern as coord edit card's DONE button). Falls back to muted white when no node is selected.
- **Architecture:** Refactored IIFE pattern — `selNode`, `nodeColor`, `coords`, `selCoord` computed once at the top of the block instead of duplicated inside two separate IIFEs.
**Why:** Action card had three inconsistencies vs the coord card: fixed accent color on effort/priority, mismatched notes field style, and a colorless SAVE button.
**Files touched:** `App.tsx`

---

## [slider-styles] — 2026-05-09

### Slider style consistency — App.tsx matches NodesScreen
- **Updated:** `sliderLine` 2px→3px height; `sliderFill` top 11→10, height 2→3; `sliderHandle` 12×12→18×18, borderRadius 6→9, top 6→3, shadowOpacity 0.8→0.9, shadowRadius 10→12; `sliderHandleInner` 6×6→8×8.
- **Added:** `coordScore` style to App.tsx StyleSheet (`fontSize: 26, fontWeight: '200'`) — was referenced in coord edit card JSX but missing from StyleSheet.
**Why:** Coordinate edit card slider was visually inconsistent with the Evaluate page (NodesScreen) after the handle/track upgrade was applied only to NodesScreen.
**Files touched:** `App.tsx`

---

## [coord-card-v2] — 2026-05-08

### Edit Coordinate Card — Reference Points removed, Actions added, Evaluate labels
- **Removed:** Reference Points section (3 LVL input boxes) and the CURRENT GROUNDING status line. Feature deferred to a later "deepen this coordinate" flow — too cognitively demanding on first use. Data model (`Goal.references`) preserved.
- **Added:** ACTIONS section at the bottom of the card — lists all non-archived actions for the coordinate with a tap-to-toggle completion dot and effort badge on the right.
- **Added:** "EVALUATE" label in small gray text above every slider — in the Edit Coordinate card and in the Evaluate screen coordinate rows.
- **Future features:** Documented Reference Points in `CLAUDE.md` under `## Future Features`.
**Why:** Reference points required too much upfront work. Actions are more immediately useful in the editing context.
**Files touched:** `App.tsx`, `src/screens/NodesScreen.tsx`, `CLAUDE.md`

---

## [card-consistency] — 2026-05-08

### Edit Card Visual Consistency
- **EDIT COORDINATE card:** Added consistent header ("EDIT COORDINATE" label + ✕ close button with divider). Replaced the bare `coordDetailName` TextInput used as a title with a proper `editFormLabel` "NAME" + `editFormInput` field, matching the node card pattern. Replaced `calibrationFeedLabel` with `editFormLabel` on "DESIRED INTENT" and "REFERENCE POINTS" sections.
- **EDIT ACTION card:** Added consistent header ("EDIT ACTION" label + ✕ close button with divider). Restructured bottom action row from left/right split layout to full-width SAVE button + ARCHIVE/DELETE centered below — matching the coordinate edit card pattern. Renamed primary button from "DONE" to "SAVE" (action card uses `saveActionEdit()` to commit form state, unlike coordinate which auto-saves).
- **New shared styles:** `cardHeader`, `cardHeaderTitle`, `cardHeaderClose`, `cardHeaderCloseText` — reusable across both cards.
**Why:** Cards had three different header patterns, two different label styles, and inconsistent button layouts. Unified so every edit surface reads the same.
**Files touched:** `App.tsx`

---

## [delete-account] — 2026-05-08

### Delete Account — Apple compliance
- Added `deleteAccountData(userId)` to `sync.ts` — deletes tasks, coordinates, nodes, and profile rows in dependency order, then calls `supabase.auth.signOut()`.
- Added `resetStore()` to `useAppStore` — clears all local Zustand state and removes the AsyncStorage key.
- Added DELETE ACCOUNT button to the Account section of ProfileScreen, visible only when signed in. Sits alongside SIGN OUT.
- Confirmation modal requires typing "DELETE" before the confirm button activates. Shows loading spinner during deletion. Displays error message on failure.
- On success: all Supabase data deleted, local store wiped, user returned to sign-in state.
**Why:** Apple App Store requires in-app account deletion for any app that supports account creation (policy enforced since June 2022). Submission will be rejected without it.
**Files touched:** `src/services/sync.ts`, `src/stores/useAppStore.ts`, `src/screens/ProfileScreen.tsx`

---

## [website] — 2026-05-08

### Website Launch — usecalibra.com
- **Landing page live:** Added `vercel.json` with `outputDirectory: '_site'` and no-op build/install commands. Fixes 20+ consecutive ERROR deployments caused by Vercel trying to build the Expo package.json as a web project.
- **`_site/index.html`:** Full Calibra landing page — dark aesthetic, animated orbital logo, feature grid, philosophy section, App Store CTA placeholder.
- **`_site/privacy/index.html`:** Privacy policy page with back-link to main site.
- **Domain:** `usecalibra.com` and `www.usecalibra.com` connected via Cloudflare DNS → Vercel. SSL issued.
- **Email routing:** `privacy@usecalibra.com` and `hello@usecalibra.com` active via Cloudflare Email Routing, forwarding to personal Gmail.

---

## [7dc923b] — 2026-05-05

### Radar Chart — Interaction & Stability
- **Native Hit-Testing:** Replaced manual coordinate math with native SVG `onPress` events. Hit detection is now 100% accurate for all Nodes, Coordinates, and Actions, regardless of rotation angle.
- **Transform Re-engineering:** Shifted orbital rotation from internal SVG groups to the parent `Animated.View`. This ensures perfect center-axis alignment and eliminates visual "wobble" or clipping.
- **Hit-Target Expansion:** Added invisible 25px/40px touch-target buffers to every orbital entity, ensuring reliable interaction on mobile devices.

### UI / UX Polish — High Fidelity
- **Trajectory Modal:** Redesigned from a bottom-sheet into a centered, floating focal card. Features 24px rounded corners, boxed border framing, and removal of the legacy drag handle for a cleaner "Mission Control" aesthetic.
- **Copilot Card:** Redesigned the AI insight area with a "Briefing Box" aesthetic. Applied premium italicized typography and glassmorphic blur to differentiate AI guidance from core system data.
- **Tab Navigation:** Replaced joined segment controls with distinct, pill-styled buttons. Improved visual separation and touch-target clarity for "Coordinates vs Actions" and "Evaluate vs Actions" tabs.

### Behavioral Grounding — Workflow Cleanup
- **Streamlined Evaluators:** Removed redundant "+ ADD ACTION" and "Go to Actions" buttons from coordinate cards. The system now enforces a clearer separation: Evaluate for grounding, Actions for execution.
- **Editable Desired Intent:** Enclosed the Node Intent description in a boxed, editable field within both the expanded Node view and the Coordinate edit modal. This allows for real-time strategy adjustment during calibration.

### Bug Fixes
- Fixed `ReferenceError` in `NodesScreen.tsx` by importing the missing `TextInput` component.
- Fixed `SyntaxError` in `Radar.tsx` caused by a duplicate variable declaration during the animation refactor.

---

## [fb4b1e2] — 2026-05-04

### Atlas Page — In-Card Editing (no navigation away)
- Node chart card: tabbed COORDINATES / ACTIONS view; coordinate sliders adjustable in-card; actions list toggleable and addable inline
- Coordinate chart card: tabbed EVALUATE / ACTIONS view; EVALUATE tab shows integrity slider; ACTIONS tab shows toggleable list + inline add with effort toggle per action
- Action chart card: fully redesigned — effort toggle (EASY / MEDIUM / HEAVY), node dropdown, coordinate dropdown, MARK AS DONE button; card height matches node/coordinate cards; fixed height so card doesn't resize between tabs
- All three cards stay on the Atlas page — no navigation buttons to other screens
- Fixed: add action and toggle action now use `useAppStore.getState()` so UI updates immediately without stale closure data

### Atlas Page — System Status
- Partial glow dashes for decimal scores (e.g. 7.2 shows 7 full dashes + 1 partial at 20% fill)
- Renamed label per persona: SYSTEM STATUS (Engineer), CURRENT ALIGNMENT (Seeker), INNER HARMONY (Spiritual)
- 7-day trend delta moved into the trend line card

### Atlas Page — Other
- Removed Atlas Guidance card (conflicts with AI Copilot)

### Nodes Page
- Node title: dynamic letter spacing (condensed for long names) + `numberOfLines={1}` truncation in both collapsed and expanded states — no more text wrapping or layout push
- Filter archived nodes and coordinates from all views

### Actions Page
- Action edit card redesigned: sleek Node dropdown, sleek Coordinate dropdown, ARCHIVE/DELETE as small muted text links, DONE button right-aligned
- Fixed: black text on dark background (THEME.text undefined on legacy token — replaced with hardcoded light values)
- Empty state messages context-aware (focus mode vs. node filter vs. no actions)

### Archive System (new)
- `archived?: boolean` added to Node and Goal types
- Store: `archiveNode`, `restoreNode`, `deleteNode`, `archiveGoal`, `restoreGoal`, `deleteGoal`, `restoreAction`, `updateActionEffort` added
- Archive/delete buttons on node edit modal and coordinate edit card (small muted links, not prominent)
- Profile page: Archive section shows all archived nodes, coordinates, and actions with RESTORE buttons

### Profile Page
- Removed Context card (CONTEXT text area)

### Store
- `updateActionEffort` — updates effort level on any action, syncs to Supabase
- `saveActionEdit` now accessible from AtlasScreen for reassigning action node/coordinate

### Copilot
- Loading text is now persona-aware: "Analyzing your data···" (Engineer), "Mapping your path···" (Seeker), "Reading your energy···" (Spiritual)

### Radar Component
- Actions now carry `__goalName` field so the Atlas action card can display coordinate context

---

## Prior to changelog

- Initial Calibra codebase: Atlas, Nodes, Actions, Profile screens
- Zustand store with AsyncStorage persistence and Supabase sync
- Persona system (Engineer, Seeker, Spiritual)
- OrbitalValueBadge, GlassCard, Radar, CopilotCard components
- PanResponder sliders, SVG orbital graphics, 7-day sparkline trajectory
