# Woodshed Application State Model

## Purpose

This document defines the behavioral state model for Woodshed.

It exists to prevent overlapping state machines, onboarding condition drift, terminology confusion, and UI logic sprawl as the app evolves.

This document should be treated as a product and architecture reference for:
- project loading
- empty workspace behavior
- onboarding triggers
- desktop/mobile divergence
- WaveSurfer lifecycle decisions
- terminology consistency

**Related:** [`TERMINOLOGY_GLOSSARY.md`](TERMINOLOGY_GLOSSARY.md) · onboarding persistence: `lib/onboarding/`

---

# Product Philosophy

Woodshed is a focused musical practice environment.

Woodshed is not:
- a DAW
- a multitrack audio editor
- a dashboard product
- a productivity app
- tutorial-heavy software

Woodshed should feel:
- musical
- tactile
- minimal
- immersive
- fast
- focused on deliberate practice

The user should feel like they are inside a practice tool immediately, even when no audio is loaded.

---

# Core Product Model

## Project

A saved song workspace that contains:
- audio
- Practice Sections
- Focus Loops
- playback settings

## Practice Section

A larger section of a song used to organize practice material, such as:
- verse
- chorus
- solo
- turnaround

Practice Sections can contain one or more Focus Loops.

## Focus Loop

A smaller loop inside a Practice Section used to isolate and repeat a difficult musical moment.

## Loop

A playback behavior.

Both Practice Sections and Focus Loops can be looped, but "Loop" should usually describe playback behavior rather than the primary saved object name.

## Region

A technical implementation term for a timed range on the waveform.

Avoid using "Region" in user-facing UI.

---

# Internal Mapping

The current implementation may not use final user-facing terminology internally.

For now, preserve internal model names unless a dedicated refactor is planned.

| User-Facing Concept | Current/Internal Concept |
|---|---|
| Project | Saved workspace/session with audio and practice data |
| Practice Section | `PracticeLoop` / outer span |
| Focus Loop | `PhraseSegment` / inner span inside a Practice Section |
| Region | WaveSurfer timed range / technical implementation detail |
| Playback | Audio playback state, repeat behavior, position, and speed |

Do not rename internal TypeScript models as part of onboarding implementation unless absolutely necessary.

Terminology changes should initially happen at the UX/string/documentation layer.

---

# State Ownership

## Woodshed Store

The main Woodshed store should own musical/session state.

This includes:
- loaded project metadata
- duration
- Practice Sections
- Focus Loops
- selected section/loop
- playback speed
- loop/repeat behavior
- waveform zoom
- editor state that directly affects music interaction

The main Woodshed store should not own:
- onboarding completion flags
- first-run hints
- marketing/tutorial state
- user education state

---

## Onboarding Persistence

Onboarding state should live outside the main Woodshed store.

Recommended location:
- `lib/onboarding/*`

Recommended persistence:
- localStorage-backed
- versioned schema
- user/device-level
- not synced across devices for now

Onboarding flags must survive:
- `resetWorkspace()`
- project switches
- demo loading
- imports
- local/cloud restore

Onboarding flags should not be saved into project files.

---

## Ephemeral Workspace State

Ephemeral state may live in local component state or derived helpers.

Examples:
- currently visible hint
- temporary hover affordance
- ghost drag animation visibility
- currently active onboarding nudge

Avoid persisting ephemeral animation or tooltip state unless it represents a meaningful completed milestone.

---

# Core Application States

These are conceptual product states. They do not necessarily need to exist as a single enum in code, but implementation should be consistent with this model.

---

## 1. Empty Workspace

### Meaning

The user is inside Woodshed, but no audio has been loaded yet.

### Conditions

Approximate technical indicators:
- WaveSurfer may be mounted or ready
- no decoded duration
- no active audio blob
- no pending project hydration
- no pending demo hydration

### UX Behavior

The app should show an in-workspace empty state.

It should not show a separate dashboard.

The workspace shell should still feel like Woodshed.

Primary actions should include:
- Create New Project
- Open Demo Project
- Open Saved Project, if available

### Notes

"Create New Project" means open the audio import/file picker.

Do not create blank project shells, project setup forms, or DAW-style empty projects.

---

## 2. Hydrating Project

### Meaning

A saved project, cloud project, local project, or demo project is being loaded.

### Conditions

Approximate technical indicators:
- pending hydration reference exists
- demo hydration reference may exist
- WaveSurfer is loading audio
- decode has not completed yet

