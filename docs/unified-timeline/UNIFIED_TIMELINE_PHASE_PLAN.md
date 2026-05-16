# UNIFIED_TIMELINE_PHASE_PLAN

Status: Proposed (docs-only planning baseline)
Date: 2026-05-16

## Scope Guardrails

- Initiative type: experimental, feature-flagged, incremental, reversible.
- Not in scope: media-engine rewrite, immediate WaveSurfer removal, semantics redesign.
- Hard invariant: preserve restart, scope, loop, Practice/Edit, and saved-region behavior unless explicitly approved.

## Phase A — Contract Freeze + Doc Reconciliation

### Goals

- Freeze architecture contracts before implementation.
- Reconcile unified-timeline docs with current roadmap and code reality.
- Confirm local/manual QA completion status from current roadmap phases.

### Scope

- Documentation alignment only.
- Define canonical terms and migration constraints.
- Clarify real-peaks upload + synthetic-peaks YouTube direction.

### Likely systems/files affected

- `docs/woodshed_global_ux_unification_roadmap.md`
- `docs/GLOBAL_UX_UNIFICATION_TODO.md`
- `docs/UNIFIED_TIMELINE_*` planning docs
- `docs/unified-timeline/*` (new planning set)

### Dependencies

- Accurate architecture inventory of upload + YouTube pathways.

### Risks

- Starting code work with ambiguous contract boundaries.
- Conflicting roadmap language across planning docs.

### Testing requirements

- N/A (docs phase), but define required test strategy for later phases.

### Rollback considerations

- No runtime rollback required; rollback is doc-level correction.

### Manual QA requirements

- Verify roadmap checkpoints in docs match accepted manual QA status.

### Approval gate to Phase B

- ADR, phase plan, regression matrix, and rollback runbook approved.

## Phase B — Shared Timeline Domain + Adapters

### Goals

- Introduce source-agnostic timeline domain contracts.
- Define adapter boundaries for upload/YouTube playback surfaces.

### Scope

- Shared types and interfaces only.
- No user-visible behavior changes by default.

### Likely systems/files affected

- Future `lib/timeline/*` contract files (when implementation starts)
- `lib/audio-engine.ts` playback-surface contract touchpoints
- `lib/youtube/youtube-playback-surface.ts`
- `components/woodshed-workspace.tsx` and `components/youtube-workspace.tsx` adapter wiring points

### Dependencies

- Phase A approved contracts.
- Existing store/hydration invariants documented.

### Risks

- Contract mismatch causing adapter churn.
- Hidden coupling between store and renderer assumptions.

### Testing requirements

- Contract unit tests.
- Adapter conformance tests (upload and YouTube).

### Rollback considerations

- Keep old direct pathways intact while introducing adapters.
- Gate any adapter usage behind flags.

### Manual QA requirements

- Verify no behavior deltas in playback scope/restart/selection.

### Approval gate to Phase C

- Shared domain contracts stable and test-backed.
- No regressions in current timeline paths.

## Phase C — Unified Timeline Renderer v0 (YouTube-first)

### Goals

- Validate unified shell in lower-risk YouTube path first.
- Prove renderer/interaction parity in synthetic-peaks mode.

### Scope

- Render YouTube timeline through unified shell behind YouTube flag.
- Preserve existing YouTube playback adapter and persistence behavior.

### Likely systems/files affected

- New unified timeline component (implementation phase)
- `components/youtube-workspace.tsx`
- `components/neutral-timeline/*` migration bridge
- `lib/neutral-timeline-wheel-zoom.ts` / coordinate helpers

### Dependencies

- Phase B contracts.
- Existing YouTube local hydration stability.

### Risks

- Interaction parity gaps versus current neutral timeline.
- Performance regressions at high zoom.

### Testing requirements

- Synthetic timeline interaction tests (seek, scrub, zoom, pan, selection).
- Playback synchronization tests with YouTube adapter.

### Rollback considerations

- `NEXT_PUBLIC_WOODSHED_UNIFIED_TIMELINE_YOUTUBE=false` returns to current YouTube timeline path.

### Manual QA requirements

- Full YouTube regression matrix subset must pass before wider flag exposure.

### Approval gate to Phase D

- YouTube unified-shell parity approved manually.
- No unresolved critical regressions.

## Phase D — Upload Mirror Mode (Read-only first)

### Goals

- Render upload projects with unified shell using real peaks while keeping WaveSurfer interaction authority.
- Achieve visual and coordinate parity in mirror/read-only mode.

### Scope

- Real peak ingestion path for upload.
- Unified shell mirrors timeline state but does not own full upload interactions yet.

### Likely systems/files affected

