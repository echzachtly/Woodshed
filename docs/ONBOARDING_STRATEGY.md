# Woodshed Onboarding Strategy

Canonical vocabulary: **`docs/TERMINOLOGY_GLOSSARY.md`** (Practice Section, Focus Loop, Waveform, Timeline, etc.).

---

## Philosophy

Woodshed should feel like a musical instrument and focused practice environment—not a DAW, productivity app, or enterprise tool.

The onboarding system must:

- Teach through interaction rather than instruction.
- Use progressive disclosure.
- Avoid modal tutorials and excessive tooltips.
- Preserve immersion and creative flow.
- Permanently disappear once core actions are learned.

---

## Success criteria (product truth)

### Desktop onboarding success

The user **intentionally creates a Focus Loop inside a Practice Section** (smaller repeat target within the section span).

- A **default Practice Section** created on first import **does not** satisfy this criterion and **must not** mark desktop onboarding complete.
- Completion is **user/device-level** (not per project); see persistence rules.

### Mobile onboarding success

The user **opens prepared material** and **interacts with Focus Loops and playback**—specifically: **selects or plays using a Focus Loop** and is exposed to **tempo / repeat** controls in a lightweight way (exact instrumentation is implementation detail; avoid heavy explanation).

---

## Primary onboarding objective (orientation)

> A first-time user should reach **desktop success** or **mobile success** quickly—without leaving the workspace shell and without forced demo projects.

Time-to-value remains a useful design goal (e.g. first session), but **completion** is defined by the success criteria above—not by “any loop exists.”

---

# Product positioning

## Desktop = workbench

Desktop is where users:

- Import songs (**Create New Project** = open file picker / import flow)
- Understand **Practice Sections** on the Waveform
- Create **Focus Loops** inside sections
- Refine practice material
- Prepare projects for mobile use

Desktop onboarding should focus on:

- Waveform discoverability (inside the workspace)
- **Focus Loop** creation (Shift + drag inside an active section—actual gesture; copy must match behavior)
- **Practice Section** organization (list, rename, boundaries where applicable)
- Editing interactions (non-modal, minimal)

## Mobile = practice instrument

Mobile is where users:

- Open prepared **Projects**
- Practice **Focus Loops**
- Repeat difficult passages
- Adjust tempo
- Move between **Practice Sections** when a project has several

Mobile onboarding should focus on:

- Choosing a project (including optional **Open Demo Project**)
- **Focus Loop** chips / selection
- Tempo and repeat / transport affordances

Mobile should avoid:

- Heavy editing workflows
- Complex creation flows
- Dense instructional UI

---

# First-run experience (empty workspace)

## No separate dashboard

The app opens **inside the Woodshed workspace**: the **Waveform / workspace shell stays visible**. Onboarding and empty-state guidance are **in-place**, not a separate app route or disconnected “home app.”

## Initial app load

- The app must **not** automatically open the demo project.
- The **demo** remains **visible, selectable, and useful** for discovery—only via **explicit user action**.

## Empty workspace content (target)

When no audio is loaded (or before the user has chosen demo / saved project), the workspace should calmly offer:

- **Create New Project** → immediately opens audio import / file picker (**no** blank DAW shell, **no** project creation form).
- **Open Demo Project** → loads the existing guided demo asset.
- **Open Saved Project** (when the feature is available)—local / cloud lists as today.

Supporting copy stays **minimal** and **musician-native**—avoid startup dashboards.

---

# Desktop progressive discovery (illustrative stages)

Staging is sequential in spirit but **must stay non-blocking** and **respect completion flags**. Exact trigger predicates are refined in **`ONBOARDING_IMPLEMENTATION_PLAN.md`** (trigger matrix).

## Stage 1 — Guiding Focus Loop creation

**Intent trigger (conceptual):** Audio decoded, user has **not** completed desktop onboarding, and **no Focus Loop authored yet** (`PhraseSegment` count is zero across loaded practice graph—or equivalent invariant used at implementation time).

Suggested behavior:

- Subtle waveform affordances (glow / ghost gesture) aligned with actual authoring: **Hold Shift + drag inside the active Practice Section** to carve a Focus Loop.
- Minimal helper copy near Waveform—not a modal.

