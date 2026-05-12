# TODO — Rev 1 (Pre-deployment refinement)

**Scope:** UI/UX polish only — no major feature expansion.  
**Source:** Product assessment (refinement, clarity, perceived polish).  
**Status:** Planning only — implementation not started.

---

## Guiding principles

- [ ] Treat every change as **reducing visual friction** and **raising perceived quality**, not adding capability.
- [ ] Prefer **spacing, contrast, hierarchy, and removal** over new panels or flows.
- [ ] Validate each batch on **long sessions** (readability, eye fatigue) and **narrow viewports** (xl sidebar layout).

---

## Critical (do first)

### 1. Remove or replace the default white horizontal scrollbar (WaveSurfer)

- [ ] Audit where horizontal scroll is applied (WaveSurfer renderer / shadow DOM `.scroll`, any host overrides).
- [ ] Choose one approach and document it in a short comment in code (for future maintainers):
  - **Option A:** Hide native scrollbar (CSS: `scrollbar-width`, webkit pseudo-elements) while keeping **wheel / trackpad / programmatic** scroll working; ensure keyboard/accessibility still usable.
  - **Option B:** Custom minimal scrollbar (styled track/thumb) if hiding alone hurts discoverability.
  - **Option C:** Emphasize **click-drag pan** (and existing minimap) only if scrollbar is fully hidden — verify UX is still obvious for new users.
- [ ] Cross-browser smoke test (Chromium, Firefox, Safari if applicable): scroll performance, region drag, minimap pan sync.
- [ ] Regression check: vertical layout, `overflow-hidden` on outer shell, no accidental **page-level** horizontal scroll return.

### 2. Increase main waveform vertical presence (~55–65% of usable workspace)

- [ ] Measure current approximate vertical share of the waveform block (viewport minus header, HUD row, minimap, sidebar).
- [ ] Raise WaveSurfer **height** and/or flex layout so the waveform column uses **~55–65%** of vertical space below the top bar (tune for `xl` + stacked mobile).
- [ ] Ensure **min-heights** still allow sidebar + minimap without overlapping; use `min-h-0` / flex discipline where needed.
- [ ] Re-check wheel-zoom, pointer hover X mapping, and region hit targets after height change.

### 3. Stronger playback cursor / “where am I listening?” focus

- [ ] Audit WaveSurfer options: `cursorColor`, `cursorWidth`, and any custom draw layers.
- [ ] Increase cursor **contrast** and/or width; consider **very subtle** outer glow (CSS or canvas-safe approach per renderer).
- [ ] Optionally explore **mild** dimming of waveform outside playhead (or ahead/behind) — keep subtle; performance check on large files.
- [ ] Verify cursor remains visible against **active loop overlay** and **progress** colors.

### 4. Clearer loop contrast hierarchy (active vs inactive)

- [ ] **Active loop region:** slightly brighter overlay, optional thin **border or soft glow**; ensure it still reads on dark theme.
- [ ] **Inactive loops:** lower opacity, slightly **cooler** tint than active; keep enough visibility for context.
- [ ] Align palette with existing accent tokens (`globals.css` / theme) — avoid one-off hex sprawl where possible.
- [ ] Quick pass with **color-blind** / grayscale check: loops and cursor still distinguishable.

---

## High value (next)

### 5. Top toolbar: intentional grouping and spacing

- [ ] Map current controls into three zones: **Left** (project / file / session), **Center** (transport / loop arm / fit-to-loop), **Right** (time + tempo / secondary transport).
- [ ] Normalize **gap**, **padding**, and **button order** within each zone; reduce inconsistent wrap breakpoints.
- [ ] Mobile / narrow: preserve grouping logic (stack or wrap by zone, not randomly).
- [ ] Visual pass: separators or spacing only — avoid adding new chrome unless necessary.

### 6. Mini-map: “navigation instrument” framing

