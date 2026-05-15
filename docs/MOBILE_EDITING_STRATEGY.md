# Mobile Editing Strategy

**Status:** Architecture & interaction specification (no implementation commitment in this document).

**Related (read together):**

- [`APPLICATION_STATE_MODEL.md`](./APPLICATION_STATE_MODEL.md) — state ownership, mobile practice mode, onboarding trigger rules, WaveSurfer lifecycle notes.
- [`TERMINOLOGY_GLOSSARY.md`](./TERMINOLOGY_GLOSSARY.md) — **Practice Section**, **Focus Loop**, **Project**, **playback**; internal `PracticeLoop` / `PhraseSegment` mapping.
- [`ONBOARDING_STRATEGY.md`](./ONBOARDING_STRATEGY.md) — mobile = practice instrument; desktop = workbench; progressive discovery principles.
- [`ONBOARDING_IMPLEMENTATION_PLAN.md`](./ONBOARDING_IMPLEMENTATION_PLAN.md) — Phase 4 mobile onboarding (future); separation from desktop authoring completion.

**Prior art in repo (may partially conflict with this strategy—this doc supersedes for *editing* direction):**

- `docs/mobile-practice-redesign/MOBILE_PRACTICE_REDESIGN_BRIEF.md` — historically “mobile = practice, not editing.” **Product direction has evolved:** mobile **must** support *lightweight* editing; it must still **not** become desktop squeezed onto a phone.
- `docs/mobile-practice-redesign/MOBILE_UI_UX_GUIDELINES.md`, `MOBILE_APP_FLOW.md`, `MOBILE_FOCUS_LOOPS_SPEC.md` — touch ergonomics, chips, repeat-first flows.

---

## 1. Executive summary

**Goal:** Define how Woodshed adds **touch-native, low-density editing** without collapsing the distinction between:

- **Desktop workbench** — deep structure, precision, inspector-driven workflows.
- **Mobile practice surface** — flow, repetition, thumb reach, sheets for structure.

**Recommended spine:**

1. **Explicit Edit Mode (or equivalent “editing posture”)** gated behind a deliberate control—not always-on authoring on the waveform.
2. **Practice mode default:** waveform behaves like today (navigation, tap seek, pinch zoom, repeat-aware drag-to-seek policy); Focus Loops driven by chips + playback scope—not edge handles on the wave.
3. **Edit Mode:** reveal a **small, reversible** set of affordances—prefer **bottom sheets / focused editors** for naming and coarse bounds; reserve **waveform-direct** gestures only for gestures that survive fat fingers and repetition context.
4. **Desktop authoring onboarding** stays **orthogonal:** mobile edits do **not** satisfy `desktop.focusLoopAuthoringComplete` unless product explicitly merges criteria later (default: **do not**).

---

## 2. Current mobile architecture (inventory)

Single workspace (`components/woodshed-workspace.tsx`), switched by **`isMobilePractice`** (`max-width: 768px`), same Zustand store.

| Area | Mobile today (observed) |
|------|-------------------------|
| **Chrome** | `MobilePracticeControls` — project pill, Practice Section (phrase) picker → bottom sheet, loop mode chip, Focus Loop chips row, large play/restart, tempo slider (`components/mobile-practice-panel.tsx`). |
| **Practice Section selection** | `MobilePhraseBottomSheet` portal + backdrop blur (`components/mobile-phrase-bottom-sheet.tsx`); picker closes on select; special case when reopening sheet from Play Through repeat state (see redesign TODO notes). |
| **Project selection** | `MobileProjectBottomSheet` pattern (`components/mobile-project-practice.tsx`). |
| **Waveform** | Same WaveSurfer host; **`segmentMobileReadonly = isMobilePractice`** ⇒ Focus Loop regions use **readonly** visuals / `pointer-events: none` overlays (CSS `[data-mobile-practice="true"]` + `applyMobileReadonlyFocusRegionVisuals`). |
| **Phrase / section on wave** | Phrase waveform pin & virtual append tooling **inactive** when mobile (`phraseWaveUnlocked && !isMobilePractice`). Shift+drag authoring gesture **early-outs** via `isMobilePractice()`. |
| **Pan / seek** | `installWaveformPanGesture` skips arming pan from mobile when repeat is on in some paths; mobile uses different `dragToSeek` policy than desktop (see `MOBILE_IMPLEMENTATION_TODO.md`). |
| **Zoom** | Pinch zoom path exists (`lib/waveform-mobile-pinch.ts`) gated off desktop wheel behavior. |
| **Inspector** | No `DesktopInspectorPanel` on mobile—no parity for advanced fields, rename, numeric start/end, notes. |
| **Save** | Documented architecture: header omits mobile save emphasis (practice-first); persists still exist server-side flows on desktop primarily. |

