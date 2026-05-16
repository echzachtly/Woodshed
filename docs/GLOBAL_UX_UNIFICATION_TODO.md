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

Status: complete (manual parity passed across uploaded audio, YouTube, and mobile).

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

- [x] Uploaded audio: Focus Loop scope restart returns to active Focus Loop start
- [x] Uploaded audio: Practice Section Loop scope restart returns to active Practice Section start
- [x] Uploaded audio: Play Through restart does not jump to stale loop/focus rail starts
- [x] YouTube project: repeat the same three restart checks above
- [x] Mobile practice flow: restart remains adjacent/primary and behavior matches resolved scope
- [x] Regression: click outside Practice Section -> Play Through, then restart
- [x] Regression: delete active Focus Loop, then restart
- [x] Regression: switch projects, then restart

Remaining restart parity gaps / risks:

- `DesktopTransportBar`/mobile restart labels still describe phrase/focus semantics and do not yet explicitly communicate Play Through transport-start restart behavior.
- Deterministic fallback for missing active Practice Section now picks earliest valid phrase; this should be validated against intended UX during manual pass.

### Phase 1D playback scope normalization and stale-state cleanup (2026-05-15)

Status: complete (manual checklist passed).

Files changed in this pass:

- `lib/playback/playback-scope-normalization.ts` (new canonical scope normalization helper)
- `lib/playback/playback-scope-normalization.test.ts` (new normalization contract tests)
- `store/woodshed-store.ts` (`removeLoop`, `removeSegment`, and hydrated preference application now normalize via shared helper)
- `lib/practice-state-persist.ts` (hydration-time practice-state normalization now delegates to shared helper)
- `lib/playback/restart-target.ts` (restart resolution now consumes normalized playback scope)
- `lib/playback-loop-rail.ts` (loop rail derivation now uses normalized scope first)

Tests added:

- `lib/playback/playback-scope-normalization.test.ts`
  - repeat off -> Play Through semantics
  - stale active Practice Section deterministic fallback
  - stale active Focus Loop deterministic fallback
  - focus scope without valid Focus Loops degrades to Practice Section loop
  - no loops degrades to Play Through
  - deletion-style stale id cleanup

Manual checklist (Phase 1D):

- [x] Uploaded audio: delete active Focus Loop -> deterministic fallback scope -> restart target still correct
- [x] Uploaded audio: delete active Practice Section -> no stale playback scope/id remains
- [x] YouTube: repeat deletion and scope fallback checks
- [x] Project switching between different section/focus structures preserves no stale focus/section behavior
- [x] Save/reload project with active focus/section state hydrates coherent scope

Remaining gaps / risks (Phase 1D):

- A few non-critical callsites still perform local state shaping before normalization (acceptable for now, but can be reduced later).

### Phase 1E Practice/Edit mode transition helper extraction (2026-05-15)

Status: complete (manual verification passed and accepted across upload + YouTube + mobile scope for this phase).

State-based existing-region double-click decision (desktop uploaded-audio):

- background double-click never creates a Practice Section
- existing-region double-click is mode-aware:
  - Practice Mode -> enter Edit Mode for clicked Practice Section / Focus Loop context
  - Edit Mode -> exit to Practice Mode and clear editable/unlocked state

Phase 1F deferral decision (handle-path auto-entry):

- Resize/trim handles do **not** auto-enter Edit Mode in this phase.
- Edit Mode entry remains intentional via:
  - double-click existing Practice Section / Focus Loop
  - lock/mode button
  - explicit Edit controls
- Once already in Edit Mode, phrase/focus handles may be used normally.
- Shift+drag remains the canonical creation gesture.
- Empty-waveform double-click creates nothing.
- Reason: protected Practice Mode and intentional structural editing are prioritized over implicit handle-path mode entry.

Files changed in this pass:

- `lib/interaction/practice-edit-mode.ts` (new canonical Practice/Edit transition helper and lock/unlock compatibility mapping)
- `lib/interaction/practice-edit-mode.test.ts` (new transition contract tests)
- `lib/woodshed-enter-region-edit.ts` (double-click structural entry + practice-mode alias now consume shared helper)
- `store/woodshed-store.ts` (`setProjectMeta` now applies defensive Practice/Edit cleanup on project/media context switch)
- `components/woodshed-workspace.tsx` (desktop Shift+drag entry, explicit transport edit/done, and mobile explicit edit/done now consume shared transition helper; WaveSurfer double-click quick-create removed; existing-region double-click now routes to edit-entry only)
- `components/woodshed-workspace.tsx` (state-based existing-region double-click handler (`handleExistingRegionDoubleClick`) now shares the same enter/exit behavior as the lock/mode toggle; Practice Section dblclick reliability hardened with region+time fallback target resolution across remounts)
- `components/youtube-workspace.tsx` (synthetic timeline edit-mode derivation + explicit transport edit/done now consume shared transition helper)

