# Product Requirements Document (PRD)

# Woodshed

### Precision Musical Phrase Isolation Workspace

---

# 1. Product Overview

## Vision

**Woodshed** is a desktop-first music practice workspace designed specifically for musicians learning songs by ear.

The product is built around one core workflow:

> Hear a phrase → isolate it → repeat it → master it.

Woodshed is not a DAW, transcription suite, media player, or clip launcher.

It is a focused environment for:
- isolating musical phrases
- slowing difficult passages down
- creating precise practice loops
- revisiting song sections over time
- deeply studying solos and musical phrasing

The primary target audience includes:
- guitar players
- harmonica players
- blues musicians
- jazz musicians
- musicians learning by ear
- musicians studying solos, phrasing, and timing

---

## Core Product Philosophy

Woodshed should feel:
- musical
- tactile
- focused
- premium
- confidence inspiring

The product should NOT feel:
- technical
- spreadsheet-like
- cluttered
- DAW-heavy
- engineering-focused

The waveform is the primary interaction surface.

Everything in the application should support one goal:

> Make isolating and practicing musical phrases feel effortless.

---

# 2. Product Positioning

## What Woodshed IS

Woodshed is:
- a musical phrase isolation workspace
- a precision looping environment
- a song study tool
- a practice session workspace
- a revisit-able song project system

---

## What Woodshed is NOT

Woodshed is NOT:
- a full DAW
- a recording tool
- a multitrack editor
- a streaming service
- a social platform
- a clip launcher
- a beat production tool
- a DJ application

---

# 3. Core User Workflow

## Primary Workflow

### Step 1 — Open Song Project

User:
- uploads local audio file
OR
- opens existing Woodshed project

Supported formats:
- MP3
- WAV
- M4A
- AAC
- FLAC (future consideration)

---

### Step 2 — Waveform Workspace Loads

Application:
- generates waveform
- initializes playback engine
- analyzes transients
- creates an initial editable loop automatically

The user should immediately feel:
> “I can start working right now.”

No setup friction.

---

### Step 3 — Identify Musical Phrase

User:
- listens to song
- zooms into area
- navigates waveform
- visually identifies phrase boundaries

---

### Step 4 — Refine Loop

User adjusts loop via:
- dragging loop edges
- transient snapping
- fine keyboard nudging
- double-click loop creation
- playback-assisted refinement

Loop edits should feel:
- smooth
- immediate
- trustworthy
- musical

---

### Step 5 — Name Practice Section

Examples:
- Intro
- Solo Chorus 1
- Turnaround
- Verse Fill
- Ending Run

Minimal organization.
Minimal friction.

---

### Step 6 — Practice

User:
- repeats loop
- slows tempo
- refines phrase
- revisits saved sections later

---

# 4. Product Pillars

## 1. Precision Phrase Isolation

This is the core product differentiator.

Success depends on:
- easy loop creation
- accurate boundary editing
- intuitive waveform interaction
- transient-assisted placement
- confidence-inspiring editing behavior

---

## 2. Waveform-First UX

The waveform is:
- the editor
- the navigator
- the project map
- the practice workspace

The loop list is secondary.

---

## 3. Long-Session Practice UX

Woodshed should support:
- focused study sessions
- repeated phrase work
- returning to songs over time
- low cognitive load
- minimal UI fatigue

---

## 4. Premium Audio Experience

Tempo shifting and looping quality are critical.

Playback must feel:
- stable
- seamless
- artifact-minimized
- musically usable

---

# 5. Core Features

# Audio Playback Engine

## Features
- Play/pause
- Stop
- Seek
- Relative seeking
- Current time tracking
- Playback synchronization
- Loop playback
- Seamless loop restarts

---

## Technical Requirements

### Required
- Low-latency playback
- Stable playback while zooming
- Smooth waveform synchronization
- No major drift between waveform and playback

---

## Critical Audio Requirements

### Loop Restarts
Loop transitions must avoid:
- clicks
- pops
- harsh discontinuities

Mitigation:
- micro-crossfades
- smoothing windows
- equal-power fades

---

## Tempo Engine

### Features
- Tempo range: 25%–150%
- Pitch preservation
- Real-time updates
- Loop-specific tempo memory

