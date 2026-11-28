"use client"
// ChatWidget — floating anime assistant (backed by /api/chat → Groq free tier)
import { useEffect, useRef, useState } from "react"
import { Orb } from "@yogesharc/thinking-orbs"
import StreamingText from "./StreamingText"
import ThinkingState from "./ThinkingState"
import { API_ORIGIN } from "@/lib/api"

type Msg = { role: "user" | "assistant"; content: string; stream?: boolean }

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hey! 👋 Ask me anything about anime — watch order, recommendations, characters, studios…" },
  ])
  const [followUps, setFollowUps] = useState<string[]>([])
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const scrollToEnd = () => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, busy, open])

  const context = typeof document !== "undefined" ? document.title.replace(/ — AniVerse$/, "").trim() : ""

  const send = async (override?: string) => {
    const text = (override ?? input).trim()
    if (!text || busy) return
    setFollowUps([])
    const next = [...messages, { role: "user", content: text } as Msg]
    setMessages(next)
    setInput("")
    setBusy(true)
    try {
      const res = await fetch(`${API_ORIGIN}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(-12), context }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${j?.message || "Chat is unavailable right now."}` }])
      } else {
        const reply = j.reply || "…"
        setMessages((m) => [...m, { role: "assistant", content: reply, stream: true }])
        const t = context ? context.replace(/ — AniVerse$/, "").trim() : ""
        setFollowUps(t
          ? [`Tell me more about ${t}`, `Where should I start with ${t}?`]
          : ["Recommend an anime for me", "Explain watch order"])
      }
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "⚠️ Network error — try again." }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button className="chat-fab" aria-label={open ? "Close anime chat" : "Open anime chat"} onClick={() => setOpen((v) => !v)}>
        {open ? "✕" : (
          <span className="chatbot-icon" aria-hidden="true">
            <span className="chatbot-bubble">
              <span className="chatbot_dot" />
              <span className="chatbot_dot" />
              <span className="chatbot_dot" />
            </span>
          </span>
        )}
      </button>
      {open && (
        <div className="chat-panel" role="dialog" aria-label="AniVerse anime assistant">
          <div className="chat-head">
            <span className="chat-title">⛩️ AniVerse Chat</span>
            <span className="chat-sub">ask me about anime</span>
          </div>
          <div className="chat-body" ref={scrollRef}>
            {messages.map((m, i) => (
              <div key={i} className={`chat-row ${m.role}`}>
                <div className={`chat-msg ${m.role}`}>
                  {m.role === "assistant" && m.stream
                    ? <StreamingText text={m.content} onTick={scrollToEnd} />
                    : m.content}
                </div>
              </div>
            ))}
            {busy && (
              <div className="chat-msg assistant">
                <ThinkingState
                  active="Working"
                  done="Worked for a moment"
                  rows={[
                    { primary: "Reading your question" },
                    { primary: "Checking anime context" },
                    { primary: "Composing the answer" },
                  ]}
                  icon={<Orb state="working" size={16} label="Thinking" />}
                />
              </div>
            )}
          </div>
          {followUps.length > 0 && !busy && (
            <div className="chat-follows chat-follows-bottom">
              {followUps.map((f, k) => (
                <button key={f} className="chat-follow" onClick={() => send(f)} style={{ animationDelay: `${k * 90}ms` }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 10l-5 5 5 5"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/></svg>
                  <span>{f}</span>
                </button>
              ))}
            </div>
          )}
          <form
            className="chat-input"
            onSubmit={(e) => {
              e.preventDefault()
              send()
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about any anime…"
              aria-label="Chat message"
              maxLength={2000}
            />
            <button type="submit" disabled={busy || !input.trim()} aria-label="Send">➤</button>
          </form>
        </div>
      )}
    </>
  )
}
