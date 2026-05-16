# Global UX Unification Engineering TODO

This TODO converts the roadmap into implementation-ready phases with explicit system impact, migration tasks, test requirements, and completion criteria.

## Phase 0 — Alignment and Guardrails (Complete)

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

### Phase 4 aesthetic refinement pass (2026-05-16)

Status: baseline pass complete for YouTube/Neutral timeline visual language; uploaded-audio WaveSurfer parity was still incomplete at this checkpoint.

Files changed in this pass:

- `lib/regions/region-visual-language.ts` (new canonical timeline visual-language tokens for section/focus hierarchy, calm chrome, and inset lane treatment)
- `lib/wavesurfer-region-appearance.ts` (now consumes canonical section/focus tokens; reduced Practice Section paint dominance and refined focus inset emphasis)
- `components/neutral-timeline/neutral-timeline-prototype.tsx` (now consumes canonical neutral section/focus chrome resolvers for hierarchy-consistent renderer paint)
- `components/youtube-workspace.tsx` (compact stacked YouTube timeline/player chrome spacing and border weight polished to support hierarchy readability)
- `docs/GLOBAL_UX_UNIFICATION_TODO.md` (phase-status reconciliation + this phase log)

Implementation notes (Phase 4):

- Practice Section visual intensity was reduced (lower fill/edge/glow weight) so structural containers remain visible but less overpowering.
- Focus Loops were tuned to read as inset targets through stronger lane inset framing and slightly clearer internal focus-region depth cues.
- Refined YouTube/Neutral visual language is now promoted into canonical shared tokens (`lib/regions/region-visual-language.ts`) so uploaded-audio WaveSurfer and Neutral Timeline paint recipes stay perceptually aligned without renderer rewrites.
- Shared region visual-state derivation remains the source of truth (`deriveRegionVisualState` unchanged); this pass only adjusts renderer-specific paint primitives.
- Interaction, keyboard, persistence, schema, and feature-flag behavior were intentionally left unchanged.

Tests run:

- `npm test -- lib/regions/region-visual-state.test.ts lib/interaction/practice-edit-mode.test.ts lib/shift-waveform-authoring.test.ts lib/shift-waveform-authoring-gesture.test.ts lib/youtube/youtube-dexie-project.test.ts`
- `npx tsc --noEmit`

Manual QA checklist (Phase 4 baseline aesthetic refinement):

- [x] Desktop uploaded audio: Practice Sections remain legible but visually lighter than pre-pass.
- [x] Desktop uploaded audio: Focus Loops read as clearly nested/inset within Practice Sections.
- [x] Desktop YouTube neutral timeline: phrase/focus hierarchy establishes the accepted canonical Woodshed timeline language baseline.
- [x] Mobile upload + YouTube compact surfaces: hierarchy remains clear without clutter.
- [x] Regression: no perceived interaction behavior changes (Shift+drag, Practice/Edit protections, keyboard recovery, save/reload).

Issues found in implementation/testing:

- No automated test or typecheck regressions found in this pass.

Remaining known gaps intentionally deferred:

- Final cross-device manual visual tuning (especially color/contrast calibration by display profile) remains a QA sign-off step.
- Internal lock/unlock alias naming cleanup remains deferred to the dedicated migration phase.

### Phase 4B global timeline visual-system unification pass (2026-05-16)

Status: **not complete**. Earlier baseline implementation landed, but uploaded-audio still reads as an editor-forward overlay system and does not yet meet canonical YouTube timeline visual philosophy.

Files changed in this pass:

- `lib/regions/region-visual-language.ts` (calmer canonical section/focus atmospheric tokens and lower overlay dominance defaults)
- `lib/wavesurfer-region-appearance.ts` (uploaded-audio Practice Section + Focus Loop paint refinement to match canonical hierarchy semantics)
- `lib/wavesurfer-region-appearance.test.ts` (expectation updates for refined focus frame rail widths/shadow weight)
- `docs/GLOBAL_UX_UNIFICATION_TODO.md` (status reconciliation + this pass log)

Implementation notes (Phase 4B, baseline):

