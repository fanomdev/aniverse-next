"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Auth, nextRedirect } from "@/lib/auth"
import { Sync } from "@/lib/sync"
import GlassyOtp from "@/components/GlassyOtp"
import ThemeFlow from "@/components/ThemeFlow"

type Step = "auth" | "otp" | "success"

export default function LoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("auth")
  const [mode, setMode] = useState<"login" | "signup">("login")
  const [error, setError] = useState<string | null>(null)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [email, setEmail] = useState("")
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [challenge, setChallenge] = useState("")
  const [sentTo, setSentTo] = useState("")
  const [otpPurpose, setOtpPurpose] = useState<"login" | "signup">("login")

  useEffect(() => {
    void Auth.migrateLegacySession()
    // guests can open the login screen from the nav bar without being bounced back
    const forced = new URLSearchParams(window.location.search).get("login") === "1"
    if (!forced && Auth.user()) router.replace(nextRedirect() || "/home")
    const onOnline = () => void Sync.flush()
    window.addEventListener("online", onOnline)
    return () => window.removeEventListener("online", onOnline)
  }, [router])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null); setBusy(true)
    try {
      if (mode === "signup") {
        const res: any = await Auth.signup(username.trim(), password, email.trim())
        if (res?.challenge) {
          setChallenge(res.challenge)
          setSentTo(res.email || email.trim())
          setOtpPurpose("signup")
          setStep("otp")
          return
        }
        setStep("success")
        setTimeout(() => router.replace(nextRedirect() || "/home"), 900)
        return
      }
      const res: any = await Auth.login(username.trim(), password)
      if (res?.challenge) {
        setChallenge(res.challenge)
        setSentTo(res.email || email.trim())
        setOtpPurpose("login")
        setStep("otp")
        return
      }
      setStep("success")
      setTimeout(() => router.replace(nextRedirect() || "/home"), 900)
    } catch (err: any) {
      setError(err?.message || "Something went wrong.")
    } finally { setBusy(false) }
  }

  const guest = async () => {
    setBusy(true); setError(null)
    try {
      await Auth.guest()
      router.replace(nextRedirect() || "/home")
    } catch (err: any) { setError(err?.message || "Guest access failed.") }
    finally { setBusy(false) }
  }

  const codeLogin = async () => {
    if (!username.trim()) { setError("Enter your username first."); return }
    setBusy(true); setError(null)
    try {
      const res: any = await Auth.sendCode(username.trim())
      setChallenge(res.challenge)
      setSentTo(res.email)
      setOtpPurpose("login")
      setStep("otp")
    } catch (err: any) { setError(err?.message || "Could not send a code.") }
    finally { setBusy(false) }
  }

  const badge = (
    <div className="g-badge" aria-hidden="true">
      <span className="g-badge-ring" />
      <div className="g-badge-core">
        {step === "success" ? (
          <svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg>
        ) : step === "otp" ? (
          <svg viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
        ) : (
          <svg viewBox="0 0 24 24"><path d="M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10" /></svg>
        )}
      </div>
    </div>
  )

  return (
    <div className="auth-page">
      <ThemeFlow variant="nebula" />
      <div className="auth-bg" aria-hidden="true" />
      <div className="glass-card" onMouseMove={(e) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
        e.currentTarget.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`)
        e.currentTarget.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`)
      }}>
        {step !== "otp" && badge}

        {step === "auth" && (
          <div className="g-view">
            <div className="auth-logo" style={{ justifyContent: "center" }}>
              <div className="logo-text" style={{ fontSize: 24 }}>ANI<b>VERSE</b></div>
            </div>
            <h1 className="g-title">Welcome back</h1>
            <p className="g-lede">Every episode. Every season. One tap away.</p>
            <div className="auth-tabs" role="tablist" style={{ marginTop: 18 }}>
              <button type="button" role="tab" className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(null) }}>Log In</button>
              <button type="button" role="tab" className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setError(null) }}>Sign Up</button>
            </div>
            {error && <div className="g-error" role="alert">{error}</div>}
            <form onSubmit={submit} autoComplete="on">
              <div className="g-field">
                <label htmlFor="username">Username</label>
                <input id="username" name="username" type="text" placeholder="otaku42" autoComplete="username" required minLength={3} maxLength={24} pattern="[A-Za-z0-9_.-]+" value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              {mode === "signup" && (
                <div className="g-field">
                  <label htmlFor="email">Email <span style={{ textTransform: "none", fontWeight: 500 }}>(optional)</span></label>
                  <input id="email" name="email" type="email" placeholder="you@example.com" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  <small className="g-hint">With email: 2-step verification code at signup and login. Leave blank: offline account, no codes ever.</small>
                </div>
              )}
              <div className="g-field" style={{ position: "relative" }}>
                <label htmlFor="password">Password</label>
                <input id="password" name="password" type={show ? "text" : "password"} placeholder="At least 6 characters" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={6} maxLength={72} value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" className="g-hide" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"}>{show ? "Hide" : "Show"}</button>
              </div>
              <button className="g-btn g-host" type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Log In" : "Create Account"}</button>
            </form>
            {mode === "login" && <button className="g-link" type="button" onClick={() => void codeLogin()} disabled={busy} style={{ marginTop: 12 }}>Log in with a code instead →</button>}
            <button className="g-guest" type="button" onClick={guest} disabled={busy}>Continue as Guest →</button>
            <p className="auth-note">Your list and progress sync to your account across devices.</p>
          </div>
        )}

        {step === "otp" && (
          <div className="g-view">
            <h1 className="g-title">{otpPurpose === "signup" ? "Verify your email" : "Check your inbox"}</h1>
            <p className="g-lede">Enter the 4-digit code we sent to <span className="email-chip">{sentTo}</span></p>
            <GlassyOtp email={sentTo} onVerify={(code) => Auth.verify(challenge, code)} onResend={() => Auth.resend(challenge)} onDone={() => { setStep("success"); setTimeout(() => router.replace(nextRedirect() || "/home"), 600) }} />
            <button className="g-link" type="button" onClick={() => { setStep("auth"); setError(null) }}>← Back</button>
          </div>
        )}

        {step === "success" && (
          <div className="g-view" style={{ padding: "12px 0" }}>
            <h1 className="g-title">You&apos;re in</h1>
            <p className="g-lede">Syncing your library…</p>
          </div>
        )}
      </div>
    </div>
  )
}
