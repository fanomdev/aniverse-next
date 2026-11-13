// app/api/caption — fetch .ass or .srt subtitle, return WebVTT (browsers only render <track> as VTT)
export const dynamic = "force-dynamic"

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

const pad2 = (n: number) => String(n).padStart(2, "0")
const vttTime = (h: number, m: number, s: number, ms: number) => `${pad2(h)}:${pad2(m)}:${pad2(s)}.${String(ms).padStart(3, "0")}`

// srt: 00:01:59,910 --> 00:02:00,700  →  00:01:59.910 --> 00:02:00.700
function srtToVtt(srt: string) {
  return "WEBVTT\n\n" + srt
    .replace(/\r+/g, "")
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2")
}

// ass: strip styles, keep Dialogue lines
function assToVtt(ass: string) {
  const out = ["WEBVTT", ""]
  for (const line of ass.split(/\r?\n/)) {
    if (!line.startsWith("Dialogue:")) continue
    const parts = line.slice(line.indexOf(":") + 1).trim().split(",")
    if (parts.length < 10) continue
    const s = parts[1].trim().match(/(\d+):(\d{2}):(\d{2})[.](\d+)/)
    const e = parts[2].trim().match(/(\d+):(\d{2}):(\d{2})[.](\d+)/)
    if (!s || !e) continue
    const hm = (m: RegExpMatchArray) => [+m[1], +m[2], +m[3], +m[4] * 10] as const
    // ass timing: h:mm:ss.cc  (cc = centiseconds)
    const [sh, sm, ss, sc] = hm(s)
    const [eh, em, es, ec] = hm(e)
    const text = parts
      .slice(9)
      .join(",")
      .replace(/\{[^}]*\}/g, "") // {\an8}, {\pos(…)}
      .replace(/\\N/gi, "\n")
      .replace(/\\h/gi, " ")
      .trim()
    if (!text) continue
    out.push(
      `${vttTime(sh, sm, ss, sc)} --> ${vttTime(eh, em, es, ec)}`,
      text,
      ""
    )
  }
  return out.join("\n")
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const target = url.searchParams.get("url")
  if (!target || !/^https?:\/\//i.test(target)) return new Response("bad url", { status: 400 })
  try {
    const res = await fetch(target, { headers: { "User-Agent": UA } })
    if (res.status >= 400) return new Response("subtitle fetch failed", { status: 502 })
    const body = await res.text()
    const isAss = /\[Script Info\]/i.test(body) || body.includes("Dialogue:")
    const vtt = isAss ? assToVtt(body) : /WEBVTT/.test(body) ? body : srtToVtt(body)
    return new Response(vtt, {
      headers: { "Content-Type": "text/vtt; charset=utf-8", "Cache-Control": "public, max-age=86400" },
    })
  } catch {
    return new Response("subtitle fetch failed", { status: 502 })
  }
}
