// app/api/chat — AniVerse anime assistant, proxied to Groq (free tier, llama-3.3-70b).
// GROQ_API_KEY stays server-side; the browser only ever sees replies.
export const dynamic = "force-dynamic"

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
const MODEL = "openai/gpt-oss-120b"
const MAX_MSG = 2000

export async function POST(req: Request) {
  let body: any = null
  try {
    body = await req.json()
  } catch {
    body = null
  }
  if (!body || !Array.isArray(body.messages)) {
    return Response.json({ error: "bad_request" }, { status: 400 })
  }
  const messages = body.messages
    .filter((m: any) => (m?.role === "user" || m?.role === "assistant") && m?.content)
    .slice(-12)
    .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, MAX_MSG) }))
  if (!messages.length) return Response.json({ error: "bad_request" }, { status: 400 })

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return Response.json(
      { error: "chat_not_configured", message: "Chat isn't configured yet — set GROQ_API_KEY (Groq console, free tier)." },
      { status: 503 }
    )
  }

  const context = String(body?.context || "").slice(0, 200).trim()
  const system =
    "You are AniVerse's anime expert. Answer questions about anime — plots, characters, " +
    "watch order, where to start, recommendations, terminology, studios, voice acting — concisely and accurately. " +
    "If you don't know, say so briefly. Keep answers under ~150 words unless asked for detail." +
    (context ? ` The user is currently looking at or watching: ${context}. Tailor answers to it when relevant.` : "")

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 25000)
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: system }, ...messages],
        temperature: 0.7,
        max_tokens: 500,
      }),
      signal: controller.signal,
    })
    if (res.status === 429) {
      return Response.json({ error: "rate_limited", message: "Groq free tier is busy — try again in a moment." }, { status: 429 })
    }
    if (!res.ok) {
      return Response.json({ error: "upstream", message: `Groq error (${res.status}).` }, { status: 502 })
    }
    const j = await res.json()
    const reply = j?.choices?.[0]?.message?.content?.trim()
    if (!reply) return Response.json({ error: "upstream", message: "Empty reply from Groq." }, { status: 502 })
    return Response.json({ reply })
  } catch (e: any) {
    if (e?.name === "AbortError") return Response.json({ error: "timeout", message: "Groq timed out — try again." }, { status: 504 })
    return Response.json({ error: "network", message: "Can't reach Groq. Check your connection." }, { status: 502 })
  } finally {
    clearTimeout(timer)
  }
}
