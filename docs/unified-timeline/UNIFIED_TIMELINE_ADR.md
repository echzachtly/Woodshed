# UNIFIED_TIMELINE_ADR

Status: Proposed (planning pass only, docs-only)
Date: 2026-05-16
Scope: Post-Phase-6 architecture initiative planning

## Context

Woodshed currently operates two timeline architectures:

- Uploaded audio projects: WaveSurfer-driven timeline rendering and much of timeline interaction ownership in `components/woodshed-workspace.tsx`.
- YouTube projects: synthetic/neutral timeline rendering in `components/neutral-timeline/neutral-timeline-prototype.tsx` with YouTube playback adapter wiring in `components/youtube-workspace.tsx`.

Observed product quality trend: the synthetic timeline path currently feels smoother and more responsive during click-to-seek, playhead motion, zoom, and navigation.

Current stabilization work (Global UX roadmap through Phase 6A) has intentionally preserved behavior semantics while improving parity. This ADR defines a future migration direction after current roadmap completion.

## Problem Statement

The app has duplicated timeline systems and partially duplicated coordinate/rendering behavior:

- Separate rendering ownership and interaction plumbing by media source.
- Risk of drift in time/x mapping, scroll behavior, and hit testing.
- Higher maintenance cost for parity, regressions, and future features.

At the same time, the system must preserve:

- Existing upload reliability and saved projects.
- Existing YouTube reliability.
- Practice/Edit, loop/restart/scope semantics.
- Mobile practice-first behavior during early phases.

## Decision

Adopt a source-agnostic unified timeline shell architecture, behind feature flags, migrated incrementally.

Key decision details:

- Uploaded audio target: unified timeline shell + real peaks.
- YouTube target: unified timeline shell + synthetic peaks.
- WaveSurfer remains initially as playback/decode helper for upload path; no reckless removal.
- Migration starts with read-only/mirror upload parity before interaction ownership moves.

**This is a timeline-shell migration, NOT a media-engine rewrite.**

## Architectural Ownership Model

### Unified timeline shell owns

- Timeline rendering primitives.
- Time<->x coordinate math.
- Playhead visual mapping.
- Zoom/pan/scroll viewport behavior.
- Region visual language and hit testing.
- Interaction event normalization (seek, scrub, drag intents).

### Playback adapters own

- Source-specific media transport APIs (`play`, `pause`, `seek`, duration/time reads).
- Playback clock integration and surface-specific quirks (WaveSurfer vs YouTube iframe).
- Decoding/stream readiness behavior.

### Store and persistence layer owns

- Canonical session/project state (loops, focus selection, loop scope, mode flags, zoom state).
- Hydration normalization and deterministic fallback logic.
- Save/load contracts for local and cloud pathways.

## Timeline Shell Responsibilities

- Accept source-agnostic inputs only: duration, currentTime, peaks, regions, mode, zoom, viewport, callbacks.
- Render phrase/focus hierarchy with existing semantic invariants.
- Route all timeline coordinate conversions through shared coordinate primitives.
- Remain agnostic to upload/YouTube/media engine details.

## Playback Adapter Responsibilities

- Translate shell callbacks (`onSeek`, interaction intents) to concrete media actions.
- Expose stable playback-surface contract to shell and workspace.
- Preserve existing warp/restart/loop-rail timing guarantees.
- Handle source-specific error/ready states and fallback signaling.

## Store/Persistence Responsibilities

- Keep one authoritative state graph (`store/woodshed-store.ts`).
- Preserve deterministic hydration boundary (`activateHydratedProjectState` pattern).
- Preserve practice-state normalization and stale-reference fallback.
- Maintain backwards compatibility for persisted project shapes during migration phases.

## Source-Specific Boundaries

### Allowed source-specific behavior

- Peak generation strategy (real decoded peaks vs synthetic peaks).
- Media metadata presentation and source identity details.
- Playback-surface implementation details.

### Not allowed source-specific behavior (long-term target)

- Independent coordinate math per source.
- Divergent interaction intent mapping.
- Divergent restart/scope semantics.

## Non-Goals

- No media-engine rewrite.
- No full WaveSurfer removal in initial migration.
- No Practice/Edit semantic redesign.
- No mobile interaction redesign during desktop parity phases.
- No persistence schema rewrite unless proven necessary.

## Architectural Invariants

1. One canonical timeline coordinate system for time/x/scroll mappings.
2. Source-agnostic timeline shell API boundary.
3. Strict behavior parity preservation for restart/scope/loop semantics unless explicitly approved.
4. Feature-flagged, reversible rollout for each phase.
5. Fallback-capable runtime with fast disablement.

## Risks

- Upload interaction regressions if ownership moves too early.
- Hydration/persistence regressions from adapter/shell integration seams.
- Performance regressions at high zoom if transform/scroll authority is unclear.
- Cloud parity drift if local-first rollout is not reconciled before broad enablement.
- Mobile behavior drift if desktop-focused phases leak interaction changes.

## Rollback Philosophy

- Every phase must ship behind explicit source/form-factor flags.
- Keep old path runnable during migration.
- Detect regressions via manual matrix + telemetry/error signals.
- Disable affected flag first; diagnose second.
- Never remove fallback implementation until parity gates pass and manual approval is complete.
