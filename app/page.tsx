"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Auth, nextRedirect } from "@/lib/auth"

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<"login" | "signup">("login")
  const [error, setError] = useState<string | null>(null)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (Auth.user()) router.replace(nextRedirect() || "/home")
  }, [router])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (mode === "login") await Auth.login(username.trim(), password)
      else await Auth.signup(username.trim(), password)
      router.replace(nextRedirect() || "/home")
    } catch (err: any) {
      setError(err?.message || "Something went wrong.")
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div
        className="auth-bg"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(circle at 18% 22%, rgba(255,138,0,.38), transparent 42%), radial-gradient(circle at 82% 30%, rgba(120,80,255,.35), transparent 45%), radial-gradient(circle at 50% 85%, rgba(255,60,90,.30), transparent 50%), #0e0f14",
        }}
      />
      <form className="auth-card" onSubmit={submit} autoComplete="on">
        <div className="auth-logo">
          <div className="logo-mark">▶</div>
          <div className="logo-text" style={{ fontSize: 26 }}>ANI<b>VERSE</b></div>
        </div>
        <p className="auth-tag">Every episode. Every season. One tap away.</p>

        <div className="auth-tabs" role="tablist">
          <button type="button" role="tab" className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(null) }}>
            Log In
          </button>
          <button type="button" role="tab" className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setError(null) }}>
            Sign Up
          </button>
        </div>

        {error && <div className="auth-error show" role="alert">{error}</div>}

        <div className="field">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            name="username"
            type="text"
            placeholder="otaku42"
            autoComplete="username"
            required
            minLength={3}
            maxLength={24}
            pattern="[A-Za-z0-9_\-]+"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            placeholder="At least 6 characters"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={6}
            maxLength={72}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: "100%", justifyContent: "center", height: 46, fontSize: 15 }}
          disabled={submitting}
        >
          {submitting ? "Please wait…" : mode === "login" ? "Log In" : "Create Account"}
        </button>
        <p className="auth-note">
          Demo accounts are stored locally on this device — not on a server.<br />
          Sign in to sync your watchlist &amp; progress on this phone or PC.
        </p>
      </form>
    </div>
  )
}
