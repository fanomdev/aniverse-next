"use client"
import { useEffect, useState } from "react"
import RequireAuth from "@/components/RequireAuth"
import AnimeCard from "@/components/AnimeCard"
import { Auth } from "@/lib/auth"
import { Watchlist, Continue, Likes } from "@/lib/storage"
import { fmtRating, toast } from "@/lib/ui"
import Link from "next/link"
import { Downloader } from "@/lib/downloader"
import { THEMES, getTheme, saveTheme, type ThemeId } from "@/lib/theme"
import { Sync } from "@/lib/sync"
import NameParticles from "@/components/NameParticles"

function fmtClock(s: number) {
  s = Math.floor(s || 0)
  const m = Math.floor(s / 60)
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`
}

export default function ProfilePage() {
  return (
    <RequireAuth>
      <ProfileInner />
    </RequireAuth>
  )
}

function ProfileInner() {
  const [user] = useState(() => Auth.user())
  const [since] = useState(() => Auth.memberSince())
  const [tick, setTick] = useState(0)
  const wl = Watchlist.all()
  const cw = Continue.all()
  // recompute on tick (e.g. after clearing history)
  // re-render when a background pull lands so remote data appears immediately
  useEffect(() => {
    const onSync = () => setTick((x) => x + 1)
    window.addEventListener("aniverse:sync", onSync)
    return () => window.removeEventListener("aniverse:sync", onSync)
  }, [])

  const [particlesOpen, setParticlesOpen] = useState(false)
  const [deletePass, setDeletePass] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [syncState, setSyncState] = useState(Sync.status())
  const refreshSync = () => setSyncState(Sync.status())
  const doSync = async (force = false) => {
    const r: any = await Sync.flush(force)
    refreshSync()
    toast(r.ok ? "Synced to your account" : r.reason === "conflict" ? `Sync conflict in ${(r.conflicts || []).join(", ")}` : "Offline — changes queued")
  }
  const initial = (user?.username || "?").charAt(0).toUpperCase()
  const memberSince = since ? `Member since ${new Date(since).toLocaleDateString(undefined, { year: "numeric", month: "long" })}` : user?.guest ? "Guest session · saved on this device" : "Account"

  return (
    <>
      <div className="profile-head">
        <div className="profile-avatar">{initial}</div>
        <div>
          <h1 id="profileName">{user?.username || "Guest"}{user?.guest ? <span className="guest-tag">guest</span> : null}</h1>
          <p id="profileSince">{memberSince}</p>
          {user?.id && <p className="uid-line">ID: {user.id.slice(0, 18)}…</p>}
          <div className="sync-panel">
            <span className={`sync-pill sync-${syncState.state}`}>{syncState.state === "synced" ? "☁ Synced" : syncState.state === "offline" ? "○ Offline" : syncState.state === "conflict" ? "⚠ Conflict" : "↻ Local"}</span>
            <button className="btn btn-ghost" onClick={() => void doSync()} style={{ fontSize: 11, padding: "5px 10px" }}>Sync now</button>
            {syncState.state === "conflict" && (
              <button className="btn btn-ghost" onClick={() => void doSync(true)} style={{ fontSize: 11, padding: "5px 10px" }}>Use this device&apos;s data</button>
            )}
          </div>
          <div className="stat-row">
            <div className="stat"><b id="statWatchlist">{wl.length}</b><span>Watchlist</span></div>
            <div className="stat"><b id="statResume">{cw.length}</b><span>In Progress</span></div>
            <div className="stat"><b id="statEpisodes">{cw.reduce((n, e) => n + (e.time > 30 ? 1 : 0), 0)}</b><span>Episodes</span></div>
            <div className="stat"><b>{Likes.all().length}</b><span>Liked</span></div>
          </div>
        </div>
      </div>

      <div className="row-title"><h2>Theme</h2></div>
      <div className="theme-row" role="radiogroup" aria-label="App theme">
        {THEMES.map((t) => (
          <button
            key={t.id}
            className={`theme-chip${getTheme() === t.id ? " active" : ""}`}
            role="radio"
            aria-checked={getTheme() === t.id}
            onClick={() => { saveTheme(t.id as ThemeId); setTick((x) => x + 1) }}
          >
            <span className={`theme-dot theme-dot-${t.id}`} />{t.name}
          </button>
        ))}
      </div>

      <div className="row-title"><h2>Downloads</h2></div>
      <Link className="btn btn-ghost" href="/downloads" style={{ margin: "0 2px 14px" }}>⬇ My Downloads{Downloader.isNative() ? "" : " (web)"}</Link>

      <div className="row-title"><h2>My List</h2></div>
      <div className="grid" id="watchlistGrid">
        {wl.length ? (
          wl.map((i) => (
            <AnimeCard key={i.detailPath} item={{ detailPath: i.detailPath, subjectId: i.subjectId, title: i.title, cover: i.cover, rating: i.rating, releaseDate: i.year, genre: "" }} />
          ))
        ) : (
          <div className="state" style={{ gridColumn: "1/-1" }}><div className="big">📭</div><h3>Your list is empty</h3><p>Tap the bookmark on any anime to save it here.</p></div>
        )}
      </div>

      <div className="row-title"><h2>Continue Watching</h2></div>
      <div id="continueList">
        {cw.length ? (
          cw.map((e) => (
            <a
              key={`${e.detailPath}-${e.se}-${e.ep}`}
              className="anime-card resume-row"
              href={`/watch?dp=${e.detailPath}&sid=${e.subjectId}&se=${e.se}&ep=${e.ep}`}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, background: "var(--surface)", border: "1px solid var(--line)", textDecoration: "none", color: "inherit", padding: 10, borderRadius: 12, marginBottom: 8 }}
            >
              <img loading="lazy" src={e.cover || ""} alt={e.title} style={{ width: 54, aspectRatio: "2/3", objectFit: "cover", borderRadius: 8, flex: "0 0 auto" }} onError={(ev) => { (ev.currentTarget as HTMLImageElement).style.opacity = "0.15" }} />
              <span style={{ minWidth: 0, flex: 1 }}>
                <span className="card-title" style={{ WebkitLineClamp: 1, minHeight: 0 }}>{e.title}</span>
                <span className="card-meta" style={{ marginTop: 4 }}>{e.se === 0 ? "Movie" : `S${e.se} · E${e.ep}`} · {fmtClock(e.time)} watched</span>
                <span className="progress" style={{ marginTop: 6, maxWidth: 240 }}><i style={{ width: `${e.duration ? Math.min(100, (e.time / e.duration) * 100) : 0}%` }} /></span>
              </span>
              <span style={{ color: "var(--accent)", fontSize: 13, fontWeight: 800, flex: "0 0 auto" }}>Resume ▶</span>
            </a>
          ))
        ) : (
          <div className="state"><div className="big">⌛</div><h3>Nothing in progress</h3><p>Start an episode and it will show up here.</p></div>
        )}
      </div>

      <div className="row-title"><h2>Account</h2></div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", padding: "0 2px 20px" }}>
        <button className="btn btn-ghost" onClick={() => setParticlesOpen(true)}>✦ {user?.username || "Your"} particle effects</button>
        <button className="btn btn-ghost" onClick={() => { localStorage.removeItem("aniverse_continue"); toast("Watch history cleared"); setTick((t) => t + 1) }}>Clear watch history</button>
        <button className="btn btn-ghost danger" onClick={() => { Auth.logout(); window.location.replace("/") }}>Log out</button>
      </div>
      {!user?.guest && (
        <div style={{ margin: "0 2px 28px", padding: 14, border: "1px solid rgba(255,90,80,.45)", borderRadius: 12 }}>
          <b style={{ fontSize: 13 }}>Delete account</b>
          <p style={{ color: "var(--muted)", fontSize: 12, margin: "5px 0 10px" }}>Permanently removes your account, saved list and progress from the server. This cannot be undone.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input type="password" placeholder="Confirm your password" value={deletePass} onChange={(e) => setDeletePass(e.target.value)} style={{ flex: "1 1 180px", height: 38, borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface)", color: "inherit", padding: "0 10px" }} />
            <button className="btn btn-ghost danger" disabled={deleting || !deletePass} onClick={async () => {
              if (!window.confirm(`Permanently delete ${user?.username}? All synced data will be removed.`)) return
              setDeleting(true)
              try { await Auth.deleteAccount(deletePass); toast("Account deleted"); window.location.replace("/") }
              catch (err: any) { toast(err?.message || "Could not delete the account"); setDeleting(false) }
            }}>{deleting ? "Deleting…" : "Delete my account"}</button>
          </div>
        </div>
      )}
      {particlesOpen && <NameParticles name={user?.username || "You"} onClose={() => setParticlesOpen(false)} />}
    </>
  )
}
