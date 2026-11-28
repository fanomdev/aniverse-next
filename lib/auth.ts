// lib/auth.ts — backward-compatible auth: legacy localStorage sessions stay valid,
// new accounts are server-backed (Cloudflare KV), with silent migration on next login.
import { Sync } from "./sync"

export interface AuthSession {
  username: string
  ts: number
  id?: string
  guest?: boolean
}
interface StoredUser { display: string; salt: string; hash: string; created: number }
const AUTH_USERS = "aniverse_users"
const AUTH_SESSION = "aniverse_session"
const API = process.env.NEXT_PUBLIC_API_ORIGIN || ""

const read = <T,>(k: string, fb: T): T => {
  try { const v = JSON.parse(localStorage.getItem(k) as string); return v == null ? fb : v } catch { return fb }
}
const write = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v))
const del = (k: string) => localStorage.removeItem(k)
async function sha256(text: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("")
}

async function post(action: string, extra: Record<string, unknown> = {}) {
  const res = await fetch(`${API}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(Sync.getToken() ? { Authorization: `Bearer ${Sync.getToken()}` } : {}) },
    body: JSON.stringify({ action, ...extra }),
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j?.message || j?.error || "Authentication failed.")
  return j
}

export const Auth = {
  // unchanged for existing callers: an existing session never disappears
  user(): AuthSession | null {
    const u = Sync.getUser()
    if (u) return { username: u.username || "Guest", ts: u.created || Date.now(), id: u.id, guest: u.guest }
    return read<AuthSession | null>(AUTH_SESSION, null)
  },
  memberSince(): number | null {
    const u = Sync.getUser()
    if (u) return u.created || null
    const s = this.user()
    if (!s) return null
    return read<Record<string, StoredUser>>(AUTH_USERS, {})[s.username.toLowerCase()]?.created ?? null
  },

  async signup(username: string, password: string, email?: string) {
    const wasGuest = !!Sync.getUser()?.guest
    const j = await post("signup", { username, password, ...(email ? { email } : {}) })
    // email accounts verify via code before the session is issued
    if (j.token) { this.applySession(j); await this.finishLogin(wasGuest) }
    return j.token ? { token: j.token as string, user: j.user } : { challenge: j.challenge as string, email: j.email as string, user: j.user }
  },

  async login(username: string, password: string) {
    const wasGuest = !!Sync.getUser()?.guest
    const j = await post("login", { username, password })
    // legacy local account still valid — migrate it silently (keeps all existing users)
    const legacy = read<Record<string, StoredUser>>(AUTH_USERS, {})[username.toLowerCase()]
    if (legacy && (await sha256(legacy.salt + password)) === legacy.hash) {
      await post("migrate", { username, salt: legacy.salt, hash: legacy.hash, created: legacy.created })
    }
    // no email on the account → login already returned a session; finish it here
    if (j.token) { this.applySession(j); await this.finishLogin(wasGuest) }
    return j.token ? { token: j.token as string, user: j.user } : { challenge: j.challenge as string, email: j.email as string, user: j.user }
  },

  async sendCode(username: string) { return post("sendCode", { username }) },
  async resend(challenge: string) { return post("resend", { challenge }) },
  async verify(challenge: string, code: string) {
    const wasGuest = !!Sync.getUser()?.guest
    const j = await post("verify", { challenge, code })
    this.applySession(j)
    await this.finishLogin(wasGuest)
    return j.user
  },

  // guest data is already in localStorage — push it into the real account,
  // asking first if the account already has newer records
  async finishLogin(wasGuest: boolean) {
    if (!wasGuest) { void Sync.pull(); return }
    const r: any = await Sync.flush()
    if (r?.reason === "conflict" && window.confirm(`This account already has newer ${(r.conflicts || []).join(", ")}. Replace with your guest data?`)) {
      await Sync.flush(true)
    } else if (!r?.ok && r?.reason !== "conflict") {
      void Sync.pull()
    }
  },

  async guest() {
    const j = await post("guest")
    Sync.setToken(j.token)
    Sync.setUser(j.user)
    write(AUTH_SESSION, { username: "Guest", ts: Date.now(), guest: true })
    return j.user
  },

  applySession(j: any) {
    if (j.token) Sync.setToken(j.token)
    if (j.user) {
      Sync.setUser(j.user)
      write(AUTH_SESSION, { username: j.user.username || "Guest", ts: Date.now(), id: j.user.id, guest: j.user.guest })
    }
  },

  async deleteAccount(password: string) {
    const j = await post("delete", { password })
    Sync.clearLocal()
    del(AUTH_SESSION)
    return j
  },

  logout() {
    // invalidate the server session with the token captured before the local wipe
    const t = Sync.getToken()
    void fetch(`${API}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: JSON.stringify({ action: "logout" }),
    }).catch(() => {})
    Sync.clearLocal()
    del(AUTH_SESSION)
  },

  /** migration helper for app boot: move an old local session to the backend without logout */
  async migrateLegacySession() {
    if (Sync.getToken() || Sync.getUser()) return
    const s = read<AuthSession | null>(AUTH_SESSION, null)
    if (!s) return
    const rec = read<Record<string, StoredUser>>(AUTH_USERS, {})[s.username.toLowerCase()]
    if (!rec) return // nothing to migrate — leave session as-is
    try {
      const j = await post("migrate", { username: s.username, salt: rec.salt, hash: rec.hash, created: rec.created })
      this.applySession(j)
      void Sync.pull()
    } catch { /* keep the old local session working */ }
  },
}

export function nextRedirect(): string | null {
  const n = new URLSearchParams(window.location.search).get("next")
  return n && !/^https?:/i.test(n) ? n : null
}
