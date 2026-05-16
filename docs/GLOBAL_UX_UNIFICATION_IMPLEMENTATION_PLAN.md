# Global UX Unification Implementation Plan

## Scope and Objective

This plan defines a safe migration path for globally unifying Woodshed interaction behavior across uploaded-audio and YouTube-backed projects while preserving source-specific rendering.

Primary objective:
- unify interaction language, region hierarchy, playback intent, and mode behavior
- preserve stable persistence, playback correctness, and mobile practice flow
- avoid large rewrites until shared behavior boundaries are explicit and tested

Non-objective for this phase:
- full visual redesign
- synthetic waveform adoption for uploaded-audio
- broad component replacement without behavioral parity tests

## Current Architecture Understanding

### Runtime Surfaces

- `components/woodshed-workspace.tsx` is the production shell and primary orchestration layer for WaveSurfer playback, region wiring, panels, transport, persistence, and mobile/desktop layout branching.
- `components/youtube-workspace.tsx` is a dev-gated workspace that already validates the shared interaction model on a synthetic timeline through `MediaPlaybackSurface`.
- `components/neutral-timeline/neutral-timeline-prototype.tsx` provides source-agnostic timeline interactions (selection, shift-drag authoring, edit entry, zoom/pan) for non-WaveSurfer surfaces.

### State and Domain Model

- `store/woodshed-store.ts` is the single behavioral authority for phrase/focus data, playback state, loop scope, mode/edit flags, viewport/zoom state, and selection.
- `lib/loop-engine.ts` defines `PracticeLoop` (Practice Section) and `PhraseSegment` (Focus Loop) plus clamping/creation helpers.
- Playback intent currently composes through:
  - `lib/playback-loop-rail.ts`
  - `lib/focus-playback-segment.ts`
  - `lib/practice-loop-mode.ts`
  - `lib/youtube/neutral-timeline-playback-intent.ts`

### Interaction and Region Behavior

- Structural edit transitions are centralized in `lib/woodshed-enter-region-edit.ts`.
- WaveSurfer gesture and interaction helpers exist in focused modules:
  - `lib/shift-waveform-authoring*.ts`
  - `lib/waveform-cursor-zoom.ts`
  - `lib/waveform-mobile-pinch.ts`
  - `lib/wavesurfer-region-appearance.ts`
  - `lib/wavesurfer-region-time-bounds.ts`
- Neutral timeline equivalents exist for coordinate conversion, region clamping, and wheel zoom:
  - `components/neutral-timeline/timeline-coordinates.ts`
  - `components/neutral-timeline/synthetic-timeline-regions.ts`
  - `lib/neutral-timeline-wheel-zoom.ts`

### Persistence and Session Boundaries

- Local projects: `lib/project-db.ts` (Dexie), including audio blob lifecycle.
- Cloud projects: `lib/cloud-projects/client.ts` (Supabase).
- Practice playback context persistence: `lib/practice-state-persist.ts`.
- YouTube local persistence path: `lib/youtube/youtube-dexie-project.ts`.

### Layout and UX Boundaries

- Desktop:
  - `components/desktop-header-bar.tsx`
  - `components/desktop-transport-bar.tsx`
  - `components/desktop-inspector-panel.tsx`
  - `components/loop-sidebar.tsx`
- Mobile:
  - `components/mobile-practice-panel.tsx`
  - `components/mobile-phrase-bottom-sheet.tsx`
  - `components/mobile-project-practice.tsx`
  - `components/mobile-edit-actions-sheet.tsx`

### Styling Hierarchy

- `app/globals.css` and `lib/wavesurfer-region-appearance.ts` jointly define phrase/focus tier semantics (locked, active, editing, selected, mobile read-only overlays, editable handles).
- Region styling is partly shadow-DOM inline style driven and partly CSS fallback, which increases parity risk when changing behavior/state classes.

## Identified Risks and Conflicts

### High-Risk Coupling

- `components/woodshed-workspace.tsx` currently combines rendering orchestration, interaction mapping, persistence triggers, and mode transitions in one large surface.
- Loop/mode behavior is conceptually centralized but still has duplicated intent translation paths between WaveSurfer and Neutral Timeline.
- Phrase editability and focus editability use multiple store flags (`editableLoopId`, phrase/focus unlock maps), which can diverge without strict invariants.

### Behavioral Conflicts

- Legacy "lock" semantics and new Practice/Edit semantics coexist in naming and affordance behavior in several components/docs.
- Mobile focus-loop UX is intentionally chip-centric, while desktop allows waveform-direct interactions; this is correct but needs explicit parity rules for state transitions.
- YouTube path is gated by env flags and has partial parity by design, so "global" behavior must be expressed as shared contracts, not assumed from one workspace.

### Data and Migration Risks

- Persistence schema already stores loop/practice state assumptions; migration must preserve load behavior for existing projects.
- Playback mode defaults and restart semantics impact muscle memory and can create perceived regressions even when technically valid.
- Region layer styling relies on class composition and z-order semantics that can regress hierarchy clarity if changed in isolation.

## Shared-System Extraction Strategy

Extraction is behavior-first, not component-first.

### 1) Define Shared Interaction Contracts

Create small pure modules (no UI dependencies) that represent:
- pointer/tap intent resolution (gap, phrase, focus, edit-intent)
- mode transition rules (Practice/Edit with intentional gesture overrides)
- playback scope transitions and restart target resolution
- selection and fallback precedence rules (active focus vs last-used focus vs phrase)

