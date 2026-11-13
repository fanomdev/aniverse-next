"use client"
// AnimeCard — grid/rail card (matches vanilla cardHTML)
import type { CSSProperties } from "react"
import Link from "next/link"
import { useState } from "react"
import { Watchlist } from "@/lib/storage"
import { fmtRating, yearOf, genres, toast } from "@/lib/ui"

interface Props {
  item: any
  progress?: number | null
}

export default function AnimeCard({ item, progress = null }: Props) {
  const [onList, setOnList] = useState(() => Watchlist.has(item.detailPath))
  const rating = fmtRating(item.rating)
  const yr = yearOf(item.releaseDate)
  const metaGenres = genres(item.genre).slice(0, 2).join(", ") || "Anime"
  const dp = item.detailPath || ""

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const next = Watchlist.toggle({
      detailPath: dp,
      subjectId: item.subjectId,
      title: item.title,
      cover: item.cover,
      rating: item.rating,
      year: yr,
    })
    setOnList(next)
    toast(next ? "Added to your list" : "Removed from your list")
  }

  const posterStyle: CSSProperties | undefined = item.cover ? { backgroundImage: `url('${item.cover}')` } : undefined

  return (
    <Link className="anime-card" href={`/detail?dp=${encodeURIComponent(dp)}`} aria-label={item.title}>
      <div className="poster" style={posterStyle}>
        {item.cover ? (
          <img loading="lazy" decoding="async" src={item.cover} alt={item.title || "Anime poster"} onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "0" }} />
        ) : null}
        <div className="fallback">🎬</div>
        <div className="card-badges">{rating && <span className="chip rating">★ {rating}</span>}</div>
        <button className={`wl-toggle${onList ? " active" : ""}`} aria-label="Toggle watchlist" type="button" onClick={toggle}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
        </button>
        <div className="card-play"><span>▶</span></div>
      </div>
      <div className="card-body">
        <div className="card-title">{item.title || "Untitled"}</div>
        <div className="card-meta">
          {yr && <><span>{yr}</span><span>•</span></>}
          <span>{metaGenres}</span>
        </div>
        {progress != null && (
          <div className="progress"><i style={{ width: `${Math.min(100, Math.round(progress * 100))}%` }} /></div>
        )}
      </div>
    </Link>
  )
}
