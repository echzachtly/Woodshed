# Woodshed desktop refinement — implementation todo

This file holds **two complementary refinement tracks** for desktop. **Refinement only** on the current direction: do **not** radically redesign; preserve strong progress (centered pills, play, waveform focus, reduced toolbar clutter).

---

## Product split (unchanged)

- **Desktop:** phrase authoring, mapping, rapid iteration, waveform precision, project creation — creative, exploratory, precise, fast — *not* “mobile stretched wider.”
- **Mobile:** phrase selection, repetition, practice, lightweight playback — touch-native, simplified — *no* regressions.

**North star**

- **Desktop:** focused **phrase-authoring studio** — project + phrase + play/repeat + waveform read as the story; everything else fades to supporting structure.
- **Mobile:** phrase practice **companion**.
- **Not:** dashboard, admin UI, DAW toolbar soup, or toolbar-heavy audio app.

---

## Cursor implementation instruction

Implement this in small, reviewable steps. Do not attempt the entire file in one pass.

Start with Track B1–B2 only:

- clean up the top-right utility cluster

- move Save / Export / Open Audio / Show-Hide Phrases into overflow

- remove the awkward standalone Phrases control

After Track B1–B2, stop and report:

- files changed

- behavior changed

- anything risky

- build/test results

Do not proceed to Track A keyboard shortcuts or deeper authoring changes until the layout cleanup is verified.

# Track A — Phrase authoring & primary workflow

### A1 — Phrase creation as a primary desktop workflow

- **Audit current discovery paths** — List every way a user can create a phrase on desktop today (phrase pill menu, PHRASES panel, waveform gestures, keyboard, etc.) and note gaps when the panel is hidden.
- **Define “primary path”** — Document the intended default flow: phrase pill → pick or **+ New Phrase** → immediate draft on waveform (single mental model).
- **Align copy / hierarchy** — Ensure UI text and visual weight communicate “authoring” on desktop (without adding dashboard clutter).

### A2 — “+ New Phrase” in the phrase selector (desktop)

- **Phrase menu content** — Desktop phrase dropdown/sheet must list: existing phrases, active indication, separator, **+ New Phrase** (order and styling match spec).
- **Select existing phrase** — Unchanged behavior: active phrase, repeat/focus rules, playback boundaries as today.
- **+ New Phrase action** — Wire to the same store path as existing creation (e.g. `addLoopCandidate` / equivalent): new loop is **active**, **editable/draft**, phrase editing enabled, shaping on waveform immediately.
- **Preserve models** — Explicitly regression-test: draft vs locked behavior, waveform region editing, no duplicate or conflicting creation paths.

### A3 — Fast phrase authoring flow (listen → map → name)

- **No new heavy modals** — Creation from pill stays in-menu or inline; avoid wizard/dialog flows for the default case.
- **Playback continuity** — Verify creating or naming a phrase does not unnecessarily stop audio or break pan/zoom context (unless product-intentional).
- **Inline naming only** — Keep rename inline in list/sidebar/waveform context; no separate “rename project”-style forms for phrases.

### A4 — Waveform authoring strength (non-goals = do not regress)

- **Regression checklist (desktop)** — Confirm unchanged: drag-to-pan, phrase edge drag/edit, draft vs locked, phrase fit/focus behavior, minimap/navigation if applicable, mouse + keyboard efficiency.
- **Explicit “do not weaken” pass** — After any UI change, run through edge cases: single phrase, many phrases, very short phrase, phrase at file end, zoom extremes.

### A5 — PHRASES panel as optional structure / song map

- **Positioning copy (internal or UI)** — Optional: subtle hint that the panel is “structure / overview” not required for basic create/select (if it helps discovery without noise).
- **Panel behaviors** — Collapse/expand, waveform width when hidden, list + multi-phrase edit from panel — all remain correct.
- **Pill stays primary** — Acceptance: all phrase select + create flows work with panel **closed**.

### A6 — Keyboard shortcut foundation (desktop)

- **Central guard** — Shortcuts must not fire when focus is in `input`, `textarea`, `select`, or `contenteditable` (and any other inline rename targets).
- **Space** — Play / pause on desktop workspace (consistent with existing global behavior; no double-handling).
- **A** — New phrase (same as **+ New Phrase**); respect Cmd/Ctrl (do not steal browser select-all).
- **R** — Toggle repeat phrase; align with store rules for “can enable repeat” vs invalid phrase.
- **Document shortcuts** — Short internal comment or future tooltip task (optional subtle help text).

### A7 — Workspace “feel” (calm + capable)

- **Visual audit** — Centered stack, pills, waveform hero; utilities de-emphasized; no new full-width toolbars.
- **Authoring cues** — At least one obvious create path without opening the side panel (pill + New Phrase + **A**).
- **Avoid DAW clutter** — Any new control must justify itself against “phrase studio” positioning.

### A8 — Mobile preservation

- **Mobile diff discipline** — Touch paths, bottom sheets, mobile phrase UI unchanged unless a shared component change is unavoidable; if shared, gate desktop-only behavior.
- **Smoke test mobile** — Narrow viewport: project pill, phrase sheet, play/repeat/tempo, waveform, account.

---

# Track B — Layout polish: utilities, hierarchy, spacing (current implementation)

**Intent:** Fix disconnected top utility cluster, awkward Phrases toggle, competing Save/account, and uneven practice row — **without** abandoning the centered stack. Preserve **all** functionality (save, open file, panel toggle, dev export, account).

### B1 — Replace / demote the top-right utility cluster

