# Woodshed Onboarding Implementation Plan

**References:**

- **`docs/TERMINOLOGY_GLOSSARY.md`** — authoritative user-facing vocabulary and internal mappings (`PracticeLoop` → Practice Section, `PhraseSegment` → Focus Loop).
- **`docs/ONBOARDING_STRATEGY.md`** — philosophy, empty workspace framing, demo policy, bootstrap vs onboarding completion.

---

# Phase 1 — Documentation and architecture ✅ (iterative)

## Objectives

- Define onboarding behavior **before** visual implementation.
- Keep **desktop** and **mobile** onboarding **logically separate** (flags + branching).
- Establish **persisted milestones** (`lib/onboarding/*`, `localStorage`, versioned schema).

## Deliverables (living)

This plan, strategy doc, terminology glossary, and implementation notes appended below.

---

# Phase 2 — Platform infrastructure (safest earliest code)

**Status:** **2a** (`lib/onboarding`) and **demo auto-load removal** are implemented in codebase (Phase 1 infra). Remaining items are empty workspace UI and hint wiring.

Goals—**minimal behavior change**, maximum alignment with product decisions:

## 2a — Onboarding persistence skeleton _(done)_

Add **`lib/onboarding/`** with versioned **`localStorage`** schema:

- Separate keys **desktop** vs **mobile** (mirror strategy).
- Booleans/milestones documented in-code (completion + optional dismissal).
- Helpers: read, write, migrate version, safe JSON parse defaults.
- **Must survive** `resetWorkspace()` — never store flags in **`woodshed-store`**.

_No UI required to ship the module._

## 2b — Stop automatic demo loading _(done)_

In **`woodshed-workspace.tsx`**, **remove or gate** the mount-time **`tryLoadBuiltInDemo()`** path:

- Preserve **explicit** demo loading invoked from user flows (same `loadBuiltInDemoProject` / restore picker behavior).
- **No** waveform engine changes required for this isolated gate.

_Order recommendation: persistence schema first or in same PR as demo gate—but demo gate **must not** regress manual demo._

## 2c — Derived trigger helpers (read-only utilities)

Thin pure functions consuming **snapshot** `(duration, loops, …)` returning suggested trigger booleans—for later UI binding **without duplicating predicates** everywhere.

_Not required at file layout level until onboarding UI begins._

---

# Phase 3 — Desktop onboarding (inside workspace UX)

Goals:

Teach—in place:

1. Import = **Create New Project** opens file picker.  
2. **Practice Section** framing on Waveform vs **Focus Loop** creation.  
3. Transport scopes (section repeat vs Focus Loop repeat) only as needed—avoid tutorial density.

Recommended implementation shape (later):

| Building block | Role |
|----------------|------|
| Empty-workspace inset | Inline CTAs: Create New Project · Open Demo Project · Open Saved Project |
| Stage 1–3 hints | Non-modal; tied to onboarding flags |
| Gesture accuracy | Align copy with Shift + drag authoring |

### Technical notes tied to glossary

User-facing **`Loop Phrase` → Practice Section looping** wording pass should accompany transport copy updates (avoid “phrase”; see glossary transport table).

---

# Phase 4 — Mobile onboarding (instrument UX)

Goals:

Teach:

- Project / demo picking  
- **Focus Loop** selection & playback rhythm  
- Tempo adjustment  
- Lightweight repeat hints  

Reuse **same onboarding persistence module**—different milestones / keys.

Avoid:

Heavy editing onboarding (desktop-only authoring).

---

# Phase 5 — Refinement & analytics (optional)

Potential:

- Telemetry on milestones  
- Explicit reset onboarding in settings  
- A/B tweak copy—not multi-step wizardry  

---

# Suggested folder structure (future coding)

```
lib/onboarding/
  schema.ts               # keys, versioning, migrations
  read-write.ts           # load/save + defaults
  triggers.ts             # derived predicates from store snapshot

components/onboarding/    # Phase 3+ UI only—do not rush
  ...

docs/
  TERMINOLOGY_GLOSSARY.md
  ONBOARDING_STRATEGY.md
  ONBOARDING_IMPLEMENTATION_PLAN.md
```

---

# Acceptance criteria (engineering)

## Desktop

- Demo does **not** auto-load on cold start.
- Explicit demo path unchanged for users who choose it.
- Desktop completion flag engages only after **Focus Loop authoring** criterion—**not** default Practice Section bootstrap.
- Hints gated by onboarding flags—not by project ids.

