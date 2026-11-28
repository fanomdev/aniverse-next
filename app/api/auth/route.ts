// app/api/auth/route.ts — centralized account auth (Cloudflare KV), server-only.
import { Store, deleteAccountData, hashPassword, newId, type Account } from "@/lib/server/kv"
import { sendOtp, mailConfigured } from "@/lib/server/mail"

export const dynamic = "force-dynamic"
export const maxDuration = 20

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true" }
const DAY = 86400000
function token() { return [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, "0")).join("") }
function cookie(t: string) {
  return `aniverse_sid=${t}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 86400}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`
}
function clientUser(a: Account | { id: string; username: string; created: number; guest?: boolean; email?: string }) {
  return { id: a.id, username: a.username, created: (a as Account).created || Date.now(), guest: !!(a as any).guest, email: (a as Account).email || undefined }
}
function readToken(req: Request) {
  const h = req.headers.get("authorization")
  if (h?.startsWith("Bearer ")) return h.slice(7)
  const c = req.headers.get("cookie") || ""
  return c.split(";").map(x => x.trim()).find(x => x.startsWith("aniverse_sid="))?.split("=")[1] || null
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...CORS, "Access-Control-Allow-Headers": "content-type, authorization", "Access-Control-Allow-Methods": "POST, GET, OPTIONS" } })
}

export async function GET(req: Request) {
  const t = readToken(req)
  try {
    if (!t) return Response.json({ user: null }, { headers: CORS })
    const s = await Store.getSession(t)
    if (!s || s.expires < Date.now()) return Response.json({ user: null, expired: true }, { headers: CORS })
    if (s.kind === "guest") return Response.json({ user: { id: s.userId, username: "Guest", guest: true, created: s.created } }, { headers: CORS })
    const a = await Store.getAccountById(s.userId)
    if (!a) return Response.json({ user: null, expired: true }, { headers: CORS })
    return Response.json({ user: clientUser(a) }, { headers: CORS })
  } catch (e: any) {
    return Response.json({ error: e?.message || "auth unavailable" }, { status: 503, headers: CORS })
  }
}

