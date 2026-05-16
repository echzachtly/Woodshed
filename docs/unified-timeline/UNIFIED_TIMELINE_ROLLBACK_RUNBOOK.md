# UNIFIED_TIMELINE_ROLLBACK_RUNBOOK

Status: Proposed rollback and safe-disablement runbook
Date: 2026-05-16

## Purpose

Provide a clear, reversible operational strategy for unified timeline rollout, including feature-flag control, fallback behavior, and regression response.

## Feature Flag Strategy

Use independent flags so rollback can target specific surfaces:

- `NEXT_PUBLIC_WOODSHED_UNIFIED_TIMELINE_UPLOAD`
- `NEXT_PUBLIC_WOODSHED_UNIFIED_TIMELINE_YOUTUBE`
- `NEXT_PUBLIC_WOODSHED_UNIFIED_TIMELINE_MOBILE`

Guidance:

- Keep default off until each phase gate is approved.
- Enable in narrow scope first (internal/local validation).
- Avoid coupling all sources/form factors to one flag.

## Recommended Flag States by Stage

- Early experimental: YouTube on, Upload off, Mobile off.
- Upload mirror validation: Upload on (read-only/mirror), YouTube optional, Mobile off.
- Desktop parity validation: Upload on, YouTube on, Mobile off.
- Mobile validation: enable mobile only after desktop parity stability.

## Fallback Behavior

### Upload fallback

- Disable `NEXT_PUBLIC_WOODSHED_UNIFIED_TIMELINE_UPLOAD`.
- Route rendering/interaction to existing WaveSurfer-owned upload timeline path.

### YouTube fallback

- Disable `NEXT_PUBLIC_WOODSHED_UNIFIED_TIMELINE_YOUTUBE`.
- Route rendering/interaction to existing neutral timeline path.

### Mobile fallback

- Disable `NEXT_PUBLIC_WOODSHED_UNIFIED_TIMELINE_MOBILE`.
- Keep current mobile practice timeline behavior unchanged.

## Rollback Procedure (Standard)

1. Detect regression via manual QA, telemetry, or user reports.
2. Classify severity and affected scope (upload, YouTube, mobile, shared).
3. Disable only affected flag(s) first.
4. Verify fallback path behavior with targeted smoke checks.
5. Communicate status and hold further rollout.
6. Triage root cause and ship fix behind same flag.
7. Re-enable only after checklist and approval gate pass.

## Handling Upload Regressions

Trigger examples:

- Incorrect seek mapping.
- Region interaction regressions.
- Playhead drift or jitter.
- Restart/scope semantic changes.

Immediate action:

- Disable `NEXT_PUBLIC_WOODSHED_UNIFIED_TIMELINE_UPLOAD`.
- Verify existing WaveSurfer upload path remains healthy.

## Handling YouTube Regressions

Trigger examples:

- Playback sync drift vs iframe clock.
- Timeline interaction mismatch.
- Selection/scope state desync.

Immediate action:

- Disable `NEXT_PUBLIC_WOODSHED_UNIFIED_TIMELINE_YOUTUBE`.
- Verify existing YouTube neutral timeline path remains healthy.

## Handling Mobile Regressions

Trigger examples:

- Tap/seek/zoom interaction degradation.
- Practice-flow friction or control regressions.
- Unintended edit behavior on mobile.

Immediate action:

- Disable `NEXT_PUBLIC_WOODSHED_UNIFIED_TIMELINE_MOBILE`.
- Verify mobile practice-first baseline remains intact.

## Handling Peak-Generation Failures

Trigger examples:

- Peak extraction crashes or times out.
- Empty/invalid peak arrays.
- Performance spikes on load.

Response:

- Fall back to current rendering path for affected source.
- Record failure with source/project context.
- Keep timeline interaction path disabled if peak data is unsafe.

## Handling Hydration Failures

Trigger examples:

- Invalid restore state after load.
- Stale active loop/focus references not normalized.
- Project switch leakage.

Response:

- Disable affected unified flag(s).
- Confirm canonical hydration path (`activateHydratedProjectState` behavior) still intact in fallback path.
- Block rollout progression until deterministic fallback behavior is restored.

## Handling Playback Sync Drift

Trigger examples:

- Visual playhead diverges from audible playback.
- Transport time and timeline position desync.
- Drift worsens at high zoom or during follow motion.

Response:

- Disable affected flag(s).
- Validate fallback timeline playback sync.
- Capture reproducible context (source, zoom, actions, browser/device).

## Conditions That Block Broader Rollout

Any of the following blocks expansion/default enablement:

- Semantic regressions in restart/scope/loop behavior.
- Save/reload/hydration regressions causing stale or corrupted state.
- Critical seek/playback synchronization bugs.
- Mobile practice-flow regressions.
- Cloud parity failures (before production default enablement).

## Manual Verification Before Enablement

Before increasing rollout scope for any flag:

- Run applicable sections of `UNIFIED_TIMELINE_REGRESSION_MATRIX.md`.
- Verify fallback toggles still work and can be applied safely.
- Verify local restore and project switching remain deterministic.
- Verify no unresolved blocker in source/form-factor being enabled.

Before production default enablement:

- Full regression matrix pass (upload + YouTube + mobile).
- Cloud parity validation complete.
- Backcompat/hydration hardening validated.
- Explicit manual signoff by architecture/product owner.
