// app/api/chat — AniVerse anime assistant, proxied to Google Gemini.
// GEMINI_API_KEY stays server-side; the browser only ever sees replies.
export const dynamic = "force-dynamic"

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models"
// Gemini's named versions rotate availability (404/503); the "latest"
// aliases stay current. Lite models are far less prone to 503 "high demand",
// so try those first and keep heavier ones as fallback.
const MODELS = ["gemini-flash-lite-latest", "gemini-3.5-flash-lite", "gemini-flash-latest", "gemini-3.7-flash"]
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
    .map((m: any) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: String(m.content).slice(0, MAX_MSG) }] }))
  if (!messages.length) return Response.json({ error: "bad_request" }, { status: 400 })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return Response.json(
      { error: "chat_not_configured", message: "Chat isn't configured yet — set GEMINI_API_KEY (Google AI Studio)." },
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
    let lastStatus = 502
    for (const model of MODELS) {
      const res = await fetch(`${GEMINI_URL}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: messages,
          generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
        }),
        signal: controller.signal,
      })
      if (res.status === 429) {
        return Response.json({ error: "rate_limited", message: "Gemini free tier is busy — try again in a moment." }, { status: 429, headers: { "Access-Control-Allow-Origin": "*" } })
      }
      if (!res.ok) { lastStatus = res.status; continue }
      const j = await res.json()
      const reply = j?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || "").join("").trim()
      if (reply) return Response.json({ reply }, { headers: { "Access-Control-Allow-Origin": "*" } })
      lastStatus = 502
    }
    const lastIsDemand = lastStatus === 503
    return Response.json({
      error: "upstream",
      message: lastIsDemand
        ? "Gemini is busy right now (high demand) — try again in a moment."
        : `Gemini error (${lastStatus}).`,
    }, { status: lastIsDemand ? 503 : 502, headers: { "Access-Control-Allow-Origin": "*" } })
  } catch (e: any) {
    if (e?.name === "AbortError") return Response.json({ error: "timeout", message: "Gemini timed out — try again." }, { status: 504 })
    return Response.json({ error: "network", message: "Can't reach Gemini. Check your connection." }, { status: 502 })
  } finally {
    clearTimeout(timer)
  }
}
