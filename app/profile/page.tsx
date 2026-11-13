"use client"
import { useEffect, useState } from "react"
import RequireAuth from "@/components/RequireAuth"
import AnimeCard from "@/components/AnimeCard"
import { Auth } from "@/lib/auth"
import { Watchlist, Continue, Likes } from "@/lib/storage"
import { fmtRating, toast } from "@/lib/ui"

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
  useEffect(() => { /* watchlist/continue read from localStorage on every render */ }, [tick])

  const initial = (user?.username || "?").charAt(0).toUpperCase()
  const memberSince = since ? `Member since ${new Date(since).toLocaleDateString(undefined, { year: "numeric", month: "long" })}` : "Demo account · local to this device"

  return (
    <>
      <div className="profile-head">
        <div className="profile-avatar">{initial}</div>
        <div>
          <h1 id="profileName">{user?.username || "Guest"}</h1>
          <p id="profileSince">{memberSince}</p>
          <div className="stat-row">
            <div className="stat"><b id="statWatchlist">{wl.length}</b><span>Watchlist</span></div>
            <div className="stat"><b id="statResume">{cw.length}</b><span>In Progress</span></div>
            <div className="stat"><b id="statEpisodes">{cw.reduce((n, e) => n + (e.time > 30 ? 1 : 0), 0)}</b><span>Episodes</span></div>
            <div className="stat"><b>{Likes.all().length}</b><span>Liked</span></div>
          </div>
        </div>
      </div>

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
        <button className="btn btn-ghost" onClick={() => { localStorage.removeItem("aniverse_continue"); toast("Watch history cleared"); setTick((t) => t + 1) }}>Clear watch history</button>
        <button className="btn btn-ghost danger" onClick={() => { Auth.logout(); window.location.replace("/") }}>Log out</button>
      </div>
    </>
  )
}