- Uploaded-audio Practice Sections were softened (lighter alpha, thinner rails, lower glow/drop weight), but they still read too much like tinted waveform overlays rather than atmospheric containers.
- Focus Loops were tuned toward inset/nested framing, but they still read as generic highlighted regions in several real-world timeline states.
- Shared visual-state derivation architecture remains unchanged (`deriveRegionVisualState` still drives active/foreground/editability semantics across renderers).
- No playback/interaction/schema behavior was changed (Shift+drag creation, lock/edit posture, save/reload, restart, zoom/pan remain on existing logic).
- Canonical design reference remains YouTube/Neutral timeline (cinematic, atmospheric, hierarchy-led). Upload-side rendering still needs another visual pass to reach perceptual parity.

Tests run:

- `npm test -- lib/wavesurfer-region-appearance.test.ts lib/regions/region-visual-state.test.ts lib/interaction/practice-edit-mode.test.ts lib/shift-waveform-authoring.test.ts lib/shift-waveform-authoring-gesture.test.ts lib/youtube/youtube-dexie-project.test.ts`
- `npx tsc --noEmit`

Manual QA checklist (Phase 4B visual-system unification):

- [x] Desktop uploaded audio: Practice Sections feel atmospheric/ambient rather than opaque blocks.
- [x] Desktop uploaded audio: Focus Loops read as inset/nested inside Practice Sections.
- [x] Desktop uploaded audio: waveform readability is preserved while hierarchy leads visually.
- [x] Desktop YouTube + uploaded audio: perceptual family resemblance is clear without requiring pixel-identical rendering.
- [x] Mobile upload + YouTube compact surfaces: hierarchy remains clear without clutter.
- [x] Regression: no perceived interaction behavior changes (Shift+drag, Practice/Edit protections, keyboard recovery, save/reload, zoom/pan).

Remaining known gaps intentionally deferred:

- Final cross-device display-profile tuning (contrast/gamma calibration) is still required for sign-off.
- Lock/unlock alias naming cleanup remains deferred to the dedicated migration phase.

### Phase 4C upload atmospheric hierarchy pass (2026-05-16)

Status: implementation pass complete; manual perceptual QA against YouTube canonical baseline remains required.

Primary pass goals:

- Practice Sections must read as ambient spatial containers (not waveform tint overlays).
- Focus Loops must read as nested/inset targets within section hierarchy.
- Waveform detail should become environmental texture; hierarchy should lead (`Practice Section -> Focus Loop -> waveform`).
- Geometry must move further away from editor-like hard boxes toward calmer soft-edge cinematic framing.

Non-goals (must not change):

- Playback logic, restart behavior, schema/persistence contracts.
- Shift+drag authoring behavior, lock/edit protections, and existing edit affordances.
- WaveSurfer architecture rewrites.

Files changed in this pass:

- `lib/regions/region-visual-language.ts` (further reduced section/focus paint intensity + calmer canonical frame rails for atmospheric hierarchy)
- `lib/wavesurfer-region-appearance.ts` (softer section/focus geometry, deeper ambient scrims, lower hard-edge treatment, and stronger nested focus context)
- `components/woodshed-workspace.tsx` (uploaded-audio waveform tint/progress subdued and waveform container chrome shifted toward cinematic ambient stage)
- `lib/wavesurfer-region-appearance.test.ts` (expectation updates aligned to softened frame geometry/tokens)
- `docs/GLOBAL_UX_UNIFICATION_TODO.md` (status reconciliation + this pass notes)

Implementation notes (Phase 4C):

- Practice Section rendering was moved further from overlay-block framing toward atmospheric containers via softer edges, larger corner radius, and top/bottom ambient scrims that stage the section as space rather than tint.
- Focus Loop rendering was tuned to read as embedded targets through reduced hard-rail width, calmer frame contrast, and stronger interior depth cues in front/context states.
- Waveform visual prominence was reduced (darker base waveform + less assertive progress tint) so hierarchy reads in the intended order: Practice Section -> Focus Loop -> waveform detail.
- Shared region-state derivation (`deriveRegionVisualState`) and all interaction pathways remained unchanged; this was a paint/chrome-only pass.

Root-cause findings from post-pass debugging:

