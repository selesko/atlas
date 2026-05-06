# Calibra Changelog

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
