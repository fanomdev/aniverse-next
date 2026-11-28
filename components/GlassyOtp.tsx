"use client"
// Glassy OTP — rebuilt to match the reference preview's four-cell behaviour:
// focus lens, digit pop, caret blink, verifying spin, shake, scatter → link →
// merge → tick success, status pill, lock after 3 tries and a resend ring.
import { useEffect, useRef, useState } from "react"

type Phase = "idle" | "verifying" | "error" | "success" | "locked"
type Digit = { v: string; k: number }
const blank = (): Digit[] => [0, 1, 2, 3].map(() => ({ v: "", k: 0 }))
const OFF = [-1.5, -0.5, 0.5, 1.5]
const DIR = [{ x: -1, y: -1, g: 0 }, { x: -1, y: 1, g: 140 }, { x: 1, y: -1, g: 520 }, { x: 1, y: 1, g: 380 }]

export default function GlassyOtp({
  email,
  onVerify,
  onResend,
  onDone,
}: {
  email: string
  onVerify: (code: string) => Promise<void>
  onResend: () => Promise<void>
  onDone?: () => void
}) {
  const [digits, setDigits] = useState<Digit[]>(blank)
  const [focus, setFocus] = useState(0)
  const [phase, setPhase] = useState<Phase>("idle")
  const [stage, setStage] = useState(0)
  const [attempts, setAttempts] = useState(3)
  const [seconds, setSeconds] = useState(60)
  const [status, setStatus] = useState<{ shown: boolean; tone: string; text: string }>({ shown: false, tone: "error", text: "" })
  const refs = useRef<Array<HTMLInputElement | null>>([])
  const timers = useRef<number[]>([])
  const phaseRef = useRef<Phase>("idle")
  const digitsRef = useRef<Digit[]>(digits)
  const attemptsRef = useRef(attempts)
  const secondsRef = useRef(seconds)

  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)) }
  const put = (d: Digit[]) => { digitsRef.current = d; setDigits(d) }
  const go = (p: Phase) => { phaseRef.current = p; setPhase(p) }

  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  useEffect(() => {
    if (secondsRef.current <= 0) return
    const t = window.setInterval(() => {
      secondsRef.current = Math.max(0, secondsRef.current - 1)
      setSeconds(secondsRef.current)
    }, 1000)
    return () => clearInterval(t)
  }, [seconds > 0])

  const code = digits.map(d => d.v).join("")
  const shake = (i: number) => refs.current[i]?.animate?.(
    [{ transform: "translateX(0)" }, { transform: "translateX(-5px)" }, { transform: "translateX(4px)" }, { transform: "translateX(-2px)" }, { transform: "translateX(0)" }],
    { duration: 340, easing: "ease-out" }
  )

  const clear = (i: number) => {
    if (phaseRef.current !== "idle" || !digitsRef.current[i].v) return
    const next = digitsRef.current.slice()
    next[i] = { v: "", k: next[i].k }
    put(next)
    setStatus(s => ({ ...s, shown: false }))
  }

  const fill = (i: number, str: string) => {
    if (phaseRef.current !== "idle" || attemptsRef.current === 0) return
    const next = digitsRef.current.slice()
    let r = i
    for (const ch of str) {
      if (r >= 4) break
      next[r] = { v: ch, k: next[r].k + 1 }
      r++
    }
    put(next)
    setStatus(s => ({ ...s, shown: false }))
    if (next.every(d => d.v)) {
      refs.current[Math.min(r, 3)]?.focus()
      later(() => { void verify(next.map(d => d.v).join("")) }, 140)
    } else refs.current[r < 4 ? r : next.findIndex(d => !d.v)]?.focus()
  }

  const change = (i: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    const num = raw.replace(/\D/g, "")
    if (!raw) return clear(i)
    if (!num) return shake(i)
    const old = digitsRef.current[i].v
    if (num.length === 2 && old && num.includes(old)) return fill(i, num[0] === old ? num[1] : num[0])
    fill(num.length >= 4 ? 0 : i, num.slice(0, 4))
  }

  const keydown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const k = e.key
    if (/^\d$/.test(k)) { e.preventDefault(); fill(i, k) }
    else if (k === "Backspace") { e.preventDefault(); digitsRef.current[i].v ? clear(i) : (clear(i - 1), refs.current[Math.max(0, i - 1)]?.focus()) }
    else if (k === "Delete") { e.preventDefault(); clear(i) }
    else if (k === "ArrowLeft" || k === "ArrowRight") { e.preventDefault(); refs.current[Math.max(0, Math.min(3, i + (k === "ArrowLeft" ? -1 : 1)))]?.focus() }
    else if (k === "Home" || k === "End") { e.preventDefault(); refs.current[k === "Home" ? 0 : 3]?.focus() }
    else if (k === "Enter") { e.preventDefault(); void verify(code) }
    else if (k.length === 1) { e.preventDefault(); shake(i) }
  }

  const paste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const nums = e.clipboardData.getData("text").replace(/\D/g, "")
    if (!nums) return shake(focus)
    fill(0, nums.slice(0, 4))
  }

  async function verify(value: string) {
    if (phaseRef.current !== "idle" || value.length !== 4) return
    go("verifying"); setStage(2)
    if (document.activeElement instanceof HTMLInputElement) document.activeElement.blur()
    setStatus(s => ({ ...s, shown: false }))
    later(async () => {
      try {
        await onVerify(value)
        go("success")
        later(() => setStage(3), 120)
        later(() => setStage(4), 280)
        later(() => setStage(5), 460)
        later(() => setStage(6), 680)
        later(() => onDone?.(), 1750)
      } catch (err: any) {
        const left = attemptsRef.current - 1
        attemptsRef.current = left
        setAttempts(left)
        setStage(0)
        if (left > 0) {
          go("error")
          setStatus({ shown: true, tone: "error", text: err?.message || "That code didn't match." })
        } else {
          go("locked")
          setStatus({ shown: true, tone: "lock", text: "Too many incorrect attempts. Request a new code to continue." })
        }
        later(() => {
          put(blank())
          go("idle")
          if (left > 0) refs.current[0]?.focus()
        }, 1600)
      }
    }, 650)
  }

  async function resend() {
    try {
      await onResend()
      secondsRef.current = 60
      setSeconds(60)
      attemptsRef.current = 3
      setAttempts(3)
      put(blank())
      setStage(0)
      go("idle")
      setStatus({ shown: false, tone: "error", text: "" })
      refs.current[0]?.focus()
    } catch (err: any) {
      setStatus({ shown: true, tone: "error", text: err?.message || "Could not send a new code." })
    }
  }

  const otpClass = ["otp", `is-${phase}`, stage >= 2 && "s-x", stage >= 3 && "s-link", stage >= 4 && "s-merge", stage >= 5 && "s-tick", status.shown && "is-clearing"].filter(Boolean).join(" ")
  const badgeClass = `badge ${phase === "idle" ? "is-idle" : `is-${phase}`}`
  const btnClass = `btn btn-primary ${phase === "verifying" || phase === "success" ? "is-busy" : ""} ${phase === "success" ? "is-success" : ""} ${phase === "locked" ? "is-ready" : code.length === 4 && phase === "idle" ? "is-ready" : ""}`
  const locked = phase === "locked"

  return (
    <div className="otp-scope">
      <div className={badgeClass} aria-hidden="true">
        <span className="badge-ring" /><span className="badge-ring badge-ring--late" /><span className="badge-spin" />
        <span className="badge-ripple" /><span className="badge-ripple badge-ripple--2" /><span className="badge-ripple badge-ripple--3" />
        <span className="badge-core">
          <span className="badge-float">
            <svg className="badge-ico badge-mail" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="3.5" /><path d="m4.5 7.8 6.1 4.5a2.4 2.4 0 0 0 2.8 0l6.1-4.5" /></svg>
            <svg className="badge-ico badge-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.8" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></svg>
          </span>
          <span className="badge-dot" />
          <svg className="badge-check" viewBox="0 0 24 24" fill="none"><path d="M6.6 12.6 10.3 16.2 17.6 8.4" pathLength="1" /></svg>
        </span>
      </div>

      <div className={otpClass} role="group" aria-label="4-digit verification code">
        <div className="otp-cells" style={{ ["--n" as any]: 4 }}>
          <span className={`otp-lens${seconds >= 0 && phase === "idle" ? " is-on" : ""}`} style={{ ["--i" as any]: focus }} aria-hidden="true" />
          <span className="otp-link otp-link--a" aria-hidden="true" /><span className="otp-link otp-link--b" aria-hidden="true" /><span className="otp-node" aria-hidden="true" />
          {digits.map((d, i) => (
            <label key={i} className={`otp-cell${d.v ? " is-filled" : ""}${focus === i && phase === "idle" ? " is-focus" : ""}`} style={{ ["--i" as any]: i, ["--off" as any]: OFF[i], ["--tx" as any]: DIR[i].x, ["--ty" as any]: DIR[i].y, ["--g" as any]: `${DIR[i].g}ms` }}>
              <input ref={el => { refs.current[i] = el }} type="text" inputMode="numeric" pattern="[0-9]*" autoComplete={i === 0 ? "one-time-code" : "off"} maxLength={4} value={d.v} readOnly={phase !== "idle"} disabled={locked} aria-label={`Digit ${i + 1} of 4`} onChange={e => change(i, e)} onKeyDown={e => keydown(i, e)} onPaste={paste} onFocus={() => setFocus(i)} />
              <span className="otp-face" aria-hidden="true">{d.v ? <span className="otp-digit" key={d.k}>{d.v}</span> : <span className="otp-caret" />}</span>
            </label>
          ))}
          <span className="otp-merged" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M6.4 12.6 10.2 16.3 17.8 8.3" pathLength="1" /></svg></span>
        </div>
      </div>

      <div className={`status${status.shown ? " is-shown" : ""}`} aria-live="polite"><div className="status-inner"><p className={`status-pill tone-${status.tone}`}>{status.tone === "lock" ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4.5" y="10.5" width="15" height="10" rx="2.8" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></svg> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 7.5V13" /><path d="M12 16.5h.01" /></svg>}<span>{status.text}</span></p></div></div>

      <button type="button" className={btnClass} disabled={phase !== "idle" || (code.length !== 4 && !locked)} onClick={() => locked ? void resend() : void verify(code)}>
        <span className="btn-label">
          {phase === "success" ? <><svg className="btn-ico" viewBox="0 0 24 24" fill="none"><path d="M6.4 12.6 10.2 16.3 17.8 8.3" /></svg>Verified</>
            : phase === "verifying" ? <><span className="spinner" />Verifying…</>
            : locked ? "Send a new code"
            : "Verify code"}
        </span>
      </button>

      <div className="resend">
        {locked ? <span className="resend-note">Codes lock after 3 wrong tries to keep your account safe.</span> : <>
          <span>Didn&apos;t get a code?</span>
          <button type="button" className="link" disabled={seconds > 0} onClick={() => void resend()}>
            {seconds === 0 ? <><svg className="link-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" /><path d="M19.5 4.5v4h-4" /></svg>Resend code</>
              : <><svg className="ring" viewBox="0 0 18 18" aria-hidden="true"><circle className="ring-track" cx="9" cy="9" r="7" /><circle className="ring-bar" cx="9" cy="9" r="7" strokeDasharray={43.98} strokeDashoffset={43.98 * (1 - seconds / 60)} /></svg>Resend in <span className="tnum">0:{String(seconds).padStart(2, "0")}</span></>}
          </button>
        </>}
      </div>
      <span className="sr-only">{email ? `Code sent to ${email}` : ""}</span>
    </div>
  )
}