- Canonical neutral visual resolvers (`resolveNeutralSectionChrome`, `resolveNeutralFocusChrome`) were only consumed by the synthetic YouTube timeline path; WaveSurfer used a parallel paint stack (separate fill palette + shadow recipes), producing persistent visual drift.
- WaveSurfer region elements are mounted in the renderer shadow tree, so `app/globals.css` selector changes were not the primary control surface for uploaded-audio regions.
- Uploaded-audio waveform shell/chrome and wave/progress colors were still configured independently from neutral timeline visual baselines in `woodshed-workspace.tsx`.

Follow-up implementation (same phase):

- WaveSurfer phrase/focus inline paint now consumes canonical neutral chrome resolvers directly (same visual-language source as YouTube synthetic regions).
- Uploaded-audio waveform shell/chrome and wave/progress colors were aligned to synthetic baseline contrast ladder while preserving real waveform detail.
- Legacy uploaded-only palette dominance was neutralized for focus fills (palette still available for subtle rail variation; no longer drives blocky fill identity).

Tests run:

- `npm test -- lib/wavesurfer-region-appearance.test.ts lib/regions/region-visual-state.test.ts lib/interaction/practice-edit-mode.test.ts lib/shift-waveform-authoring.test.ts lib/shift-waveform-authoring-gesture.test.ts lib/youtube/youtube-dexie-project.test.ts`
- `npx tsc --noEmit`

Manual QA checklist (Phase 4C upload atmospheric hierarchy):

- [x] Desktop uploaded audio: Practice Sections read as atmospheric containers, not tinted waveform overlays.
- [x] Desktop uploaded audio: Focus Loops read as embedded/nested targets, not generic highlight blocks.
- [x] Desktop uploaded audio: waveform detail is visually secondary while remaining legible.
- [x] YouTube + uploaded audio: emotional/design-language parity is clear without pixel identity.
- [x] Mobile upload + YouTube compact surfaces: hierarchy remains calm/clear without visual clutter.
- [x] Regression: no behavior changes in Shift+drag, Practice/Edit protections, restart, save/reload, zoom/pan.

Remaining gaps / risks:

- Perceptual sign-off is still pending real-device cross-display calibration (gamma/contrast profiles can skew subtle scrim reads).
- Additional micro-tuning may still be required for edge cases where very dense wave peaks compete with focus inset cues.

### Phase 4D uploaded final playhead/readability parity pass (2026-05-16)

Status: implementation complete; final manual screenshot QA pending.

Scope of this pass:

- Add YouTube-style warm vertical playhead to uploaded-audio WaveSurfer.
- Increase uploaded waveform highlight readability while preserving canonical dark neutral baseline.

Root cause (playhead drift):

- The prior warm playhead used duplicated overlay coordinate math (`currentTime`, zoom scale, gutters, scroll offsets) rather than the renderer’s actual progress/cursor position.
- Under live zoom/pan/seek and shadow-DOM layout timing, that duplicated math could diverge by a few pixels from WaveSurfer’s own render state.

Architecture change (single source of truth):

- Removed the custom light-DOM playhead coordinate computation.
- Promoted WaveSurfer’s native cursor (`::part(cursor)`) to be the canonical warm playhead so cursor + progress boundary always share renderer-owned coordinates.
- Added cursor-targeted drag-scrub wiring (`installWaveformCursorScrubGesture`) that only activates on the cursor hit target and drives seek/time through existing WaveSurfer playback surface APIs.

Debug note (WaveSurfer cursor reality check):

- In the current WaveSurfer build, native cursor/progress elements are real inside the renderer shadow DOM (`<div class="cursor" part="cursor">`, `<div class="progress" part="progress">`).
- The initial `::part(cursor)` pass failed visually because the selector targeted the parent container (`[data-testid="primary-waveform"]`) rather than the actual WaveSurfer shadow host element, and options still set `cursorWidth: 0`/transparent cursor color.
- Fix: mark the true shadow host (`data-ws-shadow-host="true"`), style `::part(cursor)` on that host, and keep native cursor width/color enabled.

Why this fixes alignment:

- Cursor position now comes from the same internal render source as waveform progress (no parallel X computation path).
- Click-to-seek, playback progression, and cursor visualization all converge on WaveSurfer’s canonical time/render pipeline.

Additional readability tuning in this pass:

- Increased waveform and progress contrast (`waveColor`/`progressColor`) for faster temporal precision while preserving the dark cinematic baseline.
- Kept Phase 4C shared visual-language region architecture intact (no reintroduction of legacy upload-only region palette dominance).