## Mobile

- User can reach practice quickly from empty workspace pathways.
- Mobile completion aligns with milestone definition in strategy (**Focus Loop playback + tempo affordance discovery**).

## Cross-cutting

- `resetWorkspace()` never clears onboarding flags.
- Terminology trajectory matches glossary (**avoid “region,” “phrase,” “loop” as noun for saved objects where glossary says otherwise**).

---

# Non-goals

Do NOT:

- Build multi-step “wizard” overlays  
- Block UI with compulsory modals  
- Gamify  
- Persist onboarding state into **`woodshed-store`** without strong rationale  
- Introduce cross-device onboarding sync prematurely  

---

# Onboarding trigger matrix (refined, post-bootstrap policy)

Signals use **conceptual predicates** implementers translate to selectors + events. **Persisted milestones** supersede instantaneous signals once “completed” for that platform.

| ID | Surface | Desired signal (conceptual) | Typical sources (conceptual) | Milestone relation |
|----|---------|-----------------------------|------------------------------|--------------------|
| `D0` | Desktop | Workspace visible; no decoded audio timeline yet (`duration === 0` baseline) | Zustand + WS readiness | Shows empty workspace CTAs; no demo autoplay |
| `D1` | Desktop | Timeline ready; **eligible for Focus Loop guidance** | Decode success; onboarding not complete | True when **total `PhraseSegment` count across all `loops` is 0** (includes default-import bootstrap with empty `segments`). **Exclude** hydrated/demo JSON until defined—implementer: treat **first session after explicit user hydrate** similarly to import for hints only if UX requires (default: hydrate does not revive desktop onboarding if already completed—see Risks). |
| `D2` | Desktop | User **authors** first Focus Loop | `createFocusSegmentFromShiftDrag` success / `addSegment` / equivalent creation UX | Marks **desktop onboarding complete** when intentional & not restore |
| `D3` | Desktop | Rename / trim hints | Existing editing flows | Secondary hints after `D2`; optional dismiss-only flags |
| `M0` | Mobile | Workspace visible; analogous empty / entry | Width + duration | Entry CTAs aligned with strategy |
| `M1` | Mobile | Prepared graph available | nonzero duration + loops from demo/import | Enables chip pulse |
| `M2` | Mobile | Focus Loop engaged | taps chip / repeat enters section vs focus mode / explicit selection handler | Contributing signal toward mobile completion |
| `M3` | Mobile | Tempo interacted | Slider change event | Contributing signal |

**Hydrated / demo caveat:** Loaded projects may ship with predefined Focus Loops (`segments`). Product choice: onboarding completion for **already-experienced** users should rely solely on **`localStorage`** completion flags—not on “segment count zero.” That means **`D1` hides** automatically when onboarding already completed—even if imported project lacks segments users never authored.

Implementation note: **`D2`** should fire from **explicit user creation paths**, not deserialize.

---

# Safest sequential implementation checklist

| Step | Work | Regression risk |
|------|------|----------------|
| **1** | Land terminology docs (this iteration) | Documentation drift vs code until strings updated |
| **2** | `lib/onboarding` schema + accessors | Very low |
| **3** | Demo auto-load removal / gate | **Verify** picker + manual demo restores |
| **4** | Add **read-only trigger helpers** wired to snapshots | Low |
| **5** | Desktop empty inset + Stage 1–3 overlays | Moderate UX |
| **6** | Mobile parallel hints | Moderate duplication risk—reuse lib |
| **7** | String terminology sweep against glossary | Moderate QA surface |

_String passes can overlap **after Step 5** deliberately to avoid rework._

---

# Risk assessment (implementation-facing)

| Risk | Mitigation |
|------|-----------|
| Demo gate breaks first-time testers who relied on autoplay | Visible **Open Demo** CTA remains in empty workspace design |
| `D2` attribution (user vs hydrate) wrongly marks completion | Tie milestone to authoring events—not store shape alone |
| Overlapping prompts (empty workspace + inspector copy) | Centralize onboarding controller later; tighten copy ladder |
| “Phrase” persists in codebase (internal) confuses translators | glossary + prioritized string spreadsheet |
| **ARCHITECTURE.md** contradicts glossary | Planned doc refresh pass—glossary authoritative for UX/onboarding meanwhile |