**Implication:** today’s codebase **intentionally** treats the mobile waveform as **non-editable structure**. Any editing initiative must introduce **new gating**, not “uncomment desktop paths.”

---

## 3. Recommended mobile editing philosophy

1. **Editing is intentional, intermittent, forgiving** — bounded sessions inside a practice app, not a continuous DAW state.
2. **Prefer “musician gestures” over “engineering precision” on the wave:** long-press, two-finger, or mode-gated drag spans—not 2px resize handles adjacent to pinch-pan ambiguity.
3. **Sheets are hierarchy editors; wave is temporal canvas** — renaming, duplication, reordering Practice Sections skew toward sheets; carving time skews toward wave *only when Edit Mode resolves gesture conflicts*.
4. **Preserve “every extra tap interrupts practice”** (mobile redesign brief)—Edit Mode transitions should be **one obvious control** + **easy exit** (Done / auto-exit on navigation).
5. **Terminology in UI** follows glossary; internal store names remain until a dedicated refactor.

---

## 4. Explicit Edit Mode — recommendation

**Answer:** **Yes—mobile should use an explicit Edit posture** (callable “Edit Mode,” “Trim,” “Arrange”—final marketing string TBD).

**Why minimal / safest:**

- Avoids perpetual conflict between **seek/pan drills** vs **boundary drags**.
- Keeps onboarding story simple: Phase 4 mobile onboarding can stay **playback-first** until user opts into Edit.
- Mirrors mental model musicians already accept (“I’m arranging” vs “I’m practicing”).

**Behavior sketch:**

| Dimension | Recommendation |
|-----------|----------------|
| **Entry** | Single control near safe thumb zone (`MobilePracticeControls` overflow, or segmented “Practice \| Edit”). Avoid burying behind three sheets. |
| **Default on import** | **Practice** — never strand new users in Edit after bootstrap. |
| **Visual feedback** | Subtle tint on chrome + optional calm banner (“Editing”)—**no fullscreen dim** by default. |
| **Exit** | Explicit **Done** + auto-exit on project switch / audio replace (defensive). |
| **Playback** | Default **pause** on Edit entry (recommended—see §7); optional “background scrub” muted preview is higher complexity—defer. |

**Alternative rejected for v1:** always-on draggable handles mobile—raises accidental edits + onboarding load.

---

## 5. Editing affordances hidden in normal practice

**Keep hidden (non-Edit):**

- Practice Section boundary handles on waveform.
- Focus Loop edge trim handles on waveform.
- “Add Focus Loop,” “Duplicate section,” “Advanced timing fields.”
- Any grid/spreadsheet numeric editors.

**Remain visible/literal in practice:**

- Focus Loop **chips** (playback targeting—already aligns with glossary “focus playback”).
- Repeat / tempo / restart (hands-free ethos).
- Practice Section picker (navigation, not authoring).

---

## 6. Waveform vs bottom sheets (split of concerns)

### 6.1 Waveform-direct (candidate list)

