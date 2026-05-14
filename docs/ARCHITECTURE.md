# Woodshed — how the app is put together

This document explains how Woodshed works **under the hood**, in plain language, for anyone who wants to understand the product without reading every line of code.

---

## 1. Playback architecture

**What you hear** comes from a single audio file loaded into **WaveSurfer.js** (a waveform player built on the browser’s `<audio>` element).

- **Play / pause** tells WaveSurfer to start or stop playback.
- **Time** shown in the transport bar is kept in sync with the player. The UI does not guess time on its own; it listens to the player’s updates (throttled slightly so the screen does not flicker every millisecond).
- **Tempo** is applied by changing the audio element’s **playback rate** for the active phrase, so the same recording can practice slower or faster.

When **Repeat phrase** is on, a small piece of logic runs on each animation frame while audio is playing: if the playhead drifts **outside** the active phrase’s start/end times, it is **pulled back** to the phrase start (or end boundary). That is how repeating stays tight without a separate audio engine.

---

## 2. Phrase state lifecycle (practice vs editing)

Internally, a “phrase” is still stored as a **loop** object (start time, end time, name, tempo). The **lifecycle** is what matters for users:

| Situation | What happens |
|-----------|----------------|
| **New phrase** | It opens in **draft / edit** mode so you can drag edges and move it on the waveform. |
| **Saved phrase** | It is **locked**: visible on the wave, but not draggable until you choose **Edit**. |
| **Only one phrase in edit mode** | Selecting another phrase **finishes** the previous one (locks it) unless you are re-clicking the same draft. |

Two IDs in the app keep this clear:

- **`activeLoopId`** — which phrase you are **practicing** (what you hear and what the main waveform highlights).
- **`editableLoopId`** — which phrase is currently **unlocked for editing** on the desktop waveform (at most one).

Mobile practice mode does **not** offer boundary editing; the phrase list and bottom sheet only **choose** which phrase is active.

---

## 3. Viewport behavior (how the waveform moves on screen)

The waveform can show the whole song or a **zoomed-in** slice. Three **viewport modes** describe intent (not every pixel calculation):

1. **`follow`** — When you are **not** repeating a phrase, the view can **track the playhead** so the current position stays visible.
2. **`phrase-focus`** — Right after you choose a phrase with **Repeat phrase** on, the app **zooms and scrolls** once so that phrase fills most of the width (comfortable framing, not edge-to-edge).
3. **`manual`** — If you **pan or zoom** after that automatic framing (while still repeating), we remember you took control: the playhead no longer drives the view until the next automatic **phrase-focus** (for example, when you pick another phrase).

**Full song** is a deliberate reset: zoom out to see the whole file and return to **`follow`** when leaving phrase-focus.

Panning on the desktop wave, the mini-map, mouse-wheel zoom, and keyboard zoom shortcuts all **hand navigation** back from **`phrase-focus`** to either **`manual`** (repeat on) or **`follow`** (repeat off), so the app never fights the user’s hands.

---

## 4. Mobile vs desktop architecture

**One React workspace** (`woodshed-workspace.tsx`) hosts the player, cloud/local save, and keyboard shortcuts. A simple width check (**768px**) switches **mobile practice mode**:

| | Desktop | Mobile (practice) |
|--|---------|-------------------|
| **Transport** | Full three-column bar (repeat, phrase start, full song, play, tempo) | Compact stack: phrase picker sheet, repeat, large play, tempo |
| **Header** | Full project controls + save | Same sessions, compact account, **no save button** (practice only) |
| **Mini-map** | Interactive (seek + drag viewport) | Shown as **read-only** overview |
| **Waveform** | Click to seek; drag to pan; double-click adds a phrase; regions editable when in edit mode | Tap/drag to **seek**; pinch to zoom; phrase region is **non-interactive** (read-only) |
| **Phrase list** | Sidebar list + add phrase | Bottom sheet from the phrase pill |

The underlying **Zustand store** is the same; only the **surface** changes.

