"use client"
import { useEffect, useMemo, useState } from "react"
import RequireAuth from "@/components/RequireAuth"
import ErrorState from "@/components/ErrorState"
import { API } from "@/lib/api"
import { Watchlist, Continue, Watched } from "@/lib/storage"
import { fmtRating, yearOf, genres, toast } from "@/lib/ui"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

export const dynamic = "force-dynamic"

export default function DetailPage() {
  return (
    <RequireAuth>
      <DetailInner />
    </RequireAuth>
  )
}

function DetailInner() {
  const searchParams = useSearchParams()
  const dp = searchParams?.get("dp") || ""
  const [subject, setSubject] = useState<any>(null)
  const [seasons, setSeasons] = useState<{ se: number; maxEp: number }[]>([])
  const [episodeNames, setEpisodeNames] = useState<{ n: number; title: string; thumbnail: string }[]>([])
  const [stars, setStars] = useState<{ name: string; character: string }[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<any>(null)
  const [activeSe, setActiveSe] = useState(1)
  const [onList, setOnList] = useState(() => (dp ? Watchlist.has(dp) : false))
  const cont = useMemo(() => (dp ? Continue.forTitle(dp)[0] : undefined), [dp])
  const watched = useMemo(() => new Set(Watched.get(dp).filter((k) => k.split(":")[0] === String(activeSe)).map((k) => String(k).split(":")[1])), [dp, activeSe])
  const epMap = useMemo(() => new Map(episodeNames.map((e) => [e.n, e])), [episodeNames])

  useEffect(() => {
    if (!dp) return
    let alive = true
    setLoading(true)
    setError(null)
    API.detail(dp)
      .then(({ data }) => {
        if (!alive) return
        const s = data?.subject
        setSubject(s)
        const se = (data?.resource?.seasons || []).filter((x: any) => x && (x.maxEp > 0 || x.se === 0))
        setSeasons(se)
        setStars(data?.stars || [])
        setEpisodeNames(Array.isArray(data?.episodeList) ? data.episodeList : [])
        const contSe = cont?.se
        setActiveSe(contSe ?? se[0]?.se ?? (se.length === 1 && se[0].se === 0 ? 0 : 1))
      })
      .catch((e) => alive && setError(e))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dp])

  // keep the tab title in sync
  useEffect(() => {
    if (subject?.title) document.title = `${subject.title} — AniVerse`
  }, [subject])

  if (!dp) {
    return (
      <div className="state"><div className="big">❓</div><h3>No title specified</h3><p>Go back and pick a show.</p></div>
    )
  }
  if (error) return <ErrorState error={error} />
  if (loading || !subject) return null

  const cover = subject.cover?.url || subject.cover || ""
  const rating = fmtRating(subject.imdbRatingValue)
  const yr = yearOf(subject.releaseDate)
  const g = genres(subject.genre).slice(0, 4)
  const isMovie = seasons.length === 1 && seasons[0].se === 0
  const startSe = cont?.se ?? seasons[0]?.se ?? 1
  const startEp = cont?.ep ?? 1
  const activeSeason = seasons.find((s) => s.se === activeSe) || seasons[0]
  const n = activeSeason?.maxEp || 0
  const epGrid = Array.from({ length: n }, (_, i) => i + 1)

  const toggleWatchlist = () => {
    const next = Watchlist.toggle({
      detailPath: dp,
      subjectId: subject.subjectId,
      title: subject.title,
      cover,
      rating: subject.imdbRatingValue || "",
      year: yr,
    })
    setOnList(next)
    toast(next ? "Added to your list" : "Removed from your list")
  }

  return (
    <>
      <div className="detail-backdrop" style={{ backgroundImage: `url('${cover}')` }} />
      <div className="detail-wrap">
        <div className="detail-poster">
          {cover && <img src={cover} alt={`${subject.title} poster`} onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "0" }} />}
        </div>
        <div className="detail-info">
          <h1>{subject.title || "Untitled"}</h1>
          <div className="detail-meta">
            {rating && <span className="chip rating">★ {rating}</span>}
            {yr && <span className="chip">{yr}</span>}
            {subject.countryName && <span className="chip">{subject.countryName}</span>}
            {g.map((x) => <span key={x} className="chip">{x}</span>)}
          </div>
          <p className="detail-desc">{subject.description || "No description available."}</p>
          <div className="detail-actions">
            <Link className="btn btn-primary" id="watchNowBtn" href={`/watch?dp=${encodeURIComponent(dp)}&sid=${subject.subjectId}&se=${startSe}&ep=${startEp}`}>
              ▶&nbsp; {cont ? `Resume S${cont.se} · E${cont.ep}` : isMovie ? "Watch Movie" : "Watch Now"}
            </Link>
            <button className="btn btn-ghost" onClick={toggleWatchlist}>{onList ? "✓ In Watchlist" : "＋ Watchlist"}</button>
          </div>
        </div>
      </div>
      {!isMovie && (
        <section id="episodesSection">
          <div className="row-title"><h2>Episodes</h2></div>
          {seasons.length > 1 && (
            <div className="season-tabs" id="seasonTabs">
              {seasons.map((x) => (
                <button key={x.se} data-se={x.se} className={x.se === activeSe ? "active" : undefined} onClick={() => setActiveSe(x.se)}>
                  Season {x.se}
                </button>
              ))}
            </div>
          )}
          <div className="ep-list" id="epGrid" aria-label="Episodes">
            {epGrid.map((ep) => {
              const meta = epMap.get(ep)
              const name = meta?.title || `Episode ${ep}`
              const seen = watched.has(String(ep))
              return (
                <button key={ep} className={`ep-row${seen ? " watched" : ""}`} data-ep={ep} aria-label={`Episode ${ep}: ${name}${seen ? " — watched" : ""}`} onClick={() => { window.location.href = `/watch?dp=${encodeURIComponent(dp)}&sid=${subject.subjectId}&se=${activeSe}&ep=${ep}` }}>
                  <span className="ep-thumb-wrap">
                    <img
                      className="ep-thumb"
                      loading="lazy"
                      decoding="async"
                      src={meta?.thumbnail || cover}
                      alt={name}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "0" }}
                    />
                    {seen ? <span className="ep-check" aria-hidden>✓</span> : null}
                  </span>
                  <span className="ep-info">
                    <span className="ep-num">Episode {ep}</span>
                    <span className="ep-title">{name}</span>
                  </span>
                  <svg className="ep-chev" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6"/></svg>
                </button>
              )
            })}
          </div>
        </section>
      )}
      {stars.length > 0 && (
        <section>
          <div className="row-title"><h2>Cast</h2></div>
          <div className="rail">
            {stars.slice(0, 14).map((st, i) => (
              <div className="anime-card" key={i} style={{ flex: "0 0 96px", background: "transparent", pointerEvents: "none" }}>
                <div className="poster" style={{ aspectRatio: 1, borderRadius: "50%", display: "grid", placeItems: "center", background: "var(--card2)", fontSize: 24, fontWeight: 800 }}>
                  {(st.name || "?").charAt(0)}
                </div>
                <div className="card-body" style={{ alignItems: "center", textAlign: "center", padding: "8px 2px" }}>
                  <div className="card-title" style={{ WebkitLineClamp: 1, minHeight: 0, fontSize: 11 }}>{st.name}</div>
                  <div className="card-meta" style={{ textAlign: "center", justifyContent: "center" }}>{st.character}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
