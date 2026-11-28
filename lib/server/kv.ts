// lib/server/kv.ts — server-only Cloudflare KV account store.
// Never import this from a client component.
const ACC = process.env.CF_ACCOUNT_ID || ""
const TOKEN = process.env.CF_API_TOKEN || ""
const NS = process.env.CF_ACCOUNTS_KV || ""
const BASE = `https://api.cloudflare.com/client/v4/accounts/${ACC}/storage/kv/namespaces/${NS}`
const KV_HEADERS = () => ({ Authorization: `Bearer ${TOKEN}` })

function ready() {
  if (!ACC || !TOKEN || !NS) throw new Error("Account backend is not configured (CF_* env vars).")
}

async function kvGet<T>(key: string): Promise<T | null> {
  ready()
  const r = await fetch(`${BASE}/values/${encodeURIComponent(key)}?t=${Date.now()}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    cache: "no-store",
  })
  if (r.status === 404) return null
  if (!r.ok) throw new Error(`KV read failed (${r.status})`)
  const text = await r.text()
  try {
    const parsed = JSON.parse(text)
    // account-name keys are stored as JSON strings; unwrap them
    return (typeof parsed === "string" ? parsed : parsed) as T
  } catch { return text as unknown as T }
}

async function kvPut(key: string, value: unknown, metadata?: Record<string, unknown>) {
  ready()
  const q = metadata ? `?metadata=${encodeURIComponent(JSON.stringify(metadata))}` : ""
  const r = await fetch(`${BASE}/values/${encodeURIComponent(key)}${q}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(value),
  })
  if (!r.ok) throw new Error(`KV write failed (${r.status})`)
}

async function kvDelRaw(key: string) {
  ready()
  await fetch(`${BASE}/values/${encodeURIComponent(key)}`, { method: "DELETE", headers: KV_HEADERS() })
}

export type Account = {
  id: string
  username: string
  salt: string
  hash: string
  created: number
  email?: string
  /** legacy SHA-256(salt+password) records migrated from old localStorage accounts */
  legacy?: boolean
}

export type Session = { userId: string; created: number; expires: number; kind: "user" | "guest" }
export type RemoteItem = { key: string; value: unknown; updated: number; device: string; deleted?: boolean }

const acctKey = (id: string) => `acct:${id}`
const nameKey = (name: string) => `name:${name.toLowerCase()}`
const sessKey = (token: string) => `sess:${token}`
const dataKey = (id: string) => `data:${id}`
// One KV entry per sync key, with its version in the name: key listings are
// strongly consistent, and pushing one key can never clobber the others.
const itemPrefix = (id: string) => `d:${id}:`
const itemKey = (id: string, key: string, updated: number) => `${itemPrefix(id)}${key}:${updated}`

// Remove every KV entry belonging to an account (auth, sessions, synced data).
export async function deleteAccountData(id: string, username: string) {
  for (const prefix of [`name:${username.toLowerCase()}:`, `${itemPrefix(id)}`, "sess:"]) {
    const r = await fetch(`${BASE}/keys?prefix=${encodeURIComponent(prefix)}`, { headers: KV_HEADERS(), cache: "no-store" })
    if (!r.ok) continue
    const j = await r.json()
    const keys: string[] = (j.result || []).map((k: any) => String(k.name)).filter((n: string) => prefix !== "sess:" || n.split(":")[2] === id)
    await Promise.all(keys.map(kvDelRaw))
  }
  await Promise.all([kvDelRaw(acctKey(id)), kvDelRaw(nameKey(username)), kvDelRaw(dataKey(id))])
}

