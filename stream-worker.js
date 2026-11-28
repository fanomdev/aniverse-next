// AniVerse video proxy — Cloudflare Worker. Cloudflare Workers have no bandwidth
// charges, unlike proxying video bytes through Vercel functions (/api/stream).
//
// The first 1 MB of every MP4 is cached in KV, keyed by the video's canonical
// path (the `for=` token changes per request, so it's stripped). Cold plays
// still wait on the source CDN; repeat plays start from the edge instantly.
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
const CACHE_PREFIX = "v1:first:"
const CHUNK = 1024 * 1024 // 1 MB

const safeName = (n) => {
  const base = String(n || "anime-episode.mp4").replace(/[^\w\- .()]/g, "_").slice(0, 80).trim() || "anime-episode.mp4"
  return /\.mp4$/i.test(base) ? base : base + ".mp4"
}
const rangeStart = (h) => {
  const m = /^bytes=(\d+)-(\d*)$/.exec(h || "")
  return m ? Number(m[1]) : 0
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const target = url.searchParams.get("video_url")
    if (!target) return new Response("missing video_url", { status: 400 })
    if (!/^https?:\/\//i.test(target)) return new Response("bad video_url", { status: 400 })
    const ref = url.searchParams.get("ref") || new URL(target).origin

    const isPlaylist = /\.m3u8(\?|$)/i.test(target)
    const rangeHeader = request.headers.get("range")
    const range = isPlaylist ? null : rangeHeader || "bytes=0-"
    const dl = url.searchParams.get("dl") === "1"
    const isMp4 = !isPlaylist && /\.mp4(\?|$)/i.test(target)

    // ── KV fast path: first chunk of an MP4, on a start-at-0 Range ──
    // Only engage when the player wants at least the whole cached chunk — a
    // tiny probe like `bytes=0-1` must get exactly 2 bytes, not a 1 MB body.
    const rm = /^bytes=(\d+)-(\d*)$/.exec(rangeHeader || "")
    const reqStart = rm ? Number(rm[1]) : 0
    const reqEnd = rm && rm[2] ? Number(rm[2]) : Infinity
    const wantsChunk = reqEnd >= CHUNK - 1
    if (isMp4 && !dl && reqStart === 0 && wantsChunk && env.VIDEO_CACHE) {
      const key = CACHE_PREFIX + new URL(target).pathname
      try {
        const hit = await env.VIDEO_CACHE.getWithMetadata(key, { type: "arrayBuffer" })
        if (hit?.value) {
          const total = Number(hit.metadata?.total) || hit.value.byteLength
          const end = Math.min(hit.value.byteLength - 1, reqEnd)
          const body = end + 1 === hit.value.byteLength ? hit.value : hit.value.slice(0, end + 1)
          return new Response(body, {
            status: 206,
            headers: {
              "Content-Type": "video/mp4",
              "Content-Length": String(body.byteLength),
              "Content-Range": `bytes 0-${end}/${total}`,
              "Accept-Ranges": "bytes",
              "Access-Control-Allow-Origin": "*",
              "X-Cache": "HIT",
            },
          })
        }
        // MISS — stream upstream bytes to the browser IMMEDIATELY (don't wait
        // for the full 1 MB — a slow CDN would time the player out), and fill
        // KV in the background from a tee'd copy.
        const first = await fetchMedia(target, ref, `bytes=0-${CHUNK - 1}`)
        if (first?.status === 206 && first.headers.get("content-range")) {
          const total = Number(first.headers.get("content-range").split("/")[1]) || 0
          const [toBrowser, toCache] = first.body.tee()
          ctx.waitUntil((async () => {
            try {
              const buf = await new Response(toCache).arrayBuffer()
              if (buf.byteLength) await env.VIDEO_CACHE.put(key, buf, { metadata: { total } })
            } catch {}
          })())
          return new Response(toBrowser, {
            status: 206,
            headers: {
              "Content-Type": first.headers.get("content-type") || "video/mp4",
              "Content-Range": `bytes 0-${CHUNK - 1}/${total}`,
              "Accept-Ranges": "bytes",
              "Access-Control-Allow-Origin": "*",
              "X-Cache": "MISS",
            },
          })
        }
        if (first) await first.arrayBuffer().catch(() => {}) // consume if full body came back
      } catch {
        // KV/CDN hiccup — fall through to the normal passthrough
      }
    }

    // ── normal passthrough: all other ranges, playlists, downloads ──
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