- **Remove “floating toolbar” feel** — Today: Phrases + ⋯ + Save + account reads as disconnected from the centered stack; refactor so utilities are **secondary and quieter**.
- **Preferred grouping** — Compact top-right: `**[ account/profile ] [ overflow ⋯ ]`** only (or equivalent minimal chrome).
- **Overflow menu contents** — Move into menu: **Save to cloud** (or Save), **Export Loops JSON** (dev only), **Show/Hide Phrases panel**, **Open audio file**, room for future utilities.
- **Do not** leave Save permanently prominent in the top bar; avoid scattered utility labels that compete with the practice stack.

### B2 — Phrases panel toggle cleanup

- **Remove awkward standalone “Phrases” text control** from the top strip (current pain point).
- **Relocate toggle** — Either: **inside overflow menu** (with clear menu label), **or** a **small icon-only** “show structure panel” control (subtle, no competing label) — pick one approach and apply consistently.
- **Reiterate role** — Panel = optional structure / song map / overview — **not** primary navigation (phrase pill + menu stays primary).

### B3 — Centered practice stack (preserve + refine)

- **Keep vertical rhythm:** Project pill → Phrase pill → Play → Time → (Repeat / Phrase start / Full song / Tempo) → Waveform.
- **Hierarchy** — Phrase pill visually dominant; Play emotionally central; project pill secondary; calm spacing rhythm between blocks.
- **Eye-flow pass** — Light design review so composition feels **intentional**, not assembled.

### B4 — Rebalance practice controls row

- **Repeat** stays the **primary** control in the row (weight, size, or position vs neighbors per current design system).
- **Phrase start** & **Full song** — Visually quieter (ghost/tertiary), consistent spacing.
- **Tempo pill** — Reads as part of the **same centered group**, not stuck to an edge; reduce sprawl.
- **Layout** — Prefer **one centered cluster** for the whole row (not stretched edge-to-edge).

### B5 — Project pill polish

- **Preserve** centered placement, DEMO badge, dropdown behavior.
- **Tighten micro-layout** — Spacing between project name, DEMO badge, and chevron; avoid cramped truncation where possible (max-width, padding, `min-w-0` patterns).

### B6 — Phrase pill polish (emotional center)

- **Preserve** dropdown behavior, **+ New Phrase**, active state.
- **Spacing** — Slightly improve vertical margin around phrase pill vs neighbors so it reads as **the** focal control.
- **Prominence** — Stronger than project pill; copy should reinforce “this is what I’m practicing / building.”

### B7 — Waveform breathing room

- **Vertical gap** — Slightly increase space between the bottom of the practice stack and the waveform region (immersive, not excessive scroll).

### B8 — Desktop authoring must stay strong (overlap with Track A)

- **No over-simplification into mobile** — After layout changes, re-verify: waveform editing, phrase creation (+ menu + keyboard), drag-to-pan, phrase locking model, phrase panel behavior, project open/save/cloud paths (functionally complete even if UI moved).

### B9 — Mobile must not regress

- **Scope check** — Layout/utility work touches **desktop stack only** where possible; shared components get mobile regression smoke test.

### B10 — Acceptance tests (layout + combined)

**Desktop**

- Top-right **utility clutter resolved**; stack remains **dominant**.
- Save / cloud save **accessible** but **not** visually competing with practice.
- Phrases panel toggle **no longer awkward**; panel still open/close correctly; waveform expands when hidden.
- Centered stack + **phrase pill primary** + **project secondary** unchanged in intent.
- Practice row: Repeat primary; Start/Full song quiet; Tempo integrated; centered grouping.
- Waveform: **more breathing room** above it.
- **+ New Phrase**, phrase creation, cloud save/load, overflow actions still work.
- Track A keyboard + authoring regressions still pass where already implemented.

**Mobile**

- No regressions: project pill, phrase pill, bottom sheets, account, waveform, practice-first layout.

**Build / quality**

- `npm run build` passes; `npm test` passes; no new TS errors; no major console errors.

---

## Suggested implementation order (combined)

1. **Track B1–B2** — Utilities + Phrases toggle (biggest visual win; unblocks “intentional” composition).
2. **Track B4–B7** — Practice row balance + pill polish + waveform spacing.
3. **Track A2–A3 + A6** (if not already done) — + New Phrase + keyboard + authoring flow.
4. **Track A4 + A5 + B8** — Regression passes (waveform, panel, authoring, cloud/save after menu moves).
5. **Track A8 + B9 + B10** — Mobile smoke + full acceptance + build.

---

## Notes

- Original phrase-authoring items are preserved under **Track A** (renamed with **A** prefixes for clarity).
- New layout/utility items are **Track B** — refinement on the **current** centered stack, not a redesign.

---

## Implementation progress

### Done (2026-05-14)

- **Track B1–B2** — Desktop top utilities are **`[ HeaderAccount ] [ ⋯ ]`** only. **Save**, **Open audio**, **Show/Hide phrase list**, and **Export loops JSON** (dev) live in the overflow menu. Standalone “Phrases” button removed.
- **Track B4** — Repeat / Phrase start / Full song / Tempo sit in a **single centered cluster** (`rounded-2xl` subtle border + background) to reduce sprawl.
- **Track B5–B6** — Project pill: extra horizontal padding + `gap-2.5`. Phrase block: slight top margin for separation from project.
- **Track B7** — Desktop waveform container: **more top/bottom padding** (`pt-9` / `sm:pt-10`, etc.). Practice stack: slightly increased vertical padding before the waveform.

**Files touched:** `components/desktop-practice-stack.tsx`, `components/woodshed-workspace.tsx`

**Risk / follow-up:** Save is one extra click (menu) — intentional per spec; confirm product OK. Next: manual **Track A/B regression** pass (waveform edit, cloud save, panel toggle from menu, + New Phrase).

