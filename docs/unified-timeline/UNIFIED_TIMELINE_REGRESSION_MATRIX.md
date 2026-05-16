# UNIFIED_TIMELINE_REGRESSION_MATRIX

Status: Manual QA checklist baseline for unified timeline migration
Date: 2026-05-16

## Usage

- Run this matrix at each phase gate where timeline behavior changes.
- Treat any semantic drift in restart/scope/loop behavior as blocking unless explicitly approved.
- Capture pass/fail notes per item with environment (desktop/mobile, source, project kind).

## Test Dimensions

- Source: uploaded audio, YouTube
- Persistence context: local, cloud (when in scope)
- Form factor: desktop, mobile
- Session lifecycle: fresh load, switch, refresh, restore

## Core Preconditions

- [ ] At least one uploaded project with multiple Practice Sections and Focus Loops.
- [ ] At least one YouTube project with multiple Practice Sections and Focus Loops.
- [ ] At least one project with no Focus Loops.
- [ ] At least one stale-reference scenario fixture (deleted/invalid active IDs).

## Uploaded Audio Projects

- [ ] Project opens and waveform/timeline renders correctly.
- [ ] Play/pause works without drift or visual desync.
- [ ] Click-to-seek lands correctly at low/medium/high zoom.
- [ ] Scrub drag follows pointer without jumps.
- [ ] Restart returns to correct target by current playback scope.
- [ ] Loop phrase/focus/play-through semantics match existing behavior.
- [ ] Shift+drag Focus Loop creation still works (desktop).
- [ ] Practice Section editing still works when explicitly enabled.
- [ ] Focus Loop editing still works when explicitly enabled.

## YouTube Projects

- [ ] Project opens with correct timeline duration and playable state.
- [ ] Click-to-seek behavior matches upload intent contract.
- [ ] Playhead movement remains smooth and synchronized with playback.
- [ ] Loop scope transitions match upload path behavior.
- [ ] Restart target behavior matches upload path behavior.
- [ ] Shift+drag Focus Loop creation parity (desktop).
- [ ] Practice/Edit mode transitions remain symmetric with upload.

## Local Projects

- [ ] Save local upload project and reopen without state loss.
- [ ] Save local YouTube project and reopen without state loss.
- [ ] Active Practice Section/focus selection restores coherently.
- [ ] Loop mode/scope restores coherently.
- [ ] Stale saved references normalize deterministically.

## Cloud Projects (when applicable for phase)

- [ ] Save cloud upload project and reopen without state loss.
- [ ] Cloud restore mirrors local restore semantics.
- [ ] Active loop/focus fallback behavior matches local.
- [ ] Browser refresh restore for cloud project is coherent.
- [ ] No stale edit/selection leakage after cloud project switch.

## Desktop Layouts

- [ ] Timeline stage remains primary and usable in normal layout.
- [ ] Timeline interactions remain accurate with resized bottom stack.
- [ ] Inspector interactions do not break timeline responsiveness.
- [ ] Header/transport controls remain synchronized with timeline state.

## Mobile Layouts

- [ ] Practice-first transport remains intact (no redesign regressions).
- [ ] Tap seek behavior remains reliable.
- [ ] Pinch zoom still works and stays anchored.
- [ ] Focus chip selection behavior remains intact.
- [ ] Restart and loop controls remain easy and deterministic.

## Project Switching

- [ ] Switch upload->upload projects without stale state leakage.
- [ ] Switch YouTube->YouTube projects without stale state leakage.
- [ ] Switch upload<->YouTube without stale state leakage.
- [ ] Edit-mode/unlock state cleans up correctly on switch.

## Browser Refresh Restore

- [ ] Last active local upload workspace restores when valid.
- [ ] Last active local YouTube workspace restores when valid.
- [ ] Invalid pointer falls back safely to empty/open state.
- [ ] Refresh does not preserve stale active IDs.

## Hydration and Stale Selection Fallback

- [ ] Hydration path routes through canonical activation boundary.
- [ ] Missing active loop falls back deterministically.
- [ ] Missing active focus falls back deterministically.
- [ ] Invalid loop scope normalizes to valid scope.
- [ ] No stale `activeSegmentId` remains after load.

## Practice/Edit Mode Semantics

- [ ] Practice mode blocks accidental structural edits.
- [ ] Explicit edit entry works on desktop.
- [ ] Explicit done/exit clears unlocked state.
- [ ] Double-click existing region behavior remains symmetric (if enabled by path).
- [ ] No implicit mobile edit-mode entry from normal taps/chips.

## Playback Modes

### Loop Phrase

- [ ] Loop phrase boundaries are respected during playback.
- [ ] Click inside phrase body keeps phrase-loop semantics.

### Loop Focus

- [ ] Loop focus boundaries are respected during playback.
- [ ] Click different focus in active phrase retargets correctly.

### Playthrough

- [ ] Repeat off truly disables loop rail.
- [ ] Click outside active phrase resolves to playthrough semantics.

## Restart Behavior

- [ ] In Focus Loop scope, restart lands at focus start.
- [ ] In Practice Section loop scope, restart lands at section start.
- [ ] In Playthrough scope, restart follows transport-start policy.
- [ ] Restart after deleting active focus remains deterministic.

## Interaction Mechanics

### Click-to-seek

- [ ] Seek mapping is accurate near start, middle, end.
- [ ] Seek mapping remains accurate after pan and zoom changes.

### Cursor-centered Zoom

- [ ] Wheel zoom anchors cursor time (desktop).
- [ ] Pinch zoom anchors midpoint time (mobile/upload path).
- [ ] Zoom does not create timeline/playhead drift.

### Pan/Scroll

- [ ] Drag/pan behavior is smooth and deterministic.
- [ ] Edge auto-pan behavior (where enabled) remains correct.
- [ ] Scroll rebase logic does not produce visible jumps.

## Authoring and Region Editing

### Shift+drag Focus Loop creation

- [ ] Works in upload desktop path.
- [ ] Works in YouTube desktop path.
- [ ] Does not trigger accidentally in non-shift interactions.

### Practice Section editing

- [ ] Boundary edits clamp correctly and remain stable.
- [ ] Editing does not break active playback context.

### Focus Loop editing

- [ ] Boundary edits clamp inside parent section.
- [ ] Focus edit does not desync selection/scope state.

## Save/Reload Behavior

- [ ] Save then reload preserves timing bounds exactly.
- [ ] Save then reload preserves mode/scope preferences coherently.
- [ ] Save then reload preserves selection only when valid.
- [ ] Legacy/older shapes fail safely with deterministic fallback.

## Playback Synchronization

- [ ] Transport time, playhead, and audible playback remain aligned.
- [ ] Alignment holds at high zoom and during continuous playback.
- [ ] Alignment holds across pause/play/seek/restart operations.
- [ ] Alignment holds after project load and mode transitions.

## Blocking Criteria

Any of the following is rollout-blocking for the affected phase:

- [ ] Restart/scope semantics differ from baseline without explicit approval.
- [ ] Save/reload causes stale selection or timing corruption.
- [ ] Upload or YouTube path has critical seek/playback desync.
- [ ] Mobile practice-first flow is degraded.
- [ ] Cloud/local parity fails in phases requiring cloud readiness.
