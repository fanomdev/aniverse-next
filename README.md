# AniVerse (Next.js)

The exact same AniVerse site as the vanilla-JS version, rebuilt as a real
Next.js app. Same UI, same AniList catalog, same Kuhi-hosted playback —
now **self-contained in this one folder**, including the stream host.

## Stack

- **Next.js 14 (App Router) + React + TypeScript**
- **AniList GraphQL** — catalog & metadata, no key needed (AniList is CORS-open)
- **Kuhi API** (`kuhi/`, local Python/FastAPI, [aryaniiil/anime-api](https://github.com/aryaniiil/anime-api)) — video streams (animegg MP4s, 480p default, Reanime for subtitles)
- No database — accounts + history live in localStorage

## Run it (local, with playback)

Double-click **`start.bat`** — starts the Kuhi stream host on `:9797`, then the
Next.js dev server on `:3001`, then opens your browser.

Or by hand (Python 3.8+, 3 deps; the venv is pre-made at `kuhi/.venv`):

```powershell
# Kuhi stream host (this folder's kuhi/)
cd D:\aniverse-next\kuhi
.venv\Scripts\python.exe -m uvicorn src.main:app --host 127.0.0.1 --port 9797

# The app
cd D:\aniverse-next
$env:ANIME_SOURCES_BASE="http://localhost:9797"
pnpm install
pnpm dev          # → http://localhost:3001
```

Production: `pnpm build && pnpm start` — same env var needed for `/api/anime/media-sources` (or playback will 503).

## Deploy (public website)

Vercel runs the Next.js app, but **not** Kuhi — Vercel has no long-running
Python runtime, and datacenter scraping fits better on a Python web service.
So: deploy `kuhi/` as a public backend, point the app at it.

1. **Backend (Render, railway.app, fly.io, your VPS — anything that runs Docker):**
   deploy the `kuhi/` folder as a Docker web service. Health check path:
   `/anime/providers/status`. Note the public URL, e.g.
   `https://aniverse-kuhi.onrender.com`.
   (A `Dockerfile` and `.dockerignore` are included; `uvicorn src.main:app`
   binds `0.0.0.0:$PORT`. The Dockerfile needs no changes for Render's
   free tier.)
2. **Frontend (Vercel):** import this repo (Next.js auto-detected, no config),
   then add the env var `ANIME_SOURCES_BASE=https://aniverse-kuhi.onrender.com`
   (Project → Settings → Environment Variables) and deploy.

Caveats:

- Free Render sleeps when idle: the first episode after a quiet period can
  take a minute (cold boot + scrape). The media-sources route sets
  `maxDuration = 60`; on Vercel Hobby the effective cap may be lower — use a
  paid instance or a non-sleeping host if playback times out.
- Providers may block scrape requests coming from cloud datacenter IPs;
  it works from your residential connection more reliably.
- Scraping third-party stream sites from a public server violates their ToS in
  many cases — your call, same as the local setup.
- Local default stays the same: double-click `start.bat`.

## Repository layout

```
D:\aniverse-next\
├─ kuhi\                  ← the stream host (Python/FastAPI, vendored)
│  ├─ src\                ← API + ~10 scrapers it races
│  ├─ api.py              ← entry:  uvicorn src.main:app
│  └─ .venv\              ← ready-made venv, deps installed
├─ start.bat              ← one-click bootstrap (kuhi + dev server)
├─ app\                   ← pages/routes
├─ components\            ← header/bottom-nav/cards/Hero/etc.
└─ lib\                   ← anilist.ts, api.ts, auth.ts, storage.ts/…
```

## Cloudflare Worker (video proxy — optional but recommended)

All MP4/HLS bytes otherwise flow through Vercel's `/api/stream` and count
against the Hobby bandwidth cap. `stream-worker.js` in this folder is the same
proxy as a Cloudflare Worker (free, no bandwidth charge):

1. dash.cloudflare.com → **Workers & Pages → Create Worker** → paste
   `stream-worker.js` → Deploy → copy the `*.workers.dev` URL.
2. Vercel → project `aniverse-next` → Settings → Environment Variables → add
   `NEXT_PUBLIC_STREAM_PROXY` = `https://<your-worker>.workers.dev` (Production +
   Preview) → redeploy.

Unset, the app falls back to `/api/stream` (works locally, uses Vercel bandwidth
in prod).

## Known limitations

- Kuhi is **local-only** by design — video only resolves on the machine running it. Deploying to Vercel/Netlify does NOT deploy animegg streams; a public deploy is catalog + "where to watch" only unless you point `ANIME_SOURCES_BASE` at a Kuhi instance reachable from the internet (a tunnel or your own host).
- The vanilla `D:\aniverse\server.js` is the older static build; both read the same `:9797`.
- Comments/account sync through localStorage only (no server DB).
- Subtitle conversion is `.ass` → `.vtt`; styled ASS markup is dropped (text only).
- AniList has no dubs — the old "EN/JP" toggle from the stream page is gone.