- `components/woodshed-workspace.tsx` integration seams
- Peak generation/caching utilities (new modules in implementation phase)
- `lib/waveform-*` coordinate/zoom utilities
- Region visual-state integration modules

### Dependencies

- Phase C shell stability.
- Upload peak generation baseline strategy (eager base resolution).

### Risks

- Coordinate mismatch between mirrored shell and WaveSurfer path.
- Performance/memory costs for peak generation and caching.

### Testing requirements

- Upload read-only parity tests (visual alignment, playhead, seek mapping).
- Peak-generation failure/fallback tests.

### Rollback considerations

- `NEXT_PUBLIC_WOODSHED_UNIFIED_TIMELINE_UPLOAD=false` restores current upload timeline rendering.

### Manual QA requirements

- Upload mirror parity checklist across zoom ranges and project types.

### Approval gate to Phase E

- Mirror mode parity validated.
- No hydration/persistence drift from mirror wiring.

## Phase E — Upload Interactive Parity

### Goals

- Move upload interaction ownership to unified shell incrementally.
- Maintain WaveSurfer as playback/decode helper.

### Scope

- Seek/scrub/zoom/pan/region interactions through unified shell.
- Preserve current playback semantics and restart/scope laws.

### Likely systems/files affected

- Unified interaction controller modules (implementation phase)
- `components/woodshed-workspace.tsx` interaction handoff logic
- `lib/wavesurfer-*` integration utilities
- `lib/interaction/*` and playback intent/restart helpers

### Dependencies

- Phase D mirror parity signoff.
- Regression matrix ready and enforced.

### Risks

- Upload regressions in direct manipulation behavior.
- Drift in region editability and Practice/Edit safeguards.

### Testing requirements

- End-to-end interaction parity tests against current baseline.
- Focused performance tests for zoom and drag paths.

### Rollback considerations

- Runtime fallback to WaveSurfer-owned interactions by flag.
- Maintain dual-path code until parity signoff.

### Manual QA requirements

- Desktop upload interaction checklist, including Shift+drag and edit toggles.

### Approval gate to Phase F

- Upload interactive parity accepted with no critical regressions.

## Phase F — Mobile Unified Timeline Integration

### Goals

- Introduce unified shell on mobile while preserving practice-first behavior.

### Scope

- Mobile rendering integration only at first.
- No mobile interaction redesign in initial pass.

### Likely systems/files affected

- Mobile branches in `components/woodshed-workspace.tsx`
- `components/mobile-practice-panel.tsx` integration points
- Mobile zoom/pinch paths (`lib/waveform-mobile-pinch.ts` or successor integration)

### Dependencies

- Desktop parity stable (Phases C-E).
- Confirmed no behavior-change policy for mobile baseline.

### Risks

- Touch gesture regressions.
- Practice-flow friction increase.

### Testing requirements

- Mobile-specific regression and ergonomics checks.
- PWA/layout sanity checks where applicable.

### Rollback considerations

- `NEXT_PUBLIC_WOODSHED_UNIFIED_TIMELINE_MOBILE=false` keeps existing mobile timeline path.

### Manual QA requirements

- Practice-first checklist (seek, restart, loop scope, chips, zoom).

### Approval gate to Phase G

- Mobile parity accepted without degrading practice-first flow.

## Phase G — Persistence / Cloud / Backcompat Hardening + Cleanup

### Goals

- Validate cloud parity and backward compatibility before broader rollout.
- Remove temporary migration scaffolding only after stable validation.

### Scope

- Cloud/local parity reconciliation.
- Backcompat and migration hardening for persisted data shapes.
- Controlled cleanup of dual-path fallback code.

### Likely systems/files affected

- `lib/project-db.ts`
- `lib/cloud-projects/client.ts`
- `lib/persistence/activate-hydrated-project-state.ts`
- `lib/practice-state-persist.ts`
- YouTube Dexie helpers and restore orchestration paths

### Dependencies

- All previous phases stable.
- Rollback runbook and telemetry gates in place.

### Risks

- Cloud/local behavior drift.
- Legacy payload edge-case failures.
- Premature removal of fallback paths.

### Testing requirements

- Cloud/local restore parity tests.
- Backcompat restore matrix across legacy payload examples.
- Extended regression matrix full run.

### Rollback considerations

- Keep flags and fallback paths through hardening completion.
- Block default enablement if cloud parity or backcompat fails.

### Manual QA requirements

- Full regression matrix across local + cloud, upload + YouTube, desktop + mobile.

### Approval gate to production default enablement

- Cloud parity validated.
- Backcompat validated.
- Regression matrix fully green.
- Explicit manual approval to change defaults.
