// lib/auth.ts — demo client-side auth (localStorage + SHA-256). Same as original vanilla app.
export interface AuthSession {
  username: string
  ts: number
}
interface StoredUser {
  display: string
  salt: string
  hash: string
  created: number
}

const AUTH_USERS = "aniverse_users"
const AUTH_SESSION = "aniverse_session"

function read<T>(k: string, fb: T): T {
  try {
    const v = JSON.parse(localStorage.getItem(k) as string)
    return v == null ? fb : v
  } catch {
    return fb
  }
}
const write = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v))
const del = (k: string) => localStorage.removeItem(k)

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("")
}

export const Auth = {
  async signup(username: string, password: string) {
    const users = read<Record<string, StoredUser>>(AUTH_USERS, {})
    if (users[username.toLowerCase()]) throw new Error("That username is taken.")
    const salt = crypto.randomUUID()
    users[username.toLowerCase()] = {
      display: username,
      salt,
      hash: await sha256(salt + password),
      created: Date.now(),
    }
    write(AUTH_USERS, users)
    return this.login(username, password)
  },
  async login(username: string, password: string) {
    const u = read<Record<string, StoredUser>>(AUTH_USERS, {})[username.toLowerCase()]
    if (!u) throw new Error("No account with that username.")
    if (u.hash !== (await sha256(u.salt + password))) throw new Error("Wrong password.")
    write(AUTH_SESSION, { username: u.display, ts: Date.now() })
    return u.display
  },
  user(): AuthSession | null {
    return read<AuthSession | null>(AUTH_SESSION, null)
  },
  memberSince(): number | null {
    const u = this.user()
    if (!u) return null
    const rec = read<Record<string, StoredUser>>(AUTH_USERS, {})[u.username.toLowerCase()]
    return rec?.created ?? null
  },
  logout() {
    del(AUTH_SESSION)
  },
}

export function nextRedirect(): string | null {
  const n = new URLSearchParams(window.location.search).get("next")
  return n && !/^https?:/i.test(n) ? n : null
}
