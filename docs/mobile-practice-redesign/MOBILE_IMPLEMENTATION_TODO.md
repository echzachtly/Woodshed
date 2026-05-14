# Mobile practice implementation TODO

Phased checklist for the mobile practice refinement pass. Check items when done; add brief notes under completed items after each meaningful step.

**Principles:** Mobile = practice execution (no desktop-style editing). Desktop authoring unchanged. Prefer single tap, persistent controls, uninterrupted repetition.

---

## Phase 1 — Transport, restart, focus loops, repetition cohesion

- [x] **Mobile transport layout** — Play, restart, and loop controls are grouped for thumb reach; time/tempo remain accessible without hiding primary actions.

  **Acceptance:** On a narrow viewport (≤768px), user can reach play + restart without opening sheets; layout does not regress desktop.

  **Notes / findings:**
  - Restart and play sit in one horizontal row (restart secondary, play primary). Loop pill and “Next:” line sit above; focus chip row sits between loop controls and transport when segments exist.

- [x] **Restart control** — Primary restart matches desktop semantics (seek to phrase start or active focus region start via `getRestartSeekSeconds`, then play).

  **Acceptance:** With a valid active phrase, restart jumps to the correct boundary and starts playback; disabled when there is no valid phrase.

  **Notes / findings:**
  - Implemented as `handleMobileRestartPractice` in `woodshed-workspace.tsx`, mirroring `DesktopTransportBar`’s `onRestartLoop`.

- [x] **Focus-loop chips** — When the active phrase has focus regions, show a horizontal chip row; one tap selects that focus target and enables Focus Loop practice (scope `practice_region`, playback on, seek to region start).

  **Acceptance:** Tapping a chip updates practice target without opening the phrase sheet; selected chip is visually indicated.

  **Notes / findings:**
  - `handleMobileFocusSegmentSelect` calls `selectSegment`, then `setLoopPracticeScope("practice_region")`, `setLoopPlaybackEnabled(true)`, and seeks to segment start. Chips use `focusChipSelectedSegmentId` (resolver-aware) for pressed styling.

- [x] **Loop-mode refinement** — Current mode remains obvious; “next mode” is visible without relying on hover tooltips (touch-friendly).

  **Acceptance:** User can predict what the loop pill will do on the next tap (e.g. sublabel or secondary line showing next mode).

  **Notes / findings:**
  - Added always-visible line: `Next: {getLoopModeDescription(loopNext)}` with `aria-live="polite"`. Kept `title` for long-press / assistive context.

- [x] **Active focus-loop visibility on waveform** — Active phrase shows read-only focus region overlays on mobile (no drag/resize; no tap-to-select on wave—chips own selection).

  **Acceptance:** With focus regions, user sees the active region emphasized on the waveform; gestures remain practice-oriented (seek/pinch/pan as before).

  **Notes / findings:**
  - Region effect now draws segment overlays on mobile with `pointer-events: none`, classes `woodshed-region-segment-readonly` / `-selected`, and slightly stronger fill for the active segment. Desktop click-to-select on segments unchanged.

- [x] **Repetition workflow cohesion** — Phrase sheet pick + loop modes + focus chips + restart behave consistently (no contradictory seek/scope after chip vs phrase pick).

  **Acceptance:** Manual pass: pick phrase → loop phrase → pick focus chip → restart → cycle to play through; state and audio boundaries stay coherent.

  **Notes / findings:**
  - Phrase sheet clears `activeSegmentId` and seeks phrase start. **On mobile only:** if the user was in **Play Through** before opening the sheet, repeat stays **off** after pick (`mobilePracticeModeRef` + `setLoopPlaybackEnabled(false)`). Desktop header phrase pick unchanged (repeat still comes from `selectLoop`).

---

## Phase 2 — Waveform gestures & visibility

- [x] **Gesture tuning** — Scrub vs pan thresholds, pinch vs one-finger scroll; reduce accidental seeks during repetition.

  **Acceptance:** Documented behavior matches intentional UX; no regression on desktop pan/wheel.

  **Notes / findings:**
  - **While repeat is on (mobile):** `dragToSeek` is **off** — tap/click to seek only, fewer accidental scrubs during drills.
  - **Play Through (mobile):** `dragToSeek: { debounceTime: 280 }` — softer drag seek than default 200ms.
  - Desktop: unchanged (`dragToSeek: false`); wheel zoom still gated off mobile in existing listener.

- [x] **Waveform visibility** — Zoom/readability tweaks as needed after gesture changes.

  **Acceptance:** Phrase and focus overlays remain readable at typical mobile zoom levels.

  **Notes / findings:**
  - `[data-mobile-practice="true"]` wrapper on the waveform column + stronger `.woodshed-region-active` frame on mobile. Segment highlight uses `mobileFocusChipSelectedId` so pill-only Focus Loop matches chips + wave.

