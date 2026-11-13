// AniVerse video proxy — Cloudflare Worker. Cloudflare Workers have no bandwidth
// charges, unlike proxying video bytes through Vercel functions (/api/stream).
//
// Deploy (2 min, free, no card):
//   dash.cloudflare.com → Workers & Pages → Create Worker → paste this file → Deploy
//   → Settings → copy the *.workers.dev URL
//   → Vercel: add env NEXT_PUBLIC_STREAM_PROXY = https://<worker>.workers.dev → redeploy
//
// Contract (same as /api/stream):
//   GET /?video_url=<mp4|m3u8>&ref=<referer>
//   - mp4 (and DASH/fMP4): passthrough with Range support, status/headers preserved
//   - m3u8: playlist returned with every segment/variant URL rewritten to point back here
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
// dl=1 turns the response into a file download with a filename
const safeName = (n) => {
  const base = String(n || "anime-episode.mp4").replace(/[^\w\- .()]/g, "_").slice(0, 80).trim() || "anime-episode.mp4"
  return /\.mp4$/i.test(base) ? base : base + ".mp4"
}

export default {
  async fetch(request) {
    const url = new URL(request.url)
    const target = url.searchParams.get("video_url")
    if (!target) return new Response("missing video_url", { status: 400 })
    if (!/^https?:\/\//i.test(target)) return new Response("bad video_url", { status: 400 })
    const ref = url.searchParams.get("ref") || new URL(target).origin

    const isPlaylist = /\.m3u8(\?|$)/i.test(target)
    const range = isPlaylist ? null : request.headers.get("range") || "bytes=0-"
    const upstream = await fetchMedia(target, ref, range)
    if (!upstream) return new Response("upstream fetch failed", { status: 502 })

    const ct = upstream.headers.get("content-type") || ""
    if ((isPlaylist || /mpegurl/i.test(ct)) && upstream.status === 200) {
      const text = await upstream.text()
      const abs = (line) => new URL(line, target).href
      const wrap = (u) => `${url.origin}/?video_url=${encodeURIComponent(abs(u))}&ref=${encodeURIComponent(ref)}`
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
        headers: { "Content-Type": "application/vnd.apple.mpegurl", "Cache-Control": "no-cache", "Access-Control-Allow-Origin": "*" },
      })
    }

    const dl = url.searchParams.get("dl") === "1"
    const name = safeName(url.searchParams.get("name"))
    const out = new Headers()
    for (const h of ["content-type", "content-length", "content-range", "accept-ranges", "cache-control"]) {
      const v = upstream.headers.get(h)
      if (v) out.set(h, v)
    }
    if (dl) out.set("Content-Disposition", `attachment; filename="${name}"`)
    out.set("Access-Control-Allow-Origin", "*")
    return new Response(upstream.body, { status: upstream.status, headers: out })
  },
}

async function fetchMedia(target, ref, range, depth = 0) {
  try {
    const headers = { "User-Agent": UA, Referer: ref, Origin: ref }
    if (range) headers.Range = range
    const res = await fetch(target, { headers, redirect: "manual" })
    if (res.status >= 300 && res.status < 400 && res.headers.get("location") && depth < 5) {
      const next = new URL(res.headers.get("location"), target).href
      return fetchMedia(next, ref, range, depth + 1)
    }
    return res
  } catch {
    return null
  }
}