### UX Behavior

Show minimal loading state.

Avoid onboarding hints during hydration.

Hydration is not the same as user learning.

---

## 3. Audio Loaded

### Meaning

Audio has decoded and a waveform/timeline exists.

### Conditions

Approximate technical indicators:
- decoded duration is greater than zero
- WaveSurfer has loaded audio
- waveform timeline is available

### UX Behavior

The user should now be able to interact with the waveform.

Desktop may begin subtle authoring guidance if onboarding conditions are met.

---

## 4. Practice Section Present

### Meaning

A Practice Section exists.

This may be:
- auto-created during import/bootstrap
- restored from a saved project
- created manually by the user
- loaded from the demo project

### Important Rule

A Practice Section existing does not mean onboarding is complete.

Auto-created/default Practice Sections are scaffolding.

They do not prove the user understands the workflow.

---

## 5. Focus Loop Present

### Meaning

At least one intentional Focus Loop exists inside a Practice Section.

### Conditions

Approximate technical indicators:
- at least one inner segment exists inside a Practice Section
- or future implementation records a user-authored Focus Loop creation event

### Important Rule

Desktop onboarding success should be tied to intentional Focus Loop creation, not merely the existence of loaded/demo/restored data.

---

## 6. Active Practice Project

### Meaning

The user is working in a real project with audio and at least one meaningful practice structure.

### Conditions

May include:
- decoded audio
- one or more Practice Sections
- optionally one or more Focus Loops
- active playback/editing context

### UX Behavior

Normal Woodshed workspace behavior.

Onboarding hints should mostly be dismissed or inactive unless the user has not completed the relevant milestone.

---

## 7. Mobile Practice Mode

### Meaning

The same project/session is being experienced through a mobile-first practice interface.

### Conditions

Approximate technical indicators:
- mobile viewport
- audio/project loaded
- mobile practice UI active

### UX Behavior

Mobile should prioritize:
- tapping Focus Loops
- playback
- repeat behavior
- tempo adjustment

Mobile should not prioritize:
- dense waveform authoring
- complex editing
- desktop-style management

---

## 8. Demo Project Loaded

### Meaning

The user explicitly chose to open the demo project.

### Important Rule

The demo project should never auto-load.

Opening the demo project is an intentional user action.

### Onboarding Rule

Opening the demo does not complete desktop onboarding.

Viewing or playing demo content is not the same as learning to author a Focus Loop.

However, after demo exploration, onboarding hints may become more subtle to avoid nagging.

---

# Onboarding Success Criteria

## Desktop Success

Desktop onboarding is complete when the user intentionally creates a Focus Loop inside a Practice Section.

Not sufficient:
- opening the app
- opening the demo
- importing audio
- auto-created Practice Section
- restored project already containing Focus Loops

The desktop workbench workflow is learned when the user authors a deliberate practice target.

---

## Mobile Success

Mobile onboarding is complete when the user understands how to practice prepared material.

A reasonable completion condition may be:
- user selects or plays a Focus Loop
- user interacts with playback/repeat controls
- user discovers tempo adjustment

Mobile onboarding should be lighter than desktop onboarding.

---

# Onboarding Trigger Rules

## Empty Workspace Trigger

Show when:
- no audio is loaded
- no hydration is pending
- no active project is open

Purpose:
- direct user toward Create New Project
- offer Open Demo Project
- offer Open Saved Project if available

---

## Desktop Focus Loop Authoring Trigger

Show when:
- desktop viewport
- audio is loaded
- at least one Practice Section exists
- no user-authored Focus Loop exists
- desktop onboarding has not been completed

Do not count an auto-created Practice Section as onboarding success.

---

## First Focus Loop Success Trigger

Complete desktop onboarding when:
- user intentionally creates a Focus Loop inside a Practice Section

This should be event-based where possible, not only shape-based.

Reason:
- demo/restored projects may already contain Focus Loops
- loaded data does not prove user learning

---

## Mobile Playback Trigger

Show when:
- mobile viewport
- prepared project is loaded
- Focus Loops exist
- mobile onboarding has not been completed

Purpose:
- teach tap-to-practice behavior
- teach tempo/repeat behavior

---

# Demo Project Rules

The demo project should:
- be prominently accessible
- be selectable from the empty workspace
- teach through example
- never auto-load

