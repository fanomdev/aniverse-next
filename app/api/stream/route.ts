// app/api/stream — video proxy with byte-range + redirect following + Referer injection.
// Handles both plain MP4 downloads and m3u8 playlists (rewrites segments to route through us).
export const dynamic = "force-dynamic"

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const videoUrl = url.searchParams.get("video_url")
  if (!videoUrl) return new Response("missing video_url", { status: 400 })
  if (!/^https?:\/\//i.test(videoUrl)) return new Response("bad video_url", { status: 400 })
  const ref = url.searchParams.get("ref") || new URL(videoUrl).origin

  const isPlaylist = /\.m3u8(\?|$)/i.test(videoUrl)
  const upstream = await fetchMedia(videoUrl, ref, isPlaylist ? null : (request.headers.get("range") || "bytes=0-"))
  if (!upstream) return new Response("upstream fetch failed", { status: 502 })

  const ct = upstream.headers.get("content-type") || ""
  if ((isPlaylist || /mpegurl/i.test(ct)) && upstream.status === 200) {
    const text = await upstream.text()
    const abs = (line: string) => new URL(line, videoUrl).href
    const wrap = (u: string) =>
      "/api/stream?video_url=" + encodeURIComponent(abs(u)) + "&ref=" + encodeURIComponent(ref)
    const rewritten = text
      .split("\n")
      .map((line) => {
        const t = line.trim()
        if (!t) return line
        if (t.startsWith("#")) return line.replace(/URI="([^"]+)"/g, (_, u) => `URI="${wrap(u)}"`)
        return wrap(t)
      })
      .join("\n")
    return new Response(rewritten, {
      status: 200,
      headers: { "Content-Type": "application/vnd.apple.mpegurl", "Cache-Control": "no-cache" },
    })
  }

  // passthrough of mp4/fmp4 bytes, range by range
  const dl = url.searchParams.get("dl") === "1"
  const safeName = (n: string | null) => {
    const base = String(n || "anime-episode.mp4").replace(/[^\w\- .()]/g, "_").slice(0, 80).trim() || "anime-episode.mp4"
    return /\.mp4$/i.test(base) ? base : base + ".mp4"
  }
  const outHeaders = new Headers()
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges", "cache-control"]) {
    const v = upstream.headers.get(h)
    if (v) outHeaders.set(h, v)
  }
  if (dl) outHeaders.set("Content-Disposition", `attachment; filename="${safeName(url.searchParams.get("name"))}"`)
  return new Response(upstream.body, { status: upstream.status, headers: outHeaders })
}

async function fetchMedia(
  target: string,
  ref: string,
  range: string | null,
  depth = 0
): Promise<Response | null> {
  try {
    const headers: Record<string, string> = {
      "User-Agent": UA,
      Referer: ref,
      Origin: ref,
    }
    if (range) headers["Range"] = range
    let res = await fetch(target, { headers, redirect: "manual" })
    if (res.status >= 300 && res.status < 400 && res.headers.get("location") && depth < 5) {
      const next = new URL(res.headers.get("location")!, target).href
      return fetchMedia(next, ref, range, depth + 1)
    }
    return res
  } catch {
    return null
  }
}
