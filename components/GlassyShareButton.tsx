"use client"
// GlassyShareButton — animation sequence copied from the CodeXr preview:
// flying-in (720ms) → paused-green (to 1750ms) → flying-out (to 2250ms)
// → blue tick → idle (5800ms).
import { useId, useRef, useState, useEffect } from "react"

type Phase = "idle" | "flying-in" | "paused-green" | "flying-out" | "tick"

export default function GlassyShareButton({ onShare }: { onShare: () => void | Promise<void> }) {
  const [phase, setPhase] = useState<Phase>("idle")
  const timers = useRef<number[]>([])
  const gid = useId().replace(/:/g, "")
  const borderGrad = `gbShareBorder-${gid}`

  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms))

  const click = () => {
    if (phase !== "idle") return
    void onShare()
    setPhase("flying-in")
    later(() => setPhase("paused-green"), 720)
    later(() => setPhase("flying-out"), 1750)
    later(() => setPhase("tick"), 2250)
    later(() => setPhase("idle"), 5800)
  }

  const flying = phase === "flying-in" || phase === "paused-green" || phase === "flying-out"

  return (
    <span className={`gb-share${phase === "paused-green" ? " is-green" : ""}`}>
      <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
        <defs>
          <linearGradient id={borderGrad} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="15%" style={{ stopColor: "var(--gb-hi)" }} stopOpacity="0.65" />
            <stop offset="42%" stopColor="#ffffff" stopOpacity="0.30" />
            <stop offset="70%" style={{ stopColor: "var(--gb-mid)" }} stopOpacity="0.55" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.80" />
          </linearGradient>
        </defs>
      </svg>
      <span className="gb-share-chip gb-share-chip-tl" aria-hidden="true"><span className="gb-share-chip-blur" /><svg viewBox="0 0 26 26" fill="none"><path d="M 6 0 L 23 0 Q 26 0 24.8 2.8 L 2.8 24.8 Q 0 26 0 23 L 0 6 A 6 6 0 0 1 6 0 Z" stroke={`url(#${borderGrad})`} strokeWidth="1.5" vectorEffect="non-scaling-stroke" /></svg></span>
      <span className="gb-share-chip gb-share-chip-br" aria-hidden="true"><span className="gb-share-chip-blur" /><svg viewBox="0 0 26 26" fill="none"><path d="M 20 26 L 3 26 Q 0 26 1.2 23.2 L 23.2 1.2 Q 26 0 26 3 L 26 20 A 6 6 0 0 1 20 26 Z" stroke={`url(#${borderGrad})`} strokeWidth="1.5" vectorEffect="non-scaling-stroke" /></svg></span>
      <button type="button" className="gb-share-btn" onClick={click} aria-label="Share episode">
        <span className="gb-share-blur" />
        <span className="gb-share-surface" />
        <svg className="gb-share-border" viewBox="0 0 250 50" fill="none" preserveAspectRatio="none" aria-hidden="true">
          <path d="M 24 0 L 242 0 A 8 8 0 0 1 250 8 L 250 28 Q 250 30 248.4 31.6 L 231.6 48.4 Q 230 50 226 50 L 8 50 A 8 8 0 0 1 0 42 L 0 24 Q 0 22 1.6 20.4 L 20.4 1.6 Q 22 0 24 0 Z" stroke={`url(#${borderGrad})`} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="gb-share-inner">
          {phase === "idle" && <span className="gb-share-text" key="share-text">Share</span>}
          {flying && (
            <span className={`gb-paper-plane${phase === "paused-green" ? " is-green" : ""} gb-plane-${phase}`} aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M22 2 L2 9 L11 13 L22 2 Z" fill="currentColor" fillOpacity="0.85" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                <path d="M22 2 L11 13 L15 22 L22 2 Z" fill="currentColor" fillOpacity="0.45" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                <path d="M22 2 L11 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </span>
          )}
          {phase === "tick" && (
            <span className="gb-blue-tick-wrapper" aria-hidden="true">
              <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                <circle cx="13" cy="13" r="11" fill="#0284c7" fillOpacity="0.25" stroke="#38bdf8" strokeWidth="1.8" />
                <path className="gb-blue-tick-path" d="M8 13.5 L11.5 17 L18 9.5" fill="none" stroke="#38bdf8" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          )}
        </span>
      </button>
    </span>
  )
}
