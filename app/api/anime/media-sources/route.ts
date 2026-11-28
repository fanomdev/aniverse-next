// app/api/anime/media-sources — Kuhi stream extraction for the player.
// Talks to the local Kuhi API (ANIME_SOURCES_BASE) and normalizes for the player.
export const dynamic = "force-dynamic"
// scrapes can take a while; let Vercel wait (default cap is lower on some plans)
export const maxDuration = 60

const SOURCES_BASE = (process.env.ANIME_SOURCES_BASE || "").trim().replace(/\/+$/, "")

async function fetchJson(url: string, timeout = 15000): Promise<any> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (res.status >= 400) throw new Error(`source host HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

const qualityNum = (q?: string) => {
  const m = String(q || "").match(/(\d{3,4})/)
  return m ? Number(m[1]) : null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = Number(searchParams.get("subjectId") || searchParams.get("detailPath"))
  const ep = Math.max(1, Number(searchParams.get("ep") || 1))
  const audio = searchParams.get("audio") === "dub" ? "dub" : "sub"
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: "bad_id", message: "subjectId must be a numeric AniList id." }, { status: 400 })
  }
  if (!SOURCES_BASE) {
    return Response.json(
      { error: "streaming_not_configured", hint: "Set ANIME_SOURCES_BASE to a Kuhi stream host (see README → Playback) — e.g. http://localhost:9797" },
      { status: 503 }
    )
  }
  try {
    // animegg/reanime serve MP4 for most shows; some titles (e.g. movies like
    // Maboroshi) are HLS-only — fall back to those instead of erroring out.
    const [ag, ra, ak] = await Promise.allSettled([
      fetchJson(`${SOURCES_BASE}/anime/extract/${id}?e=${ep}&type=${audio}&provider=animegg`, 60000),
      fetchJson(`${SOURCES_BASE}/anime/extract/${id}?e=${ep}&type=${audio}&provider=reanime`, 60000),
      fetchJson(`${SOURCES_BASE}/anime/extract/${id}?e=${ep}&type=${audio}&provider=anikoto`, 8000),
    ])
    const agR = ag.status === "fulfilled" ? ag.value : null
    const raR = ra.status === "fulfilled" ? ra.value : null
    const akR = ak.status === "fulfilled" ? ak.value : null
    const mp4Of = (r: any) => (r?.streams || []).filter((s: any) => s && s.url && s.type === "mp4")
    const hlsOf = (r: any) => (r?.streams || []).filter((s: any) => s && s.url && /\.m3u8(\?|$)/i.test(String(s.url)) && /^hls$/i.test(String(s.type)))

    let streams = mp4Of(agR)
    if (!streams.length) streams = mp4Of(raR)
    const isHls = streams.length === 0
    if (isHls) streams = hlsOf(akR).concat(hlsOf(agR)).concat(hlsOf(raR))
    if (!streams.length) {
      return Response.json(
        { error: "episode_not_found", message: "No playable stream found for this episode" },
        { status: 503 }
      )
    }
    const downloads = streams
      .map((s: any) => ({
        url: s.url,
        resolution: qualityNum(s.quality),
        size: 0,
        vipLocked: false,
        isM3U8: isHls,
        referer: s.referer || SOURCES_BASE,
      }))
      // ascending: the player element #0 starts on the lowest quality
      .sort((a: any, b: any) => (a.resolution || 0) - (b.resolution || 0))
    const subList =
      raR?.subtitles && raR.subtitles.length
        ? raR.subtitles
        : (agR?.subtitles || []).length
        ? agR.subtitles
        : raR?.streams?.flatMap((s: any) => s.subtitles || []) || []
    const seen = new Set<string>()
    const captions = (subList || [])
      .filter((t: any) => t && (t.url || t.file))
      .map((t: any) => ({
        lan: t.srclang || "en",
        lanName: t.language || t.label || "Subtitles",
        url: t.url || t.file,
      }))
      .filter((t: any) => !seen.has(t.url) && seen.add(t.url))
    return Response.json({ data: { downloads, captions } }, { headers: { "Access-Control-Allow-Origin": "*" } })
  } catch (err: any) {
    const msg = err?.message || "stream extraction failed"
    return Response.json({ error: "upstream_error", message: msg }, { status: 502 })
  }
}
