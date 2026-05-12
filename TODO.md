# Woodshed — implementation checklist

Derived from [woodshed_prd.md](./woodshed_prd.md). Work top to bottom; each checkpoint alternates **Implement** then **Test**. Use `/lib/audio-engine.ts`, `/lib/loop-engine.ts`, `/lib/transient-engine.ts`, and `/lib/waveform-manager.ts` as in the PRD.

**Verification (automated vs manual)**

- Automated: `npm install` then `npm test` — covers loop engine, waveform helpers, transient heuristics, and loop wrap decisions.
- Manual: `npm run dev`, open `/`, verify transport + waveform + IndexedDB workflows in Chrome/Edge (best Web Audio + `IndexedDB`).
- Builds: `npm run build`.

---

## Phase 1 — Core workspace MVP

### 1. Scaffold

- [x] **Implement:** Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn-style Radix primitives. App shell matching PRD layout: top transport bar, large primary waveform area, minimap strip, compact loop sidebar. Minimal Framer dependency reserved for polish.
- [x] **Test:** `npm run dev` → transport, waveform host, minimap, and sidebar render; resizing keeps waveform flex region visible.

### 2. Global state

- [x] **Implement:** Zustand store (`store/woodshed-store.ts`) for playback, waveform zoom (`minPxPerSec`), loops, transports, persisted metadata, snapping assist strength, HUD toggles.
- [x] **Test:** Toggle the inline debugger HUD; confirm state reflected when switching loops/zoom sliders.

### 3. Audio engine core

- [x] **Implement:** `lib/audio-engine.ts` — tempo application with DOM `playbackRate`, optional micro-fades (helpers remain for future WASM), loop wrap decision + warp integration with WaveSurfer `timeupdate`.
- [x] **Test:** `npm test lib/audio-engine.test.ts` covers wrap math; manually load WAV/MP3/M4A, verify play/stop/time jump + looping toggle.

### 4. Waveform rendering and sync

- [x] **Implement:** `components/woodshed-workspace.tsx` uses `wavesurfer.js`, regions plugin, synced cursor + draggable loop overlays.
- [x] **Test:** Playback cursor tracks audio file; dragging seeks (WaveSurfer `dragToSeek`).

### 5. Waveform navigation

- [x] **Implement:** Scroll wheel adjusts `minPxPerSec`; minimap previews full file; WaveSurfer native scroll syncing updates viewport rectangles; hover HUD timestamp via pointer move.
- [x] **Test:** Zoom deeply, confirm wheel zoom + minimap overlay tracks; hover readout updates.

### 6. Loop system — creation and selection

- [x] **Implement:** `lib/loop-engine.ts` auto loop on first decode, “Add loop” button, double-click phrase creation, dimmed inactive regions.
- [x] **Test:** Fresh load shows default loop; add/select loops; only active region is resizable.

### 7. Loop editing

- [x] **Implement:** Region drag + resize with guard rails (min width) and keyboard `[` / `]` nudges (Shift for fine steps). Shift+drag fine-control still TODO for pointer layer (PRD stretch goal).
- [x] **Test:** Resize loop while zoomed; playback obeys new bounds; keyboard nudges move edges.

### 8. Transient detection

- [x] **Implement:** `lib/transient-engine.ts` lightweight RMS novelty detector + caching via Zustand; `analyzeAudioEnvelope()` primes minimap PCM post load/hydrate.
- [x] **Test:** `npm test lib/transient-engine.test.ts` + inspect debugger showing transient timestamps on percussive files.

### 9. Transient snapping

- [x] **Implement:** `softSnapSeconds` gated by sidebar “Snap assist” slider; thresholds scale with slider (0 disables magnet).
- [x] **Test:** Raise assist slider, drag handles near spikes to feel pull; lowering slider releases magnet.

### 10. Tempo engine

- [x] **Implement:** Playback uses browser `playbackRate` with `preservesPitch` hints (RubberBand WASM slated for enhancement). Slider + +/- keys mutate active loop tempo; switching loops reapplies tempo.
- [x] **Test:** 50% vs 125% audibly slows/speeds; swap loops retains individual tempo memories.

### 11. Loop seams and crossings

- [x] **Implement:** Lightweight wrap seek (<30 ms lookahead) keeps phrase cycling smooth; richer equal-power fades remain upgrade path aligned with PRD RubberBand work.
- [x] **Test:** Subjectively audition bright sources at boundary; iterate micro-fades if audible clicks remain.

### 12. Mini-map waveform

