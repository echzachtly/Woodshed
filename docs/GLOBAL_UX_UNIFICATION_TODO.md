# Global UX Unification Engineering TODO

This TODO converts the roadmap into implementation-ready phases with explicit system impact, migration tasks, test requirements, and completion criteria.

## Phase 0 — Alignment and Guardrails (Current)

### Goals

- lock architecture direction before implementation
- define migration safety boundaries and parity requirements

### Affected Systems/Components

- `docs/woodshed_global_ux_unification_roadmap.md`
- architecture and UX docs under `docs/`
- planning docs for this initiative

### Implementation Tasks

- publish `GLOBAL_UX_UNIFICATION_IMPLEMENTATION_PLAN.md`
- publish this phased engineering TODO
- define shared behavior contracts to extract in Phase 1

### Migration Tasks

- identify legacy "lock" terminology and replacement path to Practice/Edit language
- define temporary compatibility policy for persisted project/practice data

### Testing Requirements

- no feature implementation tests in this phase
- draft required regression matrix for later phases

### Regression Risks

- starting implementation before contract alignment
- introducing broad changes without rollback points

### Completion Criteria

- planning docs complete
- clarifying questions answered
- scope and constraints explicitly approved

### Phase 0 Baseline Lock Snapshot (2026-05-15)

- [x] Canonical behavior references added:
  - `docs/GLOBAL_INTERACTION_PHILOSOPHY.md`
  - `docs/GLOBAL_REGION_SYSTEM.md`
  - `docs/PLAYBACK_STATE_MACHINE.md`
  - `docs/GLOBAL_MODE_TRANSITIONS.md`
  - `docs/TIMELINE_INTERACTION_CONTRACT.md`
- [x] First extraction pass started with pure shared helpers (no persistence/schema mutations):
  - `lib/interaction/timeline-playback-intent.ts`
  - `lib/focus-playback-segment.ts` deterministic focus deletion fallback helper
- [x] Cross-surface adoption started:
  - YouTube timeline playback intent now consumes shared resolver via adapter
  - Upload neutral timeline/minimap seek path now consumes shared resolver

Known parity gap intentionally deferred from this first extraction pass:

- Main WaveSurfer direct click intent still routes through native seek behavior and is not yet fully wired through the shared timeline intent resolver.

Follow-up status (2026-05-15):

- [x] WaveSurfer direct-click parity pass completed in `components/woodshed-workspace.tsx` via a narrow adapter that routes direct click seconds through `resolveTimelinePlaybackIntent`.

## Phase 1 — Shared Behavioral Contract Extraction

### Goals

- centralize interaction and playback intent as pure shared logic
- reduce workspace-specific behavioral drift

### Affected Systems/Components

- `store/woodshed-store.ts`
- `lib/playback-loop-rail.ts`
- `lib/focus-playback-segment.ts`
- `lib/practice-loop-mode.ts`
- `lib/woodshed-enter-region-edit.ts`
- `lib/youtube/neutral-timeline-playback-intent.ts`
- new shared modules under `lib/interaction/` and `lib/playback/` (to be created)

### Implementation Tasks

- extract pure intent resolvers for:
  - timeline click/tap intent
  - Practice/Edit transition rules
  - scope transitions and restart targets
  - focus segment fallback precedence
- standardize action naming around Practice/Edit semantics
- add shared utilities for state derivation consumed by both workspaces

### Migration Tasks

- replace duplicated logic in WaveSurfer and Neutral Timeline pathways with shared helpers
- keep existing component props stable while swapping internal behavior sources

### Testing Requirements

- unit tests for extracted resolvers
- regression tests for existing playback loop rail behavior
- state-invariant tests for active loop/segment coherence

### Regression Risks

- accidental behavior changes when extracting logic from workspace components
- hidden coupling between UI and store updates

### Completion Criteria

- both workspaces call shared behavior resolvers for core intent mapping
- no known playback/mode regressions in smoke tests

### Manual parity test notes (2026-05-15)

Manual verification checklist for this pass:

- Uploaded audio: with Practice Section loop active, clicking outside the active section should resolve to Play Through and seek to clicked time.
- Uploaded audio: clicking inside active Practice Section body (outside Focus Loop bounds) should resolve to Practice Section Loop behavior.
- Uploaded audio: clicking Focus Loop area while in section loop should promote to Focus Loop scope via shared resolver decision.
- Regression checks to run:
  - Shift+drag create Focus Loop
  - Practice Section drag/resize
  - Focus Loop drag/resize
  - wheel zoom cursor anchoring
  - minimap seek
  - mobile practice flow smoke

