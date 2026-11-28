"use client"
// ThinkingState — expandable agent trace (Steps / Reasoning / Search / Coding).
// Adapted from the provided component to this app's CSS tokens (no Tailwind).
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"

const STAGES = [800, 600, 1800, 2600, 1600]

function useSequence(steps: number[]) {
  const [stage, setStage] = useState(0)
  useEffect(() => {
    if (stage >= steps.length - 1) return
    const t = setTimeout(() => setStage((s) => s + 1), steps[stage])
    return () => clearTimeout(t)
  }, [stage, steps])
  return stage
}

type Row = {
  primary: string
  secondary?: string
  mono?: boolean
  add?: number
  del?: number
  href?: string
}

const VARIANTS: Record<string, { active: string; done: string; rows: Row[]; query?: string }> = {
  Steps: {
    active: "Thinking", done: "Thought for a moment",
    rows: [
      { primary: "Reading your question" },
      { primary: "Checking anime context" },
      { primary: "Looking up details" },
      { primary: "Writing the answer" },
    ],
  },
  Reasoning: {
    active: "Thinking", done: "Thought for a moment",
    rows: [
      { primary: "Considering the show and what you asked" },
      { primary: "Picking the clearest way to explain it" },
    ],
  },
  Search: {
    active: "Searching", done: "Searched",
    query: "anime lookup",
    rows: [
      { primary: "AniList", secondary: "anilist.co", href: "https://anilist.co/" },
      { primary: "Crunchyroll", secondary: "crunchyroll.com", href: "https://www.crunchyroll.com/" },
      { primary: "MyAnimeList", secondary: "myanimelist.net", href: "https://myanimelist.net/" },
    ],
  },
  Coding: {
    active: "Running tools", done: "Ran tools",
    rows: [
      { primary: "Read", secondary: "api.ts", mono: true },
      { primary: "Edit", secondary: "ChatWidget.tsx", mono: true, add: 74, del: 41 },
      { primary: "Run", secondary: "pnpm build", mono: true },
    ],
  },
}

function Dot({ tone }: { tone: string }) {
  return (
    <span className={`ts-dot ${tone}`}>
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="12" cy="12" r="9" />
        <path d="M3.5 12h17M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </svg>
    </span>
  )
}
const TONES = ["ts-tone-a", "ts-tone-b", "ts-tone-c"]

export default function ThinkingState({
  variant = "Steps",
  onSettled,
  rows,
  active,
  done,
  icon,
}: {
  variant?: string
  onSettled?: () => void
  rows?: Row[]
  active?: string
  done?: string
  icon?: ReactNode
}) {
  const stage = useSequence(STAGES)
  const [manualExpanded, setManualExpanded] = useState<boolean | null>(null)
  const [selectedTool, setSelectedTool] = useState<string | null>(null)
  const base = VARIANTS[variant] ?? VARIANTS.Steps
  const v = { ...base, rows: rows ?? base.rows, active: active ?? base.active, done: done ?? base.done }
  const autoExpanded = stage >= 1 && stage < 4
  const expanded = manualExpanded ?? autoExpanded
  const working = stage < 3
  const visible = stage < 2 ? 0 : stage === 2 ? Math.min(2, v.rows.length) : v.rows.length
  const traceRef = useRef<HTMLDivElement>(null)
  const [lineHeight, setLineHeight] = useState(0)
  useLayoutEffect(() => {
    if (traceRef.current) setLineHeight(traceRef.current.offsetHeight)
  }, [visible, expanded, variant, stage])

  const settledRef = useRef(false)
  useEffect(() => {
    if (working || settledRef.current) return
    settledRef.current = true
    onSettled?.()
  }, [working, onSettled])

  return (
    <div key={variant} className="ts-root">
      <button type="button" aria-expanded={expanded} onClick={() => setManualExpanded((c) => !(c ?? autoExpanded))} className="ts-head">
        {icon ? (
          <span className="ts-head-icon">{icon}</span>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
          </svg>
        )}
        <span role="status" className="ts-status">
          {working ? (
            <span className="ts-working-label">{v.active}</span>
          ) : (
            <span className="ts-done-label">{v.done}</span>
          )}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="ts-chev" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0)" }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div className="ts-collapse" style={{ gridTemplateRows: expanded ? "1fr" : "0fr", opacity: expanded ? 1 : 0 }}>
        <div className="ts-clip">
          <div className="ts-trace-wrap">
            <span aria-hidden className="ts-line" style={{ height: lineHeight ? lineHeight - 2 : 0 }} />
            <div ref={traceRef} className="ts-trace">
              {v.query && (
                <div className="ts-row">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
                  <span className="ts-primary">{v.query}</span>
                </div>
              )}
              {v.rows.slice(0, visible).map((row, i) => {
                const content = (
                  <>
                    {variant === "Search" && <Dot tone={TONES[i % 3]} />}
                    {variant === "Steps" && (
                      i < visible - 1 || !working ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                      ) : (
                        <span className="ts-spinner" />
                      )
                    )}
                    <span className={`ts-primary${variant === "Reasoning" ? " ts-prose" : ""}`}>{row.primary}</span>
                    {row.secondary && <span className="ts-secondary">{row.secondary}</span>}
                    {row.add !== undefined && (
                      <span className="ts-diff"><span className="ts-add">+{row.add}</span> <span className="ts-del">−{row.del}</span></span>
                    )}
                  </>
                )
                const animation = { animation: `tsFadeUp 320ms cubic-bezier(0.23,1,0.32,1) ${i * 120}ms both` }
                if (variant === "Search") return <a key={row.primary} href={row.href} target="_blank" rel="noreferrer" className="ts-row ts-link" style={animation}>{content}</a>
                if (variant === "Coding") {
                  const selected = selectedTool === row.primary
                  return <button key={row.primary} type="button" aria-pressed={selected} onClick={() => setSelectedTool(selected ? null : row.primary)} className={`ts-row ts-btn${selected ? " selected" : ""}`} style={animation}>{content}</button>
                }
                return <div key={row.primary} className="ts-row" style={animation}>{content}</div>
              })}
              {variant === "Search" && stage >= 3 && <span className="ts-more">+7 more</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