export const Store = {
  getAccountById: async (id: string) => {
    const r = await fetch(`${BASE}/keys?prefix=name%3A`, { headers: KV_HEADERS(), cache: "no-store" })
    if (r.ok) {
      const j = await r.json()
      const key = (j.result || []).find((k: any) => String(k.name).split(":")[2] === id)
      if (key) {
        const [, username, , salt, hash, created, legacy, email] = key.name.split(":")
        return { id, username, salt, hash, created: Number(created) || Date.now(), legacy: legacy === "1", email: email ? decodeURIComponent(email) : undefined }
      }
    }
    return kvGet<Account>(acctKey(id))
  },
  // deterministic id: same username can never resolve to two different accounts
  idForName: async (name: string) => {
    const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(name.toLowerCase()))
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("")
  },
  // the KV list endpoint is strongly consistent (value GET is eventually consistent)
  idByName: async (name: string) => {
    const r = await fetch(`${BASE}/keys?prefix=${encodeURIComponent(nameKey(name))}`, { headers: KV_HEADERS(), cache: "no-store" })
    if (!r.ok) return null
    const j = await r.json()
    const match = (j.result || []).find((k: any) => k.name === nameKey(name))
    if (!match) return null
    const v = await kvGet<string>(nameKey(name))
    return typeof v === "string" && v ? v : null
  },
  getAccountByName: async (name: string) => {
    const r = await fetch(`${BASE}/keys?prefix=${encodeURIComponent(`name:${name.toLowerCase()}:`)}`, { headers: KV_HEADERS(), cache: "no-store" })
    if (r.ok) {
      const j = await r.json()
      const key = (j.result || []).find((k: any) => String(k.name).startsWith(`name:${name.toLowerCase()}:`))
      if (key) {
        const [, , id, salt, hash, created, legacy, email] = key.name.split(":")
        if (id && salt && hash) return { id, username: name, salt, hash, created: Number(created) || Date.now(), legacy: legacy === "1", email: email ? decodeURIComponent(email) : undefined }
      }
    }
    const direct = await kvGet<Account>(acctKey(await Store.idForName(name)))
    return direct || null
  },
  // account auth data encoded in the KEY NAME because KV list is strongly
  // consistent while value reads can lag up to a minute
  authKey: (a: Account) => `name:${a.username}:${a.id}:${a.salt}:${a.hash}:${a.created}:${a.legacy ? 1 : 0}:${a.email ? encodeURIComponent(a.email) : ""}`,
  putAccount: async (a: Account, previousName?: string) => {
    const listBase = `${BASE}/keys?prefix=`
    // remove any old auth keys for this username (incl. case/legacy variants)
    const r = await fetch(listBase + encodeURIComponent(`name:${a.username}:`), { headers: KV_HEADERS(), cache: "no-store" })
    if (r.ok) {
      const j = await r.json()
      await Promise.all((j.result || []).map((k: any) => kvDelRaw(k.name)))
    }
    if (previousName && previousName.toLowerCase() !== a.username) {
      const r2 = await fetch(listBase + encodeURIComponent(`name:${previousName.toLowerCase()}:`), { headers: KV_HEADERS(), cache: "no-store" })
      if (r2.ok) {
        const j2 = await r2.json()
        await Promise.all((j2.result || []).map((k: any) => kvDelRaw(k.name)))
      }
    }
    await Promise.all([
      kvPut(acctKey(a.id), a),
      kvPut(nameKey(a.username), a.id),
      kvPut(Store.authKey(a), a.id),
    ])
  },
  // session data lives in the key name for strongly-consistent reads
  sessionKey: (token: string, s: Session) => `${sessKey(token)}:${s.userId}:${s.expires}:${s.kind}:${s.created}`,
  getSession: async (token: string) => {
    const r = await fetch(`${BASE}/keys?prefix=${encodeURIComponent(sessKey(token))}`, { headers: KV_HEADERS(), cache: "no-store" })
    if (!r.ok) return null
    const j = await r.json()
    const key = (j.result || []).find((k: any) => String(k.name).startsWith(`${sessKey(token)}:`))
    if (!key) return null
    const parts = key.name.split(":")
    return { userId: parts[2], expires: Number(parts[3]) || 0, kind: parts[4] as Session["kind"], created: Number(parts[5]) || 0 }
  },
  getOtpCode: async (challenge: string) => {
    const r = await fetch(`${BASE}/keys?prefix=${encodeURIComponent(`sess:otpcode:${challenge}:`)}`, { headers: KV_HEADERS(), cache: "no-store" })
    if (!r.ok) return null
    const j = await r.json()
    const key = (j.result || [])[0]?.name
    if (!key) return null
    const parts = key.split(":")
    return { code: parts[3], expires: Number(parts[4]) || 0, created: Number(parts[5]) || 0 }
  },
  putSession: async (token: string, s: Session) => {
    await kvPut(Store.sessionKey(token, s), s)
  },
  delSession: async (token: string) => {
    const r = await fetch(`${BASE}/keys?prefix=${encodeURIComponent(sessKey(token))}`, { headers: KV_HEADERS(), cache: "no-store" })
    if (!r.ok) return
    const j = await r.json()
    await Promise.all((j.result || []).map((k: any) => kvDelRaw(k.name)))
  },
  getData: async (id: string) => {
    const r = await fetch(`${BASE}/keys?prefix=${encodeURIComponent(itemPrefix(id))}`, { headers: KV_HEADERS(), cache: "no-store" })
    if (!r.ok) return {}
    const j = await r.json()
    const keys: any[] = j.result || []
    if (!keys.length) return (await kvGet<Record<string, RemoteItem>>(dataKey(id))) || {} // pre-upgrade records
    const latest: Record<string, { name: string; updated: number }> = {}
    for (const k of keys) {
      const parts = String(k.name).split(":")
      if (parts.length < 4) continue
      const key = parts[2], updated = Number(parts[3]) || 0
      if (!latest[key] || updated > latest[key].updated) latest[key] = { name: k.name, updated }
    }
    const out: Record<string, RemoteItem> = {}
    await Promise.all(Object.entries(latest).map(async ([key, b]) => {
      const v = await kvGet<RemoteItem>(b.name)
      out[key] = v && typeof v === "object" && "value" in v ? v : { key, value: [], updated: b.updated, device: "server" }
    }))
    return out
  },
  putData: async (id: string, data: Record<string, RemoteItem>) => {
    await Promise.all(Object.entries(data).map(async ([key, item]) => {
      const prefix = `${itemPrefix(id)}${key}:`
      const r = await fetch(`${BASE}/keys?prefix=${encodeURIComponent(prefix)}`, { headers: KV_HEADERS(), cache: "no-store" })
      if (r.ok) {
        const j = await r.json()
        await Promise.all((j.result || []).map((k: any) => kvDelRaw(k.name)))
      }
      await kvPut(itemKey(id, key, Number(item.updated) || Date.now()), item)
    }))
  },
}

// PBKDF2-SHA256 via WebCrypto, 120k iterations. Passwords never stored.
export async function hashPassword(password: string, salt: string) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"])
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: 120000, hash: "SHA-256" },
    key,
    256
  )
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("")
}

export function newId() {
  return crypto.randomUUID()
}