### Phase 1C restart target unification (2026-05-15)

Status: in progress (extraction + cross-surface wiring landed; manual parity re-run pending).

Files changed in this pass:

- `lib/playback/restart-target.ts` (new pure restart resolver)
- `lib/playback/restart-target.test.ts` (new restart contract tests)
- `components/woodshed-workspace.tsx` (uploaded audio desktop/mobile restart paths use shared resolver)
- `components/youtube-workspace.tsx` (YouTube desktop restart path uses shared resolver)
- `lib/playback-loop-rail.ts` (`getRestartSeekSeconds` now delegates to shared resolver)

Tests added:

- `lib/playback/restart-target.test.ts`
  - Focus Loop restart target
  - Practice Section restart target
  - Play Through restart target (transport-start behavior)
  - stale Focus Loop id deterministic fallback
  - missing active Practice Section deterministic fallback
  - boundary clamping

Manual restart checklist (Phase 1C):

- [ ] Uploaded audio: Focus Loop scope restart returns to active Focus Loop start
- [ ] Uploaded audio: Practice Section Loop scope restart returns to active Practice Section start
- [ ] Uploaded audio: Play Through restart does not jump to stale loop/focus rail starts
- [ ] YouTube project: repeat the same three restart checks above
- [ ] Mobile practice flow: restart remains adjacent/primary and behavior matches resolved scope
- [ ] Regression: click outside Practice Section -> Play Through, then restart
- [ ] Regression: delete active Focus Loop, then restart
- [ ] Regression: switch projects, then restart

Remaining restart parity gaps / risks:

- Manual parity sweep across upload + YouTube + mobile is still required for final Phase 1C sign-off.
- `DesktopTransportBar`/mobile restart labels still describe phrase/focus semantics and do not yet explicitly communicate Play Through transport-start restart behavior.
- Deterministic fallback for missing active Practice Section now picks earliest valid phrase; this should be validated against intended UX during manual pass.

## Phase 2 — Playback Intelligence Unification

### Goals

- make playback behavior consistent across surfaces and media sources
- ensure restart and scope transitions follow one rule set

### Affected Systems/Components

- `lib/playback-loop-rail.ts`
- `lib/focus-playback-segment.ts`
- `lib/playhead-sync.ts`
- `components/desktop-transport-bar.tsx`
- `components/mobile-practice-panel.tsx`
- `components/woodshed-workspace.tsx`
- `components/youtube-workspace.tsx`
- `lib/audio-engine.ts`

### Implementation Tasks

- unify play-through, phrase-loop, and focus-loop transition behavior
- normalize restart target resolution for all contexts
- align timeline click behavior to the same playback-intent rules on both surfaces
- verify tempo/pitch behavior remains consistent via `MediaPlaybackSurface`

### Migration Tasks

- replace workspace-local playback branching with shared playback helpers
- preserve existing persistence behavior for loop mode and practice scope

### Testing Requirements

- unit tests for transition matrix and restart behavior
- integration smoke tests for transport controls desktop/mobile
- manual tests for edge clicks near boundaries and scope changes

### Regression Risks

- restart landing at incorrect time after mode/scope changes
- inconsistent scope after selecting/deleting focus loops

### Completion Criteria

- playback transition matrix passes for both WaveSurfer and YouTube workspace
- restart behavior is deterministic and documented

## Phase 3 — Practice/Edit Mode and Authoring Intent Unification

### Goals

- globally adopt Practice/Edit interaction law
- remove remaining lock-model ambiguity

### Affected Systems/Components

- `lib/woodshed-enter-region-edit.ts`
- `lib/shift-waveform-authoring.ts`
- `lib/shift-waveform-authoring-gesture.ts`
- `components/woodshed-workspace.tsx`
- `components/neutral-timeline/neutral-timeline-prototype.tsx`
- `components/desktop-inspector-panel.tsx`
- `components/loop-sidebar.tsx`
- mobile edit-mode pathways in mobile components

### Implementation Tasks

- enforce intentional gesture entry into structural edit context
- align explicit edit controls with inferred intent behavior
- unify mode naming and helper usage across UI and store interactions
- ensure accidental edits remain blocked in Practice Mode

### Migration Tasks

- phase out residual lock terminology in code paths and UI copy
- keep temporary compatibility aliases if needed until full cutover

### Testing Requirements

- unit tests for mode transition helpers
- manual gesture tests:
  - shift-drag create
  - double-click edit entry
  - return from edit to practice flow

