"use client"
import { useEffect, useState } from "react"
import RequireAuth from "@/components/RequireAuth"
import AnimeCard from "@/components/AnimeCard"
import SkeletonRail from "@/components/SkeletonRail"
import ErrorState from "@/components/ErrorState"
import { API } from "@/lib/api"
import { useSearchParams } from "next/navigation"

export const dynamic = "force-dynamic"

export default function TrendingPage() {
  return (
    <RequireAuth>
      <TrendingInner />
    </RequireAuth>
  )
}

function TrendingInner() {
  const searchParams = useSearchParams()
  const [page, setPage] = useState(() => Math.max(0, parseInt(searchParams?.get("page") || "0", 10) || 0))
  const [items, setItems] = useState<any[] | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<any>(null)

  useEffect(() => {
    let alive = true
    setItems(null)
    setError(null)
    // frontend is 0-based (AnimeDoc style); API adds +1 internally
    API.trending(page, 30)
      .then(({ data }) => {
        if (!alive) return
        const list = (data?.items || []).filter((i: any) => i.detailPath)
        setItems(list)
        setHasMore(!!data?.pager?.hasMore)
      })
      .catch((e) => alive && setError(e))
    window.history.replaceState(null, "", page > 0 ? `/trending?page=${page}` : "/trending?page=0")
    return () => { alive = false }
  }, [page])

  return (
    <>
      <div className="row-title"><h2>🔥 Most Popular Right Now</h2></div>
      <div className="grid" id="trendGrid">
        {error ? (
          <div style={{ gridColumn: "1/-1" }}><ErrorState error={error} /></div>
        ) : items == null ? (
          <SkeletonRail n={15} />
        ) : items.length ? (
          items.map((i) => <AnimeCard key={i.detailPath} item={i} />)
        ) : (
          <div className="state" style={{ gridColumn: "1/-1" }}><div className="big">🎌</div><h3>Nothing here</h3></div>
        )}
      </div>
      <div className="pager">
        <button id="prevPage" aria-label="Previous page" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>‹</button>
        <span id="pageLabel">Page {page + 1}</span>
        <button id="nextPage" aria-label="Next page" disabled={!hasMore} onClick={() => setPage((p) => p + 1)}>›</button>
      </div>
    </>
  )
}
