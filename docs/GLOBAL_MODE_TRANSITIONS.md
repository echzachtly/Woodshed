# GLOBAL_MODE_TRANSITIONS

## Purpose

Define canonical mode transitions between Practice Mode and Edit Mode across desktop and mobile.

This document governs transition intent, guardrails, and compatibility behavior during lock -> Practice/Edit migration.

---

## Modes

### Practice Mode

- safe default posture
- playback and navigation first
- accidental structural edits prevented

### Edit Mode

- intentional structural authoring posture
- editing affordances available
- transitions should preserve playback correctness and stable selection context

---

## Entry Rules

### Desktop

Desktop may enter Edit Mode from:

- explicit edit controls
- intentional Shift+drag create
- intentional resize/trim handles
- double-click structural edit entry

### Mobile

Mobile enters Edit Mode only through explicit controls.

No implicit auto-entry from generic taps, drags, or chip selection in this phase.

---

## Exit Rules

- explicit Done/return actions
- deterministic fallback when edited target is removed
- project/media switches may defensively exit Edit Mode

Exiting Edit Mode must not leave stale unlocked handle state.

---

## Compatibility Alias Policy

- internal "lock/unlock" may remain as migration compatibility helpers
- user-facing language should standardize now on Practice Mode / Edit Mode
- persistence schemas should remain stable in early phases

---

## Transition Invariants

- only intentional gestures/actions should mutate structural data
- mobile practice flow is protected by default
- selection, editability, and playback scope remain coherent after each transition
- transition behavior is shared by contract, not duplicated ad-hoc in each surface

---

## Migration Guidance

Phase-safe extraction order:

1. pure transition helpers
2. shared intent adapters for WaveSurfer + Neutral Timeline
3. replace local branching with shared helpers
4. later conceptual lock alias removal once parity is verified
