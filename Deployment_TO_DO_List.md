# Woodshed — Deployment TO DO List

**Source:** `WOODSHED_DEPLOYMENT_TODO.md` (Desktop)  
**Goal:** Ship for real-world musician testing and private beta—not new product features. **User behavior > internal polish.**

**Recommended stack:** **Vercel** (frontend) + **Supabase** (auth, Postgres, storage).

**Last updated:** 2026-05-12 (Phase 1 scaffolding landed in repo; run `npm install` once to sync `package-lock.json` after dependency trim.)

---

## Workflow rule (each phase)

Do **not** stack major systems untested. For every checkpoint:

1. **Implement**
2. **Deploy preview** (or production slice)
3. **Test manually**
4. **Fix obvious issues**
5. **Only then** continue

---

## Phase 1 — Production-ready project

### 1.1 Clean the repository

- [x] Remove debug UI, temporary `console.log`, dead code, unused components/CSS *(debug UI removed earlier; unused `@radix-ui/react-dialog` + `@radix-ui/react-scroll-area` removed from `package.json`; app `console.*` routed through `lib/dev-log.ts` so production stays quiet.)*
- [x] Clear placeholder TODOs and experimental prototype files not needed for beta *(none in `app/`, `components/`, `lib/`.)*
- [x] Review imports, dependencies, and `package.json`
- [x] Audit environment variable usage (no secrets in repo) *(`.gitignore` covers `.env*` with `!.env.example`; service role documented server-only in README.)*
- [x] **Test:** No debug UI; minimal console noise; production build succeeds locally; app runs from production build *(run `npm run build` + `npm run start` locally to confirm on your machine.)*

### 1.2 Desktop / laptop layout (not a mobile pass)

- [ ] Verify at **1440p**, **1080p**, and **smaller laptop** widths *(see README “Layout QA”; codebase uses `min-h-0` / `min-w-0` / `overflow-hidden` for scroll containment.)*
- [ ] **Test:** Waveform dominant; sidebar not awkward; toolbar/workspace transport spacing clean; mini-map usable; no overflow; zoom/pan smooth

### 1.3 Environment variables

- [x] Add **`.env.example`** with placeholders (no real secrets)
- [x] Document local `.env.local` setup; ensure `.gitignore` excludes secrets
- [x] **Test:** Vars load in dev/preview; missing vars fail gracefully; no accidental client exposure of service role *(public helpers in `lib/env/public.ts` only read `NEXT_PUBLIC_*`; `/api/health` reports `supabase: true/false` without leaking values.)*

---

## Phase 2 — Public deploy (Vercel + GitHub)

### 2.1 GitHub repository

- [ ] Create **private** (recommended) or public repo
- [ ] Push cleaned tree + README (+ PRD / TODO docs if useful)
- [ ] **Test:** Push OK; `.env.local` / secrets not committed; README renders

### 2.2 Vercel deployment

- [ ] Connect repo; enable **preview** + **production** deploys
- [ ] Set **all** required env vars in Vercel (incl. Supabase when added)
- [ ] Configure production domain when ready
- [ ] **Test:** Deploy green; app loads; **audio upload**; waveform; playback; loops; zoom; no critical console errors; no hydration errors

### 2.3 Cross-browser smoke test

- [ ] **Chrome**, **Edge**, **Firefox** (+ **Safari** if available): audio, waveform, zoom, drag, timing
- [ ] **Test:** Consistent playback; loops OK; layout not broken; stable audio timing

---

## Phase 3 — Basic authentication (Supabase)

### 3.1 Supabase project

- [ ] New Supabase project; enable **email/password** auth only (no social/org for now)
- [ ] Capture URL + anon key; store service role **server-only**
- [ ] **Test:** Auth enabled; keys valid; app connects from local env

### 3.2 Auth UI

- [ ] Minimal **sign up**, **login**, **logout** (modal or light dedicated page—no heavy SaaS onboarding)
- [ ] **Test:** Sign up / login / logout; session survives refresh; invalid credentials handled cleanly; UI stays calm

### 3.3 Auth state in the app

- [ ] Track current user, loading, session restore
- [ ] **Test:** Refresh restores session; logout clears; unauthorized states handled; UI reacts correctly app-wide

---

## Phase 4 — Cloud project persistence

### 4.1 Database schema (keep simple)

- [ ] **`projects`:** `id`, `user_id`, `title`, `audio_file_path` (or storage key), `created_at`, `updated_at`
- [ ] **`loops`:** `id`, `project_id`, `name`, `start_time`, `end_time`, `tempo`, `order_index`
- [ ] Users via Supabase Auth (`auth.users`); link `projects.user_id`
- [ ] **Test:** Migrations apply; FKs OK; basic insert/select

### 4.2 Supabase Storage (audio)

- [ ] Secure upload path per user/project; signed or RLS-appropriate URLs for playback
- [ ] **Test:** Upload works; playback from storage works; file stays tied to project; WaveSurfer still happy

### 4.3 Cloud save / load (replace or augment local-only)

- [ ] Persist: project name, loops, active loop, tempos, audio reference
- [ ] **Test:** Save + reload; loop bounds and tempos accurate; multiple projects per user

### 4.4 Project library UI (minimal)

- [ ] List projects; open; delete; optional rename—**no** folders/tags/analytics dashboards
- [ ] **Test:** List correct; reopen reliable; switching projects stable; UI stays uncluttered

---

## Phase 5 — Private beta

### 5.1 Recruit testers (5–15)

- [ ] Invite ear-learning musicians (e.g. guitar, harmonica, blues/jazz)

### 5.2 Structured feedback

- [ ] Run short sessions; capture answers to: loop intuitiveness, zoom, playback clarity, waveform readability, confusion, delight, friction, “would you use this while practicing?”
- [ ] Anchor question: **Does Woodshed help musicians learn phrases faster?**

### 5.3 Observe behavior

- [ ] Note hesitation, misclicks, lost users, loop organization habits, revisit rate, playback expectations

---

## Phase 6 — After beta (do not pre-commit)

- [ ] **Only after** real usage: prioritize roadmap from data—not assumed features (practice modes, repeat counts, sharing, AI, etc. remain **unvalidated** until users say so)

---

## Final acceptance (beta-ready)

- [ ] Deploys successfully
- [ ] Production audio playback reliable
- [ ] Loops and zoom/navigation solid
- [ ] Auth reliable
- [ ] Projects save/reopen; audio uploads work; cross-device access works
- [ ] UI remains calm, musician-first, simple
- [ ] **Real musicians can use it without a walkthrough**

---

## Guardrails

- [x] **No feature creep** during deployment—protect focus, simplicity, and waveform-first workflow
- [x] **No secrets in Git**; service role only on server / Vercel server env *(documented in README + `.env.example`.)*

---

*Derived from Woodshed Deployment & Private Beta Launch Checklist.*