| Action | Recommendation | Risk |
|--------|------------------|------|
| **Tap / short drag seek** | Keep—core navigation. | Low—already tuned vs repeat modes. |
| **Pinch zoom** | Keep. | Conflict if future adds two-finger “span create”—must not collide. |
| **Create Focus Loop span** | **Edit Mode only;** gesture = long-press + drag bracket **or** “mark in / mark out” two-tap span (alternate for low-precision users). **Avoid Shift** (no hardware Shift). | Medium—finger velocity vs scroll container. |
| **Trim Focus Loop boundaries** | Prefer **handles only in Edit Mode** *or* stepper in sheet; waveform trim is Phase 2+ once base edit stable. | High—collision with pan/seek. |
| **Create / resize Practice Section** | Prefer **sheet-first** (“Set section boundaries” preview + coarse sliders snapping to waveform playhead position). Waveform marquee optional later. | High—song-span drags resemble pan. |

### 6.2 Bottom sheets / contextual UI

Reuse patterns: **`MobilePhraseBottomSheet`**, **`MobileProjectBottomSheet`** (backdrop, portal, Escape, focus trap).

**Recommended sheet duties:**

| Task | Sheet? | Notes |
|------|--------|-------|
| Select / switch Practice Section | Already | Keep thin; future: inline rename in sheet rows. |
| Add Practice Section after import | Sheet or single “+ Section” wizard | Respect bootstrap default section—don’t confuse user. |
| Focus Loop CRUD scaffolding | Combo: chips for pick; sheet for **rename / delete confirmation / add without wave** (`+ Add Focus Loop` could create centered span needing trim). | Align with desktop `addSegment` mental model. |
| Numeric start/end | Sheet / spinners | Desktop inspector parity *light*, not full advanced panel. |

**Context menus:** optional long-press on chip/list row once haptics/accessibility reviewed—don’t duplicate sheet unless it saves depth.

---

## 7. Desktop-only complexity (explicit non-goals for mobile v1–v2)

Keep on desktop indefinitely unless strong mobile demand:

- Phrase waveform **virtual append pin**, multi-region orchestration diagnostics.
- Unlock matrices (`phraseWaveformEditUnlockedById`, `focusRegionWaveformEditUnlockedById`) exposed raw to user as separate toggles—mobile should consolidate to **Edit Mode presets** (“Trim loop,” “Resize section”).
- Dense inspector (notes/advanced collapses) unless distilled.
- Shift+drag authoring parity (desktop-specific modality).

Mobile may later adopt **subset** automation (single unlock path in Edit Mode rather than mirrored toggles).

---

## 8. Touch gestures — recommendations

### 8.1 Creating Practice Sections

**v1 safest:** Sheet-driven—“From playhead → To playhead,” “Use whole song intro span,” sliders with waveform preview overlay *read-only*.  
**v2:** Optional Edit Mode marquee on wave requiring **explicit mode** + **dead zone** thresholds.

### 8.2 Creating Focus Loops

**v1:** Inside active Practice Section: **Edit Mode** → long-press + drag **preview band** similar to desktop shift preview—but mobile-specific implementation (distinct from Shift gesture). Fallback: sheet “Add Focus Loop” center span (reuse store `createSegmentInPhrase`).  
**v2:** Refine marquee snap to transients (desktop parity feature—defer).

### 8.3 Trimming boundaries

**v1:** Sheet numeric **or** enlarged draggable ends **only while Edit Mode engaged** AND loop selected; snapping + haptic hooks later.  
**Avoid:** simultaneous repeat playback + trimming same edges (ambiguous audio feedback).

---

## 9. Playback vs editing coexistence

**Recommendation (default stance):**

1. **Entering Edit Mode: pause playback** and optionally seek to Focus Loop start or selection context (mirror “stop to tune” intuition).
2. **During Edit Mode:** allow **silent scrub preview** tap only after pause is stable—not required v1.
3. **Practice Mode:** forbid structural mutations from wave—but allow transport as today.

**Rationale:** repeat drills + unintended boundary moves are catastrophic UX; autopause simplifies state machine without new concurrent “multiplayer” authoring state.

**Alternate (future power users):** “Edit while looping” gated behind toggle—dangerous complexity; defer.

---

## 10. Scaling affordances on small screens