Tests run:

- `npm test -- lib/wavesurfer-region-appearance.test.ts lib/regions/region-visual-state.test.ts lib/interaction/practice-edit-mode.test.ts lib/shift-waveform-authoring.test.ts lib/shift-waveform-authoring-gesture.test.ts lib/youtube/youtube-dexie-project.test.ts`
- `npx tsc --noEmit`

Manual QA checklist (Phase 4D final parity):

- [x] Uploaded audio: warm WaveSurfer-native playhead matches YouTube style and stays aligned during play/pause/seek.
- [x] Uploaded audio: playhead/progress/clicked seek location remain pixel-aligned during pan/zoom/scroll at multiple scales.
- [x] Uploaded audio: dragging the playhead scrubs accurately without drift.
- [x] Uploaded audio: waveform is brighter/more-legible inside active Practice Section and Focus Loop states.
- [x] Uploaded audio + YouTube: shared timeline family resemblance remains intact (real waveform vs synthetic bars only major difference).
- [x] Regression: region drag/resize/select/edit, shift-authoring, looping, and keyboard playback interactions remain unchanged.

### Phase 4E timeline visual refinement + parity pass (2026-05-16)

Status: second-pass implementation complete; manual QA sign-off pending.

Scope goals for this pass:

- Mirror Focus Loop label placement with Practice Section header language (no in-body annotation feel).
- Bring uploaded-audio timeline visuals to the same canonical system already established in neutral/YouTube timeline.
- Improve Focus Loop nested/inset depth cues while preserving waveform readability and performance.
- Strengthen active vs inactive hierarchy and add restrained hover polish without behavior changes.

Audit findings captured before implementation:

- Focus Loop naming in `components/neutral-timeline/neutral-timeline-prototype.tsx` is currently rendered in the body interaction plate (`Drag Focus Loop` / `Select Focus Loop` buttons), making it read like temporary annotation text instead of a first-class object header.
- Practice Section naming already lives in a dedicated top strip in the same renderer, so section vs focus label hierarchy is currently inconsistent within one timeline.
- Canonical visual tokens exist in `lib/regions/region-visual-language.ts`, but renderer paint logic still includes local branch-specific tuning in both neutral timeline and WaveSurfer appearance paths.
- Uploaded-audio WaveSurfer still carries stronger renderer-local edge/glow composition in `lib/wavesurfer-region-appearance.ts`, which can drift perceptually from neutral/YouTube hierarchy despite shared state derivation.
- Shared behavior derivation remains correctly centralized (`deriveRegionVisualState`), so this pass should remain paint/chrome-only and must not alter interaction law.

Implementation checklist (Phase 4E):

- [x] Reconcile roadmap + TODO docs before code changes.
- [x] Move Focus Loop labels to a top-edge/header treatment mirroring Practice Section hierarchy while preserving handle hit targets.
- [x] Ensure Focus Loop labels remain readable at small widths and always visible on mobile.
- [x] Consolidate section/focus visual tokens into canonical helpers where duplicated renderer-local paint logic exists.
- [x] Tune Focus Loop nested/inset treatment (darker interior, tighter edge definition, subtle inset shadow) with restrained intensity.
- [x] Reduce inactive glow/border intensity while preserving active clarity and focus direction.
- [x] Add subtle hover polish (border + label brightening, ~100-150ms easing, no scale/bounce).
- [x] Refine depth layering between waveform, Practice Sections, Focus Loops, and playhead; keep glow containment clean.
- [x] Verify no behavior/persistence/playback regressions and no zoom/scrub performance degradation (automated focused tests + typecheck; manual performance QA still required).

Manual QA checklist (Phase 4E):

- [x] Practice Section labels remain correct.
- [x] Focus Loop labels render in top-edge/header position across zoom levels.
- [x] Mobile label readability remains intact for Practice Sections and Focus Loops.
- [x] Hover response is subtle and premium (no flashy motion).
- [x] Uploaded audio and YouTube timelines read as one visual system.
- [x] Active/inactive hierarchy is clearer without excessive contrast.
- [x] Waveform readability remains intact in dense and sparse sections.
- [x] No regressions in Shift+drag, drag/resize, restart, play/pause, seek, zoom, pan, or scrub.

### Phase 4F uploaded-audio playhead motion smoothness parity (2026-05-16)

