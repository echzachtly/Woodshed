# Woodshed — Global UX Unification Roadmap

## Purpose

The YouTube workspace implementation evolved into a full interaction-philosophy proving ground for Woodshed.

This document defines:
- what should become global across Woodshed
- what should remain source-specific
- how to safely roll out the new interaction system
- the phased implementation plan
- stabilization/testing priorities before external user testing

This is now one of the highest leverage stages of the entire project.

The goal is no longer simply:
> "make looping software"

The goal is now:
> build a focused, musician-first deliberate practice environment.

---

# Core Product Philosophy

The YouTube refinement work exposed several important truths about Woodshed.

## Woodshed is NOT a DAW

Woodshed should not optimize for:
- maximum editing power
- dense controls
- technical workflows
- feature-heavy production paradigms

Woodshed SHOULD optimize for:
- practice flow state
- low-friction interaction
- fast repetition
- muscle memory
- immersion
- emotional calmness
- intentionality
- intelligent behavior

The app should feel:
- instrument-like
- spatial
- responsive
- collaborative

NOT:
- configuration-heavy
- menu-driven
- software-state-machine-y

---

# Major Architectural Decision

## Separate Interaction Language From Media Rendering

This is critically important.

We are NOT globally adopting:
- synthetic waveform rendering
- YouTube-specific metadata presentation
- source-specific visuals

We ARE globally adopting:
- interaction philosophy
- region hierarchy
- mode behavior
- playback logic
- intentional gesture handling
- practice/edit workflow
- waveform dominance
- adaptive workspace behavior

Meaning:
- uploaded audio projects still use real waveforms
- YouTube projects still use synthetic timeline rendering
- future sources can use source-specific rendering

BUT:
all Woodshed projects should feel behaviorally unified.

---

# What Becomes Global

## 1. Practice Mode ↔ Edit Mode

The old “lock” mental model is deprecated.

Global Woodshed behavior becomes:

### Practice Mode
- protects against accidental edits
- playback-focused
- calmer visual presentation
- editing affordances subdued
- safe navigation mode

### Edit Mode
- editing affordances visible
- drag/move/resize/create enabled
- authoring-focused

Important:
Practice Mode prevents accidental editing.
It does NOT block intentional authoring.

Intentional gestures may automatically transition the user into Edit Mode.

Examples:
- Shift+drag create
- double-click region
- explicit create actions

This becomes a global Woodshed interaction law.

---

## 2. Intent-Based Interaction Philosophy

The app should infer user intent whenever possible.

Examples:
- clicking outside phrase while looping phrase → Playthrough
- selecting focus loop inside phrase → Focus Loop mode
- clicking outside focus but inside phrase → Phrase Loop mode
- double-clicking region → Edit intent
- Shift+dragging → Authoring intent

The app should feel collaborative rather than restrictive.

This philosophy becomes global.

---

## 3. Global Region System

The new YouTube region hierarchy should become the global Woodshed region language.

### Phrase Regions
Structural layer.
Broad practice targets.

### Focus Loops
Foreground interaction layer.
Nested inside phrases.
Smaller/more concentrated visual treatment.

### Desired Relationship
Focus Loops should visually feel embedded INSIDE Practice Sections.

Not adjacent.
Not equivalent.

The relationship should immediately communicate:
> “this is the smaller drill area inside the larger practice target.”

---

## 4. Global Waveform Dominance

The waveform/timeline is the stage.

Everything else is secondary/contextual.

This becomes a core layout principle globally.

Implications:
- reduce unnecessary vertical stack density
- adaptive workspace compression
- stronger timeline dominance
- reduced dead space
- better spatial continuity

---

## 5. Global Playback Intelligence

Playback should behave contextually.

Examples:
- Playthrough behaves like full-song phrase
- restart behavior follows active playback context
- timeline clicks update playback context
- click-to-seek works globally
- playback ranges adapt intelligently

This should feel natural and invisible.

---

## 6. Global Zen / Focus Workspace Philosophy

