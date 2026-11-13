"use client"
// ChatWidget — floating anime assistant (backed by /api/chat → Groq free tier)
import { useEffect, useRef, useState } from "react"

type Msg = { role: "user" | "assistant"; content: string }

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hey! 👋 Ask me anything about anime — watch order, recommendations, characters, studios…" },
  ])
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, busy, open])

  const context = typeof document !== "undefined" ? document.title.replace(/ — AniVerse$/, "").trim() : ""

  const send = async () => {
    const text = input.trim()
    if (!text || busy) return
    const next = [...messages, { role: "user", content: text } as Msg]
    setMessages(next)
    setInput("")
    setBusy(true)
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(-12), context }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${j?.message || "Chat is unavailable right now."}` }])
      } else {
        setMessages((m) => [...m, { role: "assistant", content: j.reply || "…" }])
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
        {open ? "✕" : "💬"}
      </button>
      {open && (
        <div className="chat-panel" role="dialog" aria-label="AniVerse anime assistant">
          <div className="chat-head">
            <span className="chat-title">⛩️ AniVerse Chat</span>
            <span className="chat-sub">ask me about anime</span>
          </div>
          <div className="chat-body" ref={scrollRef}>
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role}`}>{m.content}</div>
            ))}
            {busy && <div className="chat-msg assistant typing"><span>●</span><span>●</span><span>●</span></div>}
          </div>
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
