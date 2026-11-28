// app/api/sync/route.ts — per-user authoritative account data (Cloudflare KV).
import { Store, type RemoteItem } from "@/lib/server/kv"

export const dynamic = "force-dynamic"
export const maxDuration = 20
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true" }
const KEYS = ["watchlist", "continue", "likes", "watched", "theme"]

function token(req: Request) {
  const h = req.headers.get("authorization")
  if (h?.startsWith("Bearer ")) return h.slice(7)
  const c = req.headers.get("cookie") || ""
  return c.split(";").map(x => x.trim()).find(x => x.startsWith("aniverse_sid="))?.split("=")[1] || null
}

// de-duplicate by stable record id so guest merges never create repeats
function dedupe(key: string, value: any) {
  if (!Array.isArray(value)) return value
  if (key === "watched") return value // object, handled by shape guard below
  const seen = new Set<string>()
  return value.filter((x: any) => {
    const k = String(x?.detailPath ?? x?.id ?? JSON.stringify(x))
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

async function sessionUser(req: Request) {
  const t = token(req)
  if (!t) return null
  const s = await Store.getSession(t)
  if (!s || s.expires < Date.now() || s.kind !== "user") return null
  return { userId: s.userId, token: t }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...CORS, "Access-Control-Allow-Headers": "content-type, authorization", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" } })
}

export async function GET(req: Request) {
  try {
    const u = await sessionUser(req)
    if (!u) return Response.json({ error: "unauthorized" }, { status: 401, headers: CORS })
    const data = await Store.getData(u.userId)
    return Response.json({ data, serverTime: Date.now() }, { headers: CORS })
  } catch (e: any) {
    return Response.json({ error: "sync_unavailable", message: e?.message }, { status: 503, headers: CORS })
  }
}

export async function POST(req: Request) {
  try {
    const u = await sessionUser(req)
    if (!u) return Response.json({ error: "unauthorized" }, { status: 401, headers: CORS })
    let body: any
    try { body = await req.json() } catch { return Response.json({ error: "bad_request" }, { status: 400, headers: CORS }) }
    const incoming: Record<string, RemoteItem> = body?.data || {}
    const force = !!body?.force
    const server = await Store.getData(u.userId)
    const result: Record<string, RemoteItem> = { ...server }
    const conflicts: string[] = []

    for (const key of KEYS) {
      const item = incoming[key]
      if (!item || typeof item !== "object") continue
      const value = dedupe(key, item.value)
      const updated = Number(item.updated) || 0
      if (updated <= 0) continue // a key never written on that device cannot replace server data
      const current = server[key]
      if (current) {
        const newer = updated > Number(current.updated || 0)
        const changed = JSON.stringify(current.value) !== JSON.stringify(value)
        const emptyCurrent = Array.isArray(current.value)
          ? current.value.length === 0
          : current.value == null || current.value === ""
        if (changed && !newer && !force && !emptyCurrent) { conflicts.push(key); continue }
      }
      result[key] = { key, value, updated: Math.max(updated, Date.now()), device: String(item.device || "web") }
    }
    await Store.putData(u.userId, result)
    return Response.json({ data: result, conflicts, serverTime: Date.now() }, { headers: CORS })
  } catch (e: any) {
    return Response.json({ error: "sync_failed", message: e?.message || "Sync unavailable." }, { status: 503, headers: CORS })
  }
}
