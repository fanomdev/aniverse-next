"use client"
// Hero carousel — real horizontal slide track (track transform), slides in from the left.
// Only the active slide + its neighbours get background images so first paint isn't six 1MB+ posters.
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import type { CSSProperties } from "react"
import { fmtRating, yearOf, genres } from "@/lib/ui"

export default function Hero({ banners }: { banners: any[] }) {
  const [idx, setIdx] = useState(0)
  const items = (banners || []).slice(0, 6)
  const swipeX = useRef<number | null>(null)

  useEffect(() => {
    if (items.length <= 1) return
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), 6500)
    return () => clearInterval(t)
  }, [items.length])

  const go = (d: number) => {
    if (items.length > 1) setIdx((i) => (i + d + items.length) % items.length)
  }

  const off = (i: number) => {
    const n = items.length
    const d = Math.abs(i - idx)
    return Math.min(d, n - d)
  }

  if (!items.length) return null

  return (
    <div
      id="heroWrap"
      onPointerDown={(e) => { swipeX.current = e.clientX }}
      onPointerUp={(e) => {
        const start = swipeX.current
        swipeX.current = null
        if (start == null) return
        const dx = e.clientX - start
        if (Math.abs(dx) > 48) go(dx < 0 ? 1 : -1)
      }}
    >
      {items.length > 1 && (
        <>
          <button className="hero-nav prev" aria-label="Previous featured" onClick={() => go(-1)}>‹</button>
          <button className="hero-nav next" aria-label="Next featured" onClick={() => go(1)}>›</button>
        </>
      )}
      <div className="hero-track" style={{ transform: `translate3d(${-idx * 100}%, 0, 0)` }}>
        {items.map((b, i) => {
          const rating = fmtRating(b.rating)
          const yr = yearOf(b.releaseDate)
          const g = genres(b.genre).slice(0, 3)
          const bg = b.backdrop || b.cover || ""
          const near = off(i) <= 1
          return (
            <div className="hero" key={b.detailPath || i}>
              <div className="hero-bg" style={(near && bg ? { backgroundImage: `url('${bg}')` } : undefined) as CSSProperties} />
              <div className="hero-scrim" />
              <div className="hero-body">
                <span className="hero-tag">🔥 Featured</span>
                <h1>{b.title}</h1>
                <div className="hero-meta">
                  {rating && <span className="chip rating">★ {rating}</span>}
                  {yr && <span className="chip">{yr}</span>}
                  {g.map((x) => (<span key={x} className="chip">{x}</span>))}
                </div>
                <p className="hero-desc">{b.description || ""}</p>
                <div className="hero-cta">
                  <Link className="btn btn-primary" href={`/watch?dp=${b.detailPath}&sid=${b.subjectId}&se=1&ep=1`}>▶&nbsp; Watch Now</Link>
                  <Link className="btn btn-ghost" href={`/detail?dp=${encodeURIComponent(b.detailPath)}`}>⊕&nbsp; Details</Link>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="hero-dots" id="heroDots">
        {items.map((_, i) => (
          <button key={i} data-i={i} className={idx === i ? "active" : undefined} aria-label={`Slide ${i + 1}`} aria-current={idx === i} onClick={() => setIdx(i)} />
        ))}
      </div>
    </div>
  )
}
