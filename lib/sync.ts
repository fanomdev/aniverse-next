// lib/sync.ts — localStorage cache ↔ centralized backend sync.
import { API_ORIGIN } from "./api"

const META = "aniverse_sync_meta"
const TOKEN = "aniverse_auth_token"
const USER = "aniverse_auth_user"
const QUEUE = "aniverse_sync_queue"
export const KEYS = ["watchlist", "continue", "likes", "watched", "theme"] as const
export type SyncKey = typeof KEYS[number]

type Meta = Record<string, { updated: number; device: string }>
const read = (k: string, fb: any) => { try { return JSON.parse(localStorage.getItem(k) || "") ?? fb } catch { return fb } }
const write = (k: string, v: any) => localStorage.setItem(k, JSON.stringify(v))
export const deviceId = () => {
  let d = localStorage.getItem("aniverse_device")
  if (!d) { d = crypto.randomUUID(); localStorage.setItem("aniverse_device", d) }
  return d
}

export const Sync = {
  getToken: () => localStorage.getItem(TOKEN),
  setToken: (t: string | null) => t ? localStorage.setItem(TOKEN, t) : localStorage.removeItem(TOKEN),
  getUser: () => read(USER, null),
  setUser: (u: any) => write(USER, u),
  // wipe everything tied to the signed-in user; the server copy stays untouched
  clearLocal() {
    clearTimeout(Sync.timer)
    for (const k of KEYS) localStorage.removeItem(`aniverse_${k}`)
    for (const k of [META, QUEUE, "aniverse_sync_status", USER, TOKEN]) localStorage.removeItem(k)
  },
  isGuest: () => !!Sync.getUser()?.guest,
  meta: (): Meta => read(META, {}),
  status: () => read("aniverse_sync_status", { state: "idle" }),
  setStatus: (state: string, detail?: string) => {
    write("aniverse_sync_status", { state, detail, at: Date.now() })
    if (typeof window !== "undefined") window.dispatchEvent(new Event("aniverse:sync"))
  },

  // called by storage.ts after every local write
  mark(key: SyncKey) {
    const m = Sync.meta()
    m[key] = { updated: Date.now(), device: deviceId() }
    write(META, m)
    if (!Sync.getToken() || Sync.isGuest()) return
    const q: string[] = read(QUEUE, [])
    if (!q.includes(key)) q.push(key)
    write(QUEUE, q)
    Sync.setStatus("pending")
    void Sync.flushSoon()
  },

  snapshot() {
    const m = Sync.meta()
    const data: Record<string, any> = {}
    for (const k of KEYS) {
      const raw = localStorage.getItem(`aniverse_${k}`)
      // never written here → don't send an empty placeholder that could wipe
      // the real record from another device
      if (!raw && !m[k]) continue
      let value: any
      if (raw) {
        // theme is stored as a plain string by lib/theme.ts, not JSON
        try { value = JSON.parse(raw) } catch { value = raw }
      } else value = k === "watched" ? {} : k === "theme" ? "aurora" : []
      data[k] = {
        value,
        updated: m[k]?.updated || 0,
        device: deviceId(),
      }
    }
    return data
  },

  apply(data: Record<string, any>) {
    const m = Sync.meta()
    for (const k of KEYS) {
      const item = data?.[k]
      if (!item || typeof item !== "object") continue
      const localUpdated = m[k]?.updated || 0
      if (Number(item.updated) > localUpdated) {
        // keep theme in the plain-string format lib/theme.ts expects
        localStorage.setItem(`aniverse_${k}`, k === "theme" ? String(item.value) : JSON.stringify(item.value))
        m[k] = { updated: Number(item.updated), device: item.device || "remote" }
      }
    }
    write(META, m)
  },

  timer: 0 as unknown as ReturnType<typeof setTimeout>,
  flushSoon() {
    clearTimeout(Sync.timer)
    Sync.timer = setTimeout(() => void Sync.flush(), 1500)
  },

  async flush(force = false) {
    const t = Sync.getToken()
    if (!t || Sync.isGuest()) return { ok: false, reason: "no-session" }
    if (!navigator.onLine) { Sync.setStatus("offline"); return { ok: false, reason: "offline" } }
    Sync.setStatus("syncing")
    try {
      const res = await fetch(`${API_ORIGIN}/api/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ data: Sync.snapshot(), force }),
      })
      const j = await res.json().catch(() => ({}))
      if (res.status === 401) { Sync.setStatus("expired", j.message); return { ok: false, reason: "expired", error: j } }
      if (!res.ok) throw new Error(j?.message || `HTTP ${res.status}`)
      Sync.apply(j.data || {})
      if ((j.conflicts || []).length && !force) {
        Sync.setStatus("conflict", (j.conflicts as string[]).join(", "))
        return { ok: false, reason: "conflict", conflicts: j.conflicts }
      }
      write(QUEUE, [])
      Sync.setStatus("synced")
      return { ok: true }
    } catch (e: any) {
      const offline = !navigator.onLine || /fetch|network/i.test(String(e?.message || ""))
      Sync.setStatus(offline ? "offline" : "error", e?.message)
      return { ok: false, reason: offline ? "offline" : "error", error: e }
    }
  },

  async pull() {
    const t = Sync.getToken()
    if (!t || Sync.isGuest()) return { ok: false }
    Sync.setStatus("syncing")
    try {
      const res = await fetch(`${API_ORIGIN}/api/sync`, { headers: { Authorization: `Bearer ${t}` } })
      const j = await res.json().catch(() => ({}))
      if (res.status === 401) { Sync.setStatus("expired"); return { ok: false, reason: "expired" } }
      if (!res.ok) throw new Error(j?.message || "pull failed")
      Sync.apply(j.data || {})
      Sync.setStatus("synced")
      return { ok: true }
    } catch (e: any) {
      const offline = !navigator.onLine || /fetch|network/i.test(String(e?.message || ""))
      Sync.setStatus(offline ? "offline" : "error", e?.message)
      return { ok: false, reason: offline ? "offline" : "error" }
    }
  },
}