- [ ] Increase **height** slightly (canvas + container).
- [ ] Improve **separation** from page background: border, subtle shadow, or soft panel background.
- [ ] Increase contrast for **viewport window** (brighter stroke/fill), keep loop markers readable.
- [ ] Optional: very light **backdrop blur** or depth on container — test performance and taste (subtle only).
- [ ] Re-read hint text size with typography task (#9).

### 7. Right sidebar: less “admin panel,” more workstation

- [ ] Soften **outer border** weight and/or sidebar background contrast vs main content.
- [ ] Lighten **loop cards**: border, shadow, or padding — reduce box heaviness while keeping active state obvious.
- [ ] Reduce perceived **density** (spacing between cards, section headers); keep tap targets comfortable.
- [ ] Ensure **active** loop still dominates without loud boxes.

---

## Nice to have (after critical + high)

### 8. Subtle motion polish (non-flashy)

- [ ] Inventory existing motion (e.g. Framer on list items); ensure nothing feels gimmicky for long sessions.
- [ ] Consider micro-transitions on: loop selection, fit-to-loop, minimap viewport — **short** durations, respect `prefers-reduced-motion`.
- [ ] Avoid motion that fights WaveSurfer redraws (test during playback).

### 9. Typography hierarchy and small text readability

- [ ] Audit `text-[11px]`, `text-xs`, and low-contrast `text-stone-500` usage (toolbar, minimap hints, sidebar meta, timestamps).
- [ ] Establish a **minimum readable size** for secondary UI (e.g. bump hints one step or increase contrast).
- [ ] Harmonize **uppercase / tracking** labels so they don’t compete with content labels.

### 10. Empty / loading states and removal of “debuggy” chrome for deployment

- [ ] **Deployment:** Remove or **gate** “Waveform HUD”, “Toggle debugger”, and any dev-only copy (feature flag, env, or build-time strip).
- [ ] Confirm no test IDs or internal names leak in user-visible strings.
- [ ] **Empty state:** no audio loaded — calm message + primary CTA (open file); avoid empty waveform looking broken.
- [ ] **Loading state:** dynamic import already exists — refine copy/spacing to match final visual system.
- [ ] **Error state:** failed load — short, human message; optional retry without stack tone.

---

## Suggested implementation order (merged checklist)

Use this as the default sequence; parallelize only where independent.

1. [ ] Critical #1 — Scrollbar removal/replacement  
2. [ ] Critical #2 — Waveform height / vertical share  
3. [ ] Critical #3 — Cursor / playback focus  
4. [ ] Critical #4 — Loop contrast hierarchy  
5. [ ] High #5 — Toolbar grouping + spacing  
6. [ ] High #6 — Mini-map framing + height  
7. [ ] High #7 — Sidebar lightness  
8. [ ] Nice #10 — Hide debug UI + empty/loading polish  
9. [ ] Nice #9 — Typography pass  
10. [ ] Nice #8 — Motion polish (last, with reduced-motion)

---

## Done criteria (Rev 1 complete when)

- [ ] Waveform occupies roughly **55–65%** of vertical workspace under the header in typical desktop layout.
- [ ] No **browser-default** white horizontal scrollbar on the main waveform; pan/scroll remains usable.
- [ ] **Active loop**, **inactive loops**, and **playhead** are immediately distinguishable at a glance.
- [ ] Mini-map reads as a **dedicated navigation** strip, not a thin afterthought.
- [ ] Toolbar reads as **three deliberate zones** with consistent rhythm.
- [ ] Sidebar feels **lighter**; loop cards less “dashboard card,” still scannable.
- [ ] No dev/debug terminology visible in production build.
- [ ] Secondary text passes a **“two-hour session”** readability skim without squinting.

---

## Notes (non-goals for Rev 1)

- Do **not** add major features, new plugins, or new workflows.
- Prefer **CSS/layout/theme** changes over new state unless unavoidable.
- Keep existing behaviors (fit-to-loop, minimap, regions, keyboard shortcuts) intact unless a polish task explicitly requires a small adjustment.
