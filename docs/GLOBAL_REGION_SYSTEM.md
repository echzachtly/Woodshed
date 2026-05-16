# GLOBAL_REGION_SYSTEM

## Purpose

Define the canonical region hierarchy and state derivation rules for Woodshed:

- Practice Sections (structural)
- Focus Loops (nested drill targets)
- active/selected/editing/playback emphasis states

This document is behavior-first and should apply across WaveSurfer and Neutral Timeline renderers.

---

## Region Hierarchy

### Practice Section

- structural container
- broad playback scope
- parent of zero or more Focus Loops

### Focus Loop

- nested inside a Practice Section
- narrower deliberate-practice target
- foreground interaction target when focus scope is active

---

## Canonical Layering Semantics

1. playback cursor has highest visual authority
2. active Focus Loop emphasis is foreground when Focus Loop scope is active
3. Practice Section remains visible as structural context
4. non-active regions stay legible but de-emphasized

No renderer should make Focus Loops feel like standalone peer objects to Practice Sections.

---

## Region State Derivation

Region state should be derived from shared logic, not duplicated ad-hoc conditionals.

Minimum derived state dimensions:

- `locked` / practice-safe
- `editing` / authoring-enabled
- `active` / current playback context
- `selected` / current interaction target
- `editable` / handle-enabled on this surface
- `mobile-readonly` overlays where applicable

---

## Interaction Boundaries

### Desktop

- waveform-direct region interaction allowed in Edit Mode
- intentional gestures may enter Edit Mode
- phrase and focus edit affordances must remain unambiguous

### Mobile

- focus-chip-first selection model in this phase
- Focus Loop waveform overlays remain practice-oriented and lightweight
- explicit Edit Mode required before structural mutation

---

## Deterministic Selection/Fallback Rules

When active Focus Loop context is invalidated, fallback must be deterministic:

1. next sibling Focus Loop
2. previous sibling Focus Loop
3. last-used Focus Loop in same Practice Section
4. Practice Section loop
5. Play Through

Never preserve stale active Focus Loop ids after data mutation.

---

## Implementation Guidance

- keep region derivation centralized in shared helpers
- allow renderer-specific paint primitives, but consume shared state semantics
- avoid persistence mutations in early extraction phases
- preserve existing public component interfaces when migrating to shared derivation
