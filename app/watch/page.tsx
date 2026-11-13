"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import RequireAuth from "@/components/RequireAuth"
import { API } from "@/lib/api"
import { Continue, Watchlist, Likes } from "@/lib/storage"
import { yearOf, genres, toast } from "@/lib/ui"
import Hls from "hls.js"
import { useSearchParams } from "next/navigation"

export const dynamic = "force-dynamic"

export default function WatchPage() {
  return (
    <RequireAuth>
      <WatchInner />
    </RequireAuth>
  )
}

function fmtTime(s: number) {
  s = Math.floor(s)
  const m = Math.floor(s / 60)
  const ss = String(s % 60).padStart(2, "0")
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}:${ss}`
}
function genresJoin(g?: string) {
  return genres(g).slice(0, 3).join(", ")
}

function WatchInner() {
  const searchParams = useSearchParams()
  const dp = searchParams?.get("dp") || ""
  const sidParam = searchParams?.get("sid") || ""
  const se = Math.max(0, parseInt(searchParams?.get("se") || "1", 10) || 1)
  const ep = Math.max(0, parseInt(searchParams?.get("ep") || "1", 10) || 1)
  const movie = se === 0
  const [audio, setAudio] = useState<"sub" | "dub">(() => (searchParams?.get("audio") === "dub" ? "dub" : "sub"))
  const [dlConfirm, setDlConfirm] = useState(false)
  const [liked, setLiked] = useState(() => (dp ? Likes.has(dp) : false))
  const [likePop, setLikePop] = useState(0)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [subject, setSubject] = useState<any>(null)
  const [seasons, setSeasons] = useState<{ se: number; maxEp: number }[]>([])
  const [sid, setSid] = useState(sidParam)
  const [overlayHtml, setOverlayHtml] = useState<string | null>(null)
  const [sources, setSources] = useState<any[]>([])
  const [captions, setCaptions] = useState<any[]>([])
  const [quality, setQuality] = useState(-1)
  const [caption, setCaption] = useState(-1)
  const [loadingEpisodes, setLoadingEpisodes] = useState(true)
  const hlsRef = useRef<any>(null)
  const saveTimer = useRef<number | undefined>(undefined)
  const triedDirect = useRef(false)

  const curSeason = useMemo(() => seasons.find((s) => s.se === se), [seasons, se])
  const maxEp = curSeason?.maxEp || 0

  // detail data
  useEffect(() => {
    if (!dp) { setOverlayHtml("<h3>Missing title</h3><p>Go back and pick something to watch.</p>"); return }
    let alive = true
    setLoadingEpisodes(true)
    Promise.allSettled([API.detail(dp)]).then(([r]) => {
      if (!alive) return
      if (r.status === "fulfilled") {
        const data = r.value?.data
        setSubject(data?.subject || null)
        const seas = (data?.resource?.seasons || []).filter((s: any) => s && (s.maxEp > 0 || s.se === 0))
        if (seas.length === 1 && seas[0].se === 0) {
          // movie: normalize any ?se=1 link to the movie path
          window.history.replaceState(null, "", `/watch?dp=${encodeURIComponent(dp)}&sid=${data?.subject?.subjectId ?? sid}&se=0&ep=0`)
        }
        setSeasons(seas)
        if (!sidParam && data?.subject?.subjectId) setSid(String(data.subject.subjectId))
      }
      setLoadingEpisodes(false)
    })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dp])

  // sources + captions for current episode
  useEffect(() => {
    if (!sid) return
    let alive = true
    setOverlayHtml(null)
    const seParam = movie ? 0 : se
    const epParam = movie ? 0 : ep
    fetch(`/api/anime/media-sources?subjectId=${encodeURIComponent(sid)}&se=${seParam}&ep=${epParam}&audio=${audio}`)
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.message || j.error || "no source host")
        }
        return res.json()
      })
      .then(({ data }) => {
        if (!alive) return
        const dl = (data?.downloads || [])
          .filter((d: any) => d && d.url && !d.vipLocked)
          .sort((a: any, b: any) => (a.resolution || 0) - (b.resolution || 0)) // ascending; player starts on #0
        setSources(dl)
        setCaptions(data?.captions || [])
        if (!dl.length) setOverlayHtml(audio === "dub"
          ? "<h3>Dub not found</h3><p>No dubbed stream for this episode. Try the Sub button — or another episode.</p>"
          : "<h3>No playable source</h3><p>This episode has no playable stream right now. Try another episode or check back later.</p>")
        else {
          const defIdx = dl.findIndex((s: any) => (s.resolution || 0) >= 480)
          const pick = defIdx >= 0 ? defIdx : dl.length - 1
          setQuality(pick)
        }
      })
      .catch((err) => {
        if (!alive) return
        setOverlayHtml(audio === "dub"
          ? `<h3>Dub not found</h3><p>No dubbed stream for this episode (or the host couldn't be reached). Try the Sub button instead.</p>`
          : `<h3>Stream failed</h3><p>${err.message || "The stream host couldn't be reached."}</p>`)
      })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sid, se, ep, movie, audio])

  // resume point
  const resume = useMemo(
    () => (dp ? Continue.forTitle(dp).find((e) => e.se === se && e.ep === ep)?.time || 0 : 0),
    [dp, se, ep]
  )

  const play = useCallback(
    (idx: number) => {
      const s = sources[idx]
      if (!s) return
      triedDirect.current = false
      const v = videoRef.current
      if (!v) return
      const startAt = (Continue.forTitle(dp).find((e) => e.se === se && e.ep === ep))?.time || 0
      // proxy through Cloudflare Worker when set (no Vercel bandwidth); else /api/stream
      const proxy = (process.env.NEXT_PUBLIC_STREAM_PROXY || "/api/stream").replace(/\/+$/, "")
      const src = `${proxy}?video_url=${encodeURIComponent(s.url)}${s.referer ? `&ref=${encodeURIComponent(s.referer)}` : ""}`
      const m3u8 = !!s.isM3U8 || /\.m3u8(\?|$)/i.test(s.url)
      // reset any previous hls instance
      if (hlsRef.current && hlsRef.current.destroy) { try { hlsRef.current.destroy() } catch {} }
      hlsRef.current = null
      v.removeAttribute("src")
      if (m3u8) {
        if (Hls && Hls.isSupported()) {
          try {
            const hls = new Hls({ maxBufferLength: 30 })
            hls.loadSource(src)
            hls.attachMedia(v)
            hls.on(Hls.Events.ERROR, (_evt: any, data: any) => {
              if (data && data.fatal) setOverlayHtml('<h3>Stream failed</h3><p>The source host couldn’t be reached through the proxy. Check that ANIME_SOURCES_BASE points at a working Kuhi host (see README → Playback), then try another episode.</p>')
            })
            hlsRef.current = hls
          } catch {
            v.src = src
            v.load()
          }
        } else if (v.canPlayType("application/vnd.apple.mpegurl")) {
          v.src = src
          v.load()
        } else {
          v.src = src
          v.load()
        }
      } else {
        v.src = src
        v.load()
      }
      v.play().catch(() => {})
      const restore = () => { if (startAt > 10 && isFinite(v.duration) && startAt < v.duration * 0.95) v.currentTime = startAt }
      if (startAt > 10 && isFinite(v.duration)) restore()
      else v.addEventListener("loadedmetadata", restore, { once: true })
    },
    [sources, dp, se, ep]
  )

  // start playback when sources load (or quality changes)
  useEffect(() => {
    if (quality >= 0 && sources[quality]) play(quality)
  }, [quality, sources, play])

  // subtitle selection → attach <track> and enable
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.querySelectorAll("track").forEach((t) => t.remove())
    if (caption < 0) return
    const c = captions[caption]
    if (!c?.url) return
    const track = document.createElement("track")
    track.kind = "subtitles"
    track.label = c.lanName || c.lan || "CC"
    track.srclang = (c.lan || "en").slice(0, 2)
    track.src = `/api/caption?url=${encodeURIComponent(c.url)}`
    track.default = true
    track.addEventListener("load", () => {
      const t = v.textTracks[v.textTracks.length - 1]
      if (t) t.mode = "showing"
    })
    v.appendChild(track)
  }, [caption, captions])

  const upsertContinue = useCallback(() => {
    const v = videoRef.current
    if (!v || !subject || !isFinite(v.duration) || v.duration <= 0) return
    Continue.save({
      subjectId: sid,
      detailPath: dp,
      title: subject.title,
      cover: subject.cover?.url || subject.cover || "",
      se, ep,
      seasons: seasons.map((s) => ({ se: s.se, maxEp: s.maxEp })),
      time: Math.floor(v.currentTime),
      duration: Math.floor(v.duration),
    })
  }, [subject, sid, dp, se, ep, seasons])

  // save-and-go handlers
  const stepEpisode = useCallback((dir: number) => {
    if (movie) return
    const n = maxEp
    let nse = se, nep = ep + dir
    if (nep > n) {
      const i = seasons.findIndex((s) => s.se === se)
      if (i >= 0 && i < seasons.length - 1) { nse = seasons[i + 1].se; nep = 1 } else return
    } else if (nep < 1) {
      const i = seasons.findIndex((s) => s.se === se)
      if (i > 0) { nse = seasons[i - 1].se; nep = seasons[i - 1].maxEp } else return
    }
    window.location.href = `/watch?dp=${encodeURIComponent(dp)}&sid=${sid}&se=${nse}&ep=${nep}`
  }, [movie, maxEp, se, ep, seasons, dp, sid])

  const handleEnded = useCallback(() => {
    const n = maxEp
    const isLast = movie || (n && ep >= n)
    if (isLast) {
      const i = seasons.findIndex((s) => s.se === se)
      if (i >= 0 && i < seasons.length - 1) {
        toast("Next season starting…")
        upsertContinue()
        const ns = seasons[i + 1].se
        setTimeout(() => { window.location.href = `/watch?dp=${encodeURIComponent(dp)}&sid=${sid}&se=${ns}&ep=1` }, 1400)
        return
      }
      Continue.remove(dp, se, ep)
      toast("You finished the season 🎉")
      return
    }
    upsertContinue()
    toast("Next episode…")
    setTimeout(() => stepEpisode(1), 1400)
  }, [maxEp, ep, movie, seasons, se, dp, sid, upsertContinue, stepEpisode])

  const bindTimeupdate = useCallback(() => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(upsertContinue, 4000)
  }, [upsertContinue])

  // keep the tab title in sync (the chat assistant reads it for context)
  useEffect(() => {
    if (subject?.title) document.title = `${subject.title} — AniVerse`
  }, [subject])

  const subjectCover = subject?.cover?.url || subject?.cover || ""
  const overview = subject
    ? [yearOf(subject.releaseDate), genresJoin(subject.genre), subject.countryName, movie ? "Movie" : `Season ${se} · Episode ${ep}${maxEp ? " of " + maxEp : ""}`]
        .filter(Boolean).join("  ·  ")
    : "Loading…"

  const switchAudio = (a: "sub" | "dub") => {
    setAudio(a)
    try {
      const q = new URLSearchParams(window.location.search)
      q.set("audio", a)
      window.history.replaceState(null, "", `${window.location.pathname}?${q}`)
    } catch {}
  }
  const toggleLike = () => {
    if (!subject) return
    const next = Likes.toggle({ detailPath: dp, title: subject.title })
    setLiked(next)
    setLikePop((p) => p + 1)
    toast(next ? "Liked ♥" : "Unliked")
  }

  const watchlistBtn = useCallback(() => {
    if (!subject) return
    const next = Watchlist.toggle({
      subjectId: sid,
      detailPath: dp,
      title: subject.title,
      cover: subjectCover,
      rating: subject.imdbRatingValue || "",
      year: yearOf(subject.releaseDate),
    })
    toast(next ? "Added to your list" : "Removed from your list")
  }, [subject, sid, dp, subjectCover])

  // best MP4 for download (through the proxy with dl=1 → attachment)
  const dlSource = useMemo(
    () => [...sources].reverse().find((s: any) => s && s.url && !s.isM3U8 && /\.mp4(\?|$)/i.test(s.url)),
    [sources]
  )
  const dl = useMemo(() => {
    if (!dlSource) return undefined
    const safeTitle = (subject?.title || "anime").replace(/[^\w\- .]/g, "_").trim() || "anime"
    const fileName = `${safeTitle} - ${movie ? "Movie" : `S${se}E${ep}`}.mp4`
    const proxy = (process.env.NEXT_PUBLIC_STREAM_PROXY || "/api/stream").replace(/\/+$/, "")
    const ref = dlSource.referer ? `&ref=${encodeURIComponent(dlSource.referer)}` : ""
    const href = `${proxy}?video_url=${encodeURIComponent(dlSource.url)}${ref}&dl=1&name=${encodeURIComponent(fileName)}`
    return { href, fileName, resolution: dlSource.resolution as number | null }
  }, [dlSource, subject?.title, se, ep, movie])
  const dlHref = dl?.href

  const onVideoError = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (triedDirect.current) {
      setOverlayHtml('<h3>Stream failed</h3><p>Direct CDN playback is also blocked. Your network may be blocking the source host, or the source host is down.</p>')
      return
    }
    const s = sources[quality]
    if (!s) return
    triedDirect.current = true
    // last resort: hotlink the CDN directly (no referer injection)
    v.src = s.url
    v.load()
    v.play().catch(() => {})
  }, [sources, quality])

  const upNext: { se: number; ep: number }[] = useMemo(() => {
    if (movie || !maxEp) return []
    const items: { se: number; ep: number }[] = []
    for (let e = ep + 1; e <= Math.min(maxEp, ep + 3); e++) items.push({ se, ep: e })
    return items
  }, [movie, maxEp, ep, se])

  return (
    <>
      {/* CDN script tag removed — hls.js imports at module scope for this route only */}
      <div className="watch-layout">
        <section>
          <div className="player-shell">
            <video id="player" ref={videoRef} playsInline controls
              onTimeUpdate={bindTimeupdate}
              onPause={upsertContinue}
              onEnded={handleEnded}
              onError={onVideoError}
            ></video>
            {overlayHtml && (
              <div className="player-overlay" id="playerOverlay">
                {/* eslint-disable-next-line react/no-danger */}
                <div style={{ maxWidth: 420 }} dangerouslySetInnerHTML={{ __html: overlayHtml }} />
              </div>
            )}
            {sources.length === 0 && !overlayHtml && (
              <div className="player-overlay" id="playerOverlay"><div className="spinner" /><p style={{ color: "var(--muted)", fontSize: 13 }}>Fetching sources…</p></div>
            )}
          </div>
          <div className="player-controls">
            <label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }} htmlFor="qualitySel">Quality</label>
            <select className="sel" id="qualitySel" aria-label="Video quality" value={quality} onChange={(e) => setQuality(Number(e.target.value))}>
              {sources.map((s, i) => (
                <option key={i} value={i}>{s.isM3U8 ? "Auto (HLS)" : s.resolution ? `${s.resolution}p` : "Auto"}{s.size ? " · " + Math.round(s.size / 1048576) + " MB" : ""}</option>
              ))}
            </select>
            <label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700 }} htmlFor="captionSel">Subtitles</label>
            <select className="sel" id="captionSel" aria-label="Subtitles" value={caption} onChange={(e) => setCaption(Number(e.target.value))}>
              <option value={-1}>Off</option>
              {captions.map((c, i) => <option key={i} value={i}>{c.lanName || c.lan || "CC"}</option>)}
            </select>
            <div className="seg audio-seg" role="group" aria-label="Audio track">
              <button className={audio === "sub" ? "active" : undefined} aria-pressed={audio === "sub"} onClick={() => switchAudio("sub")}>SUB</button>
              <button className={audio === "dub" ? "active" : undefined} aria-pressed={audio === "dub"} onClick={() => switchAudio("dub")}>DUB</button>
            </div>
            {dlHref && (
              <button className="icon-btn" aria-label="Download episode" title="Download episode (MP4)" onClick={() => setDlConfirm(true)}>
                <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </button>
            )}
            <button
              className={`icon-btn like-btn${liked ? " active" : ""}`}
              aria-label={liked ? "Unlike this anime" : "Like this anime"}
              title={liked ? "Liked ♥" : "Like this anime"}
              onClick={toggleLike}
            >
              <span key={likePop} className={likePop ? "like-pop" : undefined} style={{ display: "grid", placeItems: "center" }}>
                <svg viewBox="0 0 24 24" width="19" height="19" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>
              </span>
            </button>
            <button className="icon-btn" id="watchlistBtn" aria-label="Toggle watchlist" title="Watchlist" onClick={watchlistBtn}>
              <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            </button>
          </div>
          <div className="ep-nav">
            <button className="icon-btn" id="prevEpBtn" aria-label="Previous episode" onClick={() => stepEpisode(-1)}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>
            {seasons.length > 1 && (
              <select
                id="seasonSel"
                className="sel"
                aria-label="Season"
                value={se}
                onChange={(e) => {
                  const nse = Number(e.target.value)
                  window.location.href = `/watch?dp=${encodeURIComponent(dp)}&sid=${sid}&se=${nse}&ep=1`
                }}
              >
                {seasons.map((s) => <option key={s.se} value={s.se}>Season {s.se}</option>)}
              </select>
            )}
            <select
              id="epSel"
              aria-label="Episode"
              value={movie ? 0 : ep}
              disabled={movie}
              onChange={(e) => {
                const nep = Number(e.target.value)
                window.location.href = `/watch?dp=${encodeURIComponent(dp)}&sid=${sid}&se=${se}&ep=${nep}`
              }}
            >
              {(movie ? [0] : Array.from({ length: Math.max(maxEp, 1) }, (_, i) => i + 1)).map((n) => (
                <option key={n} value={movie ? 0 : n}>{movie ? "Movie" : `Episode ${n}`}</option>
              ))}
            </select>
            <button className="icon-btn" id="nextEpBtn" aria-label="Next episode" onClick={() => stepEpisode(1)}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6"/></svg></button>
            <span id="epInfo" style={{ color: "var(--muted)", fontSize: 12 }}>{resume > 10 && `Resume at ${fmtTime(resume)}`}</span>
          </div>
        </section>
        <aside className="watch-side">
          <h2 id="sideTitle">{subject?.title || "Loading…"}</h2>
          <div className="sub" id="sideMeta">{overview}</div>
          <p id="sideDesc" style={{ fontSize: 13, lineHeight: 1.6, color: "#c6c8d4" }}>{subject?.description || ""}</p>
          <div className="row-title" style={{ marginTop: 18 }}><h2 style={{ fontSize: 14 }}>Up Next</h2></div>
          <div id="upNextList" style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13, color: "var(--muted)" }}>
            {movie ? (
              <span>Movie — sit back and enjoy. 🍿</span>
            ) : upNext.length ? (
              upNext.map((i) => (
                <a key={i.ep} className="btn btn-ghost" style={{ justifyContent: "space-between" }} href={`/watch?dp=${encodeURIComponent(dp)}&sid=${sid}&se=${i.se}&ep=${i.ep}`}><span>Episode {i.ep}</span><span>▶</span></a>
              ))
            ) : (
              <span>You’re on the latest episode here.</span>
            )}
          </div>
        </aside>
      </div>
      {dlConfirm && dl && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Download episode" onClick={() => setDlConfirm(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-big">⬇️</div>
            <h3>Download this episode?</h3>
            <p className="modal-sub">{dl.fileName}{dl.resolution ? ` · ${dl.resolution}p` : ""}</p>
            <p className="modal-fine">Direct from the source through your proxy. It may take a moment to start.</p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setDlConfirm(false)}>Cancel</button>
              <a className="btn btn-primary" href={dl.href} download={dl.fileName} onClick={() => setDlConfirm(false)}>Download</a>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