Tests added:

- `lib/interaction/practice-edit-mode.test.ts`
  - desktop Shift+drag intent may enter Edit Mode
  - desktop double-click structural edit intent may enter Edit Mode
  - desktop explicit edit action may enter Edit Mode
  - mobile tap/drag/chip selection does not auto-enter Edit Mode
  - mobile explicit edit action may enter Edit Mode
  - explicit Done/exit clears editable + unlock state
  - project/media switch defensively exits Edit Mode
  - lock/unlock compatibility mapping remains stable

Manual checklist (Phase 1E):

- [x] Desktop uploaded audio: Practice Mode blocks accidental drag/resize edits
- [x] Desktop uploaded audio: double-click empty waveform space does not create a new Practice Section
- [x] Desktop uploaded audio: Shift+drag intentionally creates Focus Loop and enters/uses Edit Mode correctly
- [x] Desktop uploaded audio: double-click is limited to edit entry on existing Practice Section / Focus Loop only
- [x] Desktop uploaded audio: Done/exit returns to protected Practice Mode
- [x] Desktop YouTube: Shift+drag / edit entry behavior matches global intent where supported
- [x] Desktop YouTube: no regression to timeline playback click behavior
- [x] Mobile: tap/drag/chip selection does not implicitly enter Edit Mode
- [x] Mobile: explicit Edit control enters Edit Mode
- [x] Mobile: Done/exit returns to Practice Mode
- [x] Mobile: practice playback remains fast and protected
- [x] Regression: switch projects while in Edit Mode leaves no stale editable/unlocked state
- [x] Regression: save/reload does not hydrate into unsafe accidental edit posture

Manual test results (Phase 1E follow-up):

- [x] Desktop uploaded audio: double-click empty waveform background does not create a new Practice Section.
- [x] Desktop uploaded audio: double-click existing Practice Section enters Edit Mode (WaveSurfer region-element + delegated dblclick edit-entry wiring).
- [x] Desktop uploaded audio: double-click existing Focus Loop enters Focus edit context (WaveSurfer region-element + delegated dblclick edit-entry wiring).
- [x] Desktop uploaded audio: lock/mode button exits Focus/phrase edit state back to Practice Mode (mode toggle no longer depends on Advanced-tab-only flow).
- [x] Desktop uploaded audio: after Shift+drag Focus Loop creation, lock/mode button reliably returns to Practice Mode (stuck-edit regression fix validated).
- [x] Desktop uploaded audio: Practice Section double-click reliably toggles Practice<->Edit state (including remount-sensitive paths).

Implementation completion notes (Phase 1E):

- Shared Practice/Edit transition law is now centralized in `lib/interaction/practice-edit-mode.ts` and consumed by WaveSurfer + YouTube interaction pathways.
- Existing-region double-click edit-entry and Shift+drag authoring parity are wired through shared helpers, with protected Practice Mode as the default structural posture.
- Added tests in `lib/interaction/practice-edit-mode.test.ts`; focused Vitest run passed (`8/8` tests) in the final verification pass.
- Remaining intentional deferral: Phase 1F handle-path auto-entry remains out of scope by design (no implicit handle-path auto-entry from Practice Mode).

Remaining gaps / risks (Phase 1E):

- Canonical waveform creation gesture is now Shift+drag; double-click quick-create is intentionally removed for uploaded-audio WaveSurfer.
- Phase 1F handle-path auto-entry cleanup is deferred/non-goal for this phase; implicit resize/trim handle entry to Edit Mode is intentionally disabled.
- Internal state naming still includes lock/unlock aliases by design; full naming migration is intentionally deferred.

### Phase 2 visual-state derivation extraction (2026-05-15)

Status: complete (shared visual-state derivation fully adopted for WaveSurfer + Neutral Timeline parity paths; manual verification passed and accepted).

Files changed in this pass:

- `lib/regions/region-visual-state.ts` (new canonical region visual/interaction state derivation helper)
- `lib/regions/region-visual-state.test.ts` (new deterministic derivation contract tests)
- `lib/wavesurfer-region-appearance.ts` (foreground + z-tier semantics now consume shared derivation helper)
- `components/woodshed-workspace.tsx` (WaveSurfer phrase/focus editability, foreground, and activity derivation now consume shared helper)
- `components/neutral-timeline/neutral-timeline-prototype.tsx` (phrase/focus active/foreground/dimmed/z-tier derivation now consumes shared helper)
- `components/youtube-workspace.tsx` (passes `loopPracticeScope` into neutral timeline for shared parity derivation)

Tests added:

- `lib/regions/region-visual-state.test.ts`
  - Practice Section state derivation
  - Focus Loop state derivation
  - Practice vs Edit mode derivation
  - focus-scope foreground derivation
  - playback-emphasis derivation
  - mobile readonly derivation
  - deterministic z-tier derivation
  - no editable state in Practice Mode

