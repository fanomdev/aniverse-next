"use client"
import { useEffect, useState } from "react"
import RequireAuth from "@/components/RequireAuth"
import AnimeCard from "@/components/AnimeCard"
import SkeletonRail from "@/components/SkeletonRail"
import ErrorState from "@/components/ErrorState"
import { API } from "@/lib/api"
import { useSearchParams } from "next/navigation"

export const dynamic = "force-dynamic"

export default function SearchPage() {
  return (
    <RequireAuth>
      <SearchInner />
    </RequireAuth>
  )
}

function SearchInner() {
  const searchParams = useSearchParams()
  const q = (searchParams?.get("q") || "").trim()
  const [items, setItems] = useState<any[] | null>(null)
  const [total, setTotal] = useState<number | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(1)
  const [error, setError] = useState<any>(null)

  useEffect(() => {
    if (!q) return
    let alive = true
    setItems(null)
    setError(null)
    API.search(q, { page, perPage: 24 })
      .then(({ data }) => {
        if (!alive) return
        const list = (data?.items || []).filter((i: any) => i.detailPath)
        setItems(list)
        setTotal(data?.pager?.totalCount || null)
        setHasMore(!!data?.pager?.hasMore)
      })
      .catch((e) => alive && setError(e))
    window.scrollTo({ top: 0 })
    return () => { alive = false }
  }, [q, page])

  useEffect(() => { setPage(1) }, [q])

  return (
    <>
      <div className="row-title"><h2 id="searchHeading">{q ? `Results for “${q}”${total ? ` · ${total} found` : ""}` : "Type something in the search bar ↑"}</h2></div>
      {!q ? (
        <div className="state"><p style={{ color: "var(--muted)" }}>Search any anime by title above ↑</p></div>
      ) : (
        <>
          <div className="grid" id="searchGrid">
            {error ? (
              <div style={{ gridColumn: "1/-1" }}><ErrorState error={error} /></div>
            ) : items == null ? (
              <SkeletonRail n={12} />
            ) : items.length ? (
              items.map((i) => <AnimeCard key={i.detailPath} item={i} />)
            ) : (
              <div className="state" style={{ gridColumn: "1/-1" }}><div className="big">🔍</div><h3>No results for “{q}”</h3><p>Check the spelling or try a shorter keyword.</p></div>
            )}
          </div>
          <div className="pager">
            <button id="prevPage" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹</button>
            <span id="pageLabel">Page {page}</span>
            <button id="nextPage" aria-label="Next page" disabled={!hasMore} onClick={() => setPage((p) => p + 1)}>›</button>
          </div>
        </>
      )}
    </>
  )
}
