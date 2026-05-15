# Woodshed terminology glossary

This document defines **canonical user-facing terminology** for Woodshed. It aligns product copy, onboarding, and UX writing across desktop and mobile.

When user-facing strings in the app still use older words (“phrase,” “focus region,” etc.), treat this file as the **target vocabulary**; migrate strings incrementally without renaming TypeScript types unless explicitly approved.

For how internal code maps to these terms, see **Internal model mapping** below.

For product-level application states, onboarding triggers, and state ownership, see [`APPLICATION_STATE_MODEL.md`](APPLICATION_STATE_MODEL.md).

---

## User-facing concepts

### Project

A **saved song workspace** that contains:

- the **audio** for that song,
- **Practice Sections** and their **Focus Loops**,
- and **playback** settings (speed, repeat mode, position, etc.) associated with that material.

**Note:** In Woodshed, **importing audio with intent to save** effectively *creates* the project identity; there is no separate “empty project wizard” or DAW-style project shell before audio.

---

### Practice Section

A **larger timed span** of the song used to organize practice material (e.g. verse, chorus, solo, turnaround).

- A Practice Section lives on the **Timeline** and is shown on the **Waveform**.
- Practice Sections exist in a **list** users can browse (desktop sidebar / mobile picker).
- Users may **loop** playback within a Practice Section (behavior: repeating that span).

---

### Focus Loop

A **smaller loop inside a Practice Section** used to **isolate and repeat** a difficult musical moment.

- Focus Loops are the **primary intentional practice target**: narrowing from the section down to “this few bars.”
- A Practice Section **can contain zero, one, or many** Focus Loops.
- **Looping playback** may target a Focus Loop (narrow repeat) instead of the whole Practice Section—see transport / practice-mode UI.

---

### Waveform

The **visual representation of the audio** used to select timing, scrub, zoom, and (on desktop workbench) **author** Practice Sections and Focus Loops.

---

### Timeline

The **time-based structure** of the song from start to finish (positions, durations, boundaries). Sections and loops are anchored to timeline time.

---

### Loop _(when used standalone)_

**Loop** describes **playback behavior**: repeating playback over a bounded time range.

- Either a **Practice Section** or a **Focus Loop** may be repeated, depending on mode.
- Prefer **not** naming the main saved Practice Section object “loop” by itself in UI; use **Practice Section**, and use **Focus Loop** for the inner practice target.

---

### Region _(avoid in UX)_

An implementation term for WaveSurfer (timed range on canvas). **Do not use “region” in user-facing onboarding or inspector copy.**

Use **Practice Section**, **Focus Loop**, or neutral phrases (“selection,” “this span”) as appropriate.

---

### Playback

The **dynamic state** of hearing the song:

- transport (play/pause, position),
- **tempo / speed** relative to recording,
- **repeat** vs play-through behavior,
- scope of repeat (**Practice Section** vs **Focus Loop** where applicable).

---

### Practice Session _(defer)_

**Avoid introducing “Practice Session”** as a primary user-facing abstraction in onboarding or core docs unless a future feature clearly needs it. It tends to imply dashboards and meta-layers unrelated to the instrument-feel.

*(Internal logs, analytics, or engineering prose may still use “session” informally—that is OK if not user-visible.)*

---

## Internal model mapping (engineering)

Stable for this phase:

| Canonical UX term       | Typical internal artifact        | Notes |
|-------------------------|----------------------------------|-------|
| **Practice Section**    | `PracticeLoop` in `loop-engine`  | Stored as outer span (`start`, `end`, name, tempo, nested items). Sidebar / mobile list rows are Practice Sections unless copy says otherwise. |
| **Focus Loop**          | `PhraseSegment`                  | Stored **inside** a `PracticeLoop`’s `segments[]`; `phraseId` links to parent section id. |

**Naming debt:** identifiers such as `phraseId`, `activeLoopId`, `loopPracticeScope: "practice_region"` remain until a dedicated refactor. New **UI strings** should follow this glossary anyway.

---

## Bootstrap vs onboarding success

Today, after importing audio (when no hydrated project dictates otherwise), Woodshed **may automatically create one default Practice Section** so the waveform and repeat behavior have a sane starting span.

Product rules:

| Item | Allowed / meaning |
|------|-------------------|
| Default Practice Section exists after import | **Yes** — current bootstrap behavior retained. |
| Counts as onboarding completion | **No** |
| Desktop onboarding completion | User **intentionally creates a Focus Loop** inside a Practice Section (see onboarding docs for trigger specifics). |

---

## Transport / modes (copy direction)

Practice transport uses coarse modes internally (`Focus Loop`, `Loop Phrase`, `Play Through` in `practice-loop-mode.ts`). For user-facing refinement:

| Internal / transitional label | User-facing intent |
|------------------------------|---------------------|
| `Loop Phrase` | Loop the **Practice Section** (whole section span)—avoid saying “phrase.” Prefer **Loop section** or **Section loop** tone (exact wording chosen during string pass). |
| `Focus Loop` | Matches glossary **Focus Loop** (narrow repeat)—keep. |
| `Play Through` | Play through song / timeline—keep clarity that repeat is off. |

---

## Documentation alignment backlog

Older docs (`ARCHITECTURE.md`, desktop/mobile redesign specs) often say **phrase** because they predate this glossary. When those documents are revised, remap explanations to:

- Practice Section (formerly described as phrase / outer loop span)
- Focus Loop (formerly focus region / segment)
- Playback (instead of implying “Practice Session” as a noun)

Until then: **`docs/TERMINOLOGY_GLOSSARY.md` is authoritative for onboarding and user-facing wording.**