### Regression Risks

- accidental edit enablement on mobile practice screens
- blocked intentional authoring due to over-restrictive guards

### Completion Criteria

- all intentional authoring paths follow shared Practice/Edit rules
- no lock-model-only behavior remains in active interaction paths

## Phase 4 — Region Hierarchy and Visual-State Unification

### Goals

- unify phrase/focus tier semantics and interaction states globally
- keep source-specific render engines while matching behavior and hierarchy

### Affected Systems/Components

- `lib/wavesurfer-region-appearance.ts`
- `app/globals.css`
- region creation/update wiring in `components/woodshed-workspace.tsx`
- region behavior in `components/neutral-timeline/neutral-timeline-prototype.tsx`
- `components/neutral-timeline/synthetic-timeline-regions.ts`

### Implementation Tasks

- centralize derivation of region tier states:
  - locked
  - active
  - editing
  - selected
  - editable
- align phrase-structural vs focus-foreground hierarchy semantics
- preserve mobile read-only overlay behavior for focus regions

### Migration Tasks

- migrate scattered class-state branching to shared tier derivation helpers
- keep fallback CSS behavior during transition to avoid visual breakage

### Testing Requirements

- visual regression pass for phrase/focus layering states
- manual handle-drag tests for phrase/focus editable states
- mobile read-only focus selection checks via chips

### Regression Risks

- z-index/state mismatch causing incorrect hit testing
- visual hierarchy regressions reducing nested-region clarity

### Completion Criteria

- tier states are derived from one shared source of truth
- phrase/focus hierarchy remains readable across desktop and mobile

## Phase 5 — Layout Hierarchy and Workflow Cohesion

### Goals

- reinforce waveform dominance and contextual controls
- reduce workflow friction without changing source-specific rendering identity

### Affected Systems/Components

- `components/desktop-header-bar.tsx`
- `components/desktop-transport-bar.tsx`
- `components/desktop-inspector-panel.tsx`
- `components/mobile-practice-panel.tsx`
- `components/mobile-*sheet*.tsx`
- `components/mini-map.tsx`
- `components/workspace-empty-state.tsx`

### Implementation Tasks

- align desktop and mobile control hierarchy to practice-first intent
- ensure contextual panels do not compete with timeline stage
- refine affordance density and sequencing around restart, mode, and section/focus actions
- preserve quick project and phrase access patterns

### Migration Tasks

- migrate layout conditionals that encode old interaction assumptions
- keep reversible toggles for major hierarchy shifts until validated

### Testing Requirements

- manual UX walkthroughs for desktop authoring and mobile practice flows
- verify safe-area/PWA layout stability on mobile standalone mode
- verify no regressions in onboarding trigger visibility

### Regression Risks

- introducing visual consistency but breaking interaction consistency
- reduced discoverability of critical controls

### Completion Criteria

- waveform remains dominant in both form factors
- core practice workflow requires fewer context switches

## Phase 6 — Persistence, Compatibility, and Stabilization

### Goals

- guarantee migration safety for existing projects and practice state
- finalize release readiness with regression certification

### Affected Systems/Components

- `lib/project-db.ts`
- `lib/cloud-projects/client.ts`
- `lib/practice-state-persist.ts`
- `lib/youtube/youtube-dexie-project.ts`
- workspace hydration/save flows in both workspaces
- onboarding persistence modules under `lib/onboarding/`

### Implementation Tasks

- verify backward-compatible load/hydrate behavior after interaction refactors
- add migration-safe normalization where new fields/rules are introduced
- finalize rollback and feature-flag strategy for staged rollout

### Migration Tasks

- test old saved projects against new behavior contracts
- ensure cloud/local parity for loop/practice state interpretation

### Testing Requirements

- automated persistence roundtrip tests (local, cloud, youtube-local)
- cross-session hydration tests
- manual destructive-operation tests (delete loop/segment, switch project mid-session)

### Regression Risks

- silent data drift during normalize/hydrate paths
- project-switch edge cases causing stale selection/scope state

### Completion Criteria

- persistence roundtrips are stable across all supported project types
- regression matrix signed off for desktop/mobile and both playback surfaces

## Global Regression Matrix (Required Across Phases)

- playback mode transitions and restart semantics
- phrase/focus creation, edit, rename, delete
- desktop and mobile mode transitions
- zoom/pan parity (wheel, drag, pinch, minimap)
- project load/save/switch across demo/local/cloud/youtube
- onboarding milestone trigger correctness
- PWA standalone mobile layout and safe-area behavior