---

## 5. Waveform rendering model

- **Peaks** — WaveSurfer draws the waveform. An optional decoded peak array feeds the **mini-map** for a lightweight overview.
- **Regions plugin** — Draws exactly **one** region on the main wave: the **active** phrase. Colors differ for locked vs active vs editing.
- **Gutters** — Extra horizontal margin so the first and last moments of the file are not clipped at the screen edge; phrase centering math accounts for this.
- **Pan gesture** — Custom pointer logic: tiny movement = **seek**; larger drag = **pan** the scroll container. Editable regions skip this so drag/resize stays with WaveSurfer’s plugin.

---

## 6. Cloud persistence flow

Projects can live **on this device** or **in the cloud** (when Supabase is configured and the user is signed in).

**Save:**

1. Read the current session from Supabase (if cloud is in play) so the save targets the right account.
2. If **cloud save** applies: upload or update the project (name, phrase data, audio blob) and store the returned **cloud project id** on the project.
3. Otherwise: write the audio and phrase metadata to **Dexie** (IndexedDB) on the device.

**Open:**

- **Local** — Load metadata + blob from Dexie, then hydrate the store and reload the waveform from a blob URL.
- **Cloud** — Fetch project JSON + audio from Supabase, same hydration path.

The **built-in demo** project is read-only: save is disabled so users cannot overwrite the example.

---

## 7. Phrase locking and editability (summary)

- **Locked** — Safe for practice; cannot accidentally drag phrase edges.
- **Editing** — Unlocked in the sidebar (**pencil** / **Done**); waveform shows handles.
- **Draft** — New phrase starts here until the user locks it by selecting another phrase or finishing edits.

This model avoids “half-edited” phrases competing with playback gestures.

---

## 8. Main React and state structure

| Piece | Role |
|-------|------|
| **`store/woodshed-store.ts`** | Single source of truth: phrases, active phrase, edit mode, repeat phrase, tempo, viewport mode, project id/name, playback flags. |
| **`components/woodshed-workspace.tsx`** | Mounts WaveSurfer, wires store to audio, regions, mini-map, file upload, demo load, cloud/local persistence, keyboard. |
| **`components/transport-bar.tsx`** | Header + desktop transport UI. |
| **`components/mobile-practice-panel.tsx`** | Mobile-only stacked controls. |
| **`components/loop-sidebar.tsx`** | Desktop phrase list and add phrase. |
| **`lib/audio-engine.ts`** | Applies tempo to the media surface; builds the “repeat window” for the RAF loop. |
| **`lib/project-db.ts`** | Dexie persistence for local projects. |
| **`lib/cloud-projects/client.ts`** | Supabase list/load/save helpers. |

The UI reads the store through a **batched subscription** (one hook with shallow comparison) so unrelated fields do not re-render the workspace as often as they would with many separate tiny hooks.

---

## 9. Supabase integration flow

1. **Middleware** (`middleware.ts`) refreshes auth cookies so server and client agree on who is signed in.
2. **`auth-provider.tsx`** exposes the Supabase client, session user, and sign-in/out to React.
3. **Workspace** asks Supabase for the **current session user id** to decide whether to show the **Cloud** section of the session picker and whether **Save** should target cloud or local storage.
4. **Cloud project APIs** use the user id as the owner key for listing and upserting projects.

If Supabase env vars are missing, the app **degrades gracefully** to local-only projects; cloud controls simply stay hidden or inert.

---

## Where to look in code (for builders)

- Viewport modes and repeat phrase: `store/woodshed-store.ts`, `components/woodshed-workspace.tsx`
- Waveform gestures: `installWaveformPanGesture` in `woodshed-workspace.tsx`, `lib/waveform-mobile-pinch.ts`
- Phrase math and clamps: `lib/loop-engine.ts`

This file is meant to stay **high level**; when in doubt, trust the code comments next to effects that touch WaveSurfer — they document timing and edge cases deliberately.
