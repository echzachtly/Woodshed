# Desktop Refinement + Internal Practice Regions

## Current Direction

The desktop redesign is moving in the correct direction.

The app now feels much more like a desktop-native phrase creation workspace rather than a mobile UI stretched onto desktop.

This next pass should focus on refinement, cohesion, workflow polish, and introducing phrase-internal practice regions correctly.

The goal of this pass is NOT adding more features.

The goal is making the existing experience feel intentional, cohesive, and professional.

---

# Core Product Philosophy

Woodshed is:

- a deliberate practice tool

- a phrase authoring environment

- a musician-focused workflow tool

Woodshed is NOT:

- a full DAW

- audio production software

- a project management tool

- a complex music editor

The interface should remain:

- calm

- sleek

- minimal

- focused

- musician-friendly

---

# Desktop UX Goals

The desktop app should feel:

- waveform-first

- timeline-centric

- immersive

- efficient

- workstation-inspired

- easy to learn

- fast to use

Borrow inspiration from:

- Ableton

- Notion

- Figma

- modern creative tools

But avoid:

- DAW complexity

- technical audio terminology

- dense control clusters

- overwhelming UI

---

# Refinement Priorities

## 1. Transport Bar Cohesion

The current transport/action area feels too disconnected.

Playback controls, phrase actions, and speed controls should feel like one unified desktop transport system.

### Current Problems

- Controls feel visually disconnected

- Tempo/speed selector feels isolated

- Spacing is inconsistent

- Some controls feel like floating buttons instead of a unified tool area

### Desired Direction

Create a tighter, more cohesive transport bar.

Example structure:

| Play | Time | Loop Mode | Phrase Controls | Divider | Speed |

### Goals

- Reduce visual fragmentation

- Improve alignment consistency

- Make controls feel intentionally grouped

- Reduce unnecessary spacing

- Make the transport feel like a real workstation control surface

---

## 2. Phrase Action Placement

Current phrase actions such as:

- Edit Loop

- Delete Loop

- Add Loop

feel disconnected from the primary playback workflow.

### Desired Direction

Move phrase editing actions closer to the transport/workflow area.

They should feel tied to playback and loop editing, not isolated in a separate form/settings area.

Possible directions:

- integrated transport actions

- contextual controls

- inline phrase editing actions

Avoid making the inspector feel like a CRUD/settings form.

---

## 3. Inspector Refinement

The inspector is useful, but currently feels too form-heavy and visually dominant.

### Desired Direction

The inspector should feel:

- contextual

- lightweight

- secondary to the waveform

The waveform should remain the primary focus of the application.

### Goals

- Reduce excessive vertical dominance

- Reduce “settings form” feeling

- Improve hierarchy inside inspector

- Make metadata feel more musical/creative and less administrative

### Important

Phrase metadata should feel elegant and inline.

Avoid overly large labeled form fields.

Prefer:

Phrase Title

0:03 → 0:28 • 25s

over large admin-style forms.

---

## 4. Reduce Mobile Spacing DNA

Some areas still feel too spaced out and mobile-inspired.

### Desired Direction

Desktop controls should feel:

- tighter

- more efficient

- more intentional

Reduce excessive:

- padding

- vertical gaps

- isolated spacing

- floating card feeling

Maintain elegance while improving density.

---

## 5. Preserve Waveform Dominance

The waveform is the heart of the application.

All layout decisions should support waveform interaction.

### Goals

- Preserve large waveform editing area

- Avoid inspector overpowering the workspace

- Keep the interface visually centered around audio interaction

---

# Internal Practice Regions (Previously Called Segments)

## Clarification

The feature previously referred to as "segments" should be treated as phrase-internal practice regions.

These are not standalone phrases.

They are not nested phrases.

They should not appear in:

- phrase selector pill

- project navigation

- global navigation

- primary phrase selection UI

---

# Core Use Case

A user creates a phrase for a 12-bar solo.

While practicing that phrase, the user realizes the turnaround is especially difficult.

The user should be able to quickly isolate that turnaround inside the parent phrase and loop it independently for focused repetition.

---

# Correct Mental Model

Project

→ Phrase

→ Internal Practice Regions

These regions exist only inside the context of the selected parent phrase.

They are NOT first-class navigation objects.

---

# UX Rules

- Keep the primary phrase selector clean

- Do not clutter project navigation

- Show practice regions only when the parent phrase is selected

- Keep region markers visually subtle

- Keep the waveform visually clean

- Avoid large labels directly on the waveform

- Prefer contextual editing interactions

---

# Suggested UI Language

Internally, the code may use `segment`.

In the user-facing UI, prefer language such as:

- Practice Region

- Focus Loop

- Section

Avoid making this feel like nested project management.

---

# Required Behavior

When a phrase is selected, the user should be able to:

- Create a practice region within the phrase

- Rename it

- Select it

- Loop only that region

- Delete it

- Return to looping the full parent phrase

- **Desktop:** Lock or unlock waveform boundary editing per focus region (desktop inspector). When unlocked, resize handles on the main phrase waveform update `startTime` / `endTime`; when locked, playback and looping use stored bounds without accidental waveform edits.

- **Desktop:** The **parent phrase** uses the same pattern: **Phrase waveform boundaries** in the inspector (plus transport / sidebar Edit) toggles `phraseWaveformEditUnlockedById`, aligned with `editableLoopId`. Phrase handles are **resize-only** (no whole-phrase drag), hidden while a focus region is selected in the inspector so boundary editing stays unambiguous.

If existing waveform interactions support boundary editing naturally, allow boundary adjustment as well.

---

# Important Constraint

Practice regions should feel:

- lightweight

- contextual

- musician-focused

- visually restrained

NOT:

- architectural

- administrative

- deeply hierarchical

- globally navigable

---

# Non-Goals

Do NOT implement:

- nested regions

- region trees

- region navigation in the phrase selector

- region search

- region stats

- region mastery systems

- heavy waveform labels

- complicated color systems

- DAW-style editing complexity

---

# Final Goal

The desktop app should feel like:

“the fastest and cleanest way to turn music into deliberate practice.”