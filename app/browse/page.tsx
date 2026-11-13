"use client"
import { useEffect, useState } from "react"
import RequireAuth from "@/components/RequireAuth"
import AnimeCard from "@/components/AnimeCard"
import SkeletonRail from "@/components/SkeletonRail"
import ErrorState from "@/components/ErrorState"
import { API } from "@/lib/api"
import { useRouter, useSearchParams } from "next/navigation"

export const dynamic = "force-dynamic"

const GENRES = ["Anime", "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Romance", "Horror", "Sci-Fi", "Sports", "Slice of Life", "Mystery", "Supernatural", "Mecha", "Music", "Psychological", "Ecchi", "Isekai"]

export default function BrowsePage() {
  return (
    <RequireAuth>
      <BrowseInner />
    </RequireAuth>
  )
}

function BrowseInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [kind, setKind] = useState(() => (searchParams?.get("kind") === "movies" ? "movies" : "series"))
  const [sort, setSort] = useState(() => {
    const s = searchParams?.get("sort") ?? ""
    return ["Latest", "Hottest", "Rating"].includes(s) ? s : "Hottest"
  })
  const [genre, setGenre] = useState(() => searchParams?.get("genre") || "Anime")
  const [page, setPage] = useState(() => Math.max(1, parseInt(searchParams?.get("page") || "1", 10) || 1))
  const [items, setItems] = useState<any[] | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<any>(null)

  useEffect(() => {
    let alive = true
    setItems(null)
    setError(null)
    const channelId = kind === "movies" ? 1 : 2
    API.browse({ channelId, sort, genre, page, perPage: 30 })
      .then(({ data }) => {
        if (!alive) return
        const list = (data?.items || []).filter((i: any) => i.detailPath)
        setItems(list)
        setHasMore(!!data?.pager?.hasMore)
      })
      .catch((e) => alive && setError(e))
    // reflect state into the URL
    const qs = new URLSearchParams({ kind, sort, genre, page: String(page) })
    router.replace(`/browse?${qs}`, { scroll: false })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, sort, genre, page])

  return (
    <>
      <div className="row-title"><h2>Browse Anime</h2></div>
      <div className="filters" role="toolbar" aria-label="Filters">
        <div className="seg" id="kindSeg">
          <button data-kind="series" className={kind === "series" ? "active" : undefined} onClick={() => { setKind("series"); setPage(1) }}>Series</button>
          <button data-kind="movies" className={kind === "movies" ? "active" : undefined} onClick={() => { setKind("movies"); setPage(1) }}>Movies</button>
        </div>
        <div className="seg" id="sortSeg">
          <button data-sort="Latest" className={sort === "Latest" ? "active" : undefined} onClick={() => { setSort("Latest"); setPage(1) }}>Latest</button>
          <button data-sort="Hottest" className={sort === "Hottest" ? "active" : undefined} onClick={() => { setSort("Hottest"); setPage(1) }}>Popular</button>
          <button data-sort="Rating" className={sort === "Rating" ? "active" : undefined} onClick={() => { setSort("Rating"); setPage(1) }}>Top Rated</button>
        </div>
        <select className="sel" id="genreSel" aria-label="Genre" value={GETNULL(genre)} onChange={(e) => { setGenre(e.target.value); setPage(1) }}>
          {GENRES.map((g) => <option key={g} value={g}>{g === "Anime" ? "All Anime" : g}</option>)}
        </select>
      </div>
      <div className="grid" id="browseGrid">
        {error ? (
          <div style={{ gridColumn: "1/-1" }}><ErrorState error={error} /></div>
        ) : items == null ? (
          <SkeletonRail n={15} />
        ) : items.length ? (
          items.map((i) => <AnimeCard key={i.detailPath} item={i} />)
        ) : (
          <div className="state" style={{ gridColumn: "1/-1" }}><div className="big">🎌</div><h3>No results</h3><p>Try a different genre or sort.</p></div>
        )}
      </div>
      <div className="pager">
        <button id="prevPage" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹</button>
        <span id="pageLabel">Page {page}</span>
        <button id="nextPage" aria-label="Next page" disabled={!hasMore} onClick={() => setPage((p) => p + 1)}>›</button>
      </div>
    </>
  )
}

// keep the select's value controlled even if genre is stale
function GETNULL(v: string) {
  return GENRES.includes(v) ? v : "Anime"
}
