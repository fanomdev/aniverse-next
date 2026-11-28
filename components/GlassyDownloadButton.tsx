"use client"
// GlassyDownloadButton — Aniverse integration of CodeXr's Glassy Buttons look:
// slanted frosted-glass card, floating corner chips, rounded border glaze,
// photon progress beam, completion flare. Wired to the existing downloader.
import { useId, useRef, useState, useEffect } from "react"

type Phase = "idle" | "downloading" | "success" | "error"

export default function GlassyDownloadButton({
  title = "Download episode",
  subtitle = "MP4 • highest available quality",
  badge = "MP4",
  doneTitle = "Download started",
  doneSubtitle = "Saved through your existing download flow",
  compact = false,
  track = true,
  className = "",
  onDownload,
}: {
  title?: string
  subtitle?: string
  badge?: string
  doneTitle?: string
  doneSubtitle?: string
  compact?: boolean
  track?: boolean
  className?: string
  onDownload: (onProgress: (pct: number) => void) => void | Promise<void>
}) {
  const [phase, setPhase] = useState<Phase>("idle")
  const [pct, setPct] = useState(0)
  const [flare, setFlare] = useState(false)
  const busy = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flareTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const gid = useId().replace(/:/g, "")
  const borderGrad = `gbDlBorder-${gid}`
  const chipGrad = `gbDlChip-${gid}`
  const okGrad = `gbDlOk-${gid}`

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); if (flareTimer.current) clearTimeout(flareTimer.current) }, [])

  const click = async () => {
    if (busy.current) return
    busy.current = true
    try {
      if (!track) { await onDownload(setPct); return }
      setPhase("downloading"); setPct(0)
      await onDownload(setPct)
      setPct(100); setPhase("success")
      setFlare(true)
      if (flareTimer.current) clearTimeout(flareTimer.current)
      flareTimer.current = setTimeout(() => setFlare(false), 900)
    } catch (e: any) {
      setPhase("error")
    } finally {
      busy.current = false
      if (track) timer.current = setTimeout(() => { setPhase("idle"); setPct(0) }, 3200)
    }
  }

  const done = phase === "success"
  const loading = phase === "downloading"
  const error = phase === "error"
  const ring = 2 * Math.PI * 14
  const label = error ? "Download failed" : done ? doneTitle : loading ? `Preparing… ${pct}%` : title
  const sub = error ? "Tap to try again" : done ? doneSubtitle : loading ? "Getting your episode ready" : subtitle
  const pill = error ? "RETRY" : done ? "READY ✓" : loading ? `${pct}%` : badge

  return (
    <span className={`gb-dl${compact ? " gb-dl-compact" : ""}${loading ? " is-downloading" : ""}${done ? " is-success" : ""}${error ? " is-error" : ""} ${className}`}>
      <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
        <defs>
          <linearGradient id={borderGrad} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="15%" style={{ stopColor: "var(--gb-hi)" }} stopOpacity="0.65" />
            <stop offset="42%" stopColor="#ffffff" stopOpacity="0.30" />
            <stop offset="70%" style={{ stopColor: "var(--gb-mid)" }} stopOpacity="0.55" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.80" />
          </linearGradient>
          <linearGradient id={chipGrad} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.90" />
            <stop offset="50%" stopColor="#f0ca7b" stopOpacity="0.60" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.40" />
          </linearGradient>
          <linearGradient id={okGrad} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="35%" stopColor="#34d399" stopOpacity="0.85" />
            <stop offset="70%" stopColor="#10b981" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#059669" stopOpacity="0.85" />
          </linearGradient>
        </defs>
      </svg>
      <span className="gb-dl-chip gb-dl-chip-tl" aria-hidden="true"><span className="gb-dl-chip-blur" /><svg viewBox="0 0 34 34" fill="none"><path d="M 8 0 L 30 0 Q 34 0 32.5 3.5 L 3.5 32.5 Q 0 34 0 30 L 0 8 A 8 8 0 0 1 8 0 Z" stroke={`url(#${done ? okGrad : chipGrad})`} strokeWidth="1.5" vectorEffect="non-scaling-stroke" /></svg></span>
      <span className="gb-dl-chip gb-dl-chip-br" aria-hidden="true"><span className="gb-dl-chip-blur" /><svg viewBox="0 0 34 34" fill="none"><path d="M 26 34 L 4 34 Q 0 34 1.5 30.5 L 30.5 1.5 Q 34 0 34 4 L 34 26 A 8 8 0 0 1 26 34 Z" stroke={`url(#${done ? okGrad : chipGrad})`} strokeWidth="1.5" vectorEffect="non-scaling-stroke" /></svg></span>

      <button type="button" className="gb-dl-btn" onClick={() => void click()} aria-label={label}>
        <span className="gb-dl-blur" />
        <span className="gb-dl-surface" />
        {loading && <span className="gb-dl-progress" style={{ width: `${pct}%` }}><span className="gb-dl-spark" /></span>}
        <svg className="gb-dl-border" viewBox="0 0 350 68" fill="none" preserveAspectRatio="none" aria-hidden="true">
          <path d="M 32 0 L 341 0 A 9 9 0 0 1 350 9 L 350 38 Q 350 41 347.8 43.2 L 324.8 66.2 Q 322.6 68 318 68 L 9 68 A 9 9 0 0 1 0 59 L 0 30 Q 0 27 2.2 24.8 L 25.2 1.8 Q 27.4 0 32 0 Z" stroke={`url(#${done ? okGrad : error ? chipGrad : borderGrad})`} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="gb-dl-content">
          <span className="gb-dl-icon">
            {done ? (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
            ) : error ? (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 8v5" /><path d="M12 17h.01" /><circle cx="12" cy="12" r="9" /></svg>
            ) : loading ? (
              <><svg className="gb-dl-circle" viewBox="0 0 40 40"><circle className="gb-dl-circle-bg" cx="20" cy="20" r="14" strokeWidth="2.5" fill="none" /><circle className="gb-dl-circle-bar" cx="20" cy="20" r="14" strokeWidth="2.5" fill="none" strokeDasharray={ring} strokeDashoffset={ring - (pct / 100) * ring} strokeLinecap="round" /></svg><svg className="gb-dl-arrow" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v12m0 0 5-5m-5 5-5-5" /></svg></>
            ) : (
              <svg className="gb-dl-icon-idle" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V3" /><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /></svg>
            )}
          </span>
          <span className="gb-dl-text"><span className="gb-dl-title">{label}</span><span className="gb-dl-sub">{sub}</span></span>
          <span className="gb-dl-pill">{pill}</span>
        </span>
      </button>
      {flare && (
        <span className="gb-complete-flare" aria-hidden="true">
          <span className="gb-flare-shockwave" />
          <span className="gb-flare-starburst" />
          <span className="gb-flare-ray" />
          <span className="gb-flare-ray-alt" />
        </span>
      )}
    </span>
  )
}