Candidate location:
- `lib/interaction/` and `lib/playback/` (pure reducers/helpers only)

### 2) Introduce Timeline Adapter Contract

Formalize a timeline interaction adapter for both WaveSurfer and Neutral Timeline:
- seconds/pixels conversion
- visible window + scroll control
- region hit testing abstraction
- gesture capability flags (wheel zoom, pinch zoom, handle drag availability)

This reduces direct workspace branching and supports source-specific rendering under shared behavior.

### 3) Consolidate Region Tier State Derivation

Move phrase/focus visual-state derivation into a shared state calculator:
- `locked | active | editing | selected | editable`
- mobile read-only overlay policy
- loop scope emphasis policy

Renderers consume derived tier state rather than rebuilding conditionals in each workspace.

### 4) Stabilize Store Invariants

Codify and test invariants in store-layer helpers:
- active loop must exist when duration + loops exist
- active segment must belong to active loop
- edit unlock maps must be mutually coherent with `editableLoopId`
- deleting loop/segment must always produce deterministic playback scope fallback

## Dependency Ordering and Recommended Rollout

### Stage A — Contract Definition and Documentation Freeze

Dependencies:
- none (documentation and test scaffolding only)

Outputs:
- canonical behavior contracts
- migration guardrails
- acceptance tests to define parity targets

### Stage B — Playback Intent Unification (Pure Logic First)

Dependencies:
- Stage A contracts

Outputs:
- unified playback scope transitions, restart target logic, and selection precedence in pure helpers
- both workspaces consume same intent helpers

Rationale:
- playback is the highest-impact behavioral layer and easiest to validate with pure tests.

### Stage C — Mode and Authoring Intent Unification

Dependencies:
- Stage B complete

Outputs:
- unified Practice/Edit transition policy
- shared intentional gesture entry points (shift-drag, double-click, explicit create)
- reduced lock/edit ambiguity

### Stage D — Region Hierarchy Derivation Unification

Dependencies:
- Stages B/C complete

Outputs:
- shared tier derivation for phrase/focus styling and z-order semantics
- stable parity between WaveSurfer and Neutral Timeline states

### Stage E — Layout and Affordance Harmonization

Dependencies:
- behavior layers stable

Outputs:
- waveform dominance and contextual controls harmonized across desktop/mobile
- no change to source-specific rendering engines

### Stage F — Stabilization and Regression Sweep

Dependencies:
- all stages complete

Outputs:
- cross-surface regression certification
- release checklist and rollback switches

## Temporary Compatibility Strategy

- Maintain current persisted shape for loops/practice-state until all new invariants pass migration tests.
- Use transitional helpers that accept both legacy lock semantics and new Practice/Edit semantics; remove legacy path only after parity tests pass.
- Keep feature flags for workspace-specific behavior pivots that may need rollback.
- Preserve existing component public props while moving internal logic to shared modules to avoid broad UI churn.

## Regression-Risk Areas

Priority 1:
- restart behavior and loop boundary warping
- scope switching (`phrase` vs `practice_region` vs play-through)
- loop deletion/segment deletion fallback behavior
- save/load roundtrip for both local and cloud projects

Priority 2:
- zoom anchoring behavior (wheel and pinch)
- timeline click intent resolution near region edges
- phrase/focus handle hit-target behavior, especially mobile edit mode

Priority 3:
- visual hierarchy (phrase vs focus layering)
- minimap viewport sync
- onboarding milestone triggers tied to intentional authoring

## Mobile-Specific Considerations

- Mobile remains practice-first; waveform structural editing stays constrained and explicit.
- Focus-loop management remains chip-driven on mobile unless explicit future scope says otherwise.
- Edit affordances must satisfy touch target constraints and never block transport/restart flow.
- Bottom-sheet workflows must preserve quick return to practice (no deep navigation traps).
- PWA standalone safe-area behavior (`woodshed-pwa-mobile-shell`) must remain stable through layout changes.

## Playback-Specific Considerations

- Playback authority should be `LoopRail` + restart target helpers, not UI component-local rules.
- Click-to-seek must preserve intent transitions consistently across render surfaces.
- Tempo changes must preserve pitch where supported and degrade gracefully where unsupported.
- Boundary clamping and warp behavior must avoid oscillation/jitter near loop edges.
- Playhead UI sync should remain throttled but accurate (`lib/playhead-sync.ts`) across media surfaces.

## Validation Strategy

### Automated

- Expand pure unit tests for:
  - playback intent transitions
  - scope fallback rules
  - region clamp/move constraints
  - practice-state normalization and hydration
- Add contract tests that run shared interaction helpers against both timeline adapters.

### Manual

- Desktop authoring flow: create/edit/delete phrase and focus loops, restart, mode transitions.
- Mobile practice flow: chip selection, restart, loop mode cycle, bottom sheet operations.
- Cross-project switching: demo/local/cloud/youtube with persistence roundtrips.
- Zoom/pan ergonomics: wheel, drag-pan, pinch, minimap seek and pan.

## Phase 0 Exit Criteria

- This implementation plan and the phased TODO are approved.
- Clarifying questions are answered.
- Shared behavior contracts are accepted as canonical references.
- No implementation begins until compatibility and regression test strategy is explicitly accepted.
