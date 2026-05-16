# TIMELINE_INTERACTION_CONTRACT

## Purpose

Define canonical timeline interaction behavior shared across:

- WaveSurfer waveform timelines
- Neutral timeline systems
- YouTube workspace timeline pathways

This contract is behavior-first and renderer-agnostic.

---

## Canonical Intent Resolution

Given a timeline interaction at time `t`, resolve target in this order:

1. narrowest containing Focus Loop
2. narrowest containing Practice Section
3. gap (no containing region)

---

## Playback Intent Contract

### Rule A: Outside active Practice Section

Click/tap outside active Practice Section always resolves to:

- **Play Through**

This applies regardless of prior loop state.

### Rule B: Inside active Practice Section on Focus Loop

Resolves to:

- Focus Loop state for that Focus Loop

### Rule C: Inside active Practice Section body

Resolves to:

- Practice Section loop state

---

## Selection Contract

- selection updates must remain coherent with playback scope
- selecting a Focus Loop must never leave scope in conflicting state
- deletion of selected targets must follow deterministic fallback rules

---

## Restart Contract

Restart target is derived from active playback scope:

- Focus Loop scope -> Focus Loop start
- Practice Section loop scope -> Practice Section start
- Play Through -> play-through restart behavior

No surface should implement a divergent restart target for the same resolved state.

---

## Mobile vs Desktop

### Desktop

- supports waveform-direct authoring and intentional gesture inference
- timeline interactions may auto-enter Edit Mode for intentional structural gestures

### Mobile

- remains focus-chip-first for Focus Loop interaction in this phase
- requires explicit Edit Mode before structural mutations
- timeline interactions should prioritize safe practice navigation

---

## Implementation Requirements

- shared pure intent resolvers should own transition law
- surfaces adapt events to shared contract, not re-implement core logic
- persistence remains unchanged during early extraction; normalize on load
- regressions are validated with cross-surface playback-intent tests
