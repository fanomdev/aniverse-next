# AniVerse (Next.js)

## About

AniVerse is the front door to watching anime without accounts or ads. The catalog comes from AniList's GraphQL API and posters, seasons and details are resolved on the fly, so there is no database and no scrape cache to rot. Stream playback goes through a vendored Kuhi API, kept on the same page in a self-contained setup — one folder, no back office. A Next.js rebuild keeps the same UI and catalog, everything self-contained — and the web build is wrapped in Capacitor as com.aniverse.app for a native Android experience with the same flows, only without a browser chrome.


The exact same AniVerse site as the vanilla-JS version, rebuilt as a real
Next.js app. Same UI, same AniList catalog, same Kuhi-hosted playback —
now **self-contained in this one folder**, including the stream host.

## Stack

- **Next.js 14 (App Router) + React + TypeScript**
- **AniList GraphQL** — catalog & metadata, no key needed (AniList is CORS-open)
- **Kuhi API** (`kuhi/`, local Python/FastAPI, [aryaniiil/anime-api](https://github.com/aryaniiil/anime-api)) — video streams (animegg MP4s, 480p default, Reanime for subtitles)
- **Cloudflare KV** — server-side accounts, sessions and per-user sync data; localStorage is only an offline cache
- **UI** — original glass-style navbar, OTP, download/share buttons and particle name effect, built in React/CSS (no copied vendor source)

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

## Interface

- **Glassy navbar** (`components/GlassyNavbar.tsx`) — the AniVerse logo and page links live in one glass bar on every screen. Search is a pill that expands into the options' space; on phones/tablets the options collapse while searching and slide back when you close it with ESC or ✕. Guests get "Log in"; signed-in users get their profile avatar.
- **Login page** (`app/page.tsx`) — branding, username/password with show–hide, glassy OTP field, "log in with a code instead", signup and guest access.
- **Watch toolbar** (`app/watch/page.tsx`) — the original download icon opens a glass modal containing the glass download and share buttons; their accents follow the active theme.
- **Name particles** (`components/NameParticles.tsx`) — profile effect with Sphere, Ring, Cube, Heart and username shapes.
- **Themes** — Aurora, Ember, Pink, Midnight and Daylight; the navbar, buttons and accents follow the selection.

## Repository layout

```
D:\aniverse-next\
├─ kuhi\                  ← the stream host (Python/FastAPI, vendored)
│  ├─ src\                ← API + ~10 scrapers it races
│  ├─ api.py              ← entry:  uvicorn src.main:app
│  └─ .venv\              ← ready-made venv, deps installed
├─ start.bat              ← one-click bootstrap (kuhi + dev server)
├─ app\                   ← pages/routes (login, home, watch, profile, downloads, API)
├─ components\            ← glassy navbar/OTP/download/share buttons, particles, cards
├─ lib\server\            ← Cloudflare KV store, sessions, password hashing
├─ tests\                 ← backend integration suite (pnpm test)
└─ lib\                   ← anilist.ts, api.ts, auth.ts, sync.ts, storage.ts/…
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

## Accounts, sync & email codes

Server-only environment variables (Vercel → Settings → Environment Variables,
Production + Preview; **never** prefix them with `NEXT_PUBLIC_`):

| Variable | Purpose |
| --- | --- |
| `CF_API_TOKEN` | Cloudflare API token with KV read/write |
| `CF_ACCOUNT_ID` | Cloudflare account id |
| `CF_ACCOUNTS_KV` | KV namespace id for accounts/sessions/data |
| `SMTP_USER` / `SMTP_PASS` | Gmail address + app password — sends login codes to any inbox (preferred) |
| `SMTP_FROM` | Optional sender address (defaults to `SMTP_USER`) |
| `RESEND_API_KEY` | Alternative: Resend API key (sandbox sender only mails the address verified in your Resend account) |
| `RESEND_FROM` | Verified sender domain address for Resend (defaults to `onboarding@resend.dev`) |

Accounts are optional-email by design: **sign up without an email → offline
account, no OTP ever, plain password login**. With an email, signup and every
login require a 4-digit code delivered to that inbox (Gmail SMTP preferred,
Resend fallback), with an explicit "log in with a code instead" option.
Existing localStorage accounts/sessions are migrated silently on boot and keep
working. Guests get a unique local identity; their data is pushed into the
account on signup/login, with a prompt before overwriting newer records.
Account deletion lives in Profile and requires a password confirmation; it
removes the account's keys from KV.

Server is authoritative: localStorage is only a cache/queue. Each sync value is
a separately versioned KV entry, so an eventually-consistent read of one key
cannot overwrite another; conflicts ask before overwriting newer records.

Checks: `pnpm lint`, `pnpm build`, `pnpm test`. Run the backend integration
suite with `pnpm test` (set `API_BASE` to test a different deployment; set
`TEST_EMAIL` to exercise email delivery).

## Known limitations

- Kuhi is **local-only** by design — video only resolves on the machine running it. Deploying to Vercel/Netlify does NOT deploy animegg streams; a public deploy is catalog + "where to watch" only unless you point `ANIME_SOURCES_BASE` at a Kuhi instance reachable from the internet (a tunnel or your own host).
- The vanilla `D:\aniverse\server.js` is the older static build; both read the same `:9797`.
- Cloudflare KV value reads are eventually consistent (~1 minute), so cross-device
  data can take a moment to appear. Conflict checks use strongly-consistent key metadata.
- Subtitle conversion is `.ass` → `.vtt`; styled ASS markup is dropped (text only).
- AniList has no dubs — the old "EN/JP" toggle from the stream page is gone.