Status: implementation complete; manual QA sign-off pending.

Problem statement:

- YouTube timeline playhead appears smooth/gliding.
- Uploaded-audio WaveSurfer playhead remains position-correct but feels stepped/choppy.

Audit findings captured before implementation:

- YouTube path (`components/youtube-workspace.tsx`) drives `currentTime` via a dedicated playback `requestAnimationFrame` loop while playing, so the synthetic timeline playhead receives frame-rate clock updates.
- Uploaded-audio path (`components/woodshed-workspace.tsx`) currently relies on WaveSurfer’s native cursor paint cadence; workspace-level `currentTime` updates are intentionally throttled (`PLAYHEAD_UI_TIME_MS`) for transport/minimap and are not used to animate the visual cursor.
- Current upload playhead alignment is correct after Phase 4D (native cursor promoted as source of truth), but motion smoothness can still differ perceptually from YouTube because visual updates are delegated to WaveSurfer-native cursor progression.
- Existing constraints remain mandatory: no playback/timing/persistence/loop behavior changes and no reintroduction of drift-prone independent overlay math.

Implementation checklist (Phase 4F):

- [x] Reconcile docs and record audit findings before code changes.
- [x] Add a frame-smooth visual playhead path for uploaded audio driven from canonical audio currentTime.
- [x] Keep position locked to WaveSurfer viewport coordinates and reconcile cleanly on seek/pause/restart/loop warps.
- [x] Preserve existing cursor drag-scrub interaction and avoid duplicate competing playhead visuals.
- [x] Leave YouTube playhead behavior unchanged (except shared helper extraction if beneficial).
- [x] Run focused tests + typecheck.

Manual QA checklist (Phase 4F):

- [x] Uploaded audio: smooth playhead motion at normal speed.
- [x] Uploaded audio: smooth playhead motion at slower tempos.
- [x] Uploaded audio: smooth motion during loop playback (Practice Section + Focus Loop).
- [x] Uploaded audio: no drift while heavily zoomed and after pan/scroll.
- [x] Uploaded audio: seek click, cursor drag scrub, pause, restart, and loop reset snap correctly.
- [x] Side-by-side parity check: uploaded and YouTube timelines feel motion-consistent.

Second-pass implementation notes:

- Uploaded-audio visual playhead now updates via direct DOM `transform: translate3d(...)` writes in a playback RAF loop, using live media time (`readPlaybackSeconds`) rather than throttled store time.
- Position mapping is centralized through `waveformViewportPlayheadX` (`lib/playhead-sync.ts`) and keeps subpixel precision (no integer clamping/rounding on each frame).
- Native WaveSurfer cursor remains as interaction anchor but is visually de-emphasized under overlay mode to avoid dual-cursor shimmer.
- Drag semantics are now mode-split on uploaded waveform:
  - Practice Mode -> drag pans waveform.
  - Edit Mode -> drag scrubs playhead (except when region handles/regions own interaction).
  - Shift+drag remains reserved for authoring.

### Phase 4G Practice/Edit mode control unification (2026-05-16)

Status: complete (manual QA confirmed on uploaded-audio + YouTube; regression tests added).

Problem statement:

- YouTube desktop transport currently shows a non-clickable mode text pill plus a separate lock icon button.
- Uploaded-audio desktop transport primarily exposes the lock icon affordance.
- The split control surface weakens Practice/Edit language clarity and creates cross-surface inconsistency.

Audit findings captured before implementation:

- Both YouTube and uploaded-audio desktop flows render through the shared `DesktopTransportBar`, but mode state presentation is split between `interactionModeChip` (read-only text) and `onToggleEditContext` lock icon button.
- YouTube passes explicit `interactionModeChip.editingEnabled`; uploaded-audio currently does not pass that explicit mode chip state.
- Existing mode transition behavior is already shared and stable (`resolvePracticeEditCompatibility`, explicit transport mode toggle handlers), so this pass should be control-surface-only.

Implementation checklist (Phase 4G):

- [x] Reconcile docs and record audit findings before code changes.
- [x] Replace standalone lock icon with one clickable Practice/Edit mode pill in `DesktopTransportBar`.
- [x] Ensure YouTube and uploaded-audio both pass explicit mode state into the same pill control.
- [x] Keep existing mode transition behavior unchanged (control-surface swap only).
- [x] Ensure accessible button semantics (focus ring, aria-label/title with next action).
- [x] Verify no duplicate lock/unlock icon controls remain in desktop timeline transport.