export async function POST(req: Request) {
  let body: any
  try { body = await req.json() } catch { return Response.json({ error: "bad_request" }, { status: 400, headers: CORS }) }
  const action = String(body?.action || "")
  const username = String(body?.username || "").trim().toLowerCase()
  const password = String(body?.password || "")

  try {
    // guest identity — no credentials, local-only data
    if (action === "guest") {
      const t = token()
      const id = `guest_${newId()}`
      await Store.putSession(t, { userId: id, created: Date.now(), expires: Date.now() + DAY * 7, kind: "guest" })
      return Response.json({ user: { id, username: "Guest", guest: true, created: Date.now() }, token: t, data: {} }, { headers: { ...CORS, "Set-Cookie": cookie(t) } })
    }

    // migrate legacy localStorage accounts — keeps every existing user/session valid
    if (action === "migrate") {
      if (!username || !body.salt || !body.hash) return Response.json({ error: "bad_request" }, { status: 400, headers: CORS })
      const existing = await Store.getAccountByName(username)
      if (existing) {
        const t = token()
        await Store.putSession(t, { userId: existing.id, created: Date.now(), expires: Date.now() + DAY * 30, kind: "user" })
        return Response.json({ user: clientUser(existing), token: t }, { headers: { ...CORS, "Set-Cookie": cookie(t) } })
      }
      const a: Account = { id: await Store.idForName(username), username, salt: String(body.salt), hash: String(body.hash), created: Number(body.created) || Date.now(), legacy: true }
      await Store.putAccount(a)
      const t = token()
      await Store.putSession(t, { userId: a.id, created: Date.now(), expires: Date.now() + DAY * 30, kind: "user" })
      return Response.json({ user: clientUser(a), token: t }, { headers: { ...CORS, "Set-Cookie": cookie(t) } })
    }

    if (action === "signup") {
      if (!/^[a-z0-9_.-]{3,24}$/.test(username) || password.length < 6) return Response.json({ error: "invalid_credentials", message: "Username 3–24 chars (letters, numbers, . _ -) and password 6+ chars." }, { status: 400, headers: CORS })
      if (await Store.getAccountByName(username)) return Response.json({ error: "taken", message: "That username is taken." }, { status: 409, headers: CORS })
      const email = String(body?.email || "").trim().toLowerCase()
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "invalid_email", message: "Enter a valid email or leave it blank." }, { status: 400, headers: CORS })
      if (email && !mailConfigured()) return Response.json({ error: "email_not_configured", message: "Login codes aren't set up yet — sign up without an email." }, { status: 503, headers: CORS })
      const salt = newId()
      const a: Account = { id: await Store.idForName(username), username, salt, hash: await hashPassword(password, salt), created: Date.now(), ...(email ? { email } : {}) }
      await Store.putAccount(a)
      // email accounts must verify ownership before they get a session
      if (email) {
        const code = String(Math.floor(Math.random() * 10000)).padStart(4, "0")
        const challenge = token()
        try { await sendOtp(email, code) } catch (e: any) { return Response.json({ error: "email_failed", message: e?.message || "Could not send the code." }, { status: 502, headers: CORS }) }
        await Store.putSession(challenge, { userId: a.id, created: Date.now(), expires: Date.now() + 5 * 60000, kind: "user" })
        await Store.putSession(`otpcode:${challenge}`, { userId: code, created: Date.now(), expires: Date.now() + 5 * 60000, kind: "user" })
        return Response.json({ challenge, email, user: clientUser(a) }, { headers: CORS })
      }
      const t = token()
      await Store.putSession(t, { userId: a.id, created: Date.now(), expires: Date.now() + DAY * 30, kind: "user" })
      return Response.json({ user: clientUser(a), token: t }, { headers: { ...CORS, "Set-Cookie": cookie(t) } })
    }

    if (action === "login") {
      const a = await Store.getAccountByName(username)
      if (!a) return Response.json({ error: "not_found", message: "No account with that username." }, { status: 401, headers: CORS })
      const ok = a.legacy
        ? (await hashPassword(password, a.salt)) === a.hash || (await crypto.subtle.digest("SHA-256", new TextEncoder().encode(a.salt + password)).then(b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join(""))) === a.hash
        : (await hashPassword(password, a.salt)) === a.hash
      if (!ok) return Response.json({ error: "wrong_password", message: "Wrong password." }, { status: 401, headers: CORS })
      // silently upgrade legacy hashes once we have the plaintext — no user-visible change
      if (a.legacy) {
        a.hash = await hashPassword(password, a.salt)
        a.legacy = false
        await Store.putAccount(a)
      }
      // OTP only for accounts that have an email. No email → no OTP, log straight in.
      if (!a.email) {
        const t = token()
        await Store.putSession(t, { userId: a.id, created: Date.now(), expires: Date.now() + DAY * 30, kind: "user" })
        return Response.json({ user: clientUser(a), token: t }, { headers: { ...CORS, "Set-Cookie": cookie(t) } })
      }
      if (!mailConfigured()) return Response.json({ error: "email_not_configured", message: "Email delivery is not configured for this account." }, { status: 503, headers: CORS })
      const code = String(Math.floor(Math.random() * 10000)).padStart(4, "0")
      const challenge = token()
      try {
        await sendOtp(a.email, code)
      } catch (e: any) {
        return Response.json({ error: "email_failed", message: e?.message || "Could not send the code." }, { status: 502, headers: CORS })
      }
      await Store.putSession(challenge, { userId: a.id, created: Date.now(), expires: Date.now() + 5 * 60000, kind: "user" })
      await Store.putSession(`otpcode:${challenge}`, { userId: code, created: Date.now(), expires: Date.now() + 5 * 60000, kind: "user" })
      return Response.json({ challenge, user: clientUser(a), email: a.email }, { headers: CORS })
    }

    // explicit "log in with code" — no password needed, but only for accounts with email
    if (action === "sendCode") {
      const a = await Store.getAccountByName(username)
      if (!a) return Response.json({ error: "not_found", message: "No account with that username." }, { status: 401, headers: CORS })
      if (!a.email) return Response.json({ error: "no_email", message: "This is an offline account — no code. Use your password." }, { status: 400, headers: CORS })
      const last = await Store.getSession(`code:${username}`)
      if (last && last.created + 60000 > Date.now()) return Response.json({ error: "too_soon", message: "Wait a minute before requesting another code." }, { status: 429, headers: CORS })
      const code = String(Math.floor(Math.random() * 10000)).padStart(4, "0")
      const challenge = token()
      try { await sendOtp(a.email, code) } catch (e: any) { return Response.json({ error: "email_failed", message: e?.message || "Could not send the code." }, { status: 502, headers: CORS }) }
      await Store.putSession(`code:${username}`, { userId: a.id, created: Date.now(), expires: Date.now() + 60000, kind: "user" })
      await Store.putSession(challenge, { userId: a.id, created: Date.now(), expires: Date.now() + 5 * 60000, kind: "user" })
      await Store.putSession(`otpcode:${challenge}`, { userId: code, created: Date.now(), expires: Date.now() + 5 * 60000, kind: "user" })
      return Response.json({ challenge, email: a.email }, { headers: CORS })
    }

    if (action === "resend") {
      const challenge = String(body.challenge || "")
      const rec = await Store.getSession(challenge)
      if (!rec || rec.expires < Date.now()) return Response.json({ error: "expired", message: "This code expired. Sign in again." }, { status: 401, headers: CORS })
      const sent = await Store.getOtpCode(challenge)
      if (sent && Date.now() - sent.created < 60000) return Response.json({ error: "too_soon", message: "Wait a minute before requesting another code." }, { status: 429, headers: CORS })
      const a = await Store.getAccountById(rec.userId)
      if (!a?.email) return Response.json({ error: "no_email", message: "This account has no email on file." }, { status: 400, headers: CORS })
      const code = String(Math.floor(Math.random() * 10000)).padStart(4, "0")
      try { await sendOtp(a.email, code) } catch (e: any) { return Response.json({ error: "email_failed", message: e?.message || "Could not send the code." }, { status: 502, headers: CORS }) }
      await Store.delSession(`otpcode:${challenge}`)
      await Store.putSession(`otpcode:${challenge}`, { userId: code, created: Date.now(), expires: rec.expires, kind: "user" })
      return Response.json({ ok: true }, { headers: CORS })
    }

    if (action === "verify") {
      const challenge = String(body.challenge || "")
      const code = String(body.code || "")
      if (!/^\d{4}$/.test(code)) return Response.json({ error: "bad_code", message: "Enter the 4-digit code." }, { status: 400, headers: CORS })
      const rec = await Store.getSession(challenge)
      if (!rec || rec.expires < Date.now()) return Response.json({ error: "expired", message: "This code expired. Sign in again." }, { status: 401, headers: CORS })
      const actual = await Store.getOtpCode(challenge)
      if (!actual || actual.expires < Date.now() || actual.code !== code) return Response.json({ error: "wrong_code", message: "Wrong code. Try again." }, { status: 401, headers: CORS })
      await Store.delSession(challenge); await Store.delSession(`otpcode:${challenge}`)
      const t = token()
      await Store.putSession(t, { userId: rec.userId, created: Date.now(), expires: Date.now() + DAY * 30, kind: "user" })
      const a = await Store.getAccountById(rec.userId)
      return Response.json({ user: a ? clientUser(a) : { id: rec.userId, username: "User", created: Date.now() }, token: t }, { headers: { ...CORS, "Set-Cookie": cookie(t) } })
    }

    if (action === "delete") {
      const t = readToken(req)
      if (!t) return Response.json({ error: "unauthorized" }, { status: 401, headers: CORS })
      const s = await Store.getSession(t)
      if (!s || s.expires < Date.now() || s.kind !== "user") return Response.json({ error: "unauthorized" }, { status: 401, headers: CORS })
      const a = await Store.getAccountById(s.userId)
      if (!a) return Response.json({ error: "not_found" }, { status: 404, headers: CORS })
      const legacyHash = a.legacy ? await crypto.subtle.digest("SHA-256", new TextEncoder().encode(a.salt + password)).then(b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("")) : ""
      if ((await hashPassword(password, a.salt)) !== a.hash && legacyHash !== a.hash) return Response.json({ error: "wrong_password", message: "Wrong password." }, { status: 403, headers: CORS })
      await deleteAccountData(a.id, a.username)
      return Response.json({ ok: true }, { headers: { ...CORS, "Set-Cookie": "aniverse_sid=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax" } })
    }

    if (action === "logout") {
      const t = readToken(req)
      if (t) await Store.delSession(t)
      return Response.json({ ok: true }, { headers: { ...CORS, "Set-Cookie": "aniverse_sid=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax" } })
    }

    return Response.json({ error: "unknown_action" }, { status: 400, headers: CORS })
  } catch (e: any) {
    return Response.json({ error: "server", message: e?.message || "Auth unavailable." }, { status: 503, headers: CORS })
  }
}