- **Temporal editing:** prioritize **fewer handles** → prefer **focused single selection** (“this Focus Loop”) not “show all spans.”
- **Vertical space:** Editing controls stack under chips or inside sheet—not parallel to minimized transport.
- **Landscape:** widen sheet / allow side-by-side summary (reuse adaptive layout guidance from redesign docs).
- **Thumb reach:** destructive actions (**Delete Focus Loop**) in sheet with confirm—never inline on microscopic chip only.

---

## 11. Desktop assumptions that break on mobile

| Desktop assumption | Mobile conflict |
|--------------------|----------------|
| **`Shift+drag`** as primary carve gesture | No Shift; needs alternate semantic layer. |
| **Inspector-driven unlock matrices** | No inspector chrome; ambiguous discoverability if copied 1:1. |
| **Pointer capture + pan competing with region drag slop** | Touch slop differs; multitouch pinch competes with two-handle drags. |
| **`segmentMobileReadonly` simplification** | Hardcoded “mobile = readonly” becomes false—must refactor to **`segmentAuthoringAllowed = isMobilePractice && editModeActive`** pattern (conceptually; exact flag location TBD). |
| **`dragToSeek` toggles keyed off repeat mode** | Edit Mode temporarily needs policy table: practice vs editing vs paused. |
| **Mini-map / desktop transport density** | Mobile transport already reorganized—editing must not reintroduce “three-column bar.” |

---

## 12. Architecture & state-flow implications

**Prefer not** to Stuff edit flags inside `woodshed-store` onboarding keys (APPLICATION_STATE_MODEL already forbids mixing). Options:

| Approach | Pros | Cons |
|---------|------|------|
| **A. Ephemeral Edit Mode boolean in workspace UI state (+ optional persisted user pref later)** | Fast, minimal churn | Lost on reload—might be desirable for accidental edit exit |
| **B. Zustand slice `mobilePracticeUi`** (distinct from onboarding) persisted optional | Mirrors store ownership of session UI | Increases surface area |

**Recommendation:** Start **A (React state lifted in workspace or small context)** scoped to mobile layout branch; revisit persistence only if users report losing mid-edit unexpectedly.

**Store mutations** continue using existing primitives (`createPhraseFromShiftDrag`-equivalents need **mobile-facing API** wrappers not tied to Shift key; `createFocusSegment*` family, `addSegment`, `updateLoopBounds`, `updateSegment`). **Reuse store—avoid parallel graph.**

**WaveSurfer:** toggling authoring likely means **replacing/unlocking pointer styles** (`applyMobileReadonlyFocusRegionVisuals` path) selectively rather than rewriting plugin graph.

---

## 13. Onboarding implications (future Phase 4+)

Aligned with [`ONBOARDING_STRATEGY.md`](./ONBOARDING_STRATEGY.md):

- Milestones stay **discovery of playback**, Focus Loop selection chips, tempo & repeat—not “carved span” mastery.
- Introducing Edit Mode warrants **either:**  
  - **Separate ephemeral hints** gated on first Edit entry (distinct from playback onboarding milestone), **or**  
  - **Single combined ladder** strictly ordered (risk: cognitive load)—not recommended initially.

Desktop criterion (`focusLoopAuthoringComplete`) **must remain** event-based authoring on desktop unless product explicitly merges—strategy default: mobile Focus Loop creation **does not** flip desktop completion flag (teaches different muscle memory).

Consider document `mobile.introducedEditMode` optional future flag **not** bundled with playback milestone—avoid blocking practice onboarding on editing exploration.

---

## 14. Reuse matrix (existing pieces)

| Component / pattern | Reuse for editing |
|--------------------|-------------------|
| `MobilePracticeControls` stack | Inject Edit entry + contextual affordances row. |
| Bottom sheet portal pattern | Structural lists, confirmations, coarse numeric trims. |
| Focus chips row | Extend with long-press menu / rename inline (Phase 2). |
| Tap seek + pinch sizing | Preserve; layering requires mode flag. |
| Store segment/loop mutations | Mandatory reuse—truth stays single graph. |

---

## 15. Complexity creep hotspots (watch list)

