// Backend integration tests — run with: pnpm test
// Set API_BASE to test another deployment (default: production alias).
import assert from "node:assert/strict"

const BASE = process.env.API_BASE || "https://aniverse-next.vercel.app/api"
const H = { "Content-Type": "application/json" }
const tag = String(Date.now()).slice(-6)

const call = async (path, body, token) => {
  const r = await fetch(BASE + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { ...H, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  return { status: r.status, body: await r.json().catch(() => ({})) }
}
const auth = (action, extra = {}, token) => call("/auth", { action, ...extra }, token)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail })
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`)
}

// --- accounts with no email: no OTP at all ---------------------------------
const username = `test${tag}`
const password = "Testpass123"
const signup = await auth("signup", { username, password })
check("signup without email", signup.status === 200 && !!signup.body.token)
const userId = signup.body.user?.id

const duplicate = await auth("signup", { username, password })
check("duplicate username rejected", duplicate.status === 409, `HTTP ${duplicate.status}`)

check("wrong password rejected", (await auth("login", { username, password: "badpass" })).status === 401)

const login = await auth("login", { username, password })
check("no-email login skips OTP", login.status === 200 && !!login.body.token && !login.body.challenge)
const token = login.body.token

const session = await call("/auth", undefined, token)
check("session resolves to the same user", session.body.user?.id === userId)

// --- sync: write, version conflict, cross-device read -----------------------
const write = await call("/sync", {
  data: { watchlist: { value: [{ detailPath: "77", title: "Test Show" }], updated: Date.now() + 60000, device: "A" } },
}, token)
check("sync write", write.status === 200 && write.body.data?.watchlist?.value?.[0]?.title === "Test Show")

const stale = await call("/sync", {
  data: { watchlist: { value: [{ detailPath: "77", title: "STALE" }], updated: 1, device: "B" } },
}, token)
check("stale write is rejected as conflict", stale.body.conflicts?.includes("watchlist"))

const deviceBLogin = await auth("login", { username, password })
const deviceBToken = deviceBLogin.body.token
let remote = { body: { data: {} } }
for (let i = 0; i < 36; i++) {
  remote = await call("/sync", undefined, deviceBToken)
  if (remote.body.data?.watchlist) break
  await sleep(5000) // Cloudflare KV value reads eventually converge across regions
}
check("cross-device sync (separate login)", remote.body.data?.watchlist?.value?.[0]?.title === "Test Show")

check("unauthenticated sync is denied", (await call("/sync")).status === 401)

// --- guests and sessions -----------------------------------------------------
const guest = await auth("guest")
check("guest gets a unique identity", guest.status === 200 && guest.body.user?.guest && guest.body.user.id.startsWith("guest_"))
check("guest data stays local", (await call("/sync", { data: {} }, guest.body.token)).status === 401)

check("logout accepted", (await auth("logout", {}, token)).status === 200)
const afterLogout = await call("/auth", undefined, token)
check("session invalid after logout", afterLogout.body.user === null && afterLogout.body.expired === true)

// --- legacy account migration keeps old credentials valid --------------------
const legacyName = `legacy${tag}`
const salt = `salt-${legacyName}`
const { createHash } = await import("node:crypto")
const hash = createHash("sha256").update(salt + "Oldpass123").digest("hex")
const migrated = await auth("migrate", { username: legacyName, salt, hash, created: Date.now() - 86400000 })
check("legacy account migrated", migrated.status === 200 && !!migrated.body.token)
const legacyLogin = await auth("login", { username: legacyName, password: "Oldpass123" })
check("old password still works after migration", legacyLogin.status === 200 && !!legacyLogin.body.token)

// --- email OTP (only when a test inbox is supplied) --------------------------
if (process.env.TEST_EMAIL) {
  const emailUser = `mail${tag}`
  const made = await auth("signup", { username: emailUser, password, email: process.env.TEST_EMAIL })
  check("signup with email", made.status === 200 && made.body.user?.email === process.env.TEST_EMAIL.toLowerCase())
  const challenged = await auth("login", { username: emailUser, password })
  check("email account requires OTP", challenged.status === 200 && !!challenged.body.challenge && !challenged.body.demoCode)
  check("bad OTP rejected", (await auth("verify", { challenge: challenged.body.challenge, code: "0000" })).status === 401)
  console.log(`MANUAL  enter the code delivered to ${process.env.TEST_EMAIL} to complete verification`)
} else {
  console.log("SKIP  email OTP delivery — set TEST_EMAIL=your@inbox to run it (requires RESEND_API_KEY on the server)")
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) process.exitCode = 1
