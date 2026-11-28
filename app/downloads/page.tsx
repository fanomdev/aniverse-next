"use client"
import { useEffect, useMemo, useState } from "react"
import RequireAuth from "@/components/RequireAuth"
import { Downloader, type DownloadEntry } from "@/lib/downloader"
import { toast } from "@/lib/ui"
import { Converter } from "@/lib/cap-shim"

export default function DownloadsPage() {
  return (
    <RequireAuth>
      <DownloadsInner />
    </RequireAuth>
  )
}

function DownloadsInner() {
  const [items, setItems] = useState<DownloadEntry[]>([])
  const [playing, setPlaying] = useState<DownloadEntry | null>(null)
  const [uri, setUri] = useState("")
  const [loading, setLoading] = useState(true)

  const refresh = () => setItems(Downloader.list())

  useEffect(() => {
    refresh()
    setLoading(false)
  }, [])

  useEffect(() => {
    let alive = true
    if (!playing) { setUri(""); return }
    ;(async () => {
      try {
        const u = await Downloader.uri(playing)
        if (alive) setUri(Converter.toSrc(u))
      } catch {
        if (alive) setUri("")
      }
    })()
    return () => { alive = false }
  }, [playing])

  const remove = async (e: DownloadEntry) => {
    await Downloader.remove(e.id)
    if (playing?.id === e.id) setPlaying(null)
    refresh()
    toast("Deleted from downloads")
  }

  const empty = !loading && items.length === 0

  return (
    <>
      <div className="row-title"><h2>⬇ My Downloads</h2></div>
      {empty ? (
        <div className="state">
          <div className="big">💾</div>
          <h3>No downloads yet</h3>
          <p>Open any episode on the watch page and tap the ⬇ button. In the Android app, episodes are saved on your device for offline playback.</p>
        </div>
      ) : (
        <>
          {!Downloader.isNative() && (
            <p style={{ color: "var(--muted)", fontSize: 12, marginBottom: 10 }}>
              Downloads are stored on-device by the AniVerse app. On the web, use the ⬇ button on the watch page instead.
            </p>
          )}
          <div className="grid">
            {items.map((e) => (
              <div key={e.id} className="anime-card" style={{ cursor: "default" }}>
                <div className="poster" style={e.cover ? { backgroundImage: `url('${e.cover}')` } : undefined}>
                  {e.cover ? <img loading="lazy" decoding="async" src={e.cover} alt={e.title} onError={(ev) => ((ev.currentTarget as HTMLImageElement).style.opacity = "0")} /> : null}
                  <div className="card-play"><button style={{ all: "unset", cursor: "pointer" }} aria-label={`Play ${e.title} episode ${e.ep}`} onClick={() => setPlaying(e)}><span>▶</span></button></div>
                </div>
                <div className="card-body">
                  <div className="card-title">{e.title}</div>
                  <div className="card-meta"><span>{e.se === 0 ? "Movie" : `S${e.se} · E${e.ep}`}</span><span>•</span><span>{e.audio.toUpperCase()}</span><span>•</span><span>{Math.round(e.size / 1048576)} MB</span></div>
                  <div className="card-actions dl-actions"><button className="btn btn-ghost" style={{ fontSize: 11, padding: "6px 10px" }} onClick={() => setPlaying(e)}>▶ Play</button><button className="btn btn-ghost danger" style={{ fontSize: 11, padding: "6px 10px" }} onClick={() => remove(e)}>🗑 Delete</button></div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {playing && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={`Playing ${playing.title}`} onClick={() => setPlaying(null)}>
          <div className="modal-card" style={{ maxWidth: 720, padding: 14 }} onClick={(e) => e.stopPropagation()}>
            <video key={playing.id} src={uri || undefined} controls autoPlay playsInline style={{ width: "100%", borderRadius: 12, background: "#000" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, gap: 10 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{playing.title}</div>
                <div style={{ color: "var(--muted)", fontSize: 12 }}>{playing.se === 0 ? "Movie" : `S${playing.se} · E${playing.ep}`} · {playing.audio.toUpperCase()}</div>
              </div>
              <button className="btn btn-ghost" onClick={() => setPlaying(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