### UX Goals
Tempo changes should:
- feel immediate
- sound musical
- preserve clarity
- avoid distracting artifacts

---

# Waveform Workspace

## Description

The waveform is the primary interaction surface for the entire application.

It should feel:
- tactile
- responsive
- musical
- trustworthy

NOT:
- technical
- clinical
- engineering-heavy

---

## Core Features

### Navigation
- Drag-to-seek
- Scroll-to-zoom
- Cursor-centered zoom
- Smooth zooming
- Hover timestamps
- Auto-scroll during playback

---

### Visual Layers
- Primary waveform
- Playback cursor
- Saved loop overlays
- Active loop highlight
- Transient markers
- Mini-map overview waveform

---

## Mini-map Waveform

A persistent mini-map waveform should display:
- full song overview
- current zoom region
- playback position
- saved loops
- active loop

Purpose:
- improve orientation
- reduce zoom claustrophobia
- support rapid navigation

---

# Transient Detection System

## Description

Woodshed should automatically analyze songs and identify likely transient points.

Examples:
- note attacks
- phrase starts
- drum hits
- strong musical accents

---

## Purpose

Transient markers exist to:
- assist phrase isolation
- improve loop placement
- reduce editing friction
- help users find musical boundaries quickly

---

## UX Philosophy

Transient markers should feel:
- subtle
- assistive
- non-technical

NOT:
- cluttered
- DAW-heavy
- visually overwhelming

---

## Behavior

### Marker Visibility
Markers become more visible:
- while zoomed in
- during loop editing
- during hover interaction

---

### Snapping
Loop edges should:
- softly magnetize to nearby transients
- allow manual override
- never feel rigid or forced

---

# Loop System

## Philosophy

Loops are:
> saved musical study regions.

NOT:
- clips
- performances
- trigger pads

---

## Core Features

### Loop Creation
- Initial loop auto-created on project load
- Add Loop button
- Double-click waveform to create loop
- Drag-to-create loop
- Keyboard-assisted creation

---

## Loop Editing

### Editing Methods
- Drag loop edges
- Move loop region
- Fine keyboard nudging
- Snap-to-transient
- Manual override

---

## Loop States

### Active Loop
Currently selected editable loop.

### Saved Loop
Persisted practice section.

Inactive loops remain:
- visible
- dimmed
- selectable

Only one loop is actively editable at a time.

---

## Loop Naming

Users should be able to quickly rename loops.

Examples:
- Intro
- Chorus Fill
- Solo Phrase
- Turnaround

Complex organizational systems are intentionally avoided in MVP.

---

# Project System

## Description

Each song becomes a persistent Woodshed project.

Projects save:
- audio file reference
- saved loops
- loop names
- loop positions
- loop tempo settings
- active loop

---

## Project Goals

Users should be able to:
- revisit songs over time
- quickly return to practiced phrases
- continue study sessions seamlessly

---

# Keyboard Shortcuts

## Philosophy

Keyboard shortcuts should support:
- precision
- speed
- fluid editing

They should enhance the mouse workflow, not replace it.

---

## Planned Shortcuts

| Key | Action |
|---|---|
| Space | Play/Pause |
| Left Arrow | Rewind |
| Right Arrow | Fast Forward |
| + | Increase Tempo |
| - | Decrease Tempo |
| Double Click | Create Loop |
| Shift + Drag | Fine Adjustment |
| R | Restart Active Loop |

---

# 6. UI / UX Design Direction

## Design Philosophy

The interface should feel:
- calm
- focused
- premium
- studio-inspired
- distraction-free

---

## Desktop-First Design

Woodshed is intentionally desktop-focused.

Reasoning:
- precision waveform editing
- mouse-driven interaction
- hover states
- fine loop manipulation
- keyboard modifiers
- detailed waveform navigation

Mobile support is NOT a priority.

---

## Layout Direction

### Recommended Layout

```txt
------------------------------------------------
Top Transport Bar
------------------------------------------------

Large Primary Waveform Workspace

------------------------------------------------
Mini-map Navigation Waveform
------------------------------------------------

Compact Loop Sidebar / Bottom Tray
------------------------------------------------
```

---

## UI Priorities

### Highest Priority
1. Precision loop editing
2. Waveform readability
3. Fast phrase isolation
4. Minimal friction
5. Immediate playback response

