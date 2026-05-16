# GLOBAL_INTERACTION_PHILOSOPHY

## Purpose

This document defines the canonical interaction law for Woodshed across all media surfaces (WaveSurfer upload projects, Neutral Timeline, and YouTube workspace pathways).

Behavior contracts in this document are authoritative over older wording that refers to "lock/unlock" as a primary model.

---

## Core Philosophy

Woodshed interaction should feel collaborative and intention-aware:

- infer likely user intent when confidence is high
- protect against accidental structural edits
- keep practice flow fast and calm
- preserve deterministic state transitions

Woodshed is not a DAW and should avoid mode complexity that requires constant manual toggles.

---

## Canonical User-Facing Modes

### Practice Mode

- default posture for playback, navigation, and repetition
- protects against accidental structural mutation
- allows contextual playback scope changes (Play Through, Practice Section loop, Focus Loop)

### Edit Mode

- explicit authoring posture for structural changes
- reveals editing affordances
- keeps playback behavior deterministic while edits occur

### Compatibility Alias

"Lock" remains an internal compatibility alias during migration.

Rules:

- user-facing copy should use Practice Mode / Edit Mode now
- persistence and schema should not be churned solely for naming migration in early phases
- full conceptual cutover is a later migration phase

---

## Intentional Gesture Entry

### Desktop

Desktop intentional gestures may auto-enter Edit Mode:

- Shift+drag create
- intentional handle resize
- double-click structural edit entry
- explicit create actions

This is required behavior.

### Mobile

Mobile does not auto-enter Edit Mode implicitly.

Rules:

- mobile remains practice-first by default
- structural edits require explicit Edit Mode entry first
- avoid precision-heavy waveform-direct authoring in this phase

---

## Interaction Contracts

1. **Timeline click outside active Practice Section:** always resolve to **Play Through**.
2. **Inside active Practice Section:** infer narrower or broader scope based on target (Focus Loop vs section body).
3. **Selection and playback scope must stay coherent:** no stale active Focus Loop references.
4. **State transitions must be deterministic:** same input state + gesture must produce the same result.

---

## Surface Responsibilities

### Shared Global Behavior (required everywhere)

- playback intent resolution
- mode transition semantics
- restart target resolution
- scope transition rules
- selection/fallback precedence

### Surface-Specific Rendering (allowed divergence)

- WaveSurfer visual rendering and handles
- synthetic timeline visuals in YouTube workspace
- source metadata presentation

Behavior should unify even when visuals differ.

---

## Non-Goals (for this phase)

- broad visual redesign
- component rewrites without parity validation
- persistence/schema mutation for naming cleanup alone
- mobile DAW-like dense editing workflows

---

## Validation Requirements

Before broad refactors:

- contracts are represented as pure shared helpers where feasible
- both upload and YouTube pathways consume equivalent behavior logic
- desktop and mobile differences are explicit and intentional
- regression tests cover playback and scope transitions
