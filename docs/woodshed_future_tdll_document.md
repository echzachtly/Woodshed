# Woodshed — Future TDLL (To Do Later)

## Purpose

This document captures future ideas, workflow improvements, UX refinements, and long-term feature concepts discussed during Woodshed development.

These items are intentionally deferred so they do not pollute the current stabilization and refinement passes.

This is not a strict roadmap.
It is a future-thinking reference document.

---

# Desktop Workflow Enhancements

## Direct Waveform Phrase Creation

### Idea
Allow users to create phrases directly from waveform interaction.

### Potential Interactions
- Cmd/Ctrl + drag waveform
- Shift + drag waveform
- Double-click + drag waveform

### Desired Flow
User drags a waveform range:

Selection appears → release → phrase instantly created → auto-selected → optionally inline rename.

### Notes
- Modifier + drag is probably safer than double-click drag.
- Should avoid conflicting with pan/zoom interactions.
- Fits the waveform-first authoring philosophy extremely well.

---

## Ad Hoc Loop → Save As Phrase

### Idea
Allow users practicing a temporary loop/freeform selection to instantly convert it into a saved phrase.

### Example Flow
- User scrubs waveform
- Sets temporary loop
- Clicks + or “Save Phrase”
- Current selection becomes a saved phrase

### Notes
This strongly aligns with exploratory/freeform practice behavior.

---

## Keyboard Shortcut Expansion

Potential shortcuts:

- Space → Play/Pause
- R → Restart
- L → Cycle loop mode
- +/- → Zoom
- Arrow keys → Nudge boundaries
- Cmd/Ctrl + drag → Create phrase

---

## Waveform Focus Mode

### Idea
Temporary distraction-free waveform mode.

### Potential Behavior
- Hide inspector
- Minimize transport
- Expand waveform vertically

### Potential Shortcut
Tab key.

---

# Phrase / Focus Region Improvements

## Lock / Unlock Icon Refinement

### Current Observation
The current pencil/checkmark interaction for phrase boundary editing feels unclear.

### Desired Direction
Use explicit:
- Locked
- Unlocked

icons/states instead.

### Why
This better communicates:
- protected boundaries
- editable boundaries
- accidental edit prevention

Much more intuitive than generic “edit/done” UI.

### Applies To
- phrase boundary editing
- focus region boundary editing
- future ad hoc loops

---

## Phrase Boundary Direct Manipulation Refinement

### Goal
Phrase editing should feel identical to focus-region editing.

Potential future refinements:
- stronger hover affordances
- smoother handle interactions
- hover glow polish
- edge snap/nudge controls

---

## Focus Region Visual Refinement

Potential improvements:
- subtle tinting
- clearer active state
- hover previews
- stronger selected-region distinction

Avoid:
- visual clutter
- dense labels
- DAW-style overlays

---

## Focus Region Persistence Improvements

Potential future persistence:
- last-used focus region
- last playback mode
- per-phrase practice memory

---

# Mobile Practice Enhancements

## Lead-In Context

### Idea
Optional musical lead-in before phrase playback begins.

### Example
If phrase starts at 0:45:
- pressing play starts playback at 0:41
- user hears natural lead-in context
- phrase then loops normally

### Important
This is NOT a traditional count-in.

Goal is:
- musical phrasing
- hands-free preparation
- natural timing
- flow-state preservation

### Potential Controls
- Off
- 2s
- 4s
- 6s

### Notes
Should probably apply only to the initial playback pass, not every loop repetition.

---

## BPM-Aware Lead-In (Later)

### Possible Future Direction
Beat/bar-aware lead-ins.

### Examples
- 1 bar lead-in
- 2 bar lead-in
- metronome-assisted lead-in

### Important
Strongly deferred.
Avoid DAW complexity for now.

---

## Footswitch Support

### Importance
Potentially very important long-term.

Especially for:
- harmonica
- guitar
- bass
- saxophone
- piano
- drums

### Potential Inputs
- MIDI footswitches
- Bluetooth pedals
- HID devices
- keyboard-emulating pedals

### Important Actions
- restart
- play/pause
- loop mode cycle
- next focus loop

### Product Direction
Mobile app increasingly behaves like:
- a digital practice pedalboard

---

## Mobile Focus Loop Chips Refinement

Potential future improvements:
- better active-state visuals
- smoother transitions
- landscape-specific layouts
- faster thumb switching

---

## Landscape Mobile Enhancements

Potential future ideas:
- larger waveform focus
- stand-friendly layout
- enhanced hands-free operation
- tablet optimization

Avoid creating a separate landscape-only app.

---

## Gesture Refinements

Potential future work:
- smoother pinch zoom
- accidental-seek prevention
- inertial scrolling
- waveform momentum refinement
- better one-handed ergonomics

---

# PWA / App-Like Experience

## Offline Caching

Potential future support:
- cached projects
- cached waveform data
- cached recent sessions

### Important
Deferred intentionally.

---

## Faster Startup / App Shell

Potential future PWA improvements:
- faster resume
- persistent app shell
- smoother standalone launch

---

## Push Notifications / Reminders

Potential future features:
- practice reminders
- streak nudges
- scheduled practice prompts

Strongly deferred.

---

# Analytics / Feedback

## Session Replay Review

### Goal
Use PostHog session replay to:
- identify confusion
- detect waveform interaction friction
- observe practice flow
- detect unnecessary taps

---

## Feedback Workflow Refinement

Potential future improvements:
- in-app feedback capture
- screenshot attachments
- quick bug reporting
- tester tagging

---

# AI / Smart Features

## AI Phrase Detection

Potential future direction:
Automatically identify:
- repeated licks
- solos
- phrase boundaries
- difficult transitions

---

## AI Practice Suggestions

Potential future features:
- speed recommendations
- difficult-section suggestions
- practice sequencing
- adaptive repetition

---

## AI Difficulty Detection

Potential future analysis:
- phrase density
- note speed
- repetition complexity
- bend-heavy sections

---

# Product Philosophy Reminders

## Desktop

Desktop = Practice Authoring

- editing
- organization
- structure
- waveform manipulation
- phrase creation

---

## Mobile

Mobile = Practice Execution

- repetition
- flow state
- quick interaction
- hands-free awareness
- low friction

---

## Important UX Principle

Every extra tap interrupts practice.

---

## Important Design Principle

DAW-inspired, not DAW-complex.

---

## Important Workflow Principle

The waveform is the app.

---

## Important Interaction Principle

Contextual intelligence > additional UI controls.