---

## Interaction Priorities

### Most Important
- confident dragging
- smooth zooming
- trustworthy snapping
- easy loop edge selection
- clean visual feedback

---

## Animation Philosophy

Animations should:
- clarify state
- reduce cognitive load
- smooth transitions

Animations should NOT:
- slow interaction
- feel floaty
- reduce responsiveness

Responsiveness is more important than visual flourish.

---

# 7. Tech Stack & Architecture

# Frontend

## Stack
- Next.js 15
- React 19
- TypeScript

---

## Styling
- Tailwind CSS
- shadcn/ui

---

## Animation
- Framer Motion (minimal usage)

---

# State Management

## Zustand

Used for:
- playback state
- waveform state
- active loop state
- zoom state
- transport state
- project state

---

# Audio & Waveform Stack

## Waveform Rendering
- wavesurfer.js

---

## Planned Audio Enhancements
- rubberband-wasm
- WASM-based time stretching
- transient analysis engine
- advanced loop smoothing

---

# Persistence Layer

## Local Storage
- IndexedDB
- Dexie.js

---

## Stored Data
- projects
- loops
- settings
- tempo values
- active loop state

---

# Planned Architecture

## Audio Engine

```txt
/lib/audio-engine.ts
```

Responsibilities:
- playback control
- loop transitions
- tempo shifting
- synchronization
- transport logic

---

## Loop Engine

```txt
/lib/loop-engine.ts
```

Responsibilities:
- loop creation
- snapping behavior
- loop validation
- loop editing logic

---

## Transient Engine

```txt
/lib/transient-engine.ts
```

Responsibilities:
- transient detection
- snap-point generation
- transient caching
- waveform marker generation

---

## Waveform Manager

```txt
/lib/waveform-manager.ts
```

Responsibilities:
- waveform rendering
- zoom synchronization
- overlay rendering
- interaction coordination

---

# 8. Performance Requirements

## Required Performance Targets

| Feature | Target |
|---|---|
| Song Load | Under 3 seconds |
| Loop Response | Under 50ms |
| Zoom Responsiveness | Smooth |
| Playback Stability | No major drift |
| Loop Transition | Seamless |

---

# 9. Known Challenges

## High-Quality Time Stretching

Challenge:
- maintaining usable audio quality at slower tempos

Mitigation:
- WASM audio processors
- Rubberband integration
- avoid custom DSP initially

---

## Loop Seam Quality

Challenge:
- clicks/pops at loop boundaries

Mitigation:
- micro-crossfades
- smoothing
- transition envelopes

---

## Waveform Performance

Challenge:
- large audio files
- many overlays
- zoom complexity

Mitigation:
- optimized rendering
- throttled updates
- virtualization strategies

---

## Transient Detection Accuracy

Challenge:
- musical variability
- blues swing timing
- live recordings

Mitigation:
- assistive-only snapping
- manual override always available
- soft magnet behavior

---

# 10. Roadmap

# Phase 1 — Core Workspace MVP

### Goals
- stable playback
- waveform rendering
- auto-created loops
- loop editing
- tempo control
- transient detection
- project persistence

---

# Phase 2 — Precision Editing Improvements

### Features
- improved snapping
- refined zooming
- keyboard nudging
- mini-map waveform
- smoother transitions
- advanced waveform overlays

---

# Phase 3 — Practice Workflow Enhancements

### Features
- practice mode
- repeat counts
- tempo ramping
- practice sequencing
- session restoration

---

# Phase 4 — Advanced Project Features

### Features
- cloud sync
- export/import
- project sharing
- collaboration

---

# Phase 5 — Intelligent Assistance

### Potential Features
- chord detection
- transcription assistance
- BPM estimation
- phrase suggestions
- AI-assisted practice tools

---

# 11. Product Philosophy

Woodshed exists to reduce the friction between:
> hearing a musical phrase and mastering it.

Every decision should prioritize:
- precision
- simplicity
- focus
- musicality
- confidence
- usability

Woodshed should always feel like:
> a serious musician tool.

NOT:
- a bloated DAW
- a media player
- an engineering app
- a productivity dashboard

The experience should feel:
> immersive, focused, and musical.