The demo project should not:
- force first-time users into a fake project
- complete desktop onboarding automatically
- replace actual user-authored Focus Loop creation

---

# Create New Project Rules

"Create New Project" should:
- open the audio import/file picker immediately
- reset the current workspace only when a new audio file is selected
- treat the imported audio as the start of the project

"Create New Project" should not:
- create a blank project shell
- show a setup wizard
- require naming before import
- create a DAW-style empty timeline

---

# WaveSurfer Lifecycle Notes

WaveSurfer lifecycle and Woodshed product state are related but not identical.

Important distinctions:
- WaveSurfer mounted does not mean audio is loaded.
- Audio decoded does not mean onboarding is complete.
- Practice Section present does not mean a user created a Focus Loop.
- Demo hydration does not mean desktop onboarding success.

Avoid coupling onboarding too tightly to WaveSurfer decode events.

Prefer:
- derived workspace state
- explicit user intent events
- small persistence helpers
- clear hydration gates

---

# Bootstrap Behavior

Keep the current bootstrap behavior unless a dedicated product decision changes it.

When audio is imported, Woodshed may automatically create an initial/default Practice Section.

This is acceptable because:
- it provides immediate musical context
- it avoids a dead empty waveform
- it supports fast orientation

However:
- the default Practice Section is scaffolding
- it does not count as a user-created Focus Loop
- it does not complete onboarding

---

# Desktop vs Mobile Rules

## Desktop

Desktop is the workbench.

Desktop should prioritize:
- importing audio
- organizing Practice Sections
- creating Focus Loops
- editing timing
- preparing practice material

Desktop onboarding should teach:
- the waveform is interactive
- Practice Sections organize the song
- Focus Loops isolate difficult moments

---

## Mobile

Mobile is the practice instrument.

Mobile should prioritize:
- choosing prepared material
- playing Focus Loops
- repeating difficult moments
- slowing down playback
- staying in practice flow

Mobile onboarding should teach:
- tap a Focus Loop to practice
- use playback controls
- adjust tempo

Mobile onboarding should avoid:
- dense editing
- desktop workbench concepts
- complex tutorial flows

---

# Derived State Over Competing State Machines

Avoid creating multiple independent state machines for:
- app phase
- onboarding phase
- waveform phase
- mobile phase
- hint phase

Prefer derived state.

Example:
- Empty Workspace can be derived from audio/load/hydration state.
- Focus Loop onboarding eligibility can be derived from platform, onboarding flags, and project graph.
- Mobile onboarding eligibility can be derived from platform, loaded project, available Focus Loops, and flags.

Persist milestones.

Derive presentation.

Do not persist transient UI phases unless necessary.

---

# Implementation Guardrails

Do:
- keep onboarding flags outside project data
- keep onboarding flags outside the main music store
- gate demo loading behind explicit user action
- use user-facing terminology consistently
- keep desktop and mobile onboarding separate
- favor small implementation phases

Do not:
- auto-load the demo
- complete onboarding from demo viewing alone
- rename internal models prematurely
- build modal tutorials
- introduce heavy dashboards
- block the user from interacting
- make mobile behave like desktop

---

# Recommended Implementation Order

## Phase 1 — Infrastructure

- Add `lib/onboarding/*`
- Add versioned localStorage onboarding flags
- Gate or disable automatic demo project loading
- Preserve explicit demo loading
- Make no visual onboarding changes yet

## Phase 2 — Empty Workspace

- Add in-workspace empty state
- Show Create New Project, Open Demo Project, and Open Saved Project if available
- Keep workspace shell visible
- Avoid separate dashboard feel

## Phase 3 — Desktop Onboarding

- Add subtle waveform affordances
- Add Focus Loop authoring guidance
- Complete desktop onboarding only after intentional Focus Loop creation

## Phase 4 — Mobile Onboarding

- Add lightweight mobile practice guidance
- Emphasize selecting/playing Focus Loops
- Introduce tempo/repeat behavior subtly

## Phase 5 — Terminology String Sweep

- Update high-impact user-facing strings
- Preserve internal TypeScript names unless separately planned
- Avoid broad refactors

---

# Non-Goals

Do not implement the following as part of initial onboarding:
- analytics event schema
- A/B testing
- guided multi-step tutorials
- onboarding reset UI
- account-synced onboarding flags
- mobile-specific demo asset
- large TypeScript model rename
- route-level dashboard

These may be considered later, but they are not required for the initial onboarding foundation.