1. **Dual authoring stacks** (“mobile editor hooks” duplicated from desktop workspace effect)—mitigate via shared **`lib/mobile-wave-authoring`** thin layer later.
2. **Gesture multiset explosion** — document allowed gesture **matrix by mode**; forbid ad-hoc addition without matrix update.
3. **Onboarding coupling to decode timers** (`APPLICATION_STATE_MODEL` warns already)—.mobile edit hints must use **explicit edit entry** triggers.
4. **Cloud save conflicts** mid-edit with desktop session—eventually operational concern; offline-first editing needs conflict policy (out of scope but note risk).

---

## 16. Implementation sequencing (suggested)

| Phase | Scope | Outcome |
|-------|-------|---------|
| **M1** | Edit Mode posture + autopause policy + readonly removal only when edit active (no structural tools yet besides maybe delete from sheet stub) | Proves coexistence pipeline |
| **M2** | Sheet-based Focus Loop rename/add/delete scaffolding | Delivers usefulness without waveform surgery |
| **M3** | Waveform marquee / long-press span create Focus Loop (inside section) | Tactile win |
| **M4** | Practice Section coarse span editor sheet + alignment with bootstrap | Structure editing |
| **M5** | Boundary trim refinement + optional haptics | Precision pass |

Gate each phase behind internal dogfood + onboarding review.

---

## 17. Risk assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Accidental edits during drills | High | Explicit Edit Mode default off + autopause entry |
| Gesture conflict (pinch vs trim) | High | Mode matrices; postpone multi-touch trim |
| Divergent mental models vs desktop glossary | Medium | Single glossary copy in UI; onboarding copy alignment |
| Store flag explosion | Medium | Consolidate authoring checks into derived selectors |
| Erosion “mobile ≠ DAW lite” identity | Medium | Hard non-goals list in PR checklist referencing this doc |
| Increased automated test burden | Medium | Gesture integration tests brittle—prefer pure reducers first |

---

## 18. Resolved product question checklist (concise answers)

| # | Topic | Recommendation |
|---|-------|----------------|
| 1 | Explicit Edit Mode? | **Yes.** |
| 2 | Hidden in practice | Waveform authoring handles & advanced scaffolding |
| 3 | Waveform-direct | Seek/zoom practice; authoring only in Edit (later trim) |
| 4 | Sheets | Structure lists, coarse numerics, confirm destructive |
| 5 | Desktop-only complexity | Inspector parity, Shift paradigm, diagnostics |
| 6 | Gesture summary | Shift→**modes** + long-press/bi-tap; sections sheet-first |
| 7 | Coexistence | Mode separation autopause recommended |
| 8 | Pause on edit enter? | **Default yes** |
| 9 | Small screens | Single-focus editing surfaces; defer “show all” |
|10 | Desktop conflicts | Readonly mobile wave, Shift, unlock matrices |
|11 | Architecture | UI-level Edit flag + reuse store mutators + relax readonly conditionally |
|12 | Onboarding | Keep playback milestone separate; optional edit hint on first Edit entry |

---

## 19. Open decisions (clarify before implementation)

These are **intentional questions**—not blockers for keeping this strategy doc stable:

1. **Save model on mobile:** Should structural edits auto-sync (cloud) like desktop, or queue until explicit “Save” returns to mobile UI? (Impacts trust + network usage.)
2. **Edit entry marketing string:** “Edit,” “Arrange,” “Adjust loops”—choose word that doesn’t sound DAW-like.
3. **Demo project on mobile:** Should demo open still discourage editing (read-only project flag) to preserve tutorial clarity, or allow sandbox edits discarded on exit?
4. **Landscape priority:** trim layout first or defer until portrait stable?
5. **Accessibility:** VoiceOver path for span creation without continuous drag—requires alternative flow (sheet).

---

## 20. Document maintenance

Update this file when:

- Product changes mobile editing scope (new non-goals / goals).
- Gesture matrix changes (always reflect in §8 + §18 table).
- Onboarding Phase 4 scope locks (cross-link behaviors).

**Do not** embed release-specific task IDs here—link to implementation plans / PRDs instead.

---

*End of strategy document — implementation intentionally deferred until product signs off on §19 where needed.*