- [x] **Implement:** `components/mini-map.tsx` renders downsampled peaks (`lib/waveform-manager.ts`) with loop overlays + viewport tint; clicking seeks main transport.
- [x] **Test:** Jump via minimap aligns audible time + cursor; overlays track active loop edits.

### 13. Loop naming and list UI

- [x] **Implement:** `components/loop-sidebar.tsx` rename inputs + loop metadata panel.
- [x] **Test:** Rename loop, ensure active highlight + durations update.

### 14. Project persistence

- [x] **Implement:** `lib/project-db.ts` Dexie persistence for blobs + serialized loops/active loop/tempo; transport “Save/Open” selectors.
- [x] **Test:** Save session → refresh page → reopen entry; confirm loops/active/tempo/audio reload (needs same browser DB).

### 15. Keyboard shortcuts (MVP)

- [x] **Implement:** Global handler on workspace root (Space, arrows w/ Shift fine, ± tempo, `R` loop restart, `[` / `]` loop trim, double-click loop create).
- [x] **Test:** Focus workspace (auto-focused on load) and confirm shortcuts fire without scrolling the page.

### 16. Performance smoke

- [x] **Implement:** Avoid re-instantiating WaveSurfer on zoom changes; rely on `ws.zoom` updates; heavy analysis throttled to decode events; document expectations inline in tests.
- [x] **Test:** Load ~3–5 min file: first interactive waveform within a few seconds on dev hardware; drag loop handles without stutter.

---

## Phase 2 — Precision editing (iteration)

### P2.1 Snap presets + ladder

- [x] **Implement:** Discrete snap modes (Soft / Std / Grip / Off) via [lib/snap-presets.ts](./lib/snap-presets.ts) + sidebar chips; finer slider layered underneath; closest preset highlights within tolerance.
- [x] **Test:** Tap each preset and drag loop edges near transients; run `npm test lib/snap-presets.test.ts`.

### P2.2 Keyboard zoom ladder

- [x] **Implement:** PageUp/PageDown multiply `minPxPerSec`; HUD line documents combos with wheel zoom.
- [x] **Test:** Focus workspace (not inputs), strike PageUp/PageDown and confirm zoom steps.

### P2.3 Loop bracket nudge ladder

- [x] **Implement:** `[`/`]` coarse by default, hold Alt for medium steps, Shift for ultra-fine (`loopBracketStep` helper in woodshed workspace).
- [x] **Test:** With debugger HUD on, observe start/end deltas for each modifier.

### P2.4 Mini-map scrub + viewport pan

- [x] **Implement:** Pointer capture scrubbing + draggable viewport sash; pan sets WaveSurfer scroll via [lib/waveform-scroll.ts](./lib/waveform-scroll.ts) and [scrollPixelsFromNormalizedRatio](./lib/waveform-manager.ts).
- [x] **Test:** Drag on minimap body scrubs audio; drag the viewport frame pans the zoom when content scrolls horizontally.

### P2.5 Transient overlay cues

- [x] **Implement:** [components/waveform-transient-strip.tsx](./components/waveform-transient-strip.tsx) draws assist ticks; boosts contrast while hovering waveform or zoomed deeply.
- [x] **Test:** Zoom in (`PageUp`/wheel), hover waveform — ticks should intensify subtly without blocking clicks.

### P2.6 Loop warp micro-fades

- [x] **Implement:** Playback wrap now awaits `warpLoopPlayback` + micro volume envelope whenever media is advancing past the boundary.
- [x] **Test:** Listen for clicks on bright loops; compare paused vs looping playback.

### P2.7 Motion polish on loop list

- [x] **Implement:** Framer Motion `layout="position"` on loop sidebar cards softens swaps when renaming/selecting loops.
- [x] **Test:** Toggle active loops rapidly — panels should glide without snapping harshly.

---

## Later phases (outline only)

**Phase 3 — Practice workflow:** practice mode UI, repeat counts, tempo ramps, sequencing, richer session restoration.

**Phase 4 — Advanced projects:** optional cloud sync, export/import bundles, collaboration.

**Phase 5 — Assistive intelligence:** BPM hinting, transcription-adjacent tools, chord/phrase assistants (explicitly deferred from MVP purity).

Optional audio formats flagged in PRD (**FLAC**), mobile clients, streaming/social integrations — intentionally out of scope until product calls for them.

---

## Quick trace

Rough dependency order overlaps in real work; acceptable parallel tracks marked in PRD architecture diagram: scaffold → state → audio → waveform (+ navigation + minimap) → loops (+ transients + tempo + seams) → persistence → shortcuts → performance polish.