Zen Mode should evolve into:
> practice-focused workspace compression

NOT:
> arbitrary panel hiding

Goals:
- immersion
- reduced distraction
- waveform emphasis
- playback focus
- calmer visual hierarchy

This should become global.

---

# What Stays Source-Specific

## Synthetic Timeline Rendering

The synthetic helix waveform remains specific to:
- YouTube projects
- non-waveform sources
- abstract media sources

Uploaded audio projects should continue using real waveform rendering.

---

## Source Metadata Presentation

YouTube:
- song title
- channel/artist
- session-oriented framing

Uploaded audio:
- potentially different metadata hierarchy
- may later evolve differently

The guiding principle globally:
- reduce technical metadata
- increase practice/session framing

---

# Required Documentation Before Implementation

Before major global migration begins, create/update the following docs.

---

## 1. GLOBAL_INTERACTION_PHILOSOPHY.md

Purpose:
Define Woodshed’s interaction laws.

Should document:
- Practice vs Edit behavior
- intentional gesture philosophy
- playback intent logic
- click behavior
- selection behavior
- timeline interaction rules
- mode transition rules
- keyboard shortcut behavior

This becomes the canonical interaction reference.

---

## 2. GLOBAL_REGION_SYSTEM.md

Purpose:
Define the global visual and behavioral language for:
- Practice Sections
- Focus Loops
- active states
- hover states
- selection states
- playback states
- hierarchy rules

Should include:
- visual hierarchy
- spacing rules
- z-index layering
- active-state logic
- nested-region behavior

This becomes the canonical region design system.

---

## 3. WORKSPACE_LAYOUT_PRINCIPLES.md

Purpose:
Define:
- waveform dominance
- adaptive compression
- Zen mode philosophy
- vertical hierarchy rules
- panel behavior
- responsive behavior
- mobile vs desktop layout goals

This prevents future UI drift.

---

## 4. PLAYBACK_STATE_MACHINE.md

Purpose:
Document:
- Playthrough
- Phrase Loop
- Focus Loop
- transitions between them
- click-to-seek logic
- playback range ownership
- restart behavior

This is extremely important now that playback behavior is becoming intelligent/contextual.

---

## 5. MOBILE_INTERACTION_GUIDELINES.md

Purpose:
Define:
- mobile editing philosophy
- practice-first workflow
- transport hierarchy
- gesture behavior
- thumb ergonomics
- mobile mode switching
- mobile Zen mode behavior

This is important because Woodshed is now intentionally bifurcating:
- desktop = authoring
- mobile = practice-first

---

# Implementation Roadmap

# PHASE 1 — Documentation & Architecture Freeze

## Goal
Prevent UX drift before global rollout.

## Tasks
- create the docs listed above
- finalize Practice/Edit philosophy
- finalize playback-state philosophy
- finalize region hierarchy philosophy
- freeze core interaction rules
- document mobile/desktop responsibilities

## Deliverables
- canonical interaction documentation
- canonical region system documentation
- canonical playback logic documentation

## Important Constraint
Do NOT implement new major features during this phase.

This phase is about clarity.

---

# PHASE 2 — Global Interaction System Migration

## Goal
Unify behavior globally before visual unification.

## Tasks

### Practice/Edit Migration
- remove old lock behavior globally
- implement Practice/Edit system globally
- unify mode transitions
- unify intentional gesture behavior

Checkpoint (2026-05-16):
- YouTube and uploaded-audio desktop surfaces now share symmetric Practice/Edit toggles.
- Practice/Edit transport pill toggles mode directly in both media paths.
- Neutral timeline double-click behavior is symmetric (Practice -> Edit -> Practice) for phrase/focus targets.

### Playback Intelligence Migration
- click-to-seek everywhere
- playback context transitions
- Playthrough behavior
- restart behavior
- loop narrowing/broadening logic

### Timeline Interaction Migration
- timeline clicks
- region clicks
- region selection
- double-click editing
- Shift+drag behavior

## Deliverables
- globally consistent interaction model
- globally consistent playback behavior