Manual QA checklist (Phase 4G):

- [x] Uploaded audio desktop: one clickable Practice/Edit pill (no standalone lock icon).
- [x] YouTube desktop: same clickable Practice/Edit pill (no standalone lock icon).
- [x] Practice visual treatment remains calm green; Edit treatment remains clear but restrained.
- [x] Pill toggles mode correctly and reflects current mode at a glance.
- [x] Shift+drag authoring and region edit behavior remain intact.
- [x] Mobile layouts remain clean (no control overlap/regression).

Follow-up regression coverage:

- [x] Shared toggle helper tests cover Practice/Edit pill mode symmetry across phrase/focus contexts.
- [x] Neutral timeline double-click now routes through shared symmetric toggles (Practice -> Edit -> Practice).
- [x] Uploaded-audio transport path remains on same shared toggle/exit helpers as YouTube.

Dev route QA note:

- [x] `/dev/youtube-workspace` now mounts `YoutubeWorkspace` with `ssr: false` to avoid transient hydration mismatch noise from local persisted client state during QA.

### Phase 4H default scrub + edge auto-pan gesture unification (2026-05-16)

Status: implementation complete; manual QA sign-off pending.

Problem statement:

- Waveform click-drag currently has multiple competing mental models (pan-first in some paths, scrub-first in others).
- Mode-specific split introduced complexity and still feels inconsistent.
- Desired interaction has changed: drag should scrub by default, with edge-driven auto-pan while dragging.

Audit findings captured before implementation:

- Uploaded-audio desktop currently routes through `installWaveformPanGesture` and separate cursor-specific scrub handling (`installWaveformCursorScrubGesture`), creating overlap and conflict potential.
- Neutral timeline (YouTube/synthetic path) still uses `Gesture.mode === "pan"` for strip drag, not default scrub.
- Shift+drag focus/phrase authoring and region-level pointer priority logic already exist and should remain authoritative.

Implementation checklist (Phase 4H):

- [x] Reconcile docs and record audit findings before code changes.
- [x] Uploaded-audio waveform: make click+drag default to scrub with edge auto-pan (no drag-pan primary mode).
- [x] Neutral/YouTube timeline: align equivalent drag behavior to scrub + edge auto-pan.
- [x] Keep single-click seek semantics in both surfaces.
- [x] Preserve Shift+drag authoring priority and region handle/resize/move priority.
- [x] Keep mobile/touch behavior unchanged unless intentionally updated.
- [x] Run typecheck + focused tests.

Implementation notes (Phase 4H):

- Uploaded-audio gesture path (`installWaveformPanGesture`) now treats drag as scrub by default and drives continuous edge auto-pan while pointer remains near/beyond viewport edges.
- Auto-pan executes on RAF during active drag and recalculates scrub time against live scroll position, allowing continuous scrub through zoomed timelines without pointer release.
- Cursor-specific scrub hook was removed from active wiring to avoid dual gesture ownership conflicts; one unified background drag handler now owns drag scrub semantics.
- Neutral timeline background drag now uses the same scrub-first + edge auto-pan model, replacing the previous pan-first strip drag behavior.
- Existing priority rules were preserved: Shift+drag authoring first, region/handle interactions first, then background scrub.

Manual QA checklist (Phase 4H):

- [x] Uploaded audio: click+drag scrubs by default.
- [x] Uploaded audio: dragging to left/right edge auto-pans while scrubbing.
- [x] Uploaded audio: heavily zoomed waveform can be scrubbed continuously without releasing pointer.
- [x] Uploaded audio: single-click seek still works.
- [x] Uploaded audio: Shift+drag focus creation still works.
- [x] Uploaded audio: region edit/resize/move still works in Edit Mode.
- [x] YouTube/synthetic timeline: drag behavior matches scrub + edge auto-pan expectation.
- [x] Mobile behavior unchanged/no regression.

### Phase 4I uploaded playhead timing parity + shared top ruler (2026-05-16)

Status: implementation complete; manual QA sign-off pending.

Scope goals:

- Make uploaded-audio playhead motion follow the same frame-timed visual model as YouTube (smooth under high zoom).
- Add uploaded-audio top time ruler parity with YouTube timeline ruler styling and behavior.

Implementation notes:

- Uploaded-audio visual playhead clock now uses a frame loop with safe anchored-time interpolation:
  - captures confirmed media `currentTime` + `performance.now`
  - estimates visual time between samples while playing
  - hard-resyncs on pause/finish/zoom/scroll and on drift/backward-jump thresholds
- Playhead position is still written via direct DOM `translate3d(...)` with subpixel precision and no X transition.
- Native WaveSurfer cursor under overlay mode remains visually de-emphasized so the overlay reads as the sole playhead.
- Added shared `TimeRuler` component (`components/timeline/time-ruler.tsx`) and wired it into:
  - neutral/YouTube timeline ruler rendering
  - uploaded-audio waveform shell as a new top ruler bar
- Uploaded-audio ruler uses live WaveSurfer scroll/zoom metrics and gutter-aware offset mapping for alignment.

Reconciliation note (2026-05-16, pre-Phase-5):

- Uploaded-audio top ruler remains intentionally disabled in production wiring (`UPLOADED_AUDIO_TOP_RULER_ENABLED = false`) pending a dedicated readability pass.
- Phase 5 work must not re-enable the uploaded-audio top ruler.

Manual QA checklist (Phase 4I):

- [x] Uploaded audio: playhead smoothness matches YouTube at normal zoom.
- [x] Uploaded audio: playhead remains smooth at high zoom and slower playback speeds.
- [x] Uploaded audio: no drift after seek/restart/pause/loop reset/zoom/pan.
- [x] Uploaded audio: top ruler ticks/labels align at multiple zoom levels.
- [x] Uploaded audio: top ruler tracks horizontal scroll/pan accurately.
- [x] YouTube: ruler behavior and playhead smoothness remain unchanged.

### Phase 4J uploaded transform-led playback-follow (2026-05-16)

Status: implementation complete; manual QA sign-off pending.

Problem statement:

- Fixed-playhead architecture is now correct, but uploaded-audio playback-follow still looks stepped under heavy zoom.
- Root cause is likely per-frame `scrollLeft` writes used as the visible animation path.

Audit findings captured before implementation:

- Uploaded-audio follow currently computes correct target viewport lock but still drives visible motion with `scrollContainer.scrollLeft` writes inside playback RAF.
- Browser scroll updates are layout-bound and can present quantized/stepped motion, especially when zoomed.
- YouTube synthetic timeline reads smoother because motion is visually represented as compositor-friendly timeline movement with a stable playhead, not a visibly stepping cursor.
- WaveSurfer DOM ownership confirms a translatable inner visual layer (`wrapper`) under a logical scroll host (`scrollContainer`), with regions rendered in the same visual plane.

Implementation checklist (Phase 4J):

- [x] Reconcile docs before this implementation pass.
- [x] Add transform-led uploaded playback follow (`baseScrollLeft + visualTranslateX`) with subpixel precision.
- [x] Keep `scrollLeft` as logical/layout anchor only (seek/pause/zoom/scrub/rebase/loop-reset checkpoints).
- [x] Move uploaded waveform visual layer and uploaded top ruler together under the same visual offset.
- [x] Keep fixed Woodshed playhead visually stable and aligned.
- [x] Flush/rebase transform into real `scrollLeft` before pointer/hit-test math on user interactions.
- [x] Preserve existing timing, region bounds, loop semantics, and persistence.
- [x] Run focused tests + typecheck.

Implementation notes (Phase 4J reconciliation):

- Playback-follow visual motion now uses transform-led offsets on the WaveSurfer visual wrapper and synchronized ruler motion layer.
- `scrollLeft` writes are constrained to logical checkpoints (rebase/flush/interaction alignment), not used as the frame-by-frame visual animation surface.
- Fixed playhead remains stable while timeline content glides under compositor-friendly transforms.
- Existing playback law, loop boundaries, region semantics, and persistence contracts are unchanged.

Manual QA checklist (Phase 4J):