**Dismiss / complete:** Permanent after **intentional Focus Loop creation** (desktop success criterion)—not after default section bootstrap alone.

## Stage 2 — First Focus Loop created

Suggested behavior:

- Light emphasis on the new Focus Loop (select, animate in tastefully—implementation detail).
- **One** contextual hint maximum (rename, boundary trim)—rotate copy; never stack spam.

Rules:

- Only one hint visible at a time.
- Never repeat after successful interaction tied to milestone flags.

## Stage 3 — First purposeful playback / repeat

Suggested behavior:

- Subtle reinforcement of transport / playback scope (Practice Section repeat vs Focus Loop repeat) without encyclopedic labeling.

Avoid:

- Confetti
- Gamification
- Loud celebration systems

Desired emotional tone:

- Musical  
- Focused  
- Analog  
- Immersive  

---

# Desktop interaction discoverability

Waveform should communicate interactivity visually.

Recommended:

- Vertical cursor tracking line
- Preview shading during authorized drags (Shift authoring)
- Subtle cursor transitions

Goal:

Teach interaction through physics and movement rather than paragraphs of text—while **keeping gesture descriptions accurate**.

---

# Mobile first-run experience (empty / entry)

Mobile uses the **same workspace shell**. Headline/supporting text proposals are **tone guides**—not separate “screens” disconnected from Woodshed.

### Tone / CTAs

- Emphasize **Open Demo Project** and **Choose Project** (saved list).
- **Create New Project** maps to **import/open audio** via the existing file-picker flow mobile already exposes—no new conceptual layer.

Suggested hint after entry:

Tap a **Focus Loop** to drill that passage; adjust **playback** speed as needed.

---

# Mobile progressive discovery (illustrative)

## Stage 1 — Demo or project opened

Behavior:

- Subtle pulse on primary **Focus Loop** affordance (chips row) **or** first Focus Loop chip when applicable.
- Subtle pulse on Play when discovery calls for it.

Rules:

- Lightweight only  
- Minimal text  
- Fade quickly  

## Stage 2 — Tempo discovery

Trigger: user engages playback **or** has shown intent on transport (implementation-defined).

Behavior: brief emphasis on tempo control.

Rules:

- Show once  
- Immediately dismissible  
- Respect `prefers-reduced-motion`

---

# Persistence rules

## User-level flags (device local)

Persist onboarding milestones **per device/browser profile** separately for:

- Desktop onboarding subsystem  
- Mobile onboarding subsystem  

Suggested schema direction (implementation detail):

- **Completed** milestones (desktop Focus Loop authored; mobile playback/tempo milestones as defined at build time).
- Optional **dismiss** flags for ephemeral hints—not a substitute for “completed.”

Requirements:

- **Do not** re-run onboarding once completed—unless explicit future reset.
- **Do not** persist onboarding state inside project JSON by default (`resetWorkspace()` and project swaps must **not** clear completion).
- Per-project onboarding is **not** in scope unless product changes.

## Future

Cross-device sync of onboarding flags is **not required** initially.

---

# Accessibility

- High contrast onboarding text when text is shown.
- Avoid color-only communication.
- Respect reduced motion preferences.
- Avoid flashing animations.

---

# Future enhancements (not initial scope)

Potential future systems:

- Analytics instrumentation  
- Guided walkthrough mode  
- Explicit reset onboarding in settings  
- Advanced shortcut discovery  
- Auto phrase/section suggestion  

These are **not** initial implementation scope unless explicitly pulled in.

---

# Success metrics (analytics-oriented)

Examples—subject to instrumentation choices:

## Primary-oriented

- Time to **first intentional Focus Loop** (desktop milestone)
- Time to **first Focus Loop playback** on mobile  
- Session completion vs completion flags  

## Secondary

- Retention windows  
- Demo project **opt-in** rate (not forced load)  
- Hint dismissal vs completion correlation  

---

# Design constraints

The onboarding system must:

- Feel nearly invisible  
- Preserve elegance  
- Avoid clutter  
- Avoid “productivity app” energy  
- Reinforce tactile interaction  

If onboarding becomes noticeable as a “system,” it has failed—but **truthful gesture hints** trump misleading brevity.