## Important Constraint
Behavior consistency matters more than visual consistency during this phase.

---

# PHASE 3 — Global Region System Unification

## Goal
Apply the new region hierarchy globally.

## Tasks

### Practice Section Styling
- port YouTube phrase visual treatment
- unify border/shadow behavior
- unify active-state logic
- unify spacing/radius philosophy

### Focus Loop Styling
- port nested/inset visual treatment
- improve embedded feeling
- unify glow/selection behavior
- improve hierarchy readability

### Region Layering
- phrase = structural plane
- focus = foreground plane
- playback cursor = top authority

## Deliverables
- unified Woodshed region language
- improved practice hierarchy clarity

## Important Constraint
Do NOT globally port the synthetic timeline rendering.
Only the region system.

### Current checkpoint (2026-05-16)

- Canonical visual language now exists as shared tokens (`lib/regions/region-visual-language.ts`) and shared state derivation (`lib/regions/region-visual-state.ts`), but parity is still perceptually incomplete in uploaded-audio timelines.
- Immediate priority pass: focused timeline visual refinement + parity (labels, hierarchy, depth, hover polish, active/inactive balance) across both YouTube and uploaded-audio surfaces.
- Non-negotiable constraint for this pass: preserve playback/interaction/persistence semantics and keep performance stable on desktop/mobile.
- Playback motion follow-up checkpoint: uploaded-audio must shift from per-frame `scrollLeft` visual motion to transform-led timeline motion (`baseScrollLeft + visualTranslateX`) so fixed-playhead playback feels as smooth as YouTube under high zoom while preserving WaveSurfer as timing/render authority.

Reconciliation note (2026-05-16, post-Phase-5A):

- Phase 4 manual QA completion was verified and reconciled in `docs/GLOBAL_UX_UNIFICATION_TODO.md`.

---

# PHASE 4 — Workspace Compression & Zen Mode

## Goal
Improve immersion and waveform dominance.

## Tasks
- global Zen mode system
- adaptive workspace compression
- collapsible lower panels
- waveform expansion behavior
- reduce dead space
- improve responsive hierarchy

### Mobile
- practice-first compression
- cleaner transport hierarchy
- adaptive lower stack behavior

## Deliverables
- more immersive practice environment
- stronger waveform-centric identity

---

# PHASE 5 — Playback Energy & Emotional Polish

## Goal
Make playback feel alive.

## Tasks
- active playback emphasis
- playback motion hierarchy
- active region energy
- smoother transitions
- subtle responsive animations
- hover synchronization
- selection continuity

## Deliverables
- emotionally responsive workspace
- less static feeling during playback

## Important Constraint
Avoid flashy/gaming-style animation.

---

# PHASE 6 — Stability & External Testing Preparation

## Goal
Prepare Woodshed for real-world testing.

## Tasks

### QA Pass
- desktop testing
- mobile testing
- tablet testing
- playback edge cases
- save/reload testing
- YouTube project switching
- upload project switching
- zoom/pan testing
- mode transition testing
- keyboard shortcut testing

### Friction Audit
Identify:
- onboarding confusion
- discoverability issues
- mode confusion
- editing friction
- practice friction
- mobile pain points

### Performance Pass
- animation smoothness
- waveform responsiveness
- region rendering performance
- mobile performance
- iframe interaction stability

## Deliverables
- stable beta-ready build
- documented known issues
- external testing checklist

---

# External User Testing Goals

The first real users are NOT testing:
- advanced features
- edge-case workflows
- customization systems

They are testing:
- clarity
- friction
- emotional feel
- discoverability
- immersion
- practice usefulness

Meaning:
The biggest risks now are:
- interaction confusion
- hierarchy confusion
- inconsistent behavior
- too much visible complexity

NOT:
- missing advanced features

---

# Final Strategic Reminder

Woodshed’s biggest differentiator is no longer:
> “looping audio.”

It is becoming:
# intelligent deliberate-practice workflow.

The YouTube workspace evolution exposed that.

That is now the product.

