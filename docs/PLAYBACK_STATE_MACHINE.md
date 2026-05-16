# PLAYBACK_STATE_MACHINE

## Purpose

Define canonical playback states and transitions for Woodshed.

This state machine governs behavior across transport controls, timeline interactions, and restart behavior for all media surfaces.

---

## Core Playback States

### Play Through

- repeat disabled
- playback is not constrained to a Practice Section or Focus Loop rail
- timeline navigation is global

### Practice Section Loop

- repeat enabled
- rail is active Practice Section bounds

### Focus Loop

- repeat enabled
- rail is active Focus Loop bounds inside active Practice Section

---

## Core Inputs

- transport loop-mode cycle action
- timeline click/tap intent
- Focus Loop chip/selection action
- restart action
- structural deletion (Focus Loop / Practice Section)

---

## Canonical Transition Rules

### Timeline Intent

1. click/tap outside active Practice Section -> **Play Through**
2. click/tap inside active Practice Section body -> **Practice Section Loop**
3. click/tap on Focus Loop inside active Practice Section -> **Focus Loop**

### Loop Mode Cycle

- no Focus Loops in active section: Play Through <-> Practice Section Loop
- with Focus Loops: Play Through -> Practice Section Loop -> Focus Loop -> Play Through

### Restart Target

- Focus Loop state -> restart at resolved Focus Loop start
- Practice Section Loop state -> restart at Practice Section start
- Play Through -> restart policy follows transport context (no loop rail warp)

---

## Focus Loop Deletion Fallback

When active Focus Loop is removed, fallback order is:

1. next sibling Focus Loop
2. previous sibling Focus Loop
3. last-used Focus Loop in same Practice Section
4. Practice Section loop
5. Play Through

State must never retain a deleted or stale active Focus Loop id.

---

## Invariants

- repeat off implies Play Through semantics
- Focus Loop state requires a valid active Focus Loop in active Practice Section
- Practice Section Loop requires valid active Practice Section bounds
- invalid focus scope must degrade deterministically (not silently drift)

---

## Compatibility Constraints

- preserve persisted shapes during early extraction
- normalize persisted playback prefs on load
- avoid schema/version bumps unless behavior cannot be stabilized otherwise

---

## Testing Requirements

Minimum automated coverage:

- timeline intent transitions among all three states
- restart target resolution per state
- deletion fallback precedence
- hydration normalization for stale focus ids and stale scopes
