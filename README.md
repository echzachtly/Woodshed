# Woodshed

Next.js + WaveSurfer practice workspace for loop-based phrase learning.

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

1. Copy `.env.example` to `.env.local`.
2. Fill in values when you add Supabase (auth + cloud saves). Until then, the app runs fully **offline** using IndexedDB (Dexie) for sessions.

| Variable | Scope | Purpose |
|----------|--------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase anon (RLS) key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** | Admin API — never prefix with `NEXT_PUBLIC_` |

`GET /api/health` returns `{ ok: true, supabase: boolean }` so deploys can confirm env wiring without leaking secrets.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Run production build locally |
| `npm run lint` | ESLint |
| `npm test` | Vitest |

## Deployment (Vercel)

1. Push this repo to GitHub (keep `.env.local` out of git — see `.gitignore`).
2. Import the repo in [Vercel](https://vercel.com), set root to this project if it lives in a monorepo.
3. Add the same env vars in the Vercel project settings (Preview + Production as needed).
4. After deploy, verify: app loads, audio upload, waveform, loops, zoom, and `/api/health`.

## Layout QA (desktop / laptop)

Manually spot-check **~1366×768**, **1920×1080**, and **2560×1440**: waveform stays dominant, sidebar and transport stay usable, no horizontal page scroll.

## License

Private / all rights reserved unless otherwise specified.