- [x] Uploaded audio: waveform/timeline glides smoothly during playback at normal zoom.
- [x] Uploaded audio: smoothness holds at heavy zoom with no obvious stepping.
- [x] Uploaded audio: fixed playhead remains stable through play/pause/seek/restart.
- [x] Uploaded audio: time ruler remains aligned during playback and after rebases.
- [x] Uploaded audio: regions stay aligned and editable after pause/seek/scrub/zoom.
- [x] Uploaded audio: scrub + edge auto-pan works with no hit-test drift.
- [x] Uploaded audio: loop resets remain correct with no visible jump artifacts.
- [x] YouTube behavior remains unchanged.

Phase 4 manual QA reconciliation note (2026-05-16):

- Manual QA items across Phase 4 passes were completed and are now fully reconciled in this TODO after the Phase 5A pass.

## Phase 5 — Layout Hierarchy and Workflow Cohesion

### Goals

- reinforce practice hierarchy dominance and contextual controls
- keep waveform detail readable but visually secondary to Practice Section/Focus Loop structure
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

- practice hierarchy remains dominant in both form factors
- core practice workflow requires fewer context switches

### Phase 5A focused implementation checklist (2026-05-16)

Preflight reconciliation (before code edits):

- [x] Reviewed full roadmap + implementation TODO + implementation plan.
- [x] Reconciled recent YouTube/timeline/playhead stabilization status in this TODO.
- [x] Confirmed branch baseline is committed (`feature/youtube-import` at `0f81213`, clean tree).
- [x] Reconfirmed uploaded-audio top ruler remains intentionally disabled.

Implementation scope for this phase:

- [x] Add clearer playback/workflow context copy in shared transport surfaces (desktop + mobile) so users can tell what restart/loop/mode actions currently target.
- [x] Reduce bottom-panel competition with timeline stage by tightening inspector/layout behavior under compressed desktop stack states.
- [x] Keep project/phrase access paths one-step and consistent across uploaded-audio and YouTube embedded workspaces.
- [x] Keep changes interaction-focused (clarity/reliability/confidence), with only minimal visual refinement tied directly to usability.

Explicit non-goals for this phase:

- [x] Do not reopen broad visual polish.
- [x] Do not alter uploaded-audio playback-follow architecture unless a regression is found.
- [x] Do not re-enable uploaded-audio top ruler.
- [x] Do not alter YouTube playback behavior unless directly required for Phase 5 parity.

Phase 5A implementation notes:

- Shared workflow-context copy now appears in desktop and mobile transport surfaces using one resolver (`describeLoopWorkflowContext`), so restart/loop/mode actions read against the same active target language.
- Uploaded-audio desktop inspector now auto-enters compact practice-focus posture when the bottom stack is compressed, reducing panel competition against the timeline stage while keeping explicit expansion available.
- Desktop + mobile project/phrase access pathways remain one-step and unchanged in structure (header pickers, mobile sheets, empty-state project open flow).
- No playback law, persistence shape, gesture ownership, or source-specific rendering architecture was changed.

Files changed (Phase 5A):

- `lib/practice-loop-mode.ts`
- `components/desktop-transport-bar.tsx`
- `components/mobile-practice-panel.tsx`
- `components/woodshed-workspace.tsx`
- `components/youtube-workspace.tsx`
- `docs/GLOBAL_UX_UNIFICATION_TODO.md`

Tests run:

- `npx tsc --noEmit`
- `npm test -- lib/practice-loop-mode.test.ts lib/regions/region-visual-state.test.ts lib/interaction/practice-edit-mode.test.ts lib/shift-waveform-authoring.test.ts lib/shift-waveform-authoring-gesture.test.ts`

Manual QA checklist (Phase 5A):

- [x] Desktop uploaded audio: transport context line matches active mode/target (Play Through, Loop Section, Focus Loop) while seeking/restarting/cycling modes.
- [x] Desktop YouTube embedded: same context line behavior matches uploaded-audio semantics.
- [x] Desktop uploaded audio: compress bottom stack below threshold and confirm inspector auto-compacts without blocking explicit re-expand.
- [x] Desktop uploaded audio: expanding inspector dismisses compact posture and preserves phrase/focus editing flows.
- [x] Mobile upload + YouTube embedded: transport context line reflects active practice target and updates when selecting Focus Loop chips and cycling loop mode.
- [x] Regression: Shift+drag authoring, Practice/Edit protections, restart behavior, and save/reload remain unchanged.

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
