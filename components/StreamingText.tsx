"use client"
// StreamingText — words resolve into view one at a time with a cursor,
// adapted from the provided component to this app's CSS tokens.
import { useEffect, useState } from "react"

const WORD_MS = 32

export default function StreamingText({
  text,
  onTick,
  onDone,
}: {
  text: string
  onTick?: () => void
  onDone?: () => void
}) {
  const words = text.split(" ")
  const [count, setCount] = useState(0)
  const done = count >= words.length

  useEffect(() => {
    if (done) {
      onDone?.()
      return
    }
    const t = setTimeout(() => {
      setCount((c) => c + 1)
      onTick?.()
    }, WORD_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, done])

  return (
    <span className="stream-text">
      {words.slice(0, count).map((w, i) => (
        <span key={i} className="stream-word" style={{ animationDelay: `${Math.min(i * 4, 240)}ms` }}>
          {w}{" "}
        </span>
      ))}
      {!done && <span className="stream-cursor" aria-hidden="true" />}
    </span>
  )
}