Manual checklist (Phase 2 visual-state derivation):

- [x] Desktop uploaded audio: Practice Sections remain visible as structural containers
- [x] Desktop uploaded audio: Focus Loops feel visually nested under Practice Sections
- [x] Desktop uploaded audio: active Focus Loop foregrounds correctly in focus scope
- [x] Desktop uploaded audio: enter/exit Edit Mode updates editability correctly
- [x] Desktop uploaded audio: inactive regions de-emphasize but remain legible
- [x] Desktop YouTube: neutral timeline hierarchy semantics match upload-side semantics
- [x] Mobile: focus overlays remain lightweight/readable
- [x] Mobile: no accidental edit affordances appear in Practice Mode
- [x] Regression: double-click edit toggle still works
- [x] Regression: Shift+drag creation still works
- [x] Regression: playback click intent still works
- [x] Regression: restart still works

Implementation completion notes (Phase 2 visual-state derivation):

- Shared visual-state derivation extraction is complete in `lib/regions/region-visual-state.ts`, and both WaveSurfer appearance wiring and Neutral Timeline region hierarchy wiring consume the same state contract.
- WaveSurfer/Neutral Timeline parity wiring is complete for practice/edit protection, active/foreground focus behavior, de-emphasis, and z-tier semantics.
- Added tests in `lib/regions/region-visual-state.test.ts`; focused Vitest run passed (`6/6` tests) in the final verification pass.
- Known deferred gaps remain intentional: renderer-specific paint tokens and local neutral-timeline chrome tuning still exist, but behavioral derivation parity is centralized and stable.

Remaining gaps / risks (Phase 2 visual-state derivation):

- A few renderer-specific style primitives remain local (intentional for now); derivation is centralized, but paint tokens are still split between WaveSurfer CSS/shadow-inline and neutral-timeline class recipes.
- Neutral timeline still contains some local conditional chrome tuning (`timelinePracticeCalmChrome`) that should eventually consume the shared derived-state object more fully.

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

### Phase 3 interaction parity pass (2026-05-15)

Status: complete (implementation + manual cross-surface QA accepted).

Files changed in this pass:

- `lib/shift-waveform-authoring-gesture.ts` (Shift+drag authoring no longer blocks when pointer starts over focus overlays; keeps resize-handle priority guard)
- `components/neutral-timeline/neutral-timeline-prototype.tsx` (Shift+drag focus-loop creation parity now starts from focus region hits as well as phrase-strip/body hits)
- `components/woodshed-workspace.tsx` (workspace keyboard-focus recovery on pointer return; restart target reconciliation now uses store-supported selection action)
- `components/youtube-workspace.tsx` (keyboard shortcut recovery after iframe interaction via pointer-return focus restore; restart reconciliation uses store-supported selection action)
- `lib/shift-waveform-authoring-gesture.test.ts` (new focused interaction guard tests)

Implementation completion notes (Phase 3):

- Shift+drag Focus Loop creation parity is now aligned across uploaded-audio WaveSurfer and YouTube neutral timeline, including in-phrase starts over existing focus overlays.
- Practice Mode remains protective for accidental edits (non-shift move/resize/delete paths still require explicit Edit posture), while intentional Shift+drag authoring remains available.
- Keyboard shortcut recovery after YouTube iframe interaction now uses local workspace focus restoration on pointer return to app/timeline surfaces (no global keydown hacks).
- Save/reload pathways remain on the existing local persistence contracts for upload + YouTube projects (no schema or cloud persistence changes in this pass).

Tests run:

- `npm test -- lib/shift-waveform-authoring.test.ts lib/shift-waveform-authoring-gesture.test.ts lib/interaction/practice-edit-mode.test.ts lib/regions/region-visual-state.test.ts lib/youtube/youtube-dexie-project.test.ts`
- `npx tsc --noEmit`

Manual QA checklist (Phase 3 interaction parity):

- [x] Shift+drag Focus Loop creation works in uploaded audio projects.
- [x] Shift+drag Focus Loop creation works in YouTube projects.
- [x] Practice Mode prevents accidental edits while preserving intentional authoring gestures.
- [x] Existing regions cannot be accidentally moved/resized while locked (Practice Mode).
- [x] Keyboard shortcuts recover after YouTube iframe interaction when focus returns to workspace/timeline.
- [x] Save/reload restores Practice Sections and Focus Loops correctly for upload + YouTube local projects.
- [x] Focused tests and typecheck pass for this pass.

Issues found during manual QA:

- No blocking Phase 3 interaction parity issues found.
- Non-blocking deferred items remain as previously documented (internal lock/unlock alias cleanup is a later migration task).

Remaining known gaps intentionally deferred:

- Lock/unlock alias naming remains in internal state for compatibility and will be removed in a later dedicated migration phase.

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
