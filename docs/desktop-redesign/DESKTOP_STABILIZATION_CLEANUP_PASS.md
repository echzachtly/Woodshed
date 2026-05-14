# Desktop Stabilization + Cleanup Pass

## Goal

Stabilize the current desktop redesign after the recent workstation, transport, and focus region changes.

This is not a feature expansion pass.

This is a cleanup, refactor, bug-chasing, and simplification pass.

## Important Product Context

Woodshed desktop is now a phrase-authoring workspace for creating practice material.

Mobile is the practice-focused experience.

The desktop app should remain:

- waveform-first

- calm

- focused

- musician-friendly

- desktop-native

- easy to use

## Do Not Change

Do not intentionally redesign the UI.

Do not add new features.

Do not change visible behavior unless required to fix a bug or simplify broken logic.

Preserve:

- desktop workstation layout

- minimap above main waveform

- unified transport bar

- play/restart cluster

- Fit All via minimap double-click

- speed control adjacent to loop mode

- contextual phrase/focus region actions

- bottom inspector

- mobile layout and behavior

## Cleanup Priorities

### 1. Remove Dead Code

Look for and remove:

- unused components

- unused props

- unused imports

- abandoned old transport buttons

- obsolete Fit All transport logic

- obsolete To Start button logic

- old mobile-stretched desktop layout leftovers

- unused CSS classes

- unreachable conditionals

### 2. Consolidate Transport Logic

The transport bar should have one clear system for:

- play/pause

- restart/replay

- loop modes

- speed control

- phrase actions

- focus region actions

Avoid duplicated playback logic across multiple components.

### 3. Normalize Terminology

Use consistent language.

Preferred user-facing terms:

- Phrase

- Focus Loop

- Focus Region

- Loop Phrase

- Play Through

Avoid user-facing terms like:

- Segment

- Subphrase

- Nested phrase

Internal code may still use `segment` if already established, but avoid confusing mixed terminology where practical.

### 4. Simplify State

Look for:

- duplicate booleans

- conflicting selected phrase/selected region state

- derived state stored unnecessarily

- stale loop mode state

- unnecessary prop drilling

- temporary workaround logic

Prefer clear, readable state relationships.

### 5. Improve Component Boundaries

Where practical, make the desktop structure easier to maintain.

Useful component boundaries may include:

- Desktop workspace

- Waveform/minimap area

- Transport bar

- Bottom inspector

- Focus region controls

- Phrase actions

Do not over-abstract.

Keep code readable.

### 6. Bug Chase

Check for bugs around:

- selecting phrases

- creating phrases

- editing phrases

- deleting phrases

- creating focus regions

- deleting focus regions

- switching between Loop Phrase, Focus Loop, and Play Through

- restart behavior

- speed changes

- minimap double-click Fit All

- mobile layout regressions

### 7. Preserve Mobile

Mobile is working well.

Do not redesign mobile in this pass.

Only make mobile changes if required to fix bugs introduced by shared logic.

## Success Criteria

After this pass:

- app builds successfully

- no obvious TypeScript errors

- no lint errors where possible

- no unused imports

- no obviously dead components

- transport logic is easier to understand

- focus region behavior is stable

- desktop layout is unchanged visually except for bug fixes

- mobile still works

- codebase feels simpler, not more abstract