- [x] **Optional minimap** — Evaluate read-only minimap on mobile; implement only if it reduces navigation friction without clutter.

  **Acceptance:** If added, minimap is non-interactive and does not steal layout from the primary wave.

  **Notes / findings:**
  - Added **compact read-only** `MiniMap` (`density="compact"`, `readOnly`, no-op handlers) in the mobile grid row between transport and main wave. `grid-rows-[auto_auto_1fr]`.
  - **2026-05-14 follow-up:** Removed the mobile read-only minimap and the mobile **“Full track”** button so practice stays centered on the main waveform (pinch zoom + seek + Play Through). Desktop minimap unchanged. Mobile grid is `grid-rows-[auto_1fr]`. Pinch zoom: root cause was `touch-action: pan-x` on the mobile waveform column overriding `touch-manipulation` (pinch never reached a cancelable `touchmove`); fixed by dropping `pan-x`, using non-passive `touchstart` + `preventDefault` when a two-finger pinch arms, and setting `touch-action: manipulation` on WaveSurfer’s scroll container during mobile pinch handling (`lib/waveform-mobile-pinch.ts`).

---

## Phase 3 — Freeform vs structured flow

- [x] **Phrase selection behavior** — Revisit defaults (e.g. repeat vs play-through when choosing a phrase) to support structured + freeform with minimal taps.

  **Acceptance:** Product-defined default is implemented and documented in this file.

  **Notes / findings:**
  - **Default (mobile + desktop header):** Phrase pick clears `activeSegmentId`, runs `selectLoop` (→ **Loop Phrase** for valid phrases: `loopPlaybackEnabled` + `loopPracticeScope: "phrase"`). **Playback sync:** `handleMobilePhraseSelect` immediately calls `WaveSurfer.setTime(phrase.start)` and `setCurrentTime` so the media element and store never diverge; the phrase-fit `useEffect` only adjusts zoom/scroll/viewport mode (removed `pendingPhrasePlaybackSeekRef` / deferred flush — that path could skip the real seek and left Play resuming a stale pause position).

- [x] **Play Through / full-song friction** — Reduce taps to move between phrase drill and song-wide listening.

  **Acceptance:** Clear path with no dead ends on mobile-only workflow.

  **Notes / findings:**
  - **“Full track”** control shipped briefly on mobile, then **removed** (product: avoid mode confusion; zoom/navigation via main waveform + pinch). Desktop overview “fit all” (`onFitAll` / `handleResetZoomFullSong`) unchanged.

---

## Phase 4 — Persistence & PWA groundwork

- [x] **Practice persistence** — Persist last loop mode / last focus region / relevant prefs in local (and cloud if applicable) project save shape.

  **Acceptance:** Reload restores chosen practice context without breaking existing projects.

  **Notes / findings:**
  - **`lib/practice-state-persist.ts`:** `PracticeStatePersistV1` + `capturePracticeStatePersistV1` / `normalizePracticeStatePersistV1`.
  - **Dexie:** optional `practiceStateV1` on `StoredProjectMeta`; local save/load wired in `persistSession` + decode hydration.
  - **Store:** `applyHydratedPracticePreferences` runs after `upsertLoops` + `selectLoop` when opening a project.
  - **Cloud:** `CloudProjectPayload` / `LoadedCloudProject` + `upsertCloudProject` / `loadCloudProject` use `practice_state` JSONB. **Requires migration** `supabase/migrations/20260514180000_woodshed_practice_state.sql` on Supabase; older DBs without the column will error on cloud save/load until migrated.

- [x] **PWA groundwork** — Manifest, icons, viewport/theme metadata as appropriate (no full offline requirement unless specified).

  **Acceptance:** Installable / standalone-friendly baseline without harming current deploy.

  **Notes / findings:**
  - `app/manifest.ts` → `/manifest.webmanifest` (`display: standalone`, theme/background colors, SVG icon).
  - `public/woodshed-icon.svg` — simple app icon.
  - `app/layout.tsx`: `export const viewport` (themeColor, colorScheme, viewportFit) + `metadata.appleWebApp`.
  - **Deferred:** service worker, offline cache, install prompt UX.

---

## Phase 5 — Lead-in & advanced playback

- [ ] **Lead-in context** — Musical lead-in before phrase/focus entry (playback contract defined and tested).

  **Acceptance:** Lead-in applies on initial start per spec; loops behave predictably after.

  **Notes / findings:**

- [ ] **Advanced playback refinement** — Any follow-ups from Phase 5 discovery (document here).

  **Acceptance:** _(scoped per issue)_

  **Notes / findings:**

---

## Changelog

| Date | Phase | Summary |
|------|-------|---------|
| 2026-05-14 | 1 | Mobile restart; focus chips; loop “Next”; read-only focus overlays; transport layout. |
| 2026-05-14 | 2–4 | Mobile `dragToSeek` policy; compact read-only minimap; phrase pick preserves Play Through; “Full track” zoom; practice prefs persist (Dexie + cloud JSONB + migration); PWA manifest/viewport/apple web app; `practice-state-persist` tests. `next build` OK. |
| 2026-05-14 | 2–3 | Removed mobile minimap + “Full track”; mobile layout `grid-rows-[auto_1fr]`; waveform pinch zoom fix (`touch-action` / passive `touchstart`). |
| 2026-05-14 | 3 | **Bugfix:** Phrase pick must sync WaveSurfer time immediately (`handleMobilePhraseSelect`); removed deferred `pendingPhrasePlaybackSeekRef` flush (could drop seek / desync UI vs audio). Mobile restart now updates `currentTime` after `setTime`. |
