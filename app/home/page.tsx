"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import RequireAuth from "@/components/RequireAuth"
import Hero from "@/components/Hero"
import AnimeCard from "@/components/AnimeCard"
import SkeletonRail from "@/components/SkeletonRail"
import DragRail from "@/components/DragRail"
import ErrorState from "@/components/ErrorState"
import { API } from "@/lib/api"
import { Continue } from "@/lib/storage"
import { fmtRating, yearOf } from "@/lib/ui"

export default function HomePage() {
  return (
    <RequireAuth>
      <HomeInner />
    </RequireAuth>
  )
}

function HomeInner() {
  const [rows, setRows] = useState<any[] | null>(null)
  const [hero, setHero] = useState<any[]>([])
  const [error, setError] = useState<any>(null)
  const [cw, setCw] = useState<any[]>([])

  useEffect(() => {
    setCw(Continue.all().slice(0, 12))
    let alive = true
    API.section()
      .then(({ data }) => {
        if (!alive) return
        setHero((data?.hero?.length ? data.hero : data?.featured) || [])
        setRows(data?.rows || [])
      })
      .catch((err) => alive && setError(err))
    return () => { alive = false }
  }, [])

  return (
    <>
      {hero.length > 0 && <Hero banners={hero} />}

      {cw.length > 0 && (
        <>
          <div className="row-title"><h2>Continue Watching</h2></div>
          <DragRail>
            {cw.map((e: any) => {
              const pct = e.duration > 0 ? Math.min(100, Math.round((e.time / e.duration) * 100)) : 0
              return (
                <Link
                  key={`${e.detailPath}-${e.se}-${e.ep}`}
                  className="anime-card"
                  href={`/watch?dp=${e.detailPath}&sid=${e.subjectId}&se=${e.se}&ep=${e.ep}`}
                  aria-label={e.title}
                >
                  <div className="poster" style={e.cover ? { backgroundImage: `url('${e.cover}')` } : undefined}>
                    {e.cover ? <img loading="lazy" src={e.cover} alt={e.title} onError={(ev) => { (ev.currentTarget as HTMLImageElement).style.opacity = "0" }} /> : null}
                    <div className="card-play"><span>▶</span></div>
                  </div>
                  <div className="card-body">
                    <div className="card-title">{e.title}</div>
                    <div className="card-meta"><span>{e.se === 0 ? "Movie" : `S${e.se} · E${e.ep}`}</span><span>•</span><span>Resume</span></div>
                    <div className="progress"><i style={{ width: `${pct}%` }} /></div>
                  </div>
                </Link>
              )
            })}
          </DragRail>
        </>
      )}

      <div id="rowsWrap">
        {error ? (
          <ErrorState error={error} />
        ) : rows == null ? (
          <div className="rail"><SkeletonRail /></div>
        ) : (
          rows.map((row: any, i: number) => {
            const items = (row.items || []).filter((it: any) => it.detailPath)
            if (!items.length) return null
            const q = row.browse || row.query
            const more = q
              ? `/browse?kind=${q.kind || (q.channelId === 1 ? "movies" : "series")}&sort=${encodeURIComponent(q.sort || "Hottest")}&genre=${encodeURIComponent(q.genre || "Anime")}`
              : ""
            return (
              <section key={i}>
                <div className="row-title">
                  <h2>{row.title || "Anime"}</h2>
                  {more ? <Link href={more}>View all →</Link> : null}
                </div>
                <DragRail>
                  {items.map((it: any) => <AnimeCard key={it.detailPath} item={it} />)}
                </DragRail>
              </section>
            )
          })
        )}
      </div>
    </>
  )
}
