# Woodshed PWA — testing checklist

Lightweight installability pass: **no service worker**, **no offline cache**, **no background audio**. Use this after `npm run build` and deploying (or `npm run start` on your LAN for device tests).

---

## 1. Build and manifest

1. Run `npm run build` (already required for production).
2. Open **`/manifest.webmanifest`** in the browser (JSON). Confirm:
   - `name` / `short_name` / `description`
   - `start_url` is `/`, `scope` is `/`
   - `display` is `standalone`, `display_override` includes `standalone`
   - `theme_color` / `background_color` match `#0c0a09`
   - `icons` lists `/icon` (32×32 PNG), `/apple-icon` (180×180 PNG), and `/woodshed-icon.svg` (any + maskable entries)

---

## 2. Installability on iPhone (Safari)

1. Deploy the app over **HTTPS** (or use a tunnel such as ngrok / Cloudflare Tunnel). iOS requires a secure origin for “Add to Home Screen” behavior.
2. Open the site in **Safari** (not Chrome on iOS for the canonical install flow).
3. Tap **Share** → **Add to Home Screen**.
4. Confirm the suggested title is **Woodshed** and the icon appears (generated **180×180** “W” on dark background, or cached variant).

### Confirm standalone / app-like launch

1. Launch Woodshed from the **home screen icon** (not from Safari tabs).
2. The app should open **without Safari’s URL bar** (standalone). Swipe from bottom may show the home indicator only.
3. **Status bar:** `appleWebApp.statusBarStyle` is `black-translucent` — content can extend under the status bar; `viewportFit: cover` is set. The home `main` shell uses **`padding-top: env(safe-area-inset-top)`** in **`display-mode: standalone`** only (`globals.css` + `.woodshed-pwa-mobile-shell` on `app/page.tsx`) so the mobile project header clears the Dynamic Island / status area.
4. Compare **Safari tab** vs **home screen icon**: extra top inset should appear only in standalone PWA, not in normal browser tabs.

### After launch, verify

- [ ] App loads at `/` and practice UI works as in the browser tab.
- [ ] **Standalone:** Top project / phrase controls sit **below** the status bar or Dynamic Island (not clipped).
- [ ] Rotation (if you use it) still behaves; manifest `orientation` is `any`.
- [ ] No broken assets or mixed-content warnings in Safari Web Inspector (Mac) → Develop → phone.

---

## 3. Installability on Android (Chrome)

1. Open the deployed **HTTPS** URL in Chrome.
2. Look for **“Install app”** / “Add to Home screen” in the menu or address bar.
3. Install and open from the launcher; confirm **standalone** (no browser toolbar, or minimal browser chrome depending on OEM).

---

## 4. Desktop Chrome (sanity)

1. Open the app → Application tab → **Manifest** — verify fields match `app/manifest.ts`.
2. **Icons** — confirm `/icon`, `/apple-icon`, and SVG load (Network tab, 200).

---

## 5. Known limitations (this pass)

- **No service worker** — no offline use, no precache, no update prompts.
- **No background audio** — OS may suspend audio when the app is backgrounded like any web page.
- **Install prompt** is browser-controlled; there is no custom “install Woodshed” UI.
- **Generated icons** (`app/icon.tsx`, `app/apple-icon.tsx`) are a simple branded “W” on `#0c0a09` for small file weight and no extra build tooling. **`public/woodshed-icon.svg`** remains the full-detail asset for manifest and linking.
- **512×512 PNG** is not shipped as a static file; some Android flows prefer larger bitmaps for splash/install art. If install art looks soft, add static `192`/`512` PNGs later and extend `app/manifest.ts`.

---

## 6. Deferred (by design)

- Service worker + offline / cache strategies  
- Push notifications  
- Background playback / audio session APIs  
- Web Share Level 2 / file handlers (unless product asks)  
- Custom install modal / `beforeinstallprompt` UX  

See also: `docs/mobile-practice-redesign/PWA_READINESS_NOTES.md`.